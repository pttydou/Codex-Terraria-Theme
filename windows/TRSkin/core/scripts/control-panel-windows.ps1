[CmdletBinding()]
param([int]$Port = 9335)

$ErrorActionPreference = 'Stop'
if ($null -eq ('TRSkin.NativeConsole' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace TRSkin {
  public static class NativeConsole {
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr window, int command);
  }

  public static class NativeWindow {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindowAsync(IntPtr window, int command);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool FlashWindow(IntPtr window, bool invert);
  }
}
'@
}
$consoleWindow = [TRSkin.NativeConsole]::GetConsoleWindow()
if ($consoleWindow -ne [IntPtr]::Zero) {
  [void][TRSkin.NativeConsole]::ShowWindow($consoleWindow, 0)
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

Assert-DreamSkinPort -Port $Port
$SkillRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$panelTracePath = Join-Path $StateRoot 'control-panel-trace.log'
$paths = Initialize-DreamSkinThemeStore -SkillRoot $SkillRoot -StateRoot $StateRoot
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$startScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore-dream-skin.ps1'
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutexName = "Local\CodexDreamSkin.$sid.ControlPanel"
$showEventName = "Local\CodexDreamSkin.$sid.ShowControlPanel"
$mutex = [System.Threading.Mutex]::new($false, $mutexName)
$showEvent = [System.Threading.EventWaitHandle]::new(
  $false,
  [System.Threading.EventResetMode]::AutoReset,
  $showEventName
)
$acquired = $false
$activePanelOperation = $null

function Write-TRSkinPanelTrace {
  param([Parameter(Mandatory = $true)][string]$Message)
  try {
    "$([DateTimeOffset]::Now.ToString('o')) $Message" |
      Add-Content -LiteralPath $panelTracePath -Encoding UTF8
  } catch {}
}

function Show-TRSkinPanelError {
  param([Parameter(Mandatory = $true)][string]$Message)
  [void][System.Windows.Forms.MessageBox]::Show(
    $Message,
    'TR Skin Control Panel',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  )
}

function Start-TRSkinPowerShell {
  param([Parameter(Mandatory = $true)][string]$Script, [string[]]$Arguments = @())
  $scriptToken = ConvertTo-DreamSkinProcessArgument -Value $Script
  $argumentLine = '-NoProfile -ExecutionPolicy Bypass -File ' + $scriptToken
  if ($Arguments.Count -gt 0) { $argumentLine += ' ' + ($Arguments -join ' ') }
  $stdoutPath = Join-Path $StateRoot 'control-panel-operation.log'
  $stderrPath = Join-Path $StateRoot 'control-panel-operation-error.log'
  Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
  $process = Start-Process -FilePath $powershell -ArgumentList $argumentLine `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath
  return [pscustomobject]@{
    Process = $process
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
  }
}

function Start-TRSkinPanelOperation {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$PendingText,
    [Parameter(Mandatory = $true)][string]$SuccessText
  )
  if ($null -ne $script:activePanelOperation) {
    throw '已有皮肤操作正在进行，请等待它完成。'
  }
  $launch = Start-TRSkinPowerShell -Script $Script -Arguments $Arguments
  $script:activePanelOperation = [pscustomobject]@{
    Process = $launch.Process
    StdoutPath = $launch.StdoutPath
    StderrPath = $launch.StderrPath
    SuccessText = $SuccessText
  }
  $script:save.Enabled = $false
  $script:restore.Enabled = $false
  $script:status.Text = $PendingText
  Write-TRSkinPanelTrace -Message "operation-started script=$([IO.Path]::GetFileName($Script)) pid=$($launch.Process.Id)"
}

function Get-TRSkinApplyRestartReason {
  $currentCodex = Get-DreamSkinCodexInstall
  if (@(Get-DreamSkinCodexProcesses -Codex $currentCodex).Count -eq 0) { return $null }
  $identity = Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $currentCodex
  if ($null -ne $identity) { return $null }
  $state = Read-DreamSkinState -Path (Join-Path $StateRoot 'state.json')
  if ($null -ne $state -and "$($state.codexVersion)" -cne "$($currentCodex.Version)") {
    return "Codex 已从 $($state.codexVersion) 更新到 $($currentCodex.Version)，旧皮肤连接已经失效。"
  }
  return '当前 Codex 没有可验证的 TR Skin 调试连接。'
}

function Confirm-TRSkinPanelRestart {
  param([Parameter(Mandatory = $true)][string]$Reason)
  $message = "$Reason`n`n应用皮肤需要重启一次 Codex，未发送的输入可能丢失。是否继续？"
  return [System.Windows.Forms.MessageBox]::Show(
    $script:form,
    $message,
    'TR Skin 需要重新连接',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Warning,
    [System.Windows.Forms.MessageBoxDefaultButton]::Button2
  ) -eq [System.Windows.Forms.DialogResult]::Yes
}

function Invoke-TRSkinRuntimeControl {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('random-config', 'next-environment')]
    [string]$Command
  )
  $state = Read-DreamSkinState -Path (Join-Path $StateRoot 'state.json')
  if ($null -eq $state) {
    throw '请先打开 Codex 并应用 TR Skin。'
  }
  $codex = Get-DreamSkinCodexInstallFromState -State $state
  if ($null -eq $codex) {
    throw '当前 Codex 运行状态无法安全验证，请使用“应用 / 重新应用”。'
  }
  $identity = Get-DreamSkinVerifiedCdpIdentity -Port ([int]$state.port) -Codex $codex
  if ($null -eq $identity -or "$($identity.BrowserId)" -cne "$($state.browserId)") {
    throw '当前 Codex 调试会话已变化，请使用“应用 / 重新应用”。'
  }
  $node = Get-DreamSkinNodeRuntime
  $injector = Join-Path $PSScriptRoot 'injector.mjs'
  $arguments = @(
    $injector,
    $(if ($Command -eq 'random-config') {
      '--runtime-random-config'
    } else {
      '--runtime-next-environment'
    })
  )
  if ($Command -eq 'random-config') {
    $arguments += (Join-Path $StateRoot 'random-pool.json')
  }
  $arguments += @(
    '--port', "$([int]$state.port)",
    '--browser-id', "$($state.browserId)",
    '--timeout-ms', '8000'
  )
  $result = Invoke-DreamSkinNative -FilePath $node.Path -ArgumentList $arguments
  if ($result.ExitCode -ne 0) {
    throw "运行中的 Codex 无法更新设置：$($result.Output -join "`n")"
  }
  try {
    return ($result.Output -join "`n") | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw '运行中的 Codex 返回了无效的热更新结果。'
  }
}

