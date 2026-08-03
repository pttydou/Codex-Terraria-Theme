[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$VerifyInstalledRuntime
)

$ErrorActionPreference = 'Stop'
$PortExplicit = $PSBoundParameters.ContainsKey('Port')
$SourceRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'update-windows.ps1')

function Read-DreamSkinVersion {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $text = (Get-Content -LiteralPath $Path -Raw).Trim()
  $parsed = $null
  if (-not [version]::TryParse($text, [ref]$parsed)) { return $null }
  return $parsed
}

function Show-DreamSkinOneClickError {
  param([Parameter(Mandatory = $true)][string]$Message)
  try {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup(
      "Codex Terraria Skin could not start.`r`n`r`n$Message",
      0,
      'Codex Terraria Skin',
      16
    )
  } catch {}
}

try {
  Assert-DreamSkinPort -Port $Port
  $StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
  $installed = Get-DreamSkinRuntimeEnginePaths -StateRoot $StateRoot
  $sourceVersion = Read-DreamSkinVersion -Path (Join-Path $SourceRoot 'VERSION')
  if ($null -eq $sourceVersion) {
    throw "The package VERSION file is missing or invalid: $SourceRoot"
  }

  $sourceIsInstalled = Test-DreamSkinPathEqual -Left $SourceRoot -Right $installed.Root
  $installedVersion = Read-DreamSkinVersion -Path (Join-Path $installed.Root 'VERSION')
  $installedFiles = @(
    $installed.Version,
    $installed.OneClick,
    $installed.Start,
    $installed.Restore,
    $installed.Tray,
    $installed.ControlPanel
    $installed.Updater
  )
  $installedComplete = $true
  foreach ($required in $installedFiles) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
      $installedComplete = $false
      break
    }
  }
  $needsInstall = -not $sourceIsInstalled -and (
    -not $installedComplete -or
    $null -eq $installedVersion -or
    $sourceVersion -gt $installedVersion
  )

  if ($VerifyInstalledRuntime) {
    if (-not $sourceIsInstalled -or -not $installedComplete -or
      $null -eq $installedVersion -or $sourceVersion -ne $installedVersion) {
      throw 'The installed Terraria Skin runtime is incomplete or has an inconsistent VERSION identity.'
    }
    Write-Host "PASS: installed one-click runtime $installedVersion is complete and source-independent."
    return
  }

  $performedInstall = $false
  if ($sourceIsInstalled -and $installedComplete -and $null -ne $installedVersion) {
    $availableUpdate = Get-DreamSkinAvailableUpdate -InstalledVersion $installedVersion -StateRoot $StateRoot
    if ($null -ne $availableUpdate) {
      $targetVersion = "$($availableUpdate.release.version)"
      $confirmed = Confirm-DreamSkinRestart -Message (
        "TR Skin $targetVersion is available. The update only replaces program files; " +
        'music, themes, and settings will be preserved. Download and install it now?'
      )
      if ($confirmed) {
        $registeredInstalls = @(Get-DreamSkinRegisteredCodexInstalls)
        foreach ($codex in $registeredInstalls) {
          if ((Get-DreamSkinCodexProcesses -Codex $codex).Count -gt 0) {
            Stop-DreamSkinCodex -Codex $codex -AllowForce
          }
        }
        Install-DreamSkinAvailableUpdate -Manifest $availableUpdate -StateRoot $StateRoot
        $installed = Get-DreamSkinRuntimeEnginePaths -StateRoot $StateRoot
        $installedVersion = Read-DreamSkinVersion -Path $installed.Version
        $performedInstall = $true
      }
    }
  }
  if ($needsInstall) {
    $registeredInstalls = @(Get-DreamSkinRegisteredCodexInstalls)
    if ($registeredInstalls.Count -eq 0) {
      throw 'The official Microsoft Store OpenAI.Codex app was not found.'
    }
    $runningInstalls = @(
      $registeredInstalls | Where-Object {
        (Get-DreamSkinCodexProcesses -Codex $_).Count -gt 0
      }
    )
    if ($runningInstalls.Count -gt 0) {
      $confirmed = Confirm-DreamSkinRestart -Message (
        'Codex must close once to install or upgrade Terraria Skin. ' +
        'Unsaved input may be lost. Close Codex and continue?'
      )
      if (-not $confirmed) {
        Write-Host 'Installation was cancelled. Codex was not changed.'
        exit 0
      }
      $stoppedExecutables = @{}
      foreach ($codex in $runningInstalls) {
        $key = "$($codex.Executable)".ToLowerInvariant()
        if ($stoppedExecutables.ContainsKey($key)) { continue }
        Stop-DreamSkinCodex -Codex $codex -AllowForce
        $stoppedExecutables[$key] = $true
      }
    }

    $installer = Join-Path $PSScriptRoot 'install-dream-skin.ps1'
    $installParameters = @{}
    if ($PortExplicit) { $installParameters['Port'] = $Port }
    & $installer @installParameters
    if (-not $?) { throw 'The Terraria Skin installer did not finish.' }
    $installed = Get-DreamSkinRuntimeEnginePaths -StateRoot $StateRoot
    $performedInstall = $true
  } elseif (-not $installedComplete) {
    throw 'The installed Terraria Skin runtime is incomplete. Run this entry from a newer complete package.'
  }

  if (-not (Test-DreamSkinTrayActive)) {
    $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $trayArguments = "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($installed.Tray)`""
    if ($PortExplicit) { $trayArguments += " -Port $Port" }
    Start-Process -FilePath $powershell -ArgumentList $trayArguments -WindowStyle Hidden | Out-Null
  }

  if ($performedInstall) {
    $startParameters = @{
      PromptRestart = $true
    }
    if ($PortExplicit) { $startParameters['Port'] = $Port }
    & $installed.Start @startParameters
    if (-not $?) { throw 'Codex Terraria Skin did not start.' }
  }

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $panelArguments = "-NoProfile -STA -ExecutionPolicy Bypass -File `"$($installed.ControlPanel)`""
  if ($PortExplicit) { $panelArguments += " -Port $Port" }
  Start-Process -FilePath $powershell -ArgumentList $panelArguments -WindowStyle Normal | Out-Null
} catch {
  Show-DreamSkinOneClickError -Message $_.Exception.Message
  Write-Error $_
  exit 1
}
