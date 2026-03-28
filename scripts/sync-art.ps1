$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $rootDir "art-resources"
$targetDir = Join-Path $rootDir "public\art"

$assetMappings = @(
  @{ From = (Join-Path $sourceDir "backgrounds"); To = (Join-Path $targetDir "backgrounds") }
  @{ From = (Join-Path $sourceDir "pets"); To = (Join-Path $targetDir "pets") }
  @{ From = (Join-Path $sourceDir "ui"); To = (Join-Path $targetDir "ui") }
  @{
    From = (Join-Path $sourceDir "pets\Mushroom_stage1_nobg_webp")
    To = (Join-Path $targetDir "pets\stage1")
  }
  @{
    From = (Join-Path $sourceDir "Preprocess\Pet_Idle_nobg_webp")
    To = (Join-Path $targetDir "pets\idle")
  }
)

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

foreach ($mapping in $assetMappings) {
  if (-not (Test-Path $mapping.From)) {
    Write-Warning "Skipping missing folder: $($mapping.From)"
    continue
  }

  New-Item -ItemType Directory -Force -Path $mapping.To | Out-Null
  Copy-Item -Path (Join-Path $mapping.From "*") -Destination $mapping.To -Recurse -Force

  $syncedFiles = @(Get-ChildItem -Path $mapping.From -File -Recurse)
  Write-Host "Synced $($syncedFiles.Count) file(s) from $($mapping.From)"
}

Write-Host "Art assets are ready in $targetDir"
