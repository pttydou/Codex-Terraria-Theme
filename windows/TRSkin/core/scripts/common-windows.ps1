. (Join-Path $PSScriptRoot 'config-utf8.ps1')

function Enter-DreamSkinOperationLock {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.Operation")
  $acquired = $false
  try {
    $acquired = $mutex.WaitOne(0)
  } catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
  }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'Another TR Skin install, start, restore, or verify operation is already running.'
  }
  return $mutex
}

function Exit-DreamSkinOperationLock {
  param([Parameter(Mandatory = $true)][System.Threading.Mutex]$Mutex)
  try { $Mutex.ReleaseMutex() } finally { $Mutex.Dispose() }
}

function Assert-DreamSkinPort {
  param([Parameter(Mandatory = $true)][int]$Port)
  if ($Port -lt 1024 -or $Port -gt 65535) { throw "Port must be between 1024 and 65535: $Port" }
}

function Test-DreamSkinPathEqual {
  param([string]$Left, [string]$Right)
  if (-not $Left -or -not $Right) { return $false }
  try {
    return ([System.IO.Path]::GetFullPath($Left).TrimEnd('\') -ieq [System.IO.Path]::GetFullPath($Right).TrimEnd('\'))
  } catch {
    return $false
  }
}

function Test-DreamSkinPathWithin {
  param([string]$Path, [string]$Root)
  if (-not $Path -or -not $Root) { return $false }
  try {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $prefix = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    return $fullPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function Get-DreamSkinRuntimeEnginePaths {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  $root = Join-Path ([System.IO.Path]::GetFullPath($StateRoot)) 'engine'
  $scripts = Join-Path $root 'scripts'
  return [pscustomobject]@{
    Root = $root
    Version = Join-Path $root 'VERSION'
    Scripts = $scripts
    Start = Join-Path $scripts 'start-dream-skin.ps1'
    OneClick = Join-Path $scripts 'one-click-dream-skin.ps1'
    Restore = Join-Path $scripts 'restore-dream-skin.ps1'
    Purge = Join-Path $scripts 'purge-dream-skin-state.ps1'
    Tray = Join-Path $scripts 'tray-dream-skin.ps1'
    ControlPanel = Join-Path $scripts 'control-panel-windows.ps1'
    Updater = Join-Path $scripts 'update-windows.ps1'
  }
}

function Test-DreamSkinTrayActive {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.Tray")
  $acquired = $false
  try {
    try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] {
      $acquired = $true
    }
    if ($acquired) {
      $mutex.ReleaseMutex()
      $acquired = $false
      return $false
    }
    return $true
  } finally {
    if ($acquired) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
  }
}

function Test-DreamSkinControlPanelActive {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.ControlPanel")
  $acquired = $false
  try {
    try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] {
      $acquired = $true
    }
    if ($acquired) {
      $mutex.ReleaseMutex()
      $acquired = $false
      return $false
    }
    return $true
  } finally {
    if ($acquired) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
  }
}

function Stop-DreamSkinTrayProcess {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  $trayScript = (Get-DreamSkinRuntimeEnginePaths -StateRoot $StateRoot).Tray
  try {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" `
      -ErrorAction Stop
    foreach ($process in $processes) {
      if ($process.ProcessId -eq $PID -or -not $process.CommandLine) { continue }
      if ($process.CommandLine.IndexOf($trayScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      }
    }
  } catch {
    throw "Could not close the installed TR Skin control process safely: $($_.Exception.Message)"
  }

  $deadline = (Get-Date).AddSeconds(5)
  while ((Test-DreamSkinTrayActive) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 100
  }
  if (Test-DreamSkinTrayActive) {
    throw 'The installed TR Skin control process did not stop. Close it manually and retry.'
  }
}

function Stop-DreamSkinControlPanelProcess {
  param([string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'))
  $panelScript = (Get-DreamSkinRuntimeEnginePaths -StateRoot $StateRoot).ControlPanel
  try {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" `
      -ErrorAction Stop
    foreach ($process in $processes) {
      if ($process.ProcessId -eq $PID -or -not $process.CommandLine) { continue }
      if ($process.CommandLine.IndexOf($panelScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      }
    }
  } catch {
    throw "Could not close the installed TR Skin control panel safely: $($_.Exception.Message)"
  }

  $deadline = (Get-Date).AddSeconds(5)
  while ((Test-DreamSkinControlPanelActive) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 100
  }
  if (Test-DreamSkinControlPanelActive) {
    throw 'The installed TR Skin control panel did not stop. Close it manually and retry.'
  }
}

function Remove-DreamSkinShortcuts {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $names = @(
    'Codex Dream Skin.lnk',
    'Codex Dream Skin - Restore.lnk',
    'Codex Dream Skin - Tray.lnk',
    'Codex Terraria Skin Console.lnk',
    'Restore Codex Official Appearance.lnk',
    'Uninstall Codex Terraria Skin.lnk',
    '恢复 Codex 官方外观.lnk',
    'Codex Terraria 皮肤控制台.lnk',
    'TR Skin Console.lnk',
    'TR Skin Control Panel.lnk'
  )
  foreach ($folder in @($desktop, $startMenu)) {
    foreach ($name in $names) {
      Remove-Item -LiteralPath (Join-Path $folder $name) -Force -ErrorAction SilentlyContinue
    }
  }
}

function Assert-DreamSkinRuntimeTree {
  param([Parameter(Mandatory = $true)][string]$Path)
  $root = [System.IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "TR Skin runtime directory does not exist: $root"
  }
  if (-not (Get-Command Assert-DreamSkinNoReparseComponents -ErrorAction SilentlyContinue)) {
    throw 'TR Skin managed-path validation is unavailable.'
  }
  Assert-DreamSkinNoReparseComponents -Path $root
  foreach ($item in Get-ChildItem -LiteralPath $root -Recurse -Force -ErrorAction Stop) {
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "TR Skin runtime contains a junction or symbolic link: $($item.FullName)"
    }
  }
}

function Remove-DreamSkinRuntimeTree {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$StateRoot
  )
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $fullStateRoot = [System.IO.Path]::GetFullPath($StateRoot)
  if (-not (Test-DreamSkinPathWithin -Path $fullPath -Root $fullStateRoot)) {
    throw "Refusing to remove a runtime path outside the TR Skin state root: $fullPath"
  }
  if (-not (Test-Path -LiteralPath $fullPath)) { return }
  Assert-DreamSkinRuntimeTree -Path $fullPath
  Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
}

function Install-DreamSkinRuntimeEngine {
  param(
    [Parameter(Mandatory = $true)][string]$SkillRoot,
    [Parameter(Mandatory = $true)][string]$StateRoot
  )
  if (-not (Get-Command Ensure-DreamSkinManagedDirectory -ErrorAction SilentlyContinue)) {
    throw 'TR Skin managed-directory validation is unavailable.'
  }

  $sourceRoot = [System.IO.Path]::GetFullPath($SkillRoot)
  $fullStateRoot = [System.IO.Path]::GetFullPath($StateRoot)
  $engine = Get-DreamSkinRuntimeEnginePaths -StateRoot $fullStateRoot
  $required = @(
    'VERSION',
    'assets\dream-skin.css',
    'assets\renderer-inject.js',
    'assets\terraria-music-catalog.json',
    'assets\trskin.ico',
    'scripts\common-windows.ps1',
    'scripts\config-utf8.ps1',
    'scripts\control-panel-windows.ps1',
    'scripts\image-metadata.mjs',
    'scripts\injector.mjs',
    'scripts\music-config.mjs',
    'scripts\one-click-dream-skin.ps1',
    'scripts\purge-dream-skin-state.ps1',
    'scripts\random-pool-config.mjs',
    'scripts\theme-payload.mjs',
    'scripts\install-dream-skin.ps1',
    'scripts\restore-dream-skin.ps1',
    'scripts\start-dream-skin.ps1',
    'scripts\theme-windows.ps1',
    'scripts\tray-dream-skin.ps1',
    'scripts\verify-dream-skin.ps1',
    'local-presets\preset-terraria-random\theme.json',
    'local-presets\CARD_ICON_SOURCES.json',
    'local-presets\COMPANION_SOURCES.json',
    'runtime\win-arm64\node.exe',
    'runtime\win-x64\node.exe',
    'runtime\LICENSE.node.txt'
  )
  foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $relative) -PathType Leaf)) {
      throw "TR Skin runtime source is incomplete: $relative"
    }
  }
  $sourceVersionText = (Get-Content -LiteralPath (Join-Path $sourceRoot 'VERSION') -Raw).Trim()
  $sourceVersion = $null
  if (-not [version]::TryParse($sourceVersionText, [ref]$sourceVersion)) {
    throw "TR Skin runtime source has an invalid VERSION: $sourceVersionText"
  }
  $runtimeDirectories = @('assets', 'scripts', 'local-presets', 'runtime')
  $runtimeFiles = @('VERSION')
  if (Test-Path -LiteralPath (Join-Path $sourceRoot 'BUILD-INFO.json') -PathType Leaf) {
    $runtimeFiles += 'BUILD-INFO.json'
  }
  foreach ($directoryName in $runtimeDirectories) {
    $sourceDirectory = Join-Path $sourceRoot $directoryName
    if ((Test-DreamSkinPathEqual -Left $fullStateRoot -Right $sourceDirectory) -or
      (Test-DreamSkinPathWithin -Path $fullStateRoot -Root $sourceDirectory)) {
      throw "TR Skin state root cannot be created inside its runtime source: $fullStateRoot"
    }
    Assert-DreamSkinRuntimeTree -Path $sourceDirectory
  }

  Ensure-DreamSkinManagedDirectory -Path $fullStateRoot -Root $fullStateRoot
  $token = [guid]::NewGuid().ToString('N')
  $stagingRoot = Join-Path $fullStateRoot ".engine-staging-$token"
  $backupRoot = Join-Path $fullStateRoot ".engine-backup-$token"
  Ensure-DreamSkinManagedDirectory -Path $stagingRoot -Root $fullStateRoot

  try {
    foreach ($directoryName in $runtimeDirectories) {
      Copy-Item -LiteralPath (Join-Path $sourceRoot $directoryName) -Destination $stagingRoot `
        -Recurse -Force -ErrorAction Stop
    }
    foreach ($fileName in $runtimeFiles) {
      Copy-Item -LiteralPath (Join-Path $sourceRoot $fileName) -Destination $stagingRoot `
        -Force -ErrorAction Stop
    }
    Assert-DreamSkinRuntimeTree -Path $stagingRoot
    foreach ($relative in $required) {
      if (-not (Test-Path -LiteralPath (Join-Path $stagingRoot $relative) -PathType Leaf)) {
        throw "Staged TR Skin runtime is incomplete: $relative"
      }
    }

    $sourcePrefix = $sourceRoot.TrimEnd('\') + '\'
    $sourceFiles = @(
      Get-ChildItem -LiteralPath ($runtimeDirectories | ForEach-Object { Join-Path $sourceRoot $_ }) `
        -Recurse -File -Force -ErrorAction Stop
    ) + @($runtimeFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $sourceRoot $_) -Force })
    $stagedFiles = @(
      Get-ChildItem -LiteralPath ($runtimeDirectories | ForEach-Object { Join-Path $stagingRoot $_ }) `
        -Recurse -File -Force -ErrorAction Stop
    ) + @($runtimeFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $stagingRoot $_) -Force })
    if ($sourceFiles.Count -ne $stagedFiles.Count) {
      throw 'Staged TR Skin runtime file count does not match its source.'
    }
    foreach ($sourceFile in $sourceFiles) {
      $relative = $sourceFile.FullName.Substring($sourcePrefix.Length)
      $stagedFile = Join-Path $stagingRoot $relative
      if (-not (Test-Path -LiteralPath $stagedFile -PathType Leaf) -or
        (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceFile.FullName).Hash -cne
        (Get-FileHash -Algorithm SHA256 -LiteralPath $stagedFile).Hash) {
        throw "Staged TR Skin runtime failed hash verification: $relative"
      }
    }

    $hasBackup = $false
    if (Test-Path -LiteralPath $engine.Root) {
      Assert-DreamSkinRuntimeTree -Path $engine.Root
      Move-Item -LiteralPath $engine.Root -Destination $backupRoot -ErrorAction Stop
      $hasBackup = $true
    }
    try {
      Move-Item -LiteralPath $stagingRoot -Destination $engine.Root -ErrorAction Stop
    } catch {
      $installError = $_.Exception.Message
      if ($hasBackup -and -not (Test-Path -LiteralPath $engine.Root)) {
        try {
          Move-Item -LiteralPath $backupRoot -Destination $engine.Root -ErrorAction Stop
          $hasBackup = $false
        } catch {
          throw "TR Skin runtime update failed and its previous engine could not be restored. Backup preserved at ${backupRoot}: $installError"
        }
      }
      throw
    }
    if ($hasBackup) {
      try { Remove-DreamSkinRuntimeTree -Path $backupRoot -StateRoot $fullStateRoot } catch {
        try {
          Write-Warning "Installed the new runtime but could not remove its previous backup: $($_.Exception.Message)"
        } catch {
          # Cleanup must never make a committed runtime update look unsuccessful.
        }
      }
    }
    return Get-DreamSkinRuntimeEnginePaths -StateRoot $fullStateRoot
  } finally {
    if (Test-Path -LiteralPath $stagingRoot) {
      try { Remove-DreamSkinRuntimeTree -Path $stagingRoot -StateRoot $fullStateRoot } catch {
        try {
          Write-Warning "Could not remove the staged TR Skin runtime: $($_.Exception.Message)"
        } catch {
          # Cleanup must never mask the runtime installation result.
        }
      }
    }
  }
}

