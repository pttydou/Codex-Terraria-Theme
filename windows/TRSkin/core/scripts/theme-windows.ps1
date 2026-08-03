if (-not (Get-Command Read-DreamSkinUtf8File -ErrorAction SilentlyContinue)) {
  . (Join-Path $PSScriptRoot 'config-utf8.ps1')
}

$script:DreamSkinMaxImageBytes = 16 * 1024 * 1024

function Assert-DreamSkinNoReparseComponents {
  param([Parameter(Mandatory = $true)][string]$Path)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetPathRoot($fullPath)
  $current = $fullPath
  while ($true) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Managed TR Skin path contains a junction or symbolic link: $current"
      }
    }
    $currentNormalized = $current.TrimEnd('\')
    $rootNormalized = $root.TrimEnd('\')
    if ($currentNormalized.Equals($rootNormalized, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $parent = [System.IO.Path]::GetDirectoryName($current)
    if (-not $parent -or $parent.Equals($current, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $current = $parent
  }
}

function Ensure-DreamSkinManagedDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Root
  )
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
  if (-not ($fullPath.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      $fullPath.StartsWith($fullRoot + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
    throw "Managed TR Skin path escaped its state root: $fullPath"
  }
  Assert-DreamSkinNoReparseComponents -Path $fullPath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    throw "Managed TR Skin path is a file, not a directory: $fullPath"
  }
  New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
  Assert-DreamSkinNoReparseComponents -Path $fullPath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
    throw "Managed TR Skin directory could not be created: $fullPath"
  }
}

function Get-DreamSkinValidatedImageMetadata {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Get-Command Get-DreamSkinNodeRuntime -ErrorAction SilentlyContinue)) {
    throw 'Node.js runtime validation is unavailable for image metadata checks.'
  }
  $node = Get-DreamSkinNodeRuntime
  $metadataScript = Join-Path $PSScriptRoot 'image-metadata.mjs'
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList @(
    $metadataScript, '--check', ([System.IO.Path]::GetFullPath($Path))
  )
  if ($result.ExitCode -ne 0) {
    throw "Image metadata is invalid or exceeds the 16384px / 50MP safety limit: $Path"
  }
  try { $metadata = ($result.Output -join "`n") | ConvertFrom-Json -ErrorAction Stop } catch {
    throw "Image metadata helper returned invalid output: $Path"
  }
  if ($null -eq $metadata -or $null -eq $metadata.width -or $null -eq $metadata.height) {
    throw "Image metadata is invalid or exceeds the 16384px / 50MP safety limit: $Path"
  }
}

function Assert-DreamSkinImageFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$SkipImageMetadata
  )
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Image does not exist: $fullPath"
  }
  $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
  if ($extension -notin @('.png', '.jpg', '.jpeg', '.webp')) {
    throw "Unsupported image format: $extension"
  }
  $length = (Get-Item -LiteralPath $fullPath -Force).Length
  if ($length -lt 1) { throw 'Theme image cannot be empty.' }
  if ($length -gt $script:DreamSkinMaxImageBytes) {
    throw 'Theme image exceeds the 16 MB limit.'
  }
  if (-not $SkipImageMetadata) {
    Get-DreamSkinValidatedImageMetadata -Path $fullPath
  }
}

function Get-DreamSkinThemePaths {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  $fullRoot = [System.IO.Path]::GetFullPath($StateRoot)
  return [pscustomobject]@{
    Root = $fullRoot
    Active = Join-Path $fullRoot 'active-theme'
    Saved = Join-Path $fullRoot 'themes'
    Images = Join-Path $fullRoot 'images'
    PauseFile = Join-Path $fullRoot 'paused'
    State = Join-Path $fullRoot 'state.json'
    MusicConfig = Join-Path $fullRoot 'music.json'
    MusicLibrary = Join-Path $fullRoot 'music'
  }
}

