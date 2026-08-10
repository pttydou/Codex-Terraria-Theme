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
