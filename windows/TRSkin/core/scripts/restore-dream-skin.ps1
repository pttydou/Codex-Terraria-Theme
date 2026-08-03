[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$Uninstall,
  [switch]$PurgeAllData,
  [switch]$RestoreBaseTheme,
  [switch]$RecoverConfigBackup,
  [switch]$PromptRestart,
  [switch]$ForceRestart,
  [switch]$NoRelaunch
)

$ErrorActionPreference = 'Stop'
$PortExplicit = $PSBoundParameters.ContainsKey('Port')
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$operationLock = Enter-DreamSkinOperationLock
try {
  if ($PurgeAllData -and (-not $Uninstall -or -not $RestoreBaseTheme)) {
    throw '-PurgeAllData requires both -Uninstall and -RestoreBaseTheme.'
  }
  if ($PurgeAllData) {
    $NoRelaunch = $true
  }
  if ($RestoreBaseTheme -and $RecoverConfigBackup) {
    throw 'Choose either -RestoreBaseTheme or -RecoverConfigBackup, not both.'
  }
  Assert-DreamSkinPort -Port $Port

  $StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
  $themePaths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $themePaths.Root -Root $themePaths.Root
  $StatePath = Join-Path $StateRoot 'state.json'
  $state = Read-DreamSkinState -Path $StatePath
  if (-not $PortExplicit -and $null -ne $state -and $state.port) {
    $Port = [int]$state.port
    Assert-DreamSkinPort -Port $Port
  }

  $currentCodex = $null
  try { $currentCodex = Get-DreamSkinCodexInstall } catch { Write-Warning $_.Exception.Message }
  $savedPathCandidate = Get-DreamSkinCodexStatePathCandidate -State $state
  $savedCodex = Get-DreamSkinCodexInstallFromState -State $state
  $candidateMatchesCurrent = [bool]($null -ne $savedPathCandidate -and $null -ne $currentCodex -and
    (Test-DreamSkinPathEqual -Left $savedPathCandidate.PackageRoot -Right $currentCodex.PackageRoot) -and
    (Test-DreamSkinPathEqual -Left $savedPathCandidate.Executable -Right $currentCodex.Executable))
  if ($null -ne $savedPathCandidate -and $null -eq $savedCodex -and -not $candidateMatchesCurrent) {
    $unverifiedSavedRunning = (Get-DreamSkinCodexProcesses -Codex $savedPathCandidate).Count -gt 0
    $unverifiedSavedOwnsPort = Test-DreamSkinCodexPortOwner -Port $Port -Codex $savedPathCandidate
    if ($unverifiedSavedRunning -or $unverifiedSavedOwnsPort) {
      throw 'The saved Codex path is still active but no longer matches a registered OpenAI.Codex package. Close it manually; state and configuration were preserved.'
    }
  }
  $savedIsDifferent = [bool]($null -ne $savedCodex -and $null -ne $currentCodex -and
    -not (Test-DreamSkinPathEqual -Left $savedCodex.Executable -Right $currentCodex.Executable))
  $currentRunning = $null -ne $currentCodex -and (Get-DreamSkinCodexProcesses -Codex $currentCodex).Count -gt 0
  $savedRunning = $null -ne $savedCodex -and (Get-DreamSkinCodexProcesses -Codex $savedCodex).Count -gt 0
  $savedOwnsPort = $null -ne $savedCodex -and (Test-DreamSkinCodexPortOwner -Port $Port -Codex $savedCodex)
  if ($savedIsDifferent -and $currentRunning -and ($savedRunning -or $savedOwnsPort)) {
    throw 'Multiple Codex package versions are active. Close them manually before restore; state and configuration were preserved.'
  }

  $codex = $currentCodex
  if ($savedRunning -or $savedOwnsPort -or $null -eq $currentCodex) {
    $codex = $savedCodex
    if ($null -ne $codex -and $savedIsDifferent) {
      Write-Warning 'Using the saved Codex package identity to close its older active CDP session.'
    } elseif ($null -ne $codex -and $null -eq $currentCodex) {
      Write-Warning 'Using the saved Codex identity after revalidating it against the registered Store package.'
    }
  }
  $relaunchCodex = if ($null -ne $currentCodex) { $currentCodex } else { $codex }
  $codexRunning = $null -ne $codex -and (Get-DreamSkinCodexProcesses -Codex $codex).Count -gt 0
  $portOwnedByCodex = $null -ne $codex -and (Test-DreamSkinCodexPortOwner -Port $Port -Codex $codex)
  if ($portOwnedByCodex -and -not $codexRunning) {
    throw 'A Codex-owned listener exists without a manageable Codex process; state was preserved.'
  }
  if ($null -ne $state -and $null -eq $codex -and -not (Test-DreamSkinPortAvailable -Port $Port)) {
    throw "Port $Port is still active, but Codex ownership cannot be verified. State and configuration were preserved."
  }

  $shouldCloseCodex = $codexRunning
  $forceAuthorized = [bool]$ForceRestart
  if (($shouldCloseCodex -and $PromptRestart) -or $PurgeAllData) {
    $restartMessage = if ($PurgeAllData) {
      'Uninstall will close Codex, restore the official appearance, and permanently delete all Codex Terraria Skin themes, settings, logs, and imported local music. Continue?'
    } elseif ($NoRelaunch) {
      'Restore will close Codex and remove TR Skin plus its CDP session. Continue?'
    } else {
      'Restore will close Codex, remove TR Skin and its CDP session, then reopen the official app. Continue?'
    }
    $forceAuthorized = Confirm-DreamSkinRestart -Message $restartMessage
    if (-not $forceAuthorized) {
      if ($PurgeAllData) {
        Write-Host 'Uninstall was cancelled; no state or configuration was changed.'
        exit 10
      }
      Write-Host 'Restore was cancelled; no state or configuration was changed.'
      exit 0
    }
  }

  $backup = Join-Path $StateRoot 'config.before-dream-skin.toml'
  $config = Join-Path $HOME '.codex\config.toml'
  $restoreBaseThemeNow = [bool]$RestoreBaseTheme
  if ($RecoverConfigBackup) {
    if (-not (Test-Path -LiteralPath $backup)) { throw 'No pre-install config backup is available.' }
    $null = Read-DreamSkinUtf8File -Path $backup
  } elseif ($RestoreBaseTheme) {
    if (-not (Test-Path -LiteralPath $backup)) {
      $completedRestoreArchives = @(
        Get-ChildItem -LiteralPath $StateRoot -File -Filter 'config.restored-*.toml' `
          -ErrorAction SilentlyContinue
      )
      if ($PurgeAllData -and $completedRestoreArchives.Count -gt 0) {
        $restoreBaseThemeNow = $false
        Write-Host 'Official appearance was already restored earlier; continuing with full uninstall.'
      } else {
        throw 'No pre-install config backup is available.'
      }
    } else {
      $null = Read-DreamSkinUtf8File -Path $backup
      $null = Read-DreamSkinUtf8File -Path $config
    }
  }

  $restoreError = $null
  try {
    Stop-DreamSkinTrayProcess -StateRoot $StateRoot
    if ($PurgeAllData -and (Test-DreamSkinControlPanelActive)) {
      Stop-DreamSkinControlPanelProcess -StateRoot $StateRoot
    }
    if ($shouldCloseCodex) {
      Stop-DreamSkinCodex -Codex $codex -AllowForce:$forceAuthorized
      if ($portOwnedByCodex -and -not (Wait-DreamSkinPortAvailable -Port $Port -TimeoutSeconds 5)) {
        throw "Port $Port is still listening after Codex closed; state was preserved for inspection."
      }
    }

    $recordedInjectorStopped = Stop-DreamSkinRecordedInjector -State $state
    if (-not $recordedInjectorStopped) {
      $staleStatePath = Archive-DreamSkinStateFile -Path $StatePath
      Write-Warning "Archived stale TR Skin state at $staleStatePath"
    }

    if ($RecoverConfigBackup) {
      $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N')
      $recoveryBackup = Join-Path $StateRoot "config.before-recovery-$stamp.toml"
      Restore-DreamSkinConfigBackup -ConfigPath $config -BackupPath $backup -RecoveryBackupPath $recoveryBackup
      Write-Host "Recovered the exact pre-install config; previous current config saved at $recoveryBackup"
    } elseif ($restoreBaseThemeNow) {
      Restore-DreamSkinBaseTheme -ConfigPath $config -BackupPath $backup
    }
    if ($RecoverConfigBackup -or $restoreBaseThemeNow) {
      $archiveStamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N')
      $archivePath = Join-Path $StateRoot "config.restored-$archiveStamp.toml"
      Archive-DreamSkinConfigBackup -BackupPath $backup -ArchivePath $archivePath
      Write-Host "Archived the completed pre-install backup at $archivePath"
    }

    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $StateRoot 'paused') -Force -ErrorAction SilentlyContinue
    if ($Uninstall) {
      Remove-DreamSkinShortcuts
    }

    if ($shouldCloseCodex -and -not $NoRelaunch) {
      if ($null -eq $relaunchCodex -or -not (Test-Path -LiteralPath $relaunchCodex.Executable)) {
        throw 'Codex cannot be reopened because its current executable is unavailable.'
      }
      $null = Start-DreamSkinCodex -Codex $relaunchCodex
    }
  } catch {
    $restoreError = $_
    if ($shouldCloseCodex -and -not $NoRelaunch -and $null -ne $relaunchCodex -and
      (Get-DreamSkinCodexProcesses -Codex $codex).Count -eq 0 -and (Test-Path -LiteralPath $relaunchCodex.Executable)) {
      try { $null = Start-DreamSkinCodex -Codex $relaunchCodex } catch {
        Write-Warning 'Restore failed and Codex could not be reopened automatically.'
      }
    }
    throw $restoreError
  }

  if ($PurgeAllData) {
    $purgeScript = Join-Path $PSScriptRoot 'purge-dream-skin-state.ps1'
    if (-not (Test-Path -LiteralPath $purgeScript -PathType Leaf)) {
      throw "The uninstall cleanup helper is missing: $purgeScript"
    }
    $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $purgeArguments = @(
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', "`"$purgeScript`"",
      '-StateRoot', "`"$StateRoot`"",
      '-ExpectedLocalAppData', "`"$env:LOCALAPPDATA`"",
      '-ParentProcessId', "$PID",
      '-ShowCompletion'
    ) -join ' '
    Start-Process -FilePath $powershell -ArgumentList $purgeArguments -WindowStyle Hidden | Out-Null
    Write-Host 'Official appearance restored. Full managed-data cleanup has been scheduled.'
  } else {
    Write-Host 'TR Skin restore actions completed; any saved CDP session was closed.'
  }
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