function Test-DreamSkinThemePathWithin {
  param([string]$Path, [string]$Root)
  if (-not $Path -or -not $Root) { return $false }
  try {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $inside = $fullPath.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      $fullPath.StartsWith($fullRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $inside) { return $false }

    $current = $fullPath.TrimEnd('\')
    while ($true) {
      if (-not (Test-Path -LiteralPath $current)) { return $false }
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        return $false
      }
      if ($current.Equals($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
      }
      $parent = [System.IO.Path]::GetDirectoryName($current)
      if (-not $parent -or $parent.Equals($current, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $false
      }
      $current = $parent.TrimEnd('\')
    }
  } catch {
    return $false
  }
}

function Read-DreamSkinTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [switch]$SkipImageMetadata
  )
  $directory = [System.IO.Path]::GetFullPath($ThemeDirectory)
  Assert-DreamSkinNoReparseComponents -Path $directory
  $themePath = Join-Path $directory 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $themePath
  if (-not (Test-Path -LiteralPath $themePath -PathType Leaf)) {
    throw "Theme metadata is missing: $themePath"
  }
  try {
    $theme = (Read-DreamSkinUtf8File -Path $themePath) | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "Theme metadata is invalid JSON: $themePath"
  }
  if ($null -eq $theme -or $theme -is [string] -or $theme -is [array] -or -not $theme.image) {
    throw "Theme metadata must be an object with a relative image path: $themePath"
  }
  $image = "$($theme.image)"
  if ([System.IO.Path]::IsPathRooted($image)) { throw 'Theme image path must be relative.' }
  $imagePath = [System.IO.Path]::GetFullPath((Join-Path $directory $image))
  if (-not (Test-DreamSkinThemePathWithin -Path $imagePath -Root $directory) -or
    -not (Test-Path -LiteralPath $imagePath -PathType Leaf)) {
    throw 'Theme image must remain inside its theme directory and exist.'
  }
  Assert-DreamSkinImageFile -Path $imagePath -SkipImageMetadata:$SkipImageMetadata
  return [pscustomobject]@{
    Directory = $directory
    ThemePath = $themePath
    ImagePath = $imagePath
    Theme = $theme
  }
}

function Write-DreamSkinTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [Parameter(Mandatory = $true)][object]$Theme
  )
  Assert-DreamSkinNoReparseComponents -Path $ThemeDirectory
  New-Item -ItemType Directory -Force -Path $ThemeDirectory | Out-Null
  Assert-DreamSkinNoReparseComponents -Path $ThemeDirectory
  $json = $Theme | ConvertTo-Json -Depth 8
  $themePath = Join-Path $ThemeDirectory 'theme.json'
  Assert-DreamSkinNoReparseComponents -Path $themePath
  Write-DreamSkinUtf8FileAtomically -Path $themePath -Content ($json + "`r`n")
}

function Repair-DreamSkinLegacyThemeSchema {
  param([Parameter(Mandatory = $true)][string]$ThemeDirectory)
  $loaded = Read-DreamSkinTheme -ThemeDirectory $ThemeDirectory -SkipImageMetadata
  $theme = $loaded.Theme
  $changed = $false
  if ($null -eq $theme.PSObject.Properties['schemaVersion'] -or $null -eq $theme.schemaVersion) {
    $theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force
    $changed = $true
  }
  if ($theme.art) {
    foreach ($coordinate in @('focusX', 'focusY')) {
      if ($null -ne $theme.art.PSObject.Properties[$coordinate] -and $null -eq $theme.art.$coordinate) {
        $theme.art.PSObject.Properties.Remove($coordinate)
        $changed = $true
      }
    }
  }
  if ($changed) { Write-DreamSkinTheme -ThemeDirectory $ThemeDirectory -Theme $theme }
  return $changed
}