function New-TRSkinLabel {
  param([string]$Text, [int]$Left, [int]$Top, [int]$Width = 180, [int]$Height = 26)
  $label = [System.Windows.Forms.Label]::new()
  $label.Text = $Text
  $label.SetBounds($Left, $Top, $Width, $Height)
  return $label
}

function Show-TRSkinControlPanelWindow {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Forms.Form]$Form,
    [switch]$NotifyWhenForegroundDenied
  )
  $Form.ShowInTaskbar = $true
  if (-not $Form.Visible) {
    $Form.Show()
  }
  if ($Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $Form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  $window = $Form.Handle
  [void][TRSkin.NativeWindow]::ShowWindowAsync($window, 9)
  $Form.Activate()
  $Form.BringToFront()
  $foregrounded = [TRSkin.NativeWindow]::SetForegroundWindow($window)
  if (-not $foregrounded -and $NotifyWhenForegroundDenied) {
    [void][TRSkin.NativeWindow]::FlashWindow($window, $true)
  }
}

try {
  try { Remove-Item -LiteralPath $panelTracePath -Force -ErrorAction SilentlyContinue } catch {}
  Write-TRSkinPanelTrace -Message 'startup'
  try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
  }
  if (-not $acquired) {
    $null = $showEvent.Set()
    exit 0
  }

  $catalog = @(Invoke-DreamSkinRandomPoolHelper -Command 'catalog' -StateRoot $StateRoot)
  if ($catalog.Count -lt 2) {
    throw "环境目录加载不完整：仅得到 $($catalog.Count) 项。"
  }
  $randomConfig = Invoke-DreamSkinRandomPoolHelper -Command 'show' -StateRoot $StateRoot
  $musicConfig = Invoke-DreamSkinMusicHelper -Command 'show' -StateRoot $StateRoot
  $savedThemes = @(Get-DreamSkinSavedThemes -StateRoot $StateRoot -SkipImageMetadata)
  $fixedThemes = @($savedThemes | Where-Object { "$($_.Id)" -cne 'preset-terraria-random' })
  $activeTheme = $null
  try { $activeTheme = Read-DreamSkinTheme -ThemeDirectory $paths.Active -SkipImageMetadata } catch {}
  Write-TRSkinPanelTrace -Message "configuration-loaded catalog-count=$($catalog.Count)"

  $form = [System.Windows.Forms.Form]::new()
  $form.Text = 'TR Skin Control Panel'
  $form.Icon = [System.Drawing.Icon]::new((Join-Path $SkillRoot 'assets\trskin.ico'))
  $form.ClientSize = [System.Drawing.Size]::new(820, 640)
  $form.MinimumSize = [System.Drawing.Size]::new(740, 540)
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
  $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  $form.ShowInTaskbar = $true
  $form.MinimizeBox = $true
  $form.TopMost = $false
  $form.Font = [System.Drawing.Font]::new('Segoe UI', 10)
  $form.BackColor = [System.Drawing.Color]::FromArgb(20, 43, 55)
  $form.ForeColor = [System.Drawing.Color]::FromArgb(236, 241, 219)
  Write-TRSkinPanelTrace -Message 'form-created'

  $title = New-TRSkinLabel -Text 'TR Skin 控制面板' -Left 22 -Top 16 -Width 360 -Height 38
  $title.Font = [System.Drawing.Font]::new('Segoe UI Semibold', 20)
  $currentName = if ($activeTheme -and $activeTheme.Theme.name) {
    "$($activeTheme.Theme.name)"
  } else {
    '未选择环境'
  }
  $status = New-TRSkinLabel -Text "当前：$currentName" -Left 390 -Top 25 -Width 390 -Height 28
  $status.TextAlign = [System.Drawing.ContentAlignment]::MiddleRight
  Write-TRSkinPanelTrace -Message 'header-created'

  $tabs = [System.Windows.Forms.TabControl]::new()
  $tabs.SetBounds(20, 66, 780, 490)
  $tabs.Anchor = [System.Windows.Forms.AnchorStyles]::Top `
    -bor [System.Windows.Forms.AnchorStyles]::Bottom `
    -bor [System.Windows.Forms.AnchorStyles]::Left `
    -bor [System.Windows.Forms.AnchorStyles]::Right
  Write-TRSkinPanelTrace -Message 'tabs-created'

  $quickPage = [System.Windows.Forms.TabPage]::new('快速设置')
  $quickPage.AutoScroll = $true
  $quickPage.BackColor = [System.Drawing.Color]::FromArgb(27, 58, 70)
  $quickPage.ForeColor = $form.ForeColor
  Write-TRSkinPanelTrace -Message 'environment-shell-created'

  $quickIntro = New-TRSkinLabel `
    -Text '选择想要使用的 Terraria 环境，然后点击“保存并应用”。' `
    -Left 20 -Top 24 -Width 690 -Height 32
  $quickIntro.Font = [System.Drawing.Font]::new('Segoe UI Semibold', 11)
  $themeLabel = New-TRSkinLabel -Text '切换环境' -Left 20 -Top 82 -Width 120
  $themeCombo = [System.Windows.Forms.ComboBox]::new()
  $themeCombo.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  $themeCombo.SetBounds(145, 78, 560, 30)
  foreach ($theme in $fixedThemes) {
    [void]$themeCombo.Items.Add("$($theme.Name)")
  }
  Write-TRSkinPanelTrace -Message 'theme-combo-bound'
  if ($activeTheme -and $activeTheme.Theme.id) {
    for ($index = 0; $index -lt $fixedThemes.Count; $index += 1) {
      if ("$($fixedThemes[$index].Id)" -eq "$($activeTheme.Theme.id)") {
        $themeCombo.SelectedIndex = $index
        break
      }
    }
  }
  if ($themeCombo.SelectedIndex -lt 0 -and $themeCombo.Items.Count -gt 0) {
    $themeCombo.SelectedIndex = 0
  }
  Write-TRSkinPanelTrace -Message 'theme-selection-created'

  $randomToggle = [System.Windows.Forms.CheckBox]::new()
  $randomToggle.Text = '启用全部环境随机轮换'
  $randomToggle.Checked = [bool](
    $activeTheme -and "$($activeTheme.Theme.id)" -eq 'preset-terraria-random'
  )
  $randomToggle.SetBounds(20, 20, 300, 28)
  $randomHint = New-TRSkinLabel `
    -Text '开启后保存将使用全部环境随机；在首页选择固定环境会自动关闭此开关。' `
    -Left 20 -Top 52 -Width 665 -Height 36
  $randomHint.ForeColor = [System.Drawing.Color]::FromArgb(184, 201, 181)
  $themeCombo.add_SelectedIndexChanged({
    if ($randomToggle.Checked) {
      $randomToggle.Checked = $false
    }
  })
  $themeCombo.add_DropDown({
    if ($randomToggle.Checked) {
      $randomToggle.Checked = $false
    }
  })
  Write-TRSkinPanelTrace -Message 'random-toggle-created'

  $intervalLabel = New-TRSkinLabel -Text '环境切换间隔' -Left 20 -Top 98 -Width 120
  $interval = [System.Windows.Forms.NumericUpDown]::new()
  $interval.Minimum = 1
  $interval.Maximum = 60
  $interval.Value = [Math]::Min(
    60,
    [Math]::Max(1, [Math]::Round(([double]$randomConfig.environmentIntervalMs) / 60000))
  )
  $interval.SetBounds(145, 94, 82, 30)
  $intervalUnit = New-TRSkinLabel -Text '分钟' -Left 235 -Top 98 -Width 60

  $backgroundLabel = New-TRSkinLabel -Text '同环境多背景' -Left 20 -Top 138 -Width 120
  $backgroundMode = [System.Windows.Forms.ComboBox]::new()
  $backgroundMode.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  [void]$backgroundMode.Items.Add('进入环境后固定一张')
  [void]$backgroundMode.Items.Add('停留期间定时轮换')
  $backgroundMode.SelectedIndex = if ("$($randomConfig.backgroundMode)" -eq 'rotate') { 1 } else { 0 }
  $backgroundMode.SetBounds(145, 134, 250, 30)
  $backgroundInterval = [System.Windows.Forms.NumericUpDown]::new()
  $backgroundInterval.Minimum = 1
  $backgroundInterval.Maximum = 60
  $backgroundInterval.Value = [Math]::Min(
    60,
    [Math]::Max(1, [Math]::Round(([double]$randomConfig.backgroundIntervalMs) / 60000))
  )
  $backgroundInterval.SetBounds(410, 134, 76, 30)
  $backgroundUnit = New-TRSkinLabel -Text '分钟' -Left 494 -Top 138 -Width 60
  Write-TRSkinPanelTrace -Message 'interval-controls-created'

  $poolLabel = New-TRSkinLabel `
    -Text '参与随机轮换的环境（至少保留两个）' -Left 20 -Top 184 -Width 340
  $selectAll = [System.Windows.Forms.Button]::new()
  $selectAll.Text = '全选'
  $selectAll.SetBounds(390, 178, 78, 32)
  $selectNone = [System.Windows.Forms.Button]::new()
  $selectNone.Text = '全部取消'
  $selectNone.SetBounds(476, 178, 94, 32)
  $nextEnvironment = [System.Windows.Forms.Button]::new()
  $nextEnvironment.Text = '随机下一个'
  $nextEnvironment.SetBounds(578, 178, 127, 32)
  $environmentList = [System.Windows.Forms.ListView]::new()
  $environmentList.View = [System.Windows.Forms.View]::Details
  $environmentList.CheckBoxes = $true
  $environmentList.FullRowSelect = $true
  $environmentList.HeaderStyle = [System.Windows.Forms.ColumnHeaderStyle]::None
  $environmentList.HideSelection = $false
  $environmentList.MultiSelect = $false
  $environmentList.Scrollable = $true
  $environmentList.SetBounds(20, 218, 685, 197)
  [void]$environmentList.Columns.Add('', 655)
  $excluded = @($randomConfig.excluded)
  Write-TRSkinPanelTrace -Message 'environment-list-starting'
  foreach ($entry in $catalog) {
    $item = [System.Windows.Forms.ListViewItem]::new("$($entry.name)")
    $item.Checked = -not ($excluded -contains "$($entry.variant)")
    [void]$environmentList.Items.Add($item)
  }
  Write-TRSkinPanelTrace -Message "environment-list-created item-count=$($environmentList.Items.Count)"
  $quickPage.Controls.AddRange(@(
    $quickIntro, $themeLabel, $themeCombo
  ))
  $rotationPage = [System.Windows.Forms.TabPage]::new('随机轮换')
  $rotationPage.AutoScroll = $true
  $rotationPage.BackColor = [System.Drawing.Color]::FromArgb(27, 58, 70)
  $rotationPage.ForeColor = $form.ForeColor
  $rotationPage.Controls.AddRange(@(
    $randomToggle, $randomHint, $intervalLabel, $interval, $intervalUnit,
    $backgroundLabel, $backgroundMode, $backgroundInterval, $backgroundUnit,
    $poolLabel, $selectAll, $selectNone, $nextEnvironment, $environmentList
  ))
  $advancedPage = [System.Windows.Forms.TabPage]::new('高级设置')
  $advancedPage.BackColor = [System.Drawing.Color]::FromArgb(27, 58, 70)
  $advancedPage.ForeColor = $form.ForeColor
  $advancedTabs = [System.Windows.Forms.TabControl]::new()
  $advancedTabs.Dock = [System.Windows.Forms.DockStyle]::Fill
  $advancedPage.Controls.Add($advancedTabs)
  Write-TRSkinPanelTrace -Message 'environment-page-created'

  $musicPage = [System.Windows.Forms.TabPage]::new('环境音乐')
  $musicPage.AutoScroll = $true
  $musicPage.BackColor = [System.Drawing.Color]::FromArgb(27, 58, 70)
  $musicPage.ForeColor = $form.ForeColor

  $musicEnabled = [System.Windows.Forms.CheckBox]::new()
  $musicEnabled.Text = '启用环境音乐'
  $musicEnabled.Checked = [bool]$musicConfig.enabled
  $musicEnabled.SetBounds(24, 20, 220, 28)

  $volumeLabel = New-TRSkinLabel -Text '音量' -Left 24 -Top 66 -Width 110
  $volume = [System.Windows.Forms.NumericUpDown]::new()
  $volume.Minimum = 0
  $volume.Maximum = 100
  $volume.Value = [int]$musicConfig.volume
  $volume.SetBounds(150, 62, 86, 30)
  $volumeUnit = New-TRSkinLabel -Text '%' -Left 242 -Top 66 -Width 40

  $playbackLabel = New-TRSkinLabel -Text '多首播放' -Left 24 -Top 108 -Width 110
  $playback = [System.Windows.Forms.ComboBox]::new()
  $playback.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  [void]$playback.Items.Add('按导入顺序')
  [void]$playback.Items.Add('随机且不立即重复')
  $playback.SelectedIndex = if ("$($musicConfig.playbackMode)" -eq 'random') { 1 } else { 0 }
  $playback.SetBounds(150, 104, 230, 30)

  $soundtrackLabel = New-TRSkinLabel -Text '原声版本' -Left 24 -Top 150 -Width 110
  $soundtrack = [System.Windows.Forms.ComboBox]::new()
  $soundtrack.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  [void]$soundtrack.Items.Add('经典原声')
  [void]$soundtrack.Items.Add('来世原声（缺曲回退经典）')
  [void]$soundtrack.Items.Add('经典与来世混合')
  $soundtrack.SelectedIndex = switch ("$($musicConfig.soundtrackMode)") {
    'otherworld' { 1 }
    'mixed' { 2 }
    default { 0 }
  }
  $soundtrack.SetBounds(150, 146, 260, 30)

  $trackChangeLabel = New-TRSkinLabel -Text '一首结束后' -Left 24 -Top 192 -Width 110
  $trackChange = [System.Windows.Forms.ComboBox]::new()
  $trackChange.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  [void]$trackChange.Items.Add('继续切换下一首')
  [void]$trackChange.Items.Add('固定当前曲循环')
  $trackChange.SelectedIndex = if ("$($musicConfig.trackChangeMode)" -eq 'fixed') { 1 } else { 0 }
  $trackChange.SetBounds(150, 188, 230, 30)

  $environmentChangeLabel = New-TRSkinLabel -Text '切换环境时' -Left 24 -Top 234 -Width 110
  $environmentChange = [System.Windows.Forms.ComboBox]::new()
  $environmentChange.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  [void]$environmentChange.Items.Add('立即换到新环境音乐')
  [void]$environmentChange.Items.Add('播完当前曲再切换')
  $environmentChange.SelectedIndex = if (
    "$($musicConfig.environmentChangeMode)" -eq 'after-current'
  ) { 1 } else { 0 }
  $environmentChange.SetBounds(150, 230, 230, 30)

  $gapLabel = New-TRSkinLabel -Text '曲间等待' -Left 24 -Top 276 -Width 110
  $gap = [System.Windows.Forms.NumericUpDown]::new()
  $gap.Minimum = 0
  $gap.Maximum = 30
  $gap.Value = [int]$musicConfig.trackGapSeconds
  $gap.SetBounds(150, 272, 86, 30)
  $gapUnit = New-TRSkinLabel -Text '秒' -Left 242 -Top 276 -Width 40

  $fadeLabel = New-TRSkinLabel -Text '渐入时间' -Left 330 -Top 276 -Width 100
  $fade = [System.Windows.Forms.NumericUpDown]::new()
  $fade.Minimum = 0
  $fade.Maximum = 5
  $fade.DecimalPlaces = 1
  $fade.Increment = [decimal]0.1
  $fade.Value = [decimal]$musicConfig.fadeInSeconds
  $fade.SetBounds(438, 272, 86, 30)
  $fadeUnit = New-TRSkinLabel -Text '秒' -Left 530 -Top 276 -Width 40

  $pauseWhenHidden = [System.Windows.Forms.CheckBox]::new()
  $pauseWhenHidden.Text = 'Codex 隐藏时暂停音乐'
  $pauseWhenHidden.Checked = [bool]$musicConfig.pauseWhenHidden
  $pauseWhenHidden.SetBounds(150, 316, 250, 28)

  $trackCount = 0
  if ($musicConfig.tracks) {
    foreach ($property in $musicConfig.tracks.PSObject.Properties) {
      $trackCount += @($property.Value).Count
    }
  }
  $musicSummary = New-TRSkinLabel -Text "本地音乐库：$trackCount 首" -Left 24 -Top 365 -Width 330
  $importMusic = [System.Windows.Forms.Button]::new()
  $importMusic.Text = '导入本地音乐…'
  $importMusic.SetBounds(520, 356, 180, 38)
  $musicPage.Controls.AddRange(@(
    $musicEnabled, $volumeLabel, $volume, $volumeUnit, $playbackLabel, $playback,
    $soundtrackLabel, $soundtrack, $trackChangeLabel, $trackChange,
    $environmentChangeLabel, $environmentChange, $gapLabel, $gap, $gapUnit,
    $fadeLabel, $fade, $fadeUnit, $pauseWhenHidden, $musicSummary, $importMusic
  ))
  Write-TRSkinPanelTrace -Message 'music-page-created'

  $maintenancePage = [System.Windows.Forms.TabPage]::new('维护')
  $maintenancePage.BackColor = [System.Drawing.Color]::FromArgb(27, 58, 70)
  $maintenancePage.ForeColor = $form.ForeColor
  [void]$advancedTabs.TabPages.Add($rotationPage)
  [void]$advancedTabs.TabPages.Add($musicPage)
  [void]$advancedTabs.TabPages.Add($maintenancePage)
  [void]$tabs.TabPages.Add($quickPage)
  [void]$tabs.TabPages.Add($advancedPage)

  $save = [System.Windows.Forms.Button]::new()
  $save.Text = '保存并应用'
  $save.SetBounds(20, 576, 160, 42)
  $save.Anchor = [System.Windows.Forms.AnchorStyles]::Bottom `
    -bor [System.Windows.Forms.AnchorStyles]::Left
  $restore = [System.Windows.Forms.Button]::new()
  $restore.Text = '恢复官方外观'
  $restore.SetBounds(28, 78, 190, 42)
  $restore.Anchor = [System.Windows.Forms.AnchorStyles]::Top `
    -bor [System.Windows.Forms.AnchorStyles]::Left
  $close = [System.Windows.Forms.Button]::new()
  $close.Text = '关闭'
  $close.SetBounds(670, 576, 130, 42)
  $close.Anchor = [System.Windows.Forms.AnchorStyles]::Bottom `
    -bor [System.Windows.Forms.AnchorStyles]::Right

  $maintenanceIntro = New-TRSkinLabel `
    -Text '需要退出 TR Skin 并恢复 Codex 官方外观时，才使用这里。' `
    -Left 28 -Top 24 -Width 650 -Height 32
  $maintenanceIntro.Font = [System.Drawing.Font]::new('Segoe UI Semibold', 11)
  $maintenancePage.Controls.AddRange(@($maintenanceIntro, $restore))
  $form.Controls.AddRange(@($title, $status, $tabs, $save, $close))
  $form.AcceptButton = $save
  $form.CancelButton = $close
  $form.KeyPreview = $true
  $form.add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.Control -and $eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::S) {
      $save.PerformClick()
      $eventArgs.SuppressKeyPress = $true
      $eventArgs.Handled = $true
    } elseif ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::F5) {
      $save.PerformClick()
      $eventArgs.SuppressKeyPress = $true
      $eventArgs.Handled = $true
    }
  })
  Write-TRSkinPanelTrace -Message 'controls-created'

  $selectAll.add_Click({
    for ($index = 0; $index -lt $environmentList.Items.Count; $index += 1) {
      $environmentList.Items[$index].Checked = $true
    }
  })

  $selectNone.add_Click({
    for ($index = 0; $index -lt $environmentList.Items.Count; $index += 1) {
      $environmentList.Items[$index].Checked = $false
    }
  })

  $nextEnvironment.add_Click({
    try {
      if (-not $randomToggle.Checked) {
        throw '请先启用全部环境随机轮换并保存设置。'
      }
      $runtimeResult = Invoke-TRSkinRuntimeControl -Command 'next-environment'
      $activeVariant = @($runtimeResult.targets)[0].result
      $status.Text = "已随机切换：$activeVariant"
    } catch {
      Show-TRSkinPanelError -Message $_.Exception.Message
    }
  })

  $save.add_Click({
    try {
      $restartReason = Get-TRSkinApplyRestartReason
      $restartExisting = $false
      if ($restartReason) {
        if (-not (Confirm-TRSkinPanelRestart -Reason $restartReason)) {
          $status.Text = '已取消：未保存或应用任何更改'
          Write-TRSkinPanelTrace -Message 'apply-restart-declined'
          return
        }
        $restartExisting = $true
      }
      $disabled = @()
      for ($index = 0; $index -lt $catalog.Count; $index += 1) {
        if (-not $environmentList.Items[$index].Checked) {
          $disabled += "$($catalog[$index].variant)"
        }
      }
      if ($catalog.Count - $disabled.Count -lt 2) {
        throw '全环境轮换至少需要保留两个环境。'
      }
      $backgroundModeId = if ($backgroundMode.SelectedIndex -eq 1) { 'rotate' } else { 'fixed' }
      $randomArguments = @(
        '--interval-ms', "$([int]$interval.Value * 60000)",
        '--background-mode', $backgroundModeId,
        '--background-interval-ms', "$([int]$backgroundInterval.Value * 60000)"
      ) + $disabled
      $null = Invoke-DreamSkinRandomPoolHelper -Command 'set' `
        -Arguments $randomArguments -StateRoot $StateRoot

      $selectedTheme = if (
        $themeCombo.SelectedIndex -ge 0 -and
        $themeCombo.SelectedIndex -lt $fixedThemes.Count
      ) {
        $fixedThemes[$themeCombo.SelectedIndex]
      } else {
        $null
      }
      $selectedThemeId = if ($null -ne $selectedTheme) { "$($selectedTheme.Id)" } else { '' }
      if ($randomToggle.Checked) {
        $selectedTheme = $savedThemes | Where-Object { $_.Id -eq 'preset-terraria-random' } |
          Select-Object -First 1
        $selectedThemeId = 'preset-terraria-random'
      }
      if ($null -eq $selectedTheme -or -not $selectedTheme.Path) {
        throw '没有找到可用的环境主题。'
      }
      $activeThemeId = if ($activeTheme -and $activeTheme.Theme.id) {
        "$($activeTheme.Theme.id)"
      } else {
        ''
      }
      $loadedName = "$($selectedTheme.Name)"
      $runtimeWarning = $null
      if ($selectedThemeId -cne $activeThemeId) {
        $loaded = Use-DreamSkinSavedTheme -ThemeDirectory $selectedTheme.Path -StateRoot $StateRoot
        $loadedName = "$($loaded.Theme.name)"
        $activeTheme = $loaded
      } elseif ($selectedThemeId -eq 'preset-terraria-random') {
        try {
          $null = Invoke-TRSkinRuntimeControl -Command 'random-config'
        } catch {
          $runtimeWarning = $_.Exception.Message
        }
      }

      $playbackId = if ($playback.SelectedIndex -eq 1) { 'random' } else { 'sequential' }
      $soundtrackId = switch ($soundtrack.SelectedIndex) {
        1 { 'otherworld' }
        2 { 'mixed' }
        default { 'classic' }
      }
      $trackChangeId = if ($trackChange.SelectedIndex -eq 1) { 'fixed' } else { 'rotate' }
      $environmentChangeId = if ($environmentChange.SelectedIndex -eq 1) {
        'after-current'
      } else {
        'immediate'
      }
      $musicArguments = @(
        $(if ($musicEnabled.Checked) { 'on' } else { 'off' }),
        "$([int]$volume.Value)",
        $playbackId,
        "$([int]$gap.Value)",
        "$([decimal]$fade.Value)",
        $(if ($pauseWhenHidden.Checked) { 'on' } else { 'off' }),
        $environmentChangeId,
        $soundtrackId,
        $trackChangeId
      )
      $musicChanged = [bool]$musicEnabled.Checked -ne [bool]$musicConfig.enabled
      $musicChanged = $musicChanged -or (
        [int]$volume.Value -ne [int]$musicConfig.volume
      )
      $musicChanged = $musicChanged -or (
        $playbackId -cne "$($musicConfig.playbackMode)"
      )
      $musicChanged = $musicChanged -or (
        [int]$gap.Value -ne [int]$musicConfig.trackGapSeconds
      )
      $musicChanged = $musicChanged -or (
        [Math]::Abs(
          [double]$fade.Value - [double]$musicConfig.fadeInSeconds
        ) -gt 0.001
      )
      $musicChanged = $musicChanged -or (
        [bool]$pauseWhenHidden.Checked -ne [bool]$musicConfig.pauseWhenHidden
      )
      $musicChanged = $musicChanged -or (
        $environmentChangeId -cne "$($musicConfig.environmentChangeMode)"
      )
      $musicChanged = $musicChanged -or (
        $soundtrackId -cne "$($musicConfig.soundtrackMode)"
      )
      $musicChanged = $musicChanged -or (
        $trackChangeId -cne "$($musicConfig.trackChangeMode)"
      )
      if ($musicChanged) {
        $musicConfig = Invoke-DreamSkinMusicHelper -Command 'set-settings' `
          -Arguments $musicArguments -StateRoot $StateRoot
      }
      Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
      if ($runtimeWarning) {
        Write-TRSkinPanelTrace -Message "runtime-random-config-warning message=$runtimeWarning"
      }
      $startArguments = @()
      if ($restartExisting) { $startArguments += '-RestartExisting' }
      Start-TRSkinPanelOperation -Script $startScript -Arguments $startArguments `
        -PendingText "已保存，正在验证并应用：$loadedName" `
        -SuccessText "应用成功：$loadedName"
    } catch {
      Show-TRSkinPanelError -Message $_.Exception.Message
    }
  })

  $restore.add_Click({
    try {
      $currentCodex = Get-DreamSkinCodexInstall
      $restoreArguments = @('-RestoreBaseTheme')
      if (@(Get-DreamSkinCodexProcesses -Codex $currentCodex).Count -gt 0) {
        $restoreReason = '恢复官方外观需要关闭并重新打开 Codex，未发送的输入可能丢失。是否继续？'
        $restoreConfirmed = [System.Windows.Forms.MessageBox]::Show(
          $form,
          $restoreReason,
          '确认恢复官方外观',
          [System.Windows.Forms.MessageBoxButtons]::YesNo,
          [System.Windows.Forms.MessageBoxIcon]::Warning,
          [System.Windows.Forms.MessageBoxDefaultButton]::Button2
        ) -eq [System.Windows.Forms.DialogResult]::Yes
        if (-not $restoreConfirmed) {
          $status.Text = '已取消恢复'
          Write-TRSkinPanelTrace -Message 'restore-restart-declined'
          return
        }
        $restoreArguments += '-ForceRestart'
      }
      Start-TRSkinPanelOperation -Script $restoreScript -Arguments $restoreArguments `
        -PendingText '正在恢复并验证官方外观…' `
        -SuccessText '已恢复官方外观'
    } catch {
      Show-TRSkinPanelError -Message $_.Exception.Message
    }
  })

  $close.add_Click({ $form.Close() })

  $importMusic.add_Click({
    $dialog = [System.Windows.Forms.OpenFileDialog]::new()
    $dialog.Title = '选择本地环境音乐'
    $dialog.Filter = 'Audio files|*.mp3;*.m4a;*.wav;*.ogg;*.flac|All files|*.*'
    $dialog.Multiselect = $false
    try {
      if ($dialog.ShowDialog($form) -ne [System.Windows.Forms.DialogResult]::OK) { return }
      $musicCatalog = Invoke-DreamSkinMusicHelper -Command 'catalog' -StateRoot $StateRoot
      $slotForm = [System.Windows.Forms.Form]::new()
      $slotForm.Text = '选择音乐对应的环境'
      $slotForm.ClientSize = [System.Drawing.Size]::new(500, 145)
      $slotForm.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterParent
      $slotForm.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
      $slotCombo = [System.Windows.Forms.ComboBox]::new()
      $slotCombo.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
      $slotCombo.SetBounds(18, 26, 460, 30)
      foreach ($slot in $musicCatalog.slots) {
        [void]$slotCombo.Items.Add("$($slot.name)（已导入 $($slot.imported) 首）")
      }
      if ($slotCombo.Items.Count -gt 0) { $slotCombo.SelectedIndex = 0 }
      $slotSave = [System.Windows.Forms.Button]::new()
      $slotSave.Text = '导入'
      $slotSave.DialogResult = [System.Windows.Forms.DialogResult]::OK
      $slotSave.SetBounds(308, 88, 80, 34)
      $slotCancel = [System.Windows.Forms.Button]::new()
      $slotCancel.Text = '取消'
      $slotCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
      $slotCancel.SetBounds(398, 88, 80, 34)
      $slotForm.Controls.AddRange(@($slotCombo, $slotSave, $slotCancel))
      $slotForm.AcceptButton = $slotSave
      $slotForm.CancelButton = $slotCancel
      try {
        if ($slotForm.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK -and
          $slotCombo.SelectedIndex -ge 0) {
          $slotId = "$($musicCatalog.slots[$slotCombo.SelectedIndex].id)"
          $null = Invoke-DreamSkinMusicHelper -Command 'import' `
            -Arguments @($slotId, $dialog.FileName) -StateRoot $StateRoot
          $musicEnabled.Checked = $true
          $trackCount += 1
          $musicSummary.Text = "本地音乐库：$trackCount 首"
        }
      } finally {
        $slotForm.Dispose()
      }
    } catch {
      Show-TRSkinPanelError -Message $_.Exception.Message
    } finally {
      $dialog.Dispose()
    }
  })

  $operationTimer = [System.Windows.Forms.Timer]::new()
  $operationTimer.Interval = 250
  $operationTimer.add_Tick({
    $operation = $script:activePanelOperation
    if ($null -eq $operation) { return }
    $completed = $false
    try {
      $operation.Process.Refresh()
      if (-not $operation.Process.HasExited) { return }
      $operation.Process.WaitForExit()
      $completed = $true
      $exitCode = $operation.Process.ExitCode
      $stdout = if (Test-Path -LiteralPath $operation.StdoutPath) {
        Get-Content -LiteralPath $operation.StdoutPath -Raw -ErrorAction SilentlyContinue
      } else { '' }
      $stderr = if (Test-Path -LiteralPath $operation.StderrPath) {
        Get-Content -LiteralPath $operation.StderrPath -Raw -ErrorAction SilentlyContinue
      } else { '' }
      if ($exitCode -eq 0) {
        $status.Text = $operation.SuccessText
        Write-TRSkinPanelTrace -Message "operation-succeeded pid=$($operation.Process.Id)"
      } else {
        $status.Text = '操作失败，请查看错误提示'
        $details = ("$stderr`n$stdout").Trim()
        if (-not $details) { $details = "后台操作退出，代码：$exitCode" }
        if ($details.Length -gt 4000) { $details = $details.Substring($details.Length - 4000) }
        Write-TRSkinPanelTrace -Message "operation-failed pid=$($operation.Process.Id) exit=$exitCode"
        Show-TRSkinPanelError -Message $details
      }
    } catch {
      $status.Text = '操作状态检查失败'
      Write-TRSkinPanelTrace -Message "operation-monitor-failed message=$($_.Exception.Message)"
      Show-TRSkinPanelError -Message $_.Exception.Message
    } finally {
      if ($completed) {
        $operation.Process.Dispose()
        $script:activePanelOperation = $null
        $save.Enabled = $true
        $restore.Enabled = $true
      }
    }
  })
  $operationTimer.Start()

  $showTimer = [System.Windows.Forms.Timer]::new()
  $showTimer.Interval = 200
  $showTimer.add_Tick({
    if ($showEvent.WaitOne(0)) {
      Write-TRSkinPanelTrace -Message 'show-signal-received'
      Show-TRSkinControlPanelWindow -Form $form -NotifyWhenForegroundDenied
    }
  })
  $showTimer.Start()
  Write-TRSkinPanelTrace -Message 'message-loop-starting'
  try {
    $form.add_Shown({
      Show-TRSkinControlPanelWindow -Form $form
      $firstItemBounds = $environmentList.Items[0].Bounds
      $secondItemBounds = $environmentList.Items[1].Bounds
      Write-TRSkinPanelTrace -Message (
        "environment-list-layout font-height=$($environmentList.Font.Height) " +
        "first=$($firstItemBounds.X),$($firstItemBounds.Y),$($firstItemBounds.Width),$($firstItemBounds.Height) " +
        "second=$($secondItemBounds.X),$($secondItemBounds.Y),$($secondItemBounds.Width),$($secondItemBounds.Height)"
      )
      Write-TRSkinPanelTrace -Message (
        "form-shown handle=$($form.Handle) visible=$($form.Visible) " +
        "taskbar=$($form.ShowInTaskbar) state=$($form.WindowState) bounds=$($form.Bounds)"
      )
    })
    [System.Windows.Forms.Application]::Run($form)
  } finally {
    $operationTimer.Stop()
    $operationTimer.Dispose()
    $showTimer.Stop()
    $showTimer.Dispose()
    $form.Icon.Dispose()
    $form.Dispose()
  }
} catch {
  try {
    @(
      "timestamp=$([DateTimeOffset]::Now.ToString('o'))"
      "message=$($_.Exception.Message)"
      ($_ | Out-String)
    ) | Set-Content -LiteralPath (Join-Path $StateRoot 'control-panel.log') -Encoding UTF8
  } catch {}
  Show-TRSkinPanelError -Message $_.Exception.Message
  exit 1
} finally {
  $showEvent.Dispose()
  if ($acquired) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
