Set-StrictMode -Version Latest

$script:DreamSkinUpdateRepository = 'pttydou/Codex-Terraria-Theme'
$script:DreamSkinUpdateManifestUrl = 'https://github.com/pttydou/Codex-Terraria-Theme/releases/latest/download/update-manifest.json'

function Test-DreamSkinUpdateManifest {
  param([Parameter(Mandatory = $true)]$Manifest)
  try {
    if ([int]$Manifest.schemaVersion -ne 1 -or "$($Manifest.repository)" -cne $script:DreamSkinUpdateRepository) {
      return $false
    }
    $versionText = "$($Manifest.release.version)"
    $tag = "$($Manifest.release.tag)"
    $commit = "$($Manifest.release.sourceCommit)"
    $platformVersion = "$($Manifest.platforms.windows.version)"
    $asset = $Manifest.platforms.windows.update
    $expectedName = "TRSkin-Windows-Update-$versionText.zip"
    $parsed = $null
    if (-not [version]::TryParse($versionText, [ref]$parsed) -or
      $tag -cne "v$versionText" -or
      $commit -cnotmatch '^[a-f0-9]{40}$' -or
      $platformVersion -cne $versionText -or
      "$($asset.name)" -cne $expectedName -or
      "$($asset.sha256)" -cnotmatch '^[a-f0-9]{64}$') {
      return $false
    }
    $size = [long]$asset.size
    return $size -gt 0 -and $size -le 536870912
  } catch {
    return $false
  }
}

function Get-DreamSkinAvailableUpdate {
  param(
    [Parameter(Mandatory = $true)][version]$InstalledVersion,
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [int]$CacheHours = 24
  )
  if ($env:TRSKIN_DISABLE_UPDATE_CHECK -eq '1') { return $null }
  $cachePath = Join-Path $StateRoot 'update-check.json'
  $manifest = $null
  if (Test-Path -LiteralPath $cachePath -PathType Leaf) {
    try {
      $cached = Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json -ErrorAction Stop
      $checkedAt = [datetime]::Parse("$($cached.checkedAtUtc)").ToUniversalTime()
      if ($checkedAt -gt [datetime]::UtcNow.AddHours(-$CacheHours) -and
        (Test-DreamSkinUpdateManifest -Manifest $cached.manifest)) {
        $manifest = $cached.manifest
      }
    } catch {}
  }
  if ($null -eq $manifest) {
    try {
      $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      try {
        $manifest = Invoke-RestMethod -UseBasicParsing -Uri $script:DreamSkinUpdateManifestUrl `
          -MaximumRedirection 5 -TimeoutSec 6 -ErrorAction Stop
      } finally {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol
      }
      if (-not (Test-DreamSkinUpdateManifest -Manifest $manifest)) { return $null }
      Ensure-DreamSkinManagedDirectory -Path $StateRoot -Root $StateRoot
      $cacheTemp = Join-Path $StateRoot ('.update-check.' + [guid]::NewGuid().ToString('N') + '.tmp')
      [ordered]@{
        checkedAtUtc = [datetime]::UtcNow.ToString('o')
        manifest = $manifest
      } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $cacheTemp -Encoding UTF8
      Move-Item -LiteralPath $cacheTemp -Destination $cachePath -Force
    } catch {
      return $null
    }
  }
  $available = $null
  if (-not [version]::TryParse("$($manifest.release.version)", [ref]$available)) { return $null }
  if ($available -le $InstalledVersion) { return $null }
  return $manifest
}

function Install-DreamSkinAvailableUpdate {
  param(
    [Parameter(Mandatory = $true)]$Manifest,
    [Parameter(Mandatory = $true)][string]$StateRoot
  )
  if (-not (Test-DreamSkinUpdateManifest -Manifest $Manifest)) {
    throw 'The TR Skin update manifest is invalid.'
  }
  $version = "$($Manifest.release.version)"
  $tag = "$($Manifest.release.tag)"
  $commit = "$($Manifest.release.sourceCommit)"
  $asset = $Manifest.platforms.windows.update
  $assetName = "$($asset.name)"
  $temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $temporaryRoot = Join-Path $temporaryBase ('TRSkinUpdate-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
  try {
    $archive = Join-Path $temporaryRoot $assetName
    $downloadUrl = "https://github.com/$script:DreamSkinUpdateRepository/releases/download/$tag/$assetName"
    $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archive `
        -MaximumRedirection 8 -TimeoutSec 120 -ErrorAction Stop
    } finally {
      [Net.ServicePointManager]::SecurityProtocol = $previousProtocol
    }
    $archiveInfo = Get-Item -LiteralPath $archive -ErrorAction Stop
    if ($archiveInfo.Length -ne [long]$asset.size) { throw 'The downloaded update size does not match the manifest.' }
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    if ($actualHash -cne "$($asset.sha256)") { throw 'The downloaded update failed SHA-256 verification.' }

    $expanded = Join-Path $temporaryRoot 'expanded'
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded
    $packageRoot = Join-Path $expanded 'TRSkin'
    $versionPath = Join-Path $packageRoot 'core\VERSION'
    $buildInfoPath = Join-Path $packageRoot 'core\BUILD-INFO.json'
    if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf) -or
      -not (Test-Path -LiteralPath $buildInfoPath -PathType Leaf)) {
      throw 'The downloaded update package is incomplete.'
    }
    if ((Get-Content -LiteralPath $versionPath -Raw).Trim() -cne $version) {
      throw 'The downloaded update VERSION does not match the manifest.'
    }
    $buildInfo = Get-Content -LiteralPath $buildInfoPath -Raw | ConvertFrom-Json -ErrorAction Stop
    if ("$($buildInfo.repository)" -cne $script:DreamSkinUpdateRepository -or
      "$($buildInfo.releaseVersion)" -cne $version -or
      "$($buildInfo.sourceCommit)" -cne $commit) {
      throw 'The downloaded update build identity does not match the manifest.'
    }
    $installer = Join-Path $packageRoot 'core\scripts\install-dream-skin.ps1'
    & $installer
    if (-not $?) { throw 'The downloaded TR Skin update did not install successfully.' }
  } finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
      $resolved = [System.IO.Path]::GetFullPath($temporaryRoot)
      if (-not $resolved.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean an unexpected update path: $resolved"
      }
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
}
