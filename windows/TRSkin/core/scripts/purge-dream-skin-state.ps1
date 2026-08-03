[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$StateRoot,
  [Parameter(Mandatory = $true)][string]$ExpectedLocalAppData,
  [int]$ParentProcessId = 0,
  [switch]$ShowCompletion
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

$fullStateRoot = Get-NormalizedPath -Path $StateRoot
$expectedStateRoot = Get-NormalizedPath -Path (Join-Path $ExpectedLocalAppData 'CodexDreamSkin')
if ($fullStateRoot -ine $expectedStateRoot) {
  throw "Refusing to purge an unexpected directory: $fullStateRoot"
}
if ([System.IO.Path]::GetFileName($fullStateRoot) -ine 'CodexDreamSkin') {
  throw "Refusing to purge a directory without the expected leaf name: $fullStateRoot"
}

if ($ParentProcessId -gt 0) {
  try {
    Wait-Process -Id $ParentProcessId -Timeout 30 -ErrorAction Stop
  } catch {
    if (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) {
      throw "The restore process did not exit; the managed state directory was preserved: $fullStateRoot"
    }
  }
}

if (Test-Path -LiteralPath $fullStateRoot) {
  $rootItem = Get-Item -LiteralPath $fullStateRoot -Force -ErrorAction Stop
  if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Refusing to purge a junction or symbolic link: $fullStateRoot"
  }

  $lastError = $null
  for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    try {
      Remove-Item -LiteralPath $fullStateRoot -Recurse -Force -ErrorAction Stop
      $lastError = $null
      break
    } catch {
      $lastError = $_
      Start-Sleep -Milliseconds 250
    }
  }
  if (Test-Path -LiteralPath $fullStateRoot) {
    throw "Could not fully remove the managed state directory: $($lastError.Exception.Message)"
  }
}

if ($ShowCompletion) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup(
      'Codex Terraria Skin has been fully removed. You can now delete the downloaded ZIP or extracted folder.',
      0,
      'Codex Terraria Skin',
      64
    )
  } catch {}
}