function Test-DreamSkinCommandLineToken {
  param([string]$CommandLine, [string]$Token)
  if (-not $CommandLine -or -not $Token) { return $false }
  $pattern = '(?i)(?:^|[\s"])' + [regex]::Escape($Token) + '(?=$|[\s"])'
  return [regex]::IsMatch($CommandLine, $pattern)
}

function ConvertTo-DreamSkinProcessArgument {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
  if ($Value.Contains('"')) { throw 'Process arguments containing a double quote are not supported.' }
  if ($Value.Length -eq 0) { return '""' }
  if ($Value -notmatch '\s') { return $Value }
  $escaped = [regex]::Replace($Value, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}

function ConvertTo-DreamSkinArgumentLine {
  param([AllowEmptyCollection()][string[]]$Arguments = @())
  return (($Arguments | ForEach-Object { ConvertTo-DreamSkinProcessArgument -Value $_ }) -join ' ')
}

function Get-DreamSkinProcessExecutablePath {
  param([Parameter(Mandatory = $true)][object]$ProcessInfo)
  if ($ProcessInfo.ExecutablePath) { return "$($ProcessInfo.ExecutablePath)" }
  try {
    $process = Get-Process -Id ([int]$ProcessInfo.ProcessId) -ErrorAction Stop
    if ($process.Path) { return "$($process.Path)" }
    return "$($process.MainModule.FileName)"
  } catch {
    return $null
  }
}

# Windows PowerShell 5.1 promotes redirected native-command stderr lines to
# ErrorRecords; while $ErrorActionPreference is 'Stop' the first stderr line
# becomes a terminating NativeCommandError before the exit code can be read.
# Run the command with the preference relaxed and report output + exit code.
function Invoke-DreamSkinNative {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [switch]$DiscardStderr
  )
  $previousPreference = $ErrorActionPreference
  $previousConsoleOutputEncoding = [Console]::OutputEncoding
  $previousOutputEncoding = $OutputEncoding
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $ErrorActionPreference = 'Continue'
  try {
    # Windows PowerShell 5.1 otherwise decodes redirected native stdout with
    # the active legacy code page. Every Node helper emits UTF-8 JSON, so one
    # central boundary must cover random pools, music catalogs, themes, and
    # non-ASCII paths regardless of how the hidden control panel was started.
    [Console]::OutputEncoding = $utf8NoBom
    $OutputEncoding = $utf8NoBom
    if ($DiscardStderr) {
      $nativeOutput = @(& $FilePath @ArgumentList 2>$null)
    } else {
      $nativeOutput = @(& $FilePath @ArgumentList 2>&1)
    }
    $exitCode = $LASTEXITCODE
    $output = @($nativeOutput | ForEach-Object { "$_" })
    return [pscustomobject]@{ Output = $output; ExitCode = $exitCode }
  } finally {
    $OutputEncoding = $previousOutputEncoding
    [Console]::OutputEncoding = $previousConsoleOutputEncoding
    $ErrorActionPreference = $previousPreference
  }
}

