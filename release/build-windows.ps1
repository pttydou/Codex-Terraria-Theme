[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][string]$SourceCommit,
  [string]$MusicPack
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($Version -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') { throw "Invalid release version: $Version" }
if ($SourceCommit -cnotmatch '^[a-f0-9]{40}$') { throw 'SourceCommit must be a full lowercase Git commit SHA.' }

$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$SourceRoot = Join-Path $RepositoryRoot 'windows\TRSkin'
$ActualVersion = (Get-Content -LiteralPath (Join-Path $SourceRoot 'core\VERSION') -Raw).Trim()
if ($ActualVersion -cne $Version) { throw "Windows VERSION $ActualVersion does not match $Version" }

$OutputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$TemporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$WorkRoot = Join-Path $TemporaryBase ("trskin-release-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function New-Zip([string]$Source, [string]$Destination) {
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  Compress-Archive -LiteralPath $Source -DestinationPath $Destination -CompressionLevel Optimal
}

try {
  $UpdateStage = Join-Path $WorkRoot 'update'
  $PackageRoot = Join-Path $UpdateStage 'TRSkin'
  New-Item -ItemType Directory -Path $UpdateStage -Force | Out-Null
  Copy-Item -LiteralPath $SourceRoot -Destination $UpdateStage -Recurse -Force

  $BuildInfo = [ordered]@{
    schemaVersion = 1
    repository = 'pttydou/TRSkin'
    releaseVersion = $Version
    sourceCommit = $SourceCommit
    builder = 'GitHub Actions'
  }
  $BuildInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PackageRoot 'core\BUILD-INFO.json') -Encoding UTF8

  $RuntimeConfig = Get-Content -LiteralPath (Join-Path $PackageRoot 'core\legal\NODE-RUNTIME.json') -Raw | ConvertFrom-Json
  $RuntimeLicense = Join-Path $PackageRoot 'core\runtime\LICENSE.node.txt'
  if ((Get-Sha256 $RuntimeLicense) -cne $RuntimeConfig.licenseSha256) {
    throw 'The checked-in Node.js license does not match NODE-RUNTIME.json.'
  }
  foreach ($Architecture in @('x64', 'arm64')) {
    $Definition = $RuntimeConfig.architectures.$Architecture
    $Archive = Join-Path $WorkRoot "node-$Architecture.zip"
    Invoke-WebRequest -UseBasicParsing -Uri $Definition.url -OutFile $Archive
    if ((Get-Sha256 $Archive) -cne $Definition.archiveSha256) {
      throw "Node.js $Architecture archive SHA-256 mismatch."
    }
    $Extracted = Join-Path $WorkRoot "node-$Architecture"
    Expand-Archive -LiteralPath $Archive -DestinationPath $Extracted
    $Candidates = @(Get-ChildItem -LiteralPath $Extracted -Recurse -File -Filter 'node.exe')
    if ($Candidates.Count -ne 1) { throw "Node.js $Architecture archive has an unexpected layout." }
    if ((Get-Sha256 $Candidates[0].FullName) -cne $Definition.nodeExeSha256) {
      throw "Node.js $Architecture executable SHA-256 mismatch."
    }
    $RuntimeDestination = Join-Path $PackageRoot "core\runtime\win-$Architecture"
    New-Item -ItemType Directory -Path $RuntimeDestination -Force | Out-Null
    Copy-Item -LiteralPath $Candidates[0].FullName -Destination (Join-Path $RuntimeDestination 'node.exe') -Force
  }

  $UpdateZip = Join-Path $OutputRoot "TRSkin-Windows-Update-$Version.zip"
  New-Zip -Source $PackageRoot -Destination $UpdateZip

  if ($MusicPack) {
    $MusicPackPath = [System.IO.Path]::GetFullPath($MusicPack)
    if (-not (Test-Path -LiteralPath $MusicPackPath -PathType Leaf)) { throw "Music Pack not found: $MusicPackPath" }
    $FullStage = Join-Path $WorkRoot 'full'
    Copy-Item -LiteralPath $UpdateStage -Destination $FullStage -Recurse -Force
    $MusicExtract = Join-Path $WorkRoot 'music'
    Expand-Archive -LiteralPath $MusicPackPath -DestinationPath $MusicExtract
    $MusicSource = Join-Path $MusicExtract 'TRSkin\core\bundled-music'
    $MusicConfig = Join-Path $MusicExtract 'TRSkin\core\bundled-music.json'
    if (-not (Test-Path -LiteralPath $MusicSource -PathType Container) -or
      -not (Test-Path -LiteralPath $MusicConfig -PathType Leaf)) {
      throw 'Music Pack has an unexpected layout.'
    }
    $FullCore = Join-Path $FullStage 'TRSkin\core'
    Copy-Item -LiteralPath $MusicSource -Destination $FullCore -Recurse -Force
    Copy-Item -LiteralPath $MusicConfig -Destination $FullCore -Force
    New-Zip -Source (Join-Path $FullStage 'TRSkin') -Destination (Join-Path $OutputRoot "TRSkin-Windows-$Version.zip")
  }
} finally {
  if (Test-Path -LiteralPath $WorkRoot) {
    $ResolvedWork = [System.IO.Path]::GetFullPath($WorkRoot)
    if (-not $ResolvedWork.StartsWith($TemporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean an unexpected path: $ResolvedWork"
    }
    Remove-Item -LiteralPath $ResolvedWork -Recurse -Force
  }
}
