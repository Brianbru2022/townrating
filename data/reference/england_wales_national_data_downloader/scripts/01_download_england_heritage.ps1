param([switch]$Force)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\Common.ps1"

$root = Get-PackageRoot
$out = Join-Path $root 'downloads\england'
Ensure-Directory $out

$nhleService = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer'
Write-Host "`n=== National Heritage List for England ===" -ForegroundColor Cyan
Download-ArcGisService -ServiceUrl $nhleService -DestinationFolder (Join-Path $out 'nhle') -Force:$Force -SourceTitle 'National Heritage List for England' | Out-Null

$catalogueRows = @()

Write-Host "`n=== Heritage at Risk: discovering latest service ===" -ForegroundColor Cyan
try {
    $har = Find-ArcGisFeatureService -Query '"Historic England Heritage at Risk Register" type:"Feature Service"' -TitleRegex '(?i)^Historic England Heritage at Risk Register 20\d{2}$'
    if ($har) {
        Save-JsonFile -Object $har -Path (Join-Path $out 'heritage_at_risk\_arcgis_item.json')
        Download-ArcGisService -ServiceUrl $har.url -DestinationFolder (Join-Path $out 'heritage_at_risk') -Force:$Force -SourceTitle $har.title | Out-Null
        $catalogueRows += [pscustomobject]@{ dataset='Heritage at Risk'; title=$har.title; item_id=$har.id; url=$har.url; status='downloaded' }
    }
    else {
        Write-Warning 'No current Heritage at Risk Feature Service was found automatically.'
        $catalogueRows += [pscustomobject]@{ dataset='Heritage at Risk'; title=''; item_id=''; url=''; status='not found' }
    }
}
catch {
    Write-Warning "Heritage at Risk discovery failed: $($_.Exception.Message)"
}

Write-Host "`n=== Conservation Areas: discovering national service ===" -ForegroundColor Cyan
try {
    $ca = Find-ArcGisFeatureService -Query 'owner:gis_historicengland "Conservation Areas" type:"Feature Service"' -TitleRegex '(?i)^Conservation Areas$'
    if ($ca) {
        Save-JsonFile -Object $ca -Path (Join-Path $out 'conservation_areas\_arcgis_item.json')
        Download-ArcGisService -ServiceUrl $ca.url -DestinationFolder (Join-Path $out 'conservation_areas') -Force:$Force -SourceTitle $ca.title | Out-Null
        $catalogueRows += [pscustomobject]@{ dataset='Conservation Areas'; title=$ca.title; item_id=$ca.id; url=$ca.url; status='downloaded' }
    }
    else {
        Write-Warning 'No national Conservation Areas Feature Service was found automatically.'
        $catalogueRows += [pscustomobject]@{ dataset='Conservation Areas'; title=''; item_id=''; url=''; status='not found' }
    }
}
catch {
    Write-Warning "Conservation-area discovery failed: $($_.Exception.Message)"
}

if ($catalogueRows.Count -gt 0) {
    $catalogueRows | Export-Csv -LiteralPath (Join-Path $out '_catalogue_discovery.csv') -NoTypeInformation -Encoding UTF8
}

Write-Host "`nEngland core heritage download complete: $out" -ForegroundColor Green