function Get-DreamSkinNodeRuntime {
  param([int]$MinimumMajor = 22)

  $nativeArchitecture = if ($env:PROCESSOR_ARCHITEW6432) {
    "$env:PROCESSOR_ARCHITEW6432"
  } else {
    "$env:PROCESSOR_ARCHITECTURE"
  }
  $runtimeFolder = if ($nativeArchitecture -match '(?i)^ARM64$') {
    'win-arm64'
  } elseif ($nativeArchitecture -match '(?i)^(AMD64|x64)$') {
    'win-x64'
  } else {
    throw "Codex Terraria Skin supports 64-bit Windows x64 and arm64; detected $nativeArchitecture."
  }
  $skillRoot = Split-Path -Parent $PSScriptRoot
  $portableRuntime = Join-Path $skillRoot "runtime\$runtimeFolder\node.exe"
  $candidates = @()
  if (Test-Path -LiteralPath $portableRuntime -PathType Leaf) {
    $candidates += $portableRuntime
  }
  $pathCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $pathCommand) { $pathCommand = Get-Command node -ErrorAction SilentlyContinue }
  if ($pathCommand -and $candidates -notcontains $pathCommand.Source) {
    $candidates += $pathCommand.Source
  }
  foreach ($candidate in $candidates) {
    $versionProbe = Invoke-DreamSkinNative -FilePath $candidate `
      -ArgumentList @('-p', 'process.versions.node') -DiscardStderr
    $version = ($versionProbe.Output -join '').Trim()
    if ($versionProbe.ExitCode -ne 0 -or -not $version) { continue }
    $pathProbe = Invoke-DreamSkinNative -FilePath $candidate `
      -ArgumentList @('-p', 'process.execPath') -DiscardStderr
    $runtimePath = ($pathProbe.Output -join '').Trim()
    if ($pathProbe.ExitCode -ne 0 -or -not $runtimePath -or
      -not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) {
      continue
    }
    $major = 0
    if ([int]::TryParse(($version -split '\.')[0], [ref]$major) -and $major -ge $MinimumMajor) {
      return [pscustomobject]@{ Path = $runtimePath; Version = $version; Major = $major }
    }
  }
  throw "Bundled Node.js $MinimumMajor+ could not run. Re-extract the ZIP and run START-TRSKIN.cmd again."
}