function Test-DreamSkinThemePayload {
  param([Parameter(Mandatory = $true)][string]$ThemeDirectory)
  if (-not (Get-Command Get-DreamSkinNodeRuntime -ErrorAction SilentlyContinue)) {
    throw 'Node.js runtime validation is unavailable for theme payload checks.'
  }
  $node = Get-DreamSkinNodeRuntime
  $injector = Join-Path $PSScriptRoot 'injector.mjs'
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList @(
    $injector, '--check-payload', '--theme-dir',
    ([System.IO.Path]::GetFullPath($ThemeDirectory)), '--timeout-ms', '1000'
  )
  if ($result.ExitCode -ne 0) {
    throw "Theme payload validation failed: $($result.Output -join "`n")"
  }
}

function Copy-DreamSkinThemeDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$AllowedSourceRoot,
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [switch]$ValidatePayload
  )
  $sourcePath = [System.IO.Path]::GetFullPath($Source)
  $destinationPath = [System.IO.Path]::GetFullPath($Destination)
  $allowedRoot = [System.IO.Path]::GetFullPath($AllowedSourceRoot)
  $managedRoot = [System.IO.Path]::GetFullPath($StateRoot)
  if (-not (Test-DreamSkinThemePathWithin -Path $sourcePath -Root $allowedRoot)) {
    throw "Theme source must remain inside its trusted theme root: $sourcePath"
  }
  if (-not (Test-DreamSkinPathWithin -Path $destinationPath -Root $managedRoot)) {
    throw "Theme destination must remain inside the TR Skin state root: $destinationPath"
  }
  Assert-DreamSkinRuntimeTree -Path $sourcePath
  $null = Read-DreamSkinTheme -ThemeDirectory $sourcePath -SkipImageMetadata
  Ensure-DreamSkinManagedDirectory -Path $managedRoot -Root $managedRoot
  $token = [guid]::NewGuid().ToString('N')
  $staging = Join-Path $managedRoot ".theme-staging-$token"
  $backup = Join-Path $managedRoot ".theme-backup-$token"
  try {
    Copy-Item -LiteralPath $sourcePath -Destination $staging -Recurse -Force -ErrorAction Stop
    Assert-DreamSkinRuntimeTree -Path $staging
    $null = Read-DreamSkinTheme -ThemeDirectory $staging -SkipImageMetadata
    $null = Repair-DreamSkinLegacyThemeSchema -ThemeDirectory $staging
    if ($ValidatePayload) { Test-DreamSkinThemePayload -ThemeDirectory $staging }
    $hasBackup = $false
    if (Test-Path -LiteralPath $destinationPath) {
      Assert-DreamSkinRuntimeTree -Path $destinationPath
      Move-Item -LiteralPath $destinationPath -Destination $backup -ErrorAction Stop
      $hasBackup = $true
    }
    try {
      Move-Item -LiteralPath $staging -Destination $destinationPath -ErrorAction Stop
    } catch {
      if ($hasBackup -and -not (Test-Path -LiteralPath $destinationPath)) {
        Move-Item -LiteralPath $backup -Destination $destinationPath -ErrorAction Stop
        $hasBackup = $false
      }
      throw
    }
    if ($hasBackup) {
      try { Remove-DreamSkinRuntimeTree -Path $backup -StateRoot $managedRoot } catch {
        Write-Warning "Theme changed successfully, but its previous backup could not be removed: $($_.Exception.Message)"
      }
    }
  } finally {
    foreach ($temporary in @($staging, $backup)) {
      if (Test-Path -LiteralPath $temporary) {
        try { Remove-DreamSkinRuntimeTree -Path $temporary -StateRoot $managedRoot } catch {}
      }
    }
  }
  return Read-DreamSkinTheme -ThemeDirectory $destinationPath
}

function Invoke-DreamSkinRandomPoolConfiguration {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $theme = Read-DreamSkinTheme -ThemeDirectory $ThemeDirectory -SkipImageMetadata
  $node = Get-DreamSkinNodeRuntime
  $helper = Join-Path $PSScriptRoot 'random-pool-config.mjs'
  $config = Join-Path ([System.IO.Path]::GetFullPath($StateRoot)) 'random-pool.json'
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList @(
    $helper, 'apply', $config, $theme.ThemePath
  )
  if ($result.ExitCode -ne 0) {
    throw "Random pool configuration failed: $($result.Output -join "`n")"
  }
}

function Invoke-DreamSkinRandomPoolHelper {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('catalog', 'show', 'set')][string]$Command,
    [string[]]$Arguments = @(),
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $node = Get-DreamSkinNodeRuntime
  $helper = Join-Path $PSScriptRoot 'random-pool-config.mjs'
  $config = Join-Path ([System.IO.Path]::GetFullPath($StateRoot)) 'random-pool.json'
  $helperArguments = @($helper, $Command, $config) + $Arguments
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList $helperArguments
  if ($result.ExitCode -ne 0) {
    throw "Random pool configuration failed: $($result.Output -join "`n")"
  }
  try {
    $parsed = ($result.Output -join "`n") | ConvertFrom-Json -ErrorAction Stop
    if ($Command -eq 'catalog') {
      # Windows PowerShell 5.1 can preserve a top-level JSON array as one
      # nested Object[] when it crosses a function boundary. Emit catalog
      # entries individually so every caller receives 44 environment rows.
      foreach ($entry in @($parsed)) {
        if ($entry -is [System.Array]) {
          foreach ($nestedEntry in $entry) {
            Write-Output $nestedEntry
          }
        } else {
          Write-Output $entry
        }
      }
      return
    }
    return $parsed
  } catch {
    throw 'Random pool configuration returned invalid JSON.'
  }
}

