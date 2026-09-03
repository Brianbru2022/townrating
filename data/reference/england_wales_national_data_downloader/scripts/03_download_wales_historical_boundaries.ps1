param([switch]$Force)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\Common.ps1"

$root = Get-PackageRoot
$out = Join-Path $root 'downloads\wales\historical_boundaries'
Ensure-Directory $out

$base = 'https://datamap.gov.wales/geoserver/ows'
Write-Host "`n=== Reading DataMapWales historical-boundary layers ===" -ForegroundColor Cyan
$typeNames = Get-WfsTypeNames -BaseUrl $base
$typeNames | Set-Content -LiteralPath (Join-Path $out '_available_wfs_layers.txt') -Encoding UTF8

$patterns = @(
    '(?i)^geonode:historic_counties_bng_rcahmw_ply$',
    '(?i)^geonode:historic_hundreds_bng_rcahmw_ply$',
    '(?i)^geonode:municipal_boundaries_bng_rcahmw_ply$',
    '(?i)^geonode:parliamentary_boundaries_bng_rcahmw_ply$',
    '(?i)^geonode:historic_.*_bng_rcahmw_(ply|pt|ln)$',
    '(?i)^geonode:.*(commote|cantref|parish).*rcahmw.*$'
)

$rows = Download-WfsMatches -BaseUrl $base -TypeNames $typeNames -Patterns $patterns -DestinationRoot $out -Force:$Force
if (-not $rows -or $rows.Count -eq 0) {
    Write-Warning 'No historical-boundary layers were downloaded. Review _available_wfs_layers.txt for renamed RCAHMW layers.'
}

Write-Host "`nWales historical-boundary download complete: $out" -ForegroundColor Green
