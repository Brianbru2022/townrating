param([switch]$Force)

. "$PSScriptRoot\Common.ps1"

$root = Get-PackageRoot
$out = Join-Path $root 'downloads\england\optional_historic_england'
Ensure-Directory $out

Write-Warning 'Some optional Historic England services can be very large. Check free disk space before continuing.'

$targets = @(
    [pscustomobject]@{
        key = 'aerial_investigation_mapping'
        query = 'owner:HistoricEngland "Aerial Investigation" type:"Feature Service"'
        regex = '(?i)(Aerial Investigation|Aerial Archaeology|National Mapping Programme)'
    },
    [pscustomobject]@{
        key = 'research_reports'
        query = 'owner:HistoricEngland "Research Reports" type:"Feature Service"'
        regex = '(?i)Research Reports'
    },
    [pscustomobject]@{
        key = 'her_boundaries'
        query = 'owner:HistoricEngland "Historic Environment Record" type:"Feature Service"'
        regex = '(?i)(HER Boundaries|Historic Environment Record)'
    },
    [pscustomobject]@{
        key = 'greater_london_archaeological_priority_areas'
        query = 'owner:HistoricEngland "Archaeological Priority Areas" type:"Feature Service"'
        regex = '(?i)Archaeological Priority Areas'
    },
    [pscustomobject]@{
        key = 'de_designated_sites'
        query = 'owner:HistoricEngland "De-Designated" type:"Feature Service"'
        regex = '(?i)De.?Designated'
    }
)

$results = @()
foreach ($target in $targets) {
    Write-Host "`n=== Discovering $($target.key) ===" -ForegroundColor Cyan
    try {
        $item = Find-ArcGisFeatureService -Query $target.query -TitleRegex $target.regex
        if ($item) {
            $folder = Join-Path $out $target.key
            Save-JsonFile -Object $item -Path (Join-Path $folder '_arcgis_item.json')
            Download-ArcGisService -ServiceUrl $item.url -DestinationFolder $folder -Force:$Force -SourceTitle $item.title | Out-Null
            $results += [pscustomobject]@{ key=$target.key; title=$item.title; item_id=$item.id; url=$item.url; status='downloaded' }
        }
        else {
            Write-Warning "No matching service was found for $($target.key)."
            $results += [pscustomobject]@{ key=$target.key; title=''; item_id=''; url=''; status='not found' }
        }
    }
    catch {
        Write-Warning "Optional dataset $($target.key) failed: $($_.Exception.Message)"
        $results += [pscustomobject]@{ key=$target.key; title=''; item_id=''; url=''; status='failed' }
    }
}

$results | Export-Csv -LiteralPath (Join-Path $out '_optional_discovery.csv') -NoTypeInformation -Encoding UTF8
Write-Host "`nOptional Historic England run complete: $out" -ForegroundColor Green
