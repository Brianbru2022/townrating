$ErrorActionPreference = 'Continue'

$node = 'C:\Users\brian\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not $env:HE_CAPTURE_WORKERS) { $env:HE_CAPTURE_WORKERS = '4' }
if (-not $env:HE_CAPTURE_DELAY_MS) { $env:HE_CAPTURE_DELAY_MS = '450' }
$shardCount = [Math]::Max(1, [int]($env:HE_CAPTURE_SHARD_COUNT ?? '1'))
$shardIndex = [Math]::Max(0, [int]($env:HE_CAPTURE_SHARD_INDEX ?? '0'))

if ($shardIndex -ge $shardCount) {
  throw "HE_CAPTURE_SHARD_INDEX must be smaller than HE_CAPTURE_SHARD_COUNT."
}

$projects = Get-ChildItem (Join-Path $repo 'data\projects') -Filter '*.json' |
  ForEach-Object {
    $package = Get-Content $_.FullName -Raw | ConvertFrom-Json
    if ($package.project.countryCode -eq 'GB-ENG') {
      [pscustomobject]@{
        ProjectId = $package.project.id
        Path = $_.FullName
      }
    }
  } |
  Sort-Object ProjectId

if ($shardCount -gt 1) {
  $projects = @(
    for ($index = 0; $index -lt $projects.Count; $index += 1) {
      if (($index % $shardCount) -eq $shardIndex) {
        $projects[$index]
      }
    }
  )
}

Write-Output "CAPTURE_SHARD index=$shardIndex count=$shardCount projects=$($projects.Count)"

foreach ($project in $projects) {
  $output = Join-Path $repo "data\review\$($project.ProjectId)-nhle-official-text-2026-08-09.json"
  Write-Output "CAPTURE_START $($project.ProjectId)"
  & $node '.\node_modules\tsx\dist\cli.mjs' `
    '.\scripts\capture-historic-england-official-text.ts' `
    $project.Path `
    $output
  Write-Output "CAPTURE_END $($project.ProjectId) exit=$LASTEXITCODE"
}

Write-Output 'CAPTURE_ALL_COMPLETE'
