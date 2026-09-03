param([switch]$Force)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\Common.ps1"

$root = Get-PackageRoot
$out = Join-Path $root 'downloads\wales\national_heritage'
Ensure-Directory $out

$base = 'https://datamap.gov.wales/geoserver/ows'
Write-Host "`n=== Reading the live DataMapWales WFS catalogue ===" -ForegroundColor Cyan
$typeNames = Get-WfsTypeNames -BaseUrl $base
$typeNames | Set-Content -LiteralPath (Join-Path $out '_available_wfs_layers.txt') -Encoding UTF8
Write-Host "Found $($typeNames.Count) WFS feature types."

# Exact known names plus conservative patterns for groups whose names can change.
$patterns = @(
    '(?i)^inspire-wg:Cadw_ListedBuildings$',
    '(?i)^inspire-wg:Cadw_SAM$',
    '(?i)^inspire-wg:Cadw_DesignatedWrecks$',
    '(?i)^inspire-wg:Cadw_HistoricLandscapes$',
    '(?i)^geonode:conservation_areas_wales$',
    '(?i)^geonode:cadw_rhpg_',
    '(?i)^inspire-wg:cadw_whs_',
    '(?i)^geonode:rcahmw_nmrw_terrestrialsites_rcahmw_bng$',
    '(?i)^geonode:nmrw_maritimesites_rcahmw_wgs84$',
    '(?i)cadw.*(world.*heritage|whs)',
    '(?i)^(?!inspire-wg:vGeoServer_).*(world.*heritage|whs).*(boundary|site|setting|view)'
)

$rows = Download-WfsMatches -BaseUrl $base -TypeNames $typeNames -Patterns $patterns -DestinationRoot $out -Force:$Force
if (-not $rows -or $rows.Count -eq 0) {
    Write-Warning 'No matching Cadw/DataMapWales layers were downloaded. Review _available_wfs_layers.txt and update the patterns if the service has renamed its layers.'
}

Write-Host "`nWales core heritage download complete: $out" -ForegroundColor Green
