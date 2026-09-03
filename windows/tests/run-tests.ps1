$ErrorActionPreference = 'Stop'

$RepositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$Node = (Get-Command node -ErrorAction Stop).Source

Push-Location -LiteralPath $RepositoryRoot
try {
  & $Node 'release/validate-release.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'Release identity validation failed.' }

  foreach ($module in Get-ChildItem -LiteralPath 'windows\TRSkin\core\scripts' -File -Filter '*.mjs') {
    & $Node --check $module.FullName
    if ($LASTEXITCODE -ne 0) { throw "Node.js syntax validation failed: $($module.FullName)" }
  }

  & $Node 'macos/tests/renderer-inject.test.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'Cross-platform renderer regression tests failed.' }

  $controlPanelSource = Get-Content -LiteralPath `
    'windows\TRSkin\core\scripts\control-panel-windows.ps1' -Raw
  $controlPanelExpectations = [ordered]@{
    'quick settings tab' = '\$quickPage\s*=\s*\[System\.Windows\.Forms\.TabPage\]::new'
    'advanced settings tab' = '\$advancedPage\s*=\s*\[System\.Windows\.Forms\.TabPage\]::new'
    'fixed environment selector' = '\$themeLabel\s*=\s*New-TRSkinLabel'
    'all-environment random toggle' = '\$randomToggle\s*=\s*\[System\.Windows\.Forms\.CheckBox\]::new'
    'advanced random page' = 'advancedTabs\.TabPages\.Add\(\$rotationPage\)'
    'advanced music page' = 'advancedTabs\.TabPages\.Add\(\$musicPage\)'
    'advanced maintenance page' = 'advancedTabs\.TabPages\.Add\(\$maintenancePage\)'
    'random preset excluded from fixed selector' = 'fixedThemes[\s\S]{0,160}preset-terraria-random'
    'quick page contains only environment controls' = '\$quickPage\.Controls\.AddRange\(@\(\s*\$quickIntro,\s*\$themeLabel,\s*\$themeCombo\s*\)\)'
    'random toggle belongs to advanced rotation' = '\$rotationPage\.Controls\.AddRange\(@\(\s*\$randomToggle,\s*\$randomHint'
    'fixed selection turns random mode off' = '\$themeCombo\.add_DropDown\([\s\S]{0,160}\$randomToggle\.Checked\s*=\s*\$false'
    'save action also applies the runtime' = '\$save\.add_Click\([\s\S]{0,9000}Start-TRSkinPanelOperation\s+-Script\s+\$startScript'
    'visible update restart consent' = 'Get-TRSkinApplyRestartReason[\s\S]{0,1800}codexVersion[\s\S]{0,900}MessageBox\]::Show\([\s\S]{0,500}MessageBoxDefaultButton\]::Button2'
    'explicit approved restart' = '\$startArguments\s*=\s*@\(\)[\s\S]{0,180}RestartExisting[\s\S]{0,260}Start-TRSkinPanelOperation'
    'adaptive stale port recovery' = 'Start-TRSkinPanelOperation\s+-Script\s+\$startScript\s+-Arguments\s+\$startArguments'
    'truthful async completion' = '\$operationTimer\.add_Tick\([\s\S]{0,500}HasExited[\s\S]{0,500}\$exitCode -eq 0[\s\S]{0,160}\$operation\.SuccessText'
    'redirected operation errors' = 'control-panel-operation-error\.log'
    'background failure surfaced' = 'operation-failed[\s\S]{0,180}Show-TRSkinPanelError'
  }
  foreach ($expectation in $controlPanelExpectations.GetEnumerator()) {
    if ($controlPanelSource -notmatch $expectation.Value) {
      throw "Windows control panel is missing the $($expectation.Key) contract."
    }
  }
  if ($controlPanelSource -match '\$tabs\.TabPages\.Add\(\$(?:environmentPage|musicPage)\)') {
    throw 'Detailed environment or music pages must not remain top-level tabs.'
  }
  if ($controlPanelSource -match '\$apply\s*=\s*\[System\.Windows\.Forms\.Button\]::new') {
    throw 'Save and apply must remain one primary action, not separate buttons.'
  }

  $commonWindows = 'windows\TRSkin\core\scripts\common-windows.ps1'
  . (Resolve-Path -LiteralPath $commonWindows).Path
  . (Resolve-Path -LiteralPath 'windows\TRSkin\core\scripts\update-windows.ps1').Path
  $missingCodex = [pscustomobject]@{ Executable = 'C:\TRSkin-test-does-not-exist\ChatGPT.exe' }
  if ((Get-DreamSkinCodexProcessCount -Codex $missingCodex) -ne 0) {
    throw 'Empty Codex process discovery must remain count-safe under strict mode.'
  }
  $processCountConsumers = Get-ChildItem -LiteralPath 'windows\TRSkin\core\scripts' -File -Filter '*.ps1' |
    Select-String -Pattern '\(Get-DreamSkinCodexProcesses[^\r\n]*\)\.Count' |
    Where-Object { $_.Line -notmatch 'return\s+@\(Get-DreamSkinCodexProcesses' }
  if ($processCountConsumers) {
    throw 'Codex process callers must use the strict-mode-safe process count helper.'
  }
  $unsafeProcessAssignments = Get-ChildItem -LiteralPath 'windows\TRSkin\core\scripts' -File -Filter '*.ps1' |
    Select-String -Pattern '=\s*Get-DreamSkinCodexProcesses'
  if ($unsafeProcessAssignments) {
    throw 'Codex process collections must be explicitly array-wrapped before callers inspect Count.'
  }

  $parseErrors = @()
  Get-ChildItem -LiteralPath 'windows','release' -Recurse -File -Filter '*.ps1' |
    ForEach-Object {
      $tokens = $null
      $errors = $null
      [void][System.Management.Automation.Language.Parser]::ParseFile(
        $_.FullName,
        [ref]$tokens,
        [ref]$errors
      )
      $parseErrors += $errors
    }
  if ($parseErrors.Count -gt 0) {
    $parseErrors | Format-List
    throw 'PowerShell syntax validation failed.'
  }

  Write-Host 'PASS: Windows renderer, Node.js, release identity, and PowerShell source tests.'
}
finally {
  Pop-Location
}
