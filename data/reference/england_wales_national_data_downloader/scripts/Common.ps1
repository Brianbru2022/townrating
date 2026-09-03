$ErrorActionPreference = "Stop"
$script:PackageRoot = Split-Path -Parent $PSScriptRoot

function Get-PackageRoot {
    return $script:PackageRoot
}

function Ensure-Directory {
    param([Parameter(Mandatory=$true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Convert-ToSafeName {
    param([Parameter(Mandatory=$true)][string]$Text)
    $name = $Text.ToLowerInvariant()
    $name = $name -replace '[^a-z0-9]+', '_'
    $name = $name.Trim('_')
    if ([string]::IsNullOrWhiteSpace($name)) { return 'layer' }
    return $name
}

function Invoke-CurlDownload {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [Parameter(Mandatory=$true)][string]$Destination,
        [switch]$Force
    )

    Ensure-Directory (Split-Path -Parent $Destination)
    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
        Write-Host "Skipping existing file: $Destination"
        return
    }

    $temporary = "$Destination.partial"
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }

    Write-Host "Downloading: $Url"
    & curl.exe -L --fail --retry 4 --retry-delay 3 --connect-timeout 30 -o $temporary $Url
    if ($LASTEXITCODE -ne 0) {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        throw "curl.exe failed with exit code $LASTEXITCODE for $Url"
    }
    Move-Item -LiteralPath $temporary -Destination $Destination -Force
}

function Save-JsonFile {
    param(
        [Parameter(Mandatory=$true)]$Object,
        [Parameter(Mandatory=$true)][string]$Path,
        [int]$Depth = 20
    )
    Ensure-Directory (Split-Path -Parent $Path)
    $Object | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Find-ArcGisFeatureService {
    param(
        [Parameter(Mandatory=$true)][string]$Query,
        [string]$TitleRegex = ''
    )

    $encoded = [uri]::EscapeDataString($Query)
    $url = "https://www.arcgis.com/sharing/rest/search?f=json&num=100&sortField=modified&sortOrder=desc&q=$encoded"
    $result = Invoke-RestMethod -Uri $url -Method Get
    if (-not $result.results) { return $null }

    $candidates = @($result.results | Where-Object { $_.type -eq 'Feature Service' -and $_.url })
    if ($TitleRegex) {
        $matched = @($candidates | Where-Object { $_.title -match $TitleRegex })
        if ($matched.Count -gt 0) { return $matched[0] }
    }
    if ($candidates.Count -gt 0) { return $candidates[0] }
    return $null
}

function Download-ArcGisLayerPaged {
    param(
        [Parameter(Mandatory=$true)][string]$LayerUrl,
        [Parameter(Mandatory=$true)][string]$DestinationFolder,
        [switch]$Force,
        [int]$PreferredPageSize = 5000
    )

    Ensure-Directory $DestinationFolder
    if ($Force) { Get-ChildItem -LiteralPath $DestinationFolder -Filter 'part_*.geojson' -ErrorAction SilentlyContinue | Remove-Item -Force }
    $info = Invoke-RestMethod -Uri "${LayerUrl}?f=json" -Method Get
    if ($info.error) { throw "ArcGIS layer error: $($info.error.message)" }
    Save-JsonFile -Object $info -Path (Join-Path $DestinationFolder '_layer_info.json')

    $countResult = Invoke-RestMethod -Uri "${LayerUrl}/query?where=1%3D1&returnCountOnly=true&f=json" -Method Get
    $total = [int64]$countResult.count
    $maxCount = $PreferredPageSize
    if ($info.maxRecordCount -and [int]$info.maxRecordCount -lt $maxCount) {
        $maxCount = [int]$info.maxRecordCount
    }
    if ($maxCount -lt 1) { $maxCount = 1000 }

    $oidField = $info.objectIdField
    if (-not $oidField -and $info.fields) {
        $oidCandidate = @($info.fields | Where-Object { $_.type -eq 'esriFieldTypeOID' })
        if ($oidCandidate.Count -gt 0) { $oidField = $oidCandidate[0].name }
    }

    Write-Host "Layer: $($info.name) — $total records"
    if ($total -eq 0) { return 0 }

    $page = 1
    $offset = 0
    while ($offset -lt $total) {
        $filename = 'part_{0:D4}.geojson' -f $page
        $destination = Join-Path $DestinationFolder $filename
        $queryParts = @(
            'where=1%3D1',
            'outFields=%2A',
            'returnGeometry=true',
            'outSR=4326',
            "resultOffset=$offset",
            "resultRecordCount=$maxCount",
            'f=geojson'
        )
        if ($oidField) {
            $queryParts += ('orderByFields=' + [uri]::EscapeDataString("$oidField ASC"))
        }
        $url = "${LayerUrl}/query?" + ($queryParts -join '&')
        Invoke-CurlDownload -Url $url -Destination $destination -Force:$Force
        $offset += $maxCount
        $page++
    }
    return $total
}

function Download-ArcGisService {
    param(
        [Parameter(Mandatory=$true)][string]$ServiceUrl,
        [Parameter(Mandatory=$true)][string]$DestinationFolder,
        [switch]$Force,
        [string]$SourceTitle = ''
    )

    Ensure-Directory $DestinationFolder
    $service = Invoke-RestMethod -Uri "${ServiceUrl}?f=json" -Method Get
    if ($service.error) { throw "ArcGIS service error: $($service.error.message)" }
    Save-JsonFile -Object $service -Path (Join-Path $DestinationFolder '_service_info.json')

    $rows = @()
    $layers = @()
    if ($service.layers) { $layers += @($service.layers) }
    if ($service.tables) { $layers += @($service.tables) }

    foreach ($layer in $layers) {
        $safeName = Convert-ToSafeName $layer.name
        $folder = Join-Path $DestinationFolder ('{0:D2}_{1}' -f [int]$layer.id, $safeName)
        try {
            $count = Download-ArcGisLayerPaged -LayerUrl "${ServiceUrl}/$($layer.id)" -DestinationFolder $folder -Force:$Force
            $rows += [pscustomobject]@{
                source = $SourceTitle
                service_url = $ServiceUrl
                layer_id = $layer.id
                layer_name = $layer.name
                records = $count
                status = 'downloaded'
                folder = $folder
            }
        }
        catch {
            Write-Warning "Could not download layer $($layer.name): $($_.Exception.Message)"
            $rows += [pscustomobject]@{
                source = $SourceTitle
                service_url = $ServiceUrl
                layer_id = $layer.id
                layer_name = $layer.name
                records = ''
                status = 'failed'
                folder = $folder
            }
        }
    }

    if ($rows.Count -gt 0) {
        $rows | Export-Csv -LiteralPath (Join-Path $DestinationFolder '_download_manifest.csv') -NoTypeInformation -Encoding UTF8
    }
    return $rows
}

function Get-WfsTypeNames {
    param([Parameter(Mandatory=$true)][string]$BaseUrl)
    $url = "${BaseUrl}?service=WFS&version=2.0.0&request=GetCapabilities"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    [xml]$xml = $response.Content
    $nodes = $xml.SelectNodes("//*[local-name()='FeatureType']/*[local-name()='Name']")
    return @($nodes | ForEach-Object { $_.'#text' } | Where-Object { $_ } | Sort-Object -Unique)
}

function Get-WfsFeatureCount {
    param(
        [Parameter(Mandatory=$true)][string]$BaseUrl,
        [Parameter(Mandatory=$true)][string]$TypeName
    )
    $encodedType = [uri]::EscapeDataString($TypeName)
    $url = "${BaseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=$encodedType&resultType=hits"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    [xml]$xml = $response.Content
    $root = $xml.DocumentElement
    $value = $root.GetAttribute('numberMatched')
    if (-not $value) { $value = $root.GetAttribute('numberOfFeatures') }
    if ($value -match '^\d+$') { return [int64]$value }
    return -1
}

function Download-WfsLayerPaged {
    param(
        [Parameter(Mandatory=$true)][string]$BaseUrl,
        [Parameter(Mandatory=$true)][string]$TypeName,
        [Parameter(Mandatory=$true)][string]$DestinationFolder,
        [switch]$Force,
        [int]$PageSize = 5000
    )

    Ensure-Directory $DestinationFolder
    if ($Force) { Get-ChildItem -LiteralPath $DestinationFolder -Filter 'part_*.geojson' -ErrorAction SilentlyContinue | Remove-Item -Force }
    $metadata = [ordered]@{
        type_name = $TypeName
        source = $BaseUrl
        downloaded_utc = (Get-Date).ToUniversalTime().ToString('o')
        page_size = $PageSize
    }

    $count = Get-WfsFeatureCount -BaseUrl $BaseUrl -TypeName $TypeName
    $metadata.number_matched = $count
    Save-JsonFile -Object $metadata -Path (Join-Path $DestinationFolder '_metadata.json')
    Write-Host "WFS layer: $TypeName — reported count: $count"

    $encodedType = [uri]::EscapeDataString($TypeName)
    $page = 1
    $startIndex = 0
    $continue = $true

    while ($continue) {
        $destination = Join-Path $DestinationFolder ('part_{0:D4}.geojson' -f $page)
        $url = "${BaseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=$encodedType&outputFormat=application%2Fjson&srsName=EPSG%3A4326&startIndex=$startIndex&count=$PageSize"
        Invoke-CurlDownload -Url $url -Destination $destination -Force:$Force

        $featuresThisPage = -1
        try {
            $json = Get-Content -LiteralPath $destination -Raw | ConvertFrom-Json
            if ($json.features) { $featuresThisPage = @($json.features).Count } else { $featuresThisPage = 0 }
        }
        catch {
            $preview = (Get-Content -LiteralPath $destination -TotalCount 5) -join ' '
            throw "The WFS response was not valid GeoJSON. First lines: $preview"
        }

        if ($count -ge 0) {
            $startIndex += $PageSize
            $continue = ($startIndex -lt $count)
        }
        else {
            $startIndex += $PageSize
            $continue = ($featuresThisPage -eq $PageSize)
        }
        $page++
    }

    return $count
}

function Download-WfsMatches {
    param(
        [Parameter(Mandatory=$true)][string]$BaseUrl,
        [Parameter(Mandatory=$true)][string[]]$TypeNames,
        [Parameter(Mandatory=$true)][string[]]$Patterns,
        [Parameter(Mandatory=$true)][string]$DestinationRoot,
        [switch]$Force
    )

    Ensure-Directory $DestinationRoot
    $selected = New-Object System.Collections.Generic.List[string]
    foreach ($pattern in $Patterns) {
        foreach ($name in $TypeNames) {
            if ($name -match $pattern -and -not $selected.Contains($name)) {
                $selected.Add($name)
            }
        }
    }

    $rows = @()
    foreach ($typeName in $selected) {
        $safe = Convert-ToSafeName $typeName
        $folder = Join-Path $DestinationRoot $safe
        try {
            $count = Download-WfsLayerPaged -BaseUrl $BaseUrl -TypeName $typeName -DestinationFolder $folder -Force:$Force
            $rows += [pscustomobject]@{ type_name=$typeName; records=$count; status='downloaded'; folder=$folder }
        }
        catch {
            Write-Warning "Could not download WFS layer ${typeName}: $($_.Exception.Message)"
            $rows += [pscustomobject]@{ type_name=$typeName; records=''; status='failed'; folder=$folder }
        }
    }

    if ($rows.Count -gt 0) {
        $rows | Export-Csv -LiteralPath (Join-Path $DestinationRoot '_download_manifest.csv') -NoTypeInformation -Encoding UTF8
    }
    return $rows
}
