$portals = @(
    [pscustomobject]@{ Name='Historic England Open Data Downloads'; Url='https://historicengland.org.uk/listing/the-list/data-downloads/' },
    [pscustomobject]@{ Name='Heritage Gateway'; Url='https://www.heritagegateway.org.uk/gateway/' },
    [pscustomobject]@{ Name='Historic England HER directory and guidance'; Url='https://historicengland.org.uk/advice/technical-advice/information-management/hers/' },
    [pscustomobject]@{ Name='Cadw Cof Cymru downloads'; Url='https://cadw.gov.wales/advice-support/cof-cymru/downloads' },
    [pscustomobject]@{ Name='DataMapWales'; Url='https://datamap.gov.wales/' },
    [pscustomobject]@{ Name='Coflein'; Url='https://coflein.gov.uk/' },
    [pscustomobject]@{ Name='Archwilio'; Url='https://archwilio.org.uk/' },
    [pscustomobject]@{ Name='List of Historic Place Names of Wales'; Url='https://historicplacenames.rcahmw.gov.uk/' },
    [pscustomobject]@{ Name='ONS Open Geography Portal'; Url='https://geoportal.statistics.gov.uk/' },
    [pscustomobject]@{ Name='Ordnance Survey OpenData'; Url='https://osdatahub.os.uk/downloads/open' },
    [pscustomobject]@{ Name='Environment Agency LiDAR and open data'; Url='https://environment.data.gov.uk/' },
    [pscustomobject]@{ Name='Natural Resources Wales open data'; Url='https://datamap.gov.wales/' }
)

Write-Host 'The following official portals cover large, tiled, locally controlled or non-bulk sources:' -ForegroundColor Cyan
$portals | Format-Table -AutoSize

foreach ($portal in $portals) {
    Start-Process $portal.Url
    Start-Sleep -Milliseconds 250
}
