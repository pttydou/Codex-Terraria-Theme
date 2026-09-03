[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$NoShortcuts
)

$ErrorActionPreference = 'Stop'
$PortExplicit = $PSBoundParameters.ContainsKey('Port')
$SkillRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$operationLock = Enter-DreamSkinOperationLock
try {
  Assert-DreamSkinPort -Port $Port
  $null = Get-DreamSkinNodeRuntime
  $registeredInstalls = @(Get-DreamSkinRegisteredCodexInstalls)
  if ($registeredInstalls.Count -eq 0) {
    throw 'The official OpenAI.Codex Store package is not installed or its identity cannot be validated.'
  }
  foreach ($registeredCodex in $registeredInstalls) {
    if ((Get-DreamSkinCodexProcessCount -Codex $registeredCodex) -gt 0) {
      throw 'Close Codex before installing TR Skin so config.toml cannot change during the transaction.'
    }
  }

  $StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
  $themePaths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $themePaths.Root -Root $themePaths.Root
  $StatePath = Join-Path $StateRoot 'state.json'
  $existingState = Read-DreamSkinState -Path $StatePath
  $savedPathCandidate = Get-DreamSkinCodexStatePathCandidate -State $existingState
  $savedCodex = Resolve-DreamSkinCodexInstallFromState -State $existingState -RegisteredInstalls $registeredInstalls
  if ($null -ne $savedPathCandidate -and $null -eq $savedCodex -and
    (Get-DreamSkinCodexProcessCount -Codex $savedPathCandidate) -gt 0) {
    throw 'The saved Codex path is still running but no longer matches a registered Store package. Close it manually before installing.'
  }
  if (Test-DreamSkinTrayActive) {
    Write-Host 'An older Codex Terraria Skin control process was detected. Closing it before the upgrade.'
    Stop-DreamSkinTrayProcess -StateRoot $StateRoot
  }
  if (Test-DreamSkinControlPanelActive) {
    Write-Host 'An older TR Skin control panel was detected. Closing it before the upgrade.'
    Stop-DreamSkinControlPanelProcess -StateRoot $StateRoot
  }
  if ($null -ne $existingState) {
    $recordedInjectorStopped = Stop-DreamSkinRecordedInjector -State $existingState
    if (-not $recordedInjectorStopped) {
      $staleStatePath = Archive-DreamSkinStateFile -Path $StatePath
      Write-Warning "Archived stale TR Skin state at $staleStatePath"
    } else {
      Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    }
  }
  $engine = Install-DreamSkinRuntimeEngine -SkillRoot $SkillRoot -StateRoot $StateRoot
  $null = Initialize-DreamSkinThemeStore -SkillRoot $engine.Root `
    -BundledContentRoot $SkillRoot -StateRoot $StateRoot
  $ConfigPath = Join-Path $HOME '.codex\config.toml'
  $BackupPath = Join-Path $StateRoot 'config.before-dream-skin.toml'
  Install-DreamSkinBaseTheme -ConfigPath $ConfigPath -BackupPath $BackupPath

  if (-not $NoShortcuts) {
    Remove-DreamSkinShortcuts
    $shell = New-Object -ComObject WScript.Shell
    $desktop = [Environment]::GetFolderPath('Desktop')
    $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $portArgument = if ($PortExplicit) { " -Port $Port" } else { '' }

    $entry = $shell.CreateShortcut((Join-Path $desktop 'TR Skin Control Panel.lnk'))
    $entry.TargetPath = $powershell
    $entry.Arguments = (
      "-NoProfile -STA -ExecutionPolicy Bypass " +
      "-File `"$($engine.OneClick)`"$portArgument"
    )
    $entry.WorkingDirectory = $engine.Root
    $entry.Description = 'Check for updates and open the Codex Terraria Skin control panel'
    $entry.IconLocation = "$(Join-Path $engine.Root 'assets\trskin.ico'),0"
    $entry.WindowStyle = 1
    $entry.Save()
  }

  if ($NoShortcuts) {
    Write-Host "TR Skin installed at $($engine.Root). Run $($engine.Start) to launch it."
  } else {
    Write-Host 'Codex Terraria skin installed. Use the desktop control entry to choose a theme, apply it, or restore Codex.'
  }
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
