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
  }
  foreach ($expectation in $controlPanelExpectations.GetEnumerator()) {
    if ($controlPanelSource -notmatch $expectation.Value) {
      throw "Windows control panel is missing the $($expectation.Key) contract."
    }
  }
  if ($controlPanelSource -match '\$tabs\.TabPages\.Add\(\$(?:environmentPage|musicPage)\)') {
    throw 'Detailed environment or music pages must not remain top-level tabs.'
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