function ConvertTo-DreamSkinCodexInstall {
  param(
    [Parameter(Mandatory = $true)][object]$Package,
    [AllowNull()][object]$Manifest
  )
  if ("$($Package.Name)" -ine 'OpenAI.Codex' -or -not $Package.InstallLocation -or
    -not $Package.PackageFullName -or -not $Package.PackageFamilyName -or
    "$($Package.SignatureKind)" -ine 'Store' -or [bool]$Package.IsDevelopmentMode) {
    return $null
  }
  $packageRoot = "$($Package.InstallLocation)"
  $executable = Join-Path $packageRoot 'app\ChatGPT.exe'
  if (-not (Test-Path -LiteralPath $executable)) { return $null }
  try {
    if (-not $PSBoundParameters.ContainsKey('Manifest')) {
      $Manifest = Get-AppxPackageManifest -Package $Package -ErrorAction Stop
    }
    $applications = @($Manifest.Package.Applications.Application | Where-Object {
      "$($_.Executable)".Replace('/', '\') -ieq 'app\ChatGPT.exe'
    })
    if ($applications.Count -ne 1) { return $null }
    $applicationId = "$($applications[0].Id)"
  } catch {
    return $null
  }
  $packageFamilyName = "$($Package.PackageFamilyName)"
  if ($packageFamilyName -cnotmatch '^[A-Za-z0-9._-]{1,128}$' -or
    $applicationId -cnotmatch '^[A-Za-z0-9._-]{1,64}$') {
    return $null
  }
  return [pscustomobject]@{
    PackageRoot = $packageRoot
    Executable = $executable
    Version = "$($Package.Version)"
    PackageFullName = "$($Package.PackageFullName)"
    PackageFamilyName = $packageFamilyName
    ApplicationId = $applicationId
    AppUserModelId = "$packageFamilyName!$applicationId"
    SignatureKind = "$($Package.SignatureKind)"
  }
}

function Get-DreamSkinRegisteredCodexInstalls {
  $packages = @(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop | Sort-Object Version -Descending)
  $installs = @()
  foreach ($package in $packages) {
    $install = ConvertTo-DreamSkinCodexInstall -Package $package
    if ($null -ne $install) { $installs += $install }
  }
  return $installs
}

function Get-DreamSkinCodexInstall {
  $installs = @(Get-DreamSkinRegisteredCodexInstalls)
  if ($installs.Count -eq 0) { throw 'The official OpenAI.Codex Store package is not installed or its identity cannot be validated.' }
  return $installs[0]
}

function Initialize-DreamSkinPackageLauncher {
  if ('CodexDreamSkin.PackageLauncher' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace CodexDreamSkin {
  [Flags]
  internal enum ActivateOptions : uint {
    None = 0
  }

  [ComImport]
  [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IApplicationActivationManager {
    [PreserveSig]
    int ActivateApplication(
      [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
      [MarshalAs(UnmanagedType.LPWStr)] string arguments,
      ActivateOptions options,
      out uint processId);
  }

  [ComImport]
  [Guid("45ba127d-10a8-46ea-8ab7-56ea9078943c")]
  internal class ApplicationActivationManager {}

  public static class PackageLauncher {
    public static uint Launch(string appUserModelId, string arguments) {
      var manager = (IApplicationActivationManager)new ApplicationActivationManager();
      try {
        uint processId;
        int result = manager.ActivateApplication(
          appUserModelId,
          arguments ?? string.Empty,
          ActivateOptions.None,
          out processId);
        Marshal.ThrowExceptionForHR(result);
        return processId;
      } finally {
        if (Marshal.IsComObject(manager)) Marshal.FinalReleaseComObject(manager);
      }
    }
  }
}
'@
}

function Start-DreamSkinCodex {
  param(
    [Parameter(Mandatory = $true)][object]$Codex,
    [AllowEmptyCollection()][string[]]$Arguments = @()
  )
  $appUserModelId = "$($Codex.AppUserModelId)"
  if ($appUserModelId -cnotmatch '^[A-Za-z0-9._-]{1,128}![A-Za-z0-9._-]{1,64}$') {
    throw 'The registered Codex AppUserModelId is unavailable or invalid.'
  }
  Initialize-DreamSkinPackageLauncher
  $argumentLine = ConvertTo-DreamSkinArgumentLine -Arguments $Arguments
  $processId = [CodexDreamSkin.PackageLauncher]::Launch($appUserModelId, $argumentLine)
  if ($processId -le 0) { throw 'Windows did not return a Codex process ID after package activation.' }
  return $processId
}

function Get-DreamSkinCodexStatePathCandidate {
  param([AllowNull()][object]$State)
  if ($null -eq $State -or -not $State.codexExe -or -not $State.codexPackageRoot) { return $null }
  $executable = "$($State.codexExe)"
  $packageRoot = "$($State.codexPackageRoot)"
  $expectedExecutable = Join-Path $packageRoot 'app\ChatGPT.exe'
  if (-not (Test-DreamSkinPathEqual -Left $executable -Right $expectedExecutable)) { return $null }
  return [pscustomobject]@{
    PackageRoot = $packageRoot
    Executable = $executable
    Version = "$($State.codexVersion)"
    FromState = $true
    RegisteredPackageVerified = $false
  }
}

function Resolve-DreamSkinCodexInstallFromState {
  param(
    [AllowNull()][object]$State,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$RegisteredInstalls
  )
  $candidate = Get-DreamSkinCodexStatePathCandidate -State $State
  if ($null -eq $candidate) { return $null }

  $hasFullName = [bool]$State.codexPackageFullName
  $hasFamilyName = [bool]$State.codexPackageFamilyName
  if ($hasFullName -xor $hasFamilyName) { return $null }
  foreach ($install in $RegisteredInstalls) {
    $pathMatches = (Test-DreamSkinPathEqual -Left $candidate.PackageRoot -Right $install.PackageRoot) -and
      (Test-DreamSkinPathEqual -Left $candidate.Executable -Right $install.Executable)
    if (-not $pathMatches) { continue }
    if ($hasFullName -and ("$($State.codexPackageFullName)" -ine $install.PackageFullName -or
      "$($State.codexPackageFamilyName)" -ine $install.PackageFamilyName)) {
      continue
    }
    return [pscustomobject]@{
      PackageRoot = $install.PackageRoot
      Executable = $install.Executable
      Version = $install.Version
      PackageFullName = $install.PackageFullName
      PackageFamilyName = $install.PackageFamilyName
      ApplicationId = $install.ApplicationId
      AppUserModelId = $install.AppUserModelId
      SignatureKind = $install.SignatureKind
      FromState = $true
      RegisteredPackageVerified = $true
    }
  }
  return $null
}

function Get-DreamSkinCodexInstallFromState {
  param([AllowNull()][object]$State)
  try { $installs = @(Get-DreamSkinRegisteredCodexInstalls) } catch { return $null }
  return Resolve-DreamSkinCodexInstallFromState -State $State -RegisteredInstalls $installs
}

function Test-DreamSkinWebSocketUrl {
  param([string]$Value, [int]$Port)
  try {
    $uri = [Uri]$Value
    $hostName = $uri.Host.ToLowerInvariant()
    return ($uri.IsAbsoluteUri -and $uri.Scheme -eq 'ws' -and $uri.Port -eq $Port -and
      $hostName -in @('127.0.0.1', 'localhost', '::1', '[::1]') -and -not $uri.UserInfo -and
      -not $uri.Query -and -not $uri.Fragment -and
      $uri.AbsolutePath -cmatch '^/devtools/(?:page|browser)/[A-Za-z0-9._-]{1,200}$')
  } catch {
    return $false
  }
}

function Test-DreamSkinCdpPageTarget {
  param([AllowNull()][object]$Target, [int]$Port)
  if ($null -eq $Target -or "$($Target.type)" -cne 'page') {
    return $false
  }
  try {
    $pageUri = [Uri]"$($Target.url)"
    $trustedRendererUrl = $pageUri.IsAbsoluteUri -and -not $pageUri.UserInfo -and (
      $pageUri.Scheme -in @('app', 'file') -or
      ($pageUri.Scheme -eq 'https' -and
        $pageUri.Host.ToLowerInvariant() -in @('chatgpt.com', 'chat.openai.com', 'codex.openai.com'))
    )
    if (-not $trustedRendererUrl) { return $false }
  } catch {
    return $false
  }
  if ($Target.id -isnot [string]) { return $false }
  $targetId = "$($Target.id)"
  $webSocketUrl = "$($Target.webSocketDebuggerUrl)"
  if (-not (Test-DreamSkinBrowserId -Value $targetId) -or
    -not (Test-DreamSkinWebSocketUrl -Value $webSocketUrl -Port $Port)) {
    return $false
  }
  try {
    return ([Uri]$webSocketUrl).AbsolutePath -ceq "/devtools/page/$targetId"
  } catch {
    return $false
  }
}

function Get-DreamSkinCdpTargets {
  param([int]$Port)
  try {
    $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 2 `
      -MaximumRedirection 0 -ErrorAction Stop
    return @($targets | Where-Object { Test-DreamSkinCdpPageTarget -Target $_ -Port $Port })
  } catch {
    return @()
  }
}

function Test-DreamSkinBrowserId {
  param([string]$Value)
  return [bool]($Value -and $Value.Length -le 200 -and $Value -cmatch '^[A-Za-z0-9._-]+$')
}

function Get-DreamSkinCdpBrowserIdentity {
  param([int]$Port)
  try {
    $version = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 `
      -MaximumRedirection 0 -ErrorAction Stop
    $webSocketUrl = "$($version.webSocketDebuggerUrl)"
    if (-not (Test-DreamSkinWebSocketUrl -Value $webSocketUrl -Port $Port)) { return $null }
    $uri = [Uri]$webSocketUrl
    $match = [regex]::Match($uri.AbsolutePath, '^/devtools/browser/(?<id>[A-Za-z0-9._-]{1,200})$')
    if (-not $match.Success -or $uri.Query -or $uri.Fragment) { return $null }
    $browserId = $match.Groups['id'].Value
    if (-not (Test-DreamSkinBrowserId -Value $browserId)) { return $null }
    return [pscustomobject]@{
      BrowserId = $browserId
      WebSocketDebuggerUrl = $webSocketUrl
      Browser = "$($version.Browser)"
    }
  } catch {
    return $null
  }
}

function Get-DreamSkinPortListeners {
  param([int]$Port)
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    throw 'Get-NetTCPConnection is required to verify CDP listener ownership.'
  }
  return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Test-DreamSkinPortAvailable {
  param([int]$Port)
  return (Get-DreamSkinPortListeners -Port $Port).Count -eq 0
}

function Test-DreamSkinCodexPortOwner {
  param([int]$Port, [Parameter(Mandatory = $true)][object]$Codex)
  $listeners = Get-DreamSkinPortListeners -Port $Port
  if ($listeners.Count -eq 0) { return $false }
  foreach ($listener in $listeners) {
    if ($listener.LocalAddress -notin @('127.0.0.1', '::1')) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$listener.OwningProcess)" -ErrorAction SilentlyContinue
    $processPath = if ($process) { Get-DreamSkinProcessExecutablePath -ProcessInfo $process } else { $null }
    if (-not $processPath -or -not (Test-DreamSkinPathEqual -Left $processPath -Right $Codex.Executable)) {
      return $false
    }
  }
  return $true
}

function Get-DreamSkinVerifiedCdpIdentity {
  param([int]$Port, [Parameter(Mandatory = $true)][object]$Codex)
  if (-not (Test-DreamSkinCodexPortOwner -Port $Port -Codex $Codex)) { return $null }
  $browser = Get-DreamSkinCdpBrowserIdentity -Port $Port
  if ($null -eq $browser) { return $null }
  $targets = Get-DreamSkinCdpTargets -Port $Port
  if ($targets.Count -eq 0) { return $null }
  if (-not (Test-DreamSkinCodexPortOwner -Port $Port -Codex $Codex)) { return $null }
  return [pscustomobject]@{
    BrowserId = $browser.BrowserId
    BrowserWebSocketDebuggerUrl = $browser.WebSocketDebuggerUrl
    Browser = $browser.Browser
    TargetCount = $targets.Count
  }
}

function Test-DreamSkinCodexCdpEndpoint {
  param([int]$Port, [Parameter(Mandatory = $true)][object]$Codex)
  return $null -ne (Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $Codex)
}

function Select-DreamSkinPort {
  param([int]$PreferredPort)
  for ($candidate = $PreferredPort; $candidate -le [Math]::Min(65535, $PreferredPort + 100); $candidate++) {
    if (Test-DreamSkinPortAvailable -Port $candidate) { return $candidate }
  }
  throw "No free loopback port was found between $PreferredPort and $([Math]::Min(65535, $PreferredPort + 100))."
}

function Wait-DreamSkinPortAvailable {
  param([int]$Port, [int]$TimeoutSeconds = 5)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-DreamSkinPortAvailable -Port $Port) { return $true }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Read-DreamSkinState {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    $state = (Read-DreamSkinUtf8File -Path $Path) | ConvertFrom-Json -ErrorAction Stop
    if ($null -eq $state -or $state -is [string] -or $state -is [array]) { throw 'State root must be an object.' }
    $properties = @($state.PSObject.Properties.Name)
    if ($properties -contains 'platform' -and "$($state.platform)" -ine 'windows') {
      throw 'State platform is not Windows.'
    }
    $schemaVersion = 1
    if ($properties -contains 'schemaVersion') {
      $schemaVersion = 0
      if (-not [int]::TryParse("$($state.schemaVersion)", [ref]$schemaVersion) -or
        $schemaVersion -lt 1 -or $schemaVersion -gt 3) {
        throw 'State schema is not supported.'
      }
    }
    if ($schemaVersion -ge 3) {
      foreach ($required in @(
        'platform', 'port', 'injectorPid', 'injectorStartedAt', 'injectorPath', 'nodePath',
        'codexExe', 'codexPackageRoot', 'codexPackageFullName', 'codexPackageFamilyName', 'browserId'
      )) {
        if ($properties -notcontains $required -or -not $state.$required) {
          throw "State schema 3 is missing required field: $required"
        }
      }
    }
    if ($properties -contains 'port') {
      $statePort = 0
      if (-not [int]::TryParse("$($state.port)", [ref]$statePort)) { throw 'State port is invalid.' }
      Assert-DreamSkinPort -Port $statePort
    }
    if ($properties -contains 'injectorPid' -and $null -ne $state.injectorPid) {
      $statePid = 0
      if (-not [int]::TryParse("$($state.injectorPid)", [ref]$statePid) -or $statePid -le 0) {
        throw 'State injector PID is invalid.'
      }
    }
    if ($properties -contains 'browserId' -and $state.browserId -and
      -not (Test-DreamSkinBrowserId -Value "$($state.browserId)")) {
      throw 'State browser ID is invalid.'
    }
    return $state
  } catch {
    throw "TR Skin state is unreadable; it was preserved for inspection: $Path"
  }
}

function Write-DreamSkinState {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][object]$State)
  $json = $State | ConvertTo-Json -Depth 6
  Write-DreamSkinUtf8FileAtomically -Path $Path -Content ($json + "`r`n")
}