function Invoke-DreamSkinMusicHelper {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'catalog', 'show', 'set-enabled', 'set-volume', 'set-mode',
      'set-gap', 'set-fade', 'set-hidden', 'set-environment-mode',
      'set-soundtrack', 'set-track-change', 'set-settings', 'import'
    )]
    [string]$Command,
    [string[]]$Arguments = @(),
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.MusicLibrary -Root $paths.Root
  $node = Get-DreamSkinNodeRuntime
  $helper = Join-Path $PSScriptRoot 'music-config.mjs'
  $catalog = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets\terraria-music-catalog.json'
  $helperArguments = @($helper, $Command, $paths.MusicConfig)
  if ($Command -eq 'catalog') {
    $helperArguments += $catalog
  } elseif ($Command -eq 'import') {
    if ($Arguments.Count -ne 2) { throw 'Music import requires a slot id and a file path.' }
    $helperArguments += @($paths.MusicLibrary, $catalog, $Arguments[0], $Arguments[1])
  } else {
    $helperArguments += $Arguments
  }
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList $helperArguments
  if ($result.ExitCode -ne 0) {
    throw "Music configuration failed: $($result.Output -join "`n")"
  }
  try { return ($result.Output -join "`n") | ConvertFrom-Json -ErrorAction Stop } catch {
    throw 'Music configuration returned invalid JSON.'
  }
}