function Archive-DreamSkinStateFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $directory = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Path))
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fff')
  $archivePath = Join-Path $directory "state.stale-$stamp-$([guid]::NewGuid().ToString('N')).json"
  Move-Item -LiteralPath $Path -Destination $archivePath -ErrorAction Stop
  return $archivePath
}

function Get-DreamSkinProcessStartedAt {
  param([int]$ProcessId)
  try {
    return (Get-Process -Id $ProcessId -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')
  } catch {
    return $null
  }
}

function Stop-DreamSkinRecordedInjector {
  param([AllowNull()][object]$State)
  if ($null -eq $State -or -not $State.injectorPid) { return $true }
  $processId = [int]$State.injectorPid
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  if (-not $process) { return $true }

  $expectedInjector = if ($State.injectorPath) {
    "$($State.injectorPath)"
  } elseif ($State.skillRoot) {
    Join-Path "$($State.skillRoot)" 'scripts\injector.mjs'
  } else {
    $null
  }
  $processPath = Get-DreamSkinProcessExecutablePath -ProcessInfo $process
  $commandLine = "$($process.CommandLine)"
  if (-not $processPath -or -not $commandLine) {
    throw "The recorded injector PID $processId is running, but its identity cannot be inspected. State was preserved."
  }
  $isNodeExecutable = [System.IO.Path]::GetFileName("$processPath") -ieq 'node.exe'
  $nodeMatches = -not $State.nodePath -or
    (Test-DreamSkinPathEqual -Left $processPath -Right "$($State.nodePath)")
  $injectorMatches = [bool]($expectedInjector -and
    (Test-DreamSkinCommandLineToken -CommandLine $commandLine -Token $expectedInjector) -and
    (Test-DreamSkinCommandLineToken -CommandLine $commandLine -Token '--watch'))
  if ($State.port) {
    $portPattern = '(?i)(?:^|\s)--port(?:=|\s+)' + [regex]::Escape("$($State.port)") + '(?=$|\s)'
    $injectorMatches = $injectorMatches -and [regex]::IsMatch($commandLine, $portPattern)
  } else {
    $injectorMatches = $false
  }
  if ($State.browserId) {
    $browserPattern = '(?:^|\s)(?i:--browser-id)(?:=|\s+)' + [regex]::Escape("$($State.browserId)") + '(?=$|\s)'
    $injectorMatches = $injectorMatches -and [regex]::IsMatch($commandLine, $browserPattern)
  }
  $startedAt = Get-DreamSkinProcessStartedAt -ProcessId $processId
  $startMatches = -not $State.injectorStartedAt -or $startedAt -eq "$($State.injectorStartedAt)"
  $identityMatches = [bool]($isNodeExecutable -and $nodeMatches -and $injectorMatches -and $startMatches)

  if (-not $identityMatches) {
    throw "The recorded injector PID $processId is running, but its visible identity does not match the saved TR Skin process. State was preserved."
  }

  Stop-Process -Id $processId -Force -ErrorAction Stop
  try { Wait-Process -Id $processId -Timeout 5 -ErrorAction Stop } catch {}
  if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    throw "The recorded TR Skin injector did not stop: PID $processId"
  }
  return $true
}

function Get-DreamSkinCodexProcesses {
  param([Parameter(Mandatory = $true)][object]$Codex)
  return @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $processPath = Get-DreamSkinProcessExecutablePath -ProcessInfo $_
      Test-DreamSkinPathEqual -Left $processPath -Right $Codex.Executable
    })
}

function Stop-DreamSkinCodex {
  param([Parameter(Mandatory = $true)][object]$Codex, [switch]$AllowForce)
  $processes = Get-DreamSkinCodexProcesses -Codex $Codex
  if ($processes.Count -eq 0) { return }
  foreach ($item in $processes) {
    try { [void](Get-Process -Id $item.ProcessId -ErrorAction Stop).CloseMainWindow() } catch {}
  }

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-DreamSkinCodexProcesses -Codex $Codex).Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  $remaining = Get-DreamSkinCodexProcesses -Codex $Codex
  if ($remaining.Count -eq 0) { return }
  if (-not $AllowForce) {
    throw 'Codex did not close within 15 seconds. Close it manually or explicitly authorize a forced restart.'
  }
  foreach ($item in $remaining) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$item.ProcessId)" -ErrorAction SilentlyContinue
    $currentPath = if ($current) { Get-DreamSkinProcessExecutablePath -ProcessInfo $current } else { $null }
    if ($currentPath -and (Test-DreamSkinPathEqual -Left $currentPath -Right $Codex.Executable)) {
      Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 500
  if ((Get-DreamSkinCodexProcesses -Codex $Codex).Count -gt 0) { throw 'Codex could not be stopped safely.' }
}

function Confirm-DreamSkinRestart {
  param([string]$Message)
  $shell = New-Object -ComObject WScript.Shell
  return $shell.Popup($Message, 0, 'TR Skin', 52) -eq 6
}