function Initialize-DreamSkinThemeStore {
  param(
    [Parameter(Mandatory = $true)][string]$SkillRoot,
    [string]$BundledContentRoot = $SkillRoot,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  foreach ($directory in @($paths.Root, $paths.Saved, $paths.Images, $paths.MusicLibrary)) {
    Ensure-DreamSkinManagedDirectory -Path $directory -Root $paths.Root
  }

  $presetRoot = Join-Path $SkillRoot 'local-presets'
  $randomPreset = Join-Path $presetRoot 'preset-terraria-random'
  if (-not (Test-Path -LiteralPath (Join-Path $randomPreset 'theme.json') -PathType Leaf)) {
    throw 'The bundled Terraria random theme is missing.'
  }

  foreach ($preset in Get-ChildItem -LiteralPath $presetRoot -Directory -Filter 'preset-*' -ErrorAction Stop) {
    $destination = Join-Path $paths.Saved $preset.Name
    $refresh = -not (Test-Path -LiteralPath (Join-Path $destination 'theme.json') -PathType Leaf)
    if (-not $refresh) {
      try {
        $refresh = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $preset.FullName 'theme.json')).Hash -cne
          (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $destination 'theme.json')).Hash
      } catch {
        $refresh = $true
      }
    }
    if ($refresh) {
      $null = Copy-DreamSkinThemeDirectory -Source $preset.FullName -Destination $destination `
        -AllowedSourceRoot $presetRoot -StateRoot $paths.Root
    }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $paths.Active 'theme.json') -PathType Leaf)) {
    $null = Copy-DreamSkinThemeDirectory -Source $randomPreset -Destination $paths.Active `
      -AllowedSourceRoot $presetRoot -StateRoot $paths.Root
    Invoke-DreamSkinRandomPoolConfiguration -ThemeDirectory $paths.Active -StateRoot $paths.Root
  }
  $null = Repair-DreamSkinLegacyThemeSchema -ThemeDirectory $paths.Active
  Test-DreamSkinThemePayload -ThemeDirectory $paths.Active

  # Seed bundled music files (Terraria OST) when the package includes them
  # and the user does not yet have a music library with tracks.
  $bundledMusicDir = Join-Path $BundledContentRoot 'bundled-music'
  $bundledMusicConfig = Join-Path $BundledContentRoot 'bundled-music.json'
  if ((Test-Path -LiteralPath $bundledMusicDir -PathType Container) -and
    (Test-Path -LiteralPath $bundledMusicConfig -PathType Leaf)) {
    $seedMusic = $true
    if (Test-Path -LiteralPath $paths.MusicConfig -PathType Leaf) {
      try {
        $existingConfig = (Read-DreamSkinUtf8File -Path $paths.MusicConfig) | ConvertFrom-Json -ErrorAction Stop
        if ($null -ne $existingConfig.tracks -and
          ($existingConfig.tracks.PSObject.Properties.Name | Measure-Object).Count -gt 0) {
          $seedMusic = $false
        }
      } catch {
        $seedMusic = $true
      }
    }
    if ($seedMusic) {
      foreach ($musicFile in (Get-ChildItem -LiteralPath $bundledMusicDir -File -Filter '*.mp3' -ErrorAction SilentlyContinue)) {
        $destination = Join-Path $paths.MusicLibrary $musicFile.Name
        if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
          Copy-Item -LiteralPath $musicFile.FullName -Destination $destination -Force -ErrorAction Stop
        }
      }
      Copy-Item -LiteralPath $bundledMusicConfig -Destination $paths.MusicConfig -Force -ErrorAction Stop
    }
  }

  return $paths
}
function New-DreamSkinThemeImageName {
  param([Parameter(Mandatory = $true)][string]$Extension)
  return 'art-' + (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' +
    [guid]::NewGuid().ToString('N').Substring(0, 8) + $Extension.ToLowerInvariant()
}

function Set-DreamSkinActiveTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [AllowNull()][object]$Theme,
    [string]$Name,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Active -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Images -Root $paths.Root
  $source = [System.IO.Path]::GetFullPath($ImagePath)
  Assert-DreamSkinImageFile -Path $source
  $extension = [System.IO.Path]::GetExtension($source).ToLowerInvariant()
  $oldImage = $null
  try { $oldImage = (Read-DreamSkinTheme -ThemeDirectory $paths.Active).ImagePath } catch {}
  if ($null -eq $Theme) {
    $Theme = [pscustomobject]@{
      schemaVersion = 1
      id = 'custom'
      name = '自定义主题'
      appearance = 'auto'
      art = [pscustomobject]@{ safeArea = 'auto'; taskMode = 'auto' }
      palette = [pscustomobject]@{}
    }
  }
  $imageName = New-DreamSkinThemeImageName -Extension $extension
  $target = Join-Path $paths.Active $imageName
  $temporary = Join-Path $paths.Active ('.dream-tmp-' + [guid]::NewGuid().ToString('N') + $extension)
  try {
    Assert-DreamSkinNoReparseComponents -Path $target
    Assert-DreamSkinNoReparseComponents -Path $temporary
    Copy-Item -LiteralPath $source -Destination $temporary -Force
    Assert-DreamSkinNoReparseComponents -Path $temporary
    Assert-DreamSkinImageFile -Path $temporary
    Move-Item -LiteralPath $temporary -Destination $target -Force
    Assert-DreamSkinNoReparseComponents -Path $target
    Assert-DreamSkinImageFile -Path $target
    $Theme | Add-Member -NotePropertyName image -NotePropertyValue $imageName -Force
    if (-not $Theme.schemaVersion) {
      $Theme | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force
    }
    if ($Name) { $Theme | Add-Member -NotePropertyName name -NotePropertyValue $Name -Force }
    if (-not $Theme.id) { $Theme | Add-Member -NotePropertyName id -NotePropertyValue 'custom' -Force }
    if (-not $Theme.appearance) { $Theme | Add-Member -NotePropertyName appearance -NotePropertyValue 'auto' -Force }
    if (-not $Theme.art) {
      $Theme | Add-Member -NotePropertyName art -NotePropertyValue `
        ([pscustomobject]@{ safeArea = 'auto'; taskMode = 'auto' }) -Force
    } else {
      foreach ($coordinate in @('focusX', 'focusY')) {
        if ($null -eq $Theme.art.$coordinate) { $Theme.art.PSObject.Properties.Remove($coordinate) }
      }
    }
    if (-not $Theme.palette) {
      $Theme | Add-Member -NotePropertyName palette -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    Write-DreamSkinTheme -ThemeDirectory $paths.Active -Theme $Theme
  } finally {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  }
  $sameImage = $oldImage -and ([System.IO.Path]::GetFullPath($oldImage) -ieq [System.IO.Path]::GetFullPath($target))
  if ($oldImage -and -not $sameImage -and
    (Test-DreamSkinThemePathWithin -Path $oldImage -Root $paths.Active)) {
    Remove-Item -LiteralPath $oldImage -Force -ErrorAction SilentlyContinue
  }
  $imageArchive = Join-Path $paths.Images $imageName
  Assert-DreamSkinNoReparseComponents -Path $imageArchive
  Copy-Item -LiteralPath $target -Destination $imageArchive -Force
  Assert-DreamSkinNoReparseComponents -Path $imageArchive
  Assert-DreamSkinImageFile -Path $imageArchive
  return Read-DreamSkinTheme -ThemeDirectory $paths.Active
}

function Save-DreamSkinCurrentTheme {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $trimmed = $Name.Trim()
  if (-not $trimmed -or $trimmed.Length -gt 80 -or $trimmed -match '[\u0000-\u001f]') {
    throw 'Theme name must be between 1 and 80 visible characters.'
  }
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  $active = Read-DreamSkinTheme -ThemeDirectory $paths.Active
  $id = (Get-Date).ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
  $destination = Join-Path $paths.Saved $id
  $null = Copy-DreamSkinThemeDirectory -Source $paths.Active -Destination $destination `
    -AllowedSourceRoot $paths.Active -StateRoot $paths.Root -ValidatePayload
  $theme = $active.Theme | ConvertTo-Json -Depth 100 | ConvertFrom-Json
  $theme.id = $id
  $theme.name = $trimmed
  Write-DreamSkinTheme -ThemeDirectory $destination -Theme $theme
  Test-DreamSkinThemePayload -ThemeDirectory $destination
  return Read-DreamSkinTheme -ThemeDirectory $destination
}
function Get-DreamSkinSavedThemes {
  param(
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'),
    [switch]$SkipImageMetadata
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  if (-not (Test-Path -LiteralPath $paths.Saved -PathType Container)) { return @() }
  $themes = @()
  foreach ($directory in Get-ChildItem -LiteralPath $paths.Saved -Directory -ErrorAction SilentlyContinue) {
    try {
      $loaded = Read-DreamSkinTheme -ThemeDirectory $directory.FullName -SkipImageMetadata:$SkipImageMetadata
      $themes += [pscustomobject]@{
        Id = "$($loaded.Theme.id)"
        Name = if ($loaded.Theme.name) { "$($loaded.Theme.name)" } else { $directory.Name }
        Path = $directory.FullName
      }
    } catch {}
  }
  return @($themes | Sort-Object Name)
}

function Use-DreamSkinSavedTheme {
  param(
    [Parameter(Mandatory = $true)][string]$ThemeDirectory,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
  $directory = [System.IO.Path]::GetFullPath($ThemeDirectory)
  if (-not (Test-DreamSkinThemePathWithin -Path $directory -Root $paths.Saved)) {
    throw 'Saved theme must remain inside the TR Skin themes folder.'
  }
  $null = Copy-DreamSkinThemeDirectory -Source $directory -Destination $paths.Active `
    -AllowedSourceRoot $paths.Saved -StateRoot $paths.Root -ValidatePayload
  Invoke-DreamSkinRandomPoolConfiguration -ThemeDirectory $paths.Active -StateRoot $paths.Root
  Test-DreamSkinThemePayload -ThemeDirectory $paths.Active
  return Read-DreamSkinTheme -ThemeDirectory $paths.Active
}
function Set-DreamSkinPaused {
  param(
    [Parameter(Mandatory = $true)][bool]$Paused,
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin')
  )
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  if ($Paused) {
    Assert-DreamSkinNoReparseComponents -Path $paths.PauseFile
    Write-DreamSkinUtf8FileAtomically -Path $paths.PauseFile -Content "paused`r`n"
  } else {
    if (Test-Path -LiteralPath $paths.PauseFile) { Assert-DreamSkinNoReparseComponents -Path $paths.PauseFile }
    Remove-Item -LiteralPath $paths.PauseFile -Force -ErrorAction SilentlyContinue
  }
  return $Paused
}

function Test-DreamSkinPaused {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  return (Test-Path -LiteralPath (Get-DreamSkinThemePaths -StateRoot $StateRoot).PauseFile -PathType Leaf)
}
