[CmdletBinding()]
param([int]$Port = 9335)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

Assert-DreamSkinPort -Port $Port
$SkillRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$paths = Initialize-DreamSkinThemeStore -SkillRoot $SkillRoot -StateRoot $StateRoot
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$startScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore-dream-skin.ps1'
$controlPanelScript = Join-Path $PSScriptRoot 'control-panel-windows.ps1'

$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkin.$sid.Tray")
$acquired = $false
$trayIcon = $null
try {
  try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) { exit 0 }

  $notify = [System.Windows.Forms.NotifyIcon]::new()
  $trayIcon = [System.Drawing.Icon]::new((Join-Path $SkillRoot 'assets\trskin.ico'))
  $notify.Icon = $trayIcon
  $notify.Text = 'TR Skin'
  $notify.Visible = $true
  $menu = [System.Windows.Forms.ContextMenuStrip]::new()
  $notify.ContextMenuStrip = $menu

  function Show-DreamSkinTrayError {
    param([string]$Message)
    [void][System.Windows.Forms.MessageBox]::Show(
      $Message,
      'TR Skin',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    )
  }

  function Start-DreamSkinPowerShell {
    param([Parameter(Mandatory = $true)][string]$Script, [string[]]$Arguments = @())
    $scriptToken = ConvertTo-DreamSkinProcessArgument -Value $Script
    $argumentLine = '-NoProfile -ExecutionPolicy Bypass -File ' + $scriptToken
    if ($Arguments.Count -gt 0) { $argumentLine += ' ' + ($Arguments -join ' ') }
    Start-Process -FilePath $powershell -ArgumentList $argumentLine | Out-Null
  }

  function Add-DreamSkinTrayItem {
    param(
      [Parameter(Mandatory = $true)][System.Windows.Forms.ToolStripItemCollection]$Items,
      [Parameter(Mandatory = $true)][string]$Text,
      [AllowNull()][scriptblock]$Action,
      [bool]$Enabled = $true
    )
    $item = [System.Windows.Forms.ToolStripMenuItem]::new($Text)
    $item.Enabled = $Enabled
    if ($null -ne $Action) {
      $item.add_Click({
        try { & $Action } catch { Show-DreamSkinTrayError -Message $_.Exception.Message }
      }.GetNewClosure())
    }
    [void]$Items.Add($item)
    return $item
  }

  function Rebuild-DreamSkinTrayMenu {
    $menu.Items.Clear()
    $paused = Test-DreamSkinPaused -StateRoot $StateRoot
    $state = $null
    try { $state = Read-DreamSkinState -Path $paths.State } catch {}
    $active = $null
    try { $active = Read-DreamSkinTheme -ThemeDirectory $paths.Active -SkipImageMetadata } catch {}
    $status = if ($paused) { '状态：已暂停' } elseif ($state) { '状态：运行中' } else { '状态：未运行' }
    if ($null -ne $active -and $null -ne $active.Theme -and $active.Theme.name) {
      $status += " · $($active.Theme.name)"
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $status -Action $null -Enabled $false
    [void]$menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())

    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '打开 TR Skin 控制面板' -Action {
      Start-DreamSkinPowerShell -Script $controlPanelScript -Arguments @('-Port', "$Port")
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '应用或重新应用' -Action {
      Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
      Start-DreamSkinPowerShell -Script $startScript -Arguments @('-Port', "$Port", '-PromptRestart')
    }
    $pauseText = if ($paused) { '继续显示皮肤' } else { '暂停皮肤' }
    $nextPaused = -not $paused
    $pauseAction = {
      Set-DreamSkinPaused -Paused $nextPaused -StateRoot $StateRoot | Out-Null
    }.GetNewClosure()
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text $pauseText -Action $pauseAction
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '更换背景图' -Action {
      $dialog = [System.Windows.Forms.OpenFileDialog]::new()
      $dialog.Title = '选择 TR Skin 背景图'
      $dialog.Filter = 'Image files|*.png;*.jpg;*.jpeg;*.webp|All files|*.*'
      $dialog.Multiselect = $false
      try {
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          $null = Set-DreamSkinActiveTheme -ImagePath $dialog.FileName -Theme $null -StateRoot $StateRoot
          Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
          $notify.ShowBalloonTip(1800, 'TR Skin', '背景图已更新。', [System.Windows.Forms.ToolTipIcon]::Info)
        }
      } finally {
        $dialog.Dispose()
      }
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '保存当前主题' -Action {
      $name = [Microsoft.VisualBasic.Interaction]::InputBox('输入主题名称：', '保存 TR Skin 主题', '')
      if ($name.Trim()) {
        $saved = Save-DreamSkinCurrentTheme -Name $name -StateRoot $StateRoot
        $notify.ShowBalloonTip(1800, 'TR Skin', "已保存：$($saved.Theme.name)", [System.Windows.Forms.ToolTipIcon]::Info)
      }
    }

    $savedMenu = [System.Windows.Forms.ToolStripMenuItem]::new('已保存主题')
    $savedThemes = @(Get-DreamSkinSavedThemes -StateRoot $StateRoot -SkipImageMetadata)
    if ($savedThemes.Count -eq 0) {
      $empty = [System.Windows.Forms.ToolStripMenuItem]::new('暂无已保存主题')
      $empty.Enabled = $false
      [void]$savedMenu.DropDownItems.Add($empty)
    } else {
      foreach ($saved in $savedThemes) {
        $savedPath = $saved.Path
        $savedName = $saved.Name
        $savedAction = {
          $null = Use-DreamSkinSavedTheme -ThemeDirectory $savedPath -StateRoot $StateRoot
          Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
          $notify.ShowBalloonTip(1800, 'TR Skin', "已应用：$savedName", [System.Windows.Forms.ToolTipIcon]::Info)
        }.GetNewClosure()
        $null = Add-DreamSkinTrayItem -Items $savedMenu.DropDownItems -Text $savedName -Action $savedAction
      }
    }
    [void]$menu.Items.Add($savedMenu)

    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '配置 · 全环境轮换' -Action {
      $catalog = @(Invoke-DreamSkinRandomPoolHelper -Command 'catalog' -StateRoot $StateRoot)
      $current = Invoke-DreamSkinRandomPoolHelper -Command 'show' -StateRoot $StateRoot
      $excluded = @($current.excluded)
      $form = [System.Windows.Forms.Form]::new()
      $form.Text = '全环境轮换配置'
      $form.Width = 440
      $form.Height = 650
      $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
      $form.MinimizeBox = $false
      $form.MaximizeBox = $false
      $label = [System.Windows.Forms.Label]::new()
      $label.Text = '勾选参与“所有环境随机轮换”的环境（至少保留两个）：'
      $label.SetBounds(16, 16, 390, 34)
      $intervalLabel = [System.Windows.Forms.Label]::new()
      $intervalLabel.Text = '环境切换间隔：'
      $intervalLabel.SetBounds(16, 54, 112, 26)
      $interval = [System.Windows.Forms.NumericUpDown]::new()
      $interval.Minimum = 1
      $interval.Maximum = 60
      $interval.Value = [Math]::Min(
        60,
        [Math]::Max(1, [Math]::Round(([double]$current.environmentIntervalMs) / 60000))
      )
      $interval.SetBounds(128, 52, 74, 28)
      $minutesLabel = [System.Windows.Forms.Label]::new()
      $minutesLabel.Text = '分钟（保存后长期有效）'
      $minutesLabel.SetBounds(212, 54, 190, 26)
      $backgroundModeLabel = [System.Windows.Forms.Label]::new()
      $backgroundModeLabel.Text = '同环境多背景：'
      $backgroundModeLabel.SetBounds(16, 88, 112, 26)
      $backgroundMode = [System.Windows.Forms.ComboBox]::new()
      $backgroundMode.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
      [void]$backgroundMode.Items.Add('进入环境后固定一张')
      [void]$backgroundMode.Items.Add('停留期间定时轮换')
      $backgroundMode.SelectedIndex = if ("$($current.backgroundMode)" -eq 'rotate') { 1 } else { 0 }
      $backgroundMode.SetBounds(128, 86, 174, 28)
      $backgroundInterval = [System.Windows.Forms.NumericUpDown]::new()
      $backgroundInterval.Minimum = 1
      $backgroundInterval.Maximum = 60
      $backgroundInterval.Value = [Math]::Min(
        60,
        [Math]::Max(1, [Math]::Round(([double]$current.backgroundIntervalMs) / 60000))
      )
      $backgroundInterval.SetBounds(310, 86, 58, 28)
      $backgroundMinutesLabel = [System.Windows.Forms.Label]::new()
      $backgroundMinutesLabel.Text = '分'
      $backgroundMinutesLabel.SetBounds(372, 88, 30, 26)
      $list = [System.Windows.Forms.CheckedListBox]::new()
      $list.CheckOnClick = $true
      $list.SetBounds(16, 124, 390, 414)
      foreach ($entry in $catalog) {
        $index = $list.Items.Add("$($entry.name)")
        $list.SetItemChecked($index, -not ($excluded -contains "$($entry.variant)"))
      }
      $save = [System.Windows.Forms.Button]::new()
      $save.Text = '保存'
      $save.DialogResult = [System.Windows.Forms.DialogResult]::OK
      $save.SetBounds(248, 550, 76, 30)
      $cancel = [System.Windows.Forms.Button]::new()
      $cancel.Text = '取消'
      $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
      $cancel.SetBounds(330, 550, 76, 30)
      $form.Controls.AddRange(@(
        $label, $intervalLabel, $interval, $minutesLabel,
        $backgroundModeLabel, $backgroundMode, $backgroundInterval,
        $backgroundMinutesLabel, $list, $save, $cancel
      ))
      $form.AcceptButton = $save
      $form.CancelButton = $cancel
      try {
        if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          $disabled = @()
          for ($index = 0; $index -lt $catalog.Count; $index += 1) {
            if (-not $list.GetItemChecked($index)) { $disabled += "$($catalog[$index].variant)" }
          }
          if ($catalog.Count - $disabled.Count -lt 2) {
            throw '全环境轮换至少需要保留两个环境。'
          }
          $intervalMs = [int]$interval.Value * 60000
          $backgroundModeId = if ($backgroundMode.SelectedIndex -eq 1) { 'rotate' } else { 'fixed' }
          $backgroundIntervalMs = [int]$backgroundInterval.Value * 60000
          $arguments = @(
            '--interval-ms', "$intervalMs",
            '--background-mode', $backgroundModeId,
            '--background-interval-ms', "$backgroundIntervalMs"
          ) + $disabled
          $null = Invoke-DreamSkinRandomPoolHelper -Command 'set' -Arguments $arguments -StateRoot $StateRoot
          if ($active -and "$($active.Theme.id)".StartsWith('preset-terraria-')) {
            $activeSavedTheme = Join-Path $paths.Saved "$($active.Theme.id)"
            if (Test-Path -LiteralPath (Join-Path $activeSavedTheme 'theme.json') -PathType Leaf) {
              $null = Use-DreamSkinSavedTheme -ThemeDirectory $activeSavedTheme -StateRoot $StateRoot
            }
          }
          $notify.ShowBalloonTip(1800, 'Codex Terraria 皮肤', '环境轮换与多背景配置已保存。', [System.Windows.Forms.ToolTipIcon]::Info)
        }
      } finally {
        $form.Dispose()
      }
    }

    $musicMenu = [System.Windows.Forms.ToolStripMenuItem]::new('环境音乐')
    $musicConfig = Invoke-DreamSkinMusicHelper -Command 'show' -StateRoot $StateRoot
    $trackCount = 0
    if ($musicConfig.tracks) {
      foreach ($property in $musicConfig.tracks.PSObject.Properties) {
        $trackCount += @($property.Value).Count
      }
    }
    $musicStatus = if ($musicConfig.enabled) { '已启用' } else { '已暂停' }
    $musicMode = if ("$($musicConfig.playbackMode)" -eq 'random') { '随机' } else { '顺序' }
    $soundtrackMode = switch ("$($musicConfig.soundtrackMode)") {
      'otherworld' { '来世' }
      'mixed' { '混合' }
      default { '经典' }
    }
    $trackChangeMode = if ("$($musicConfig.trackChangeMode)" -eq 'fixed') {
      '固定一首'
    } else {
      '自动换曲'
    }
    $null = Add-DreamSkinTrayItem -Items $musicMenu.DropDownItems `
      -Text "状态：$musicStatus · $trackCount 首 · $soundtrackMode · $trackChangeMode · $($musicConfig.volume)%" `
      -Action $null -Enabled $false
    $environmentMode = if ("$($musicConfig.environmentChangeMode)" -eq 'after-current') {
      '播完当前曲'
    } else {
      '立即换曲'
    }
    $hiddenMode = if ([bool]$musicConfig.pauseWhenHidden) { '隐藏时暂停' } else { '后台继续' }
    $null = Add-DreamSkinTrayItem -Items $musicMenu.DropDownItems `
      -Text "间隔 $($musicConfig.trackGapSeconds)s · 渐入 $($musicConfig.fadeInSeconds)s · $environmentMode · $hiddenMode" `
      -Action $null -Enabled $false

    $musicToggleEnabled = -not [bool]$musicConfig.enabled
    $musicToggleText = if ($musicToggleEnabled) { '启用环境音乐' } else { '暂停环境音乐' }
    $musicToggleAction = {
      $value = if ($musicToggleEnabled) { 'on' } else { 'off' }
      $null = Invoke-DreamSkinMusicHelper -Command 'set-enabled' `
        -Arguments @($value) -StateRoot $StateRoot
      $notify.ShowBalloonTip(
        1800,
        'Codex Terraria 皮肤',
        $(if ($musicToggleEnabled) { '音乐已启用；请在 Codex 顶部点击 ♪。' } else { '音乐已暂停。' }),
        [System.Windows.Forms.ToolTipIcon]::Info
      )
    }.GetNewClosure()
    $null = Add-DreamSkinTrayItem -Items $musicMenu.DropDownItems `
      -Text $musicToggleText -Action $musicToggleAction

    $modeMenu = [System.Windows.Forms.ToolStripMenuItem]::new('多首播放方式')
    foreach ($mode in @(
      [pscustomobject]@{ Id = 'sequential'; Name = '按导入顺序' },
      [pscustomobject]@{ Id = 'random'; Name = '随机且不立即重复' }
    )) {
      $modeId = $mode.Id
      $modeAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-mode' `
          -Arguments @($modeId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $modeMenu.DropDownItems `
        -Text $mode.Name -Action $modeAction
    }
    [void]$musicMenu.DropDownItems.Add($modeMenu)

    $soundtrackMenu = [System.Windows.Forms.ToolStripMenuItem]::new('原声版本')
    foreach ($soundtrack in @(
      [pscustomobject]@{ Id = 'classic'; Name = '经典原声' },
      [pscustomobject]@{ Id = 'otherworld'; Name = '来世原声（缺曲回退经典）' },
      [pscustomobject]@{ Id = 'mixed'; Name = '经典与来世混合' }
    )) {
      $soundtrackId = $soundtrack.Id
      $soundtrackAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-soundtrack' `
          -Arguments @($soundtrackId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $soundtrackMenu.DropDownItems `
        -Text $soundtrack.Name -Action $soundtrackAction
    }
    [void]$musicMenu.DropDownItems.Add($soundtrackMenu)

    $trackChangeMenu = [System.Windows.Forms.ToolStripMenuItem]::new('一首结束后')
    foreach ($trackChange in @(
      [pscustomobject]@{ Id = 'rotate'; Name = '继续切换下一首' },
      [pscustomobject]@{ Id = 'fixed'; Name = '固定当前曲循环' }
    )) {
      $trackChangeId = $trackChange.Id
      $trackChangeAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-track-change' `
          -Arguments @($trackChangeId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $trackChangeMenu.DropDownItems `
        -Text $trackChange.Name -Action $trackChangeAction
    }
    [void]$musicMenu.DropDownItems.Add($trackChangeMenu)

    $volumeMenu = [System.Windows.Forms.ToolStripMenuItem]::new('音量')
    foreach ($volume in @(10, 20, 35, 50, 70, 100)) {
      $volumeValue = $volume
      $volumeAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-volume' `
          -Arguments @("$volumeValue") -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $volumeMenu.DropDownItems `
        -Text "$volumeValue%" -Action $volumeAction
    }
    [void]$musicMenu.DropDownItems.Add($volumeMenu)

    $gapMenu = [System.Windows.Forms.ToolStripMenuItem]::new('曲间等待')
    foreach ($gap in @(0, 1, 2, 3, 5, 10, 15, 30)) {
      $gapValue = $gap
      $gapAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-gap' `
          -Arguments @("$gapValue") -StateRoot $StateRoot
      }.GetNewClosure()
      $gapLabel = if ($gapValue -eq 0) { '无间隔' } else { "$gapValue 秒" }
      $null = Add-DreamSkinTrayItem -Items $gapMenu.DropDownItems `
        -Text $gapLabel -Action $gapAction
    }
    [void]$musicMenu.DropDownItems.Add($gapMenu)

    $fadeMenu = [System.Windows.Forms.ToolStripMenuItem]::new('渐入时长')
    foreach ($fade in @(
      [pscustomobject]@{ Id = '0'; Name = '关闭' },
      [pscustomobject]@{ Id = '0.5'; Name = '0.5 秒' },
      [pscustomobject]@{ Id = '1'; Name = '1 秒' },
      [pscustomobject]@{ Id = '1.5'; Name = '1.5 秒' },
      [pscustomobject]@{ Id = '2'; Name = '2 秒' },
      [pscustomobject]@{ Id = '3'; Name = '3 秒' },
      [pscustomobject]@{ Id = '5'; Name = '5 秒' }
    )) {
      $fadeId = $fade.Id
      $fadeAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-fade' `
          -Arguments @($fadeId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $fadeMenu.DropDownItems `
        -Text $fade.Name -Action $fadeAction
    }
    [void]$musicMenu.DropDownItems.Add($fadeMenu)

    $environmentMusicMenu = [System.Windows.Forms.ToolStripMenuItem]::new('环境切换时')
    foreach ($environmentModeOption in @(
      [pscustomobject]@{ Id = 'immediate'; Name = '立即切换音乐' },
      [pscustomobject]@{ Id = 'after-current'; Name = '播完当前曲再切换' }
    )) {
      $environmentModeId = $environmentModeOption.Id
      $environmentModeAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-environment-mode' `
          -Arguments @($environmentModeId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $environmentMusicMenu.DropDownItems `
        -Text $environmentModeOption.Name -Action $environmentModeAction
    }
    [void]$musicMenu.DropDownItems.Add($environmentMusicMenu)

    $visibilityMusicMenu = [System.Windows.Forms.ToolStripMenuItem]::new('Codex 隐藏时')
    foreach ($visibilityOption in @(
      [pscustomobject]@{ Id = 'on'; Name = '暂停音乐' },
      [pscustomobject]@{ Id = 'off'; Name = '继续播放' }
    )) {
      $visibilityId = $visibilityOption.Id
      $visibilityAction = {
        $null = Invoke-DreamSkinMusicHelper -Command 'set-hidden' `
          -Arguments @($visibilityId) -StateRoot $StateRoot
      }.GetNewClosure()
      $null = Add-DreamSkinTrayItem -Items $visibilityMusicMenu.DropDownItems `
        -Text $visibilityOption.Name -Action $visibilityAction
    }
    [void]$musicMenu.DropDownItems.Add($visibilityMusicMenu)

    $null = Add-DreamSkinTrayItem -Items $musicMenu.DropDownItems -Text '导入本地音乐…' -Action {
      $dialog = [System.Windows.Forms.OpenFileDialog]::new()
      $dialog.Title = '选择本机环境音乐'
      $dialog.Filter = 'Audio files|*.mp3;*.m4a;*.wav;*.ogg;*.flac|All files|*.*'
      $dialog.Multiselect = $false
      try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
        $catalogResult = Invoke-DreamSkinMusicHelper -Command 'catalog' -StateRoot $StateRoot
        $slots = @($catalogResult.slots)
        $form = [System.Windows.Forms.Form]::new()
        $form.Text = '选择泰拉瑞亚音乐槽'
        $form.Width = 460
        $form.Height = 170
        $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
        $form.MinimizeBox = $false
        $form.MaximizeBox = $false
        $label = [System.Windows.Forms.Label]::new()
        $label.Text = '这首音乐对应哪个环境音乐槽？'
        $label.SetBounds(16, 16, 410, 24)
        $combo = [System.Windows.Forms.ComboBox]::new()
        $combo.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
        $combo.SetBounds(16, 44, 410, 28)
        foreach ($slot in $slots) {
          [void]$combo.Items.Add("$($slot.name)（已导入 $($slot.imported) 首）")
        }
        if ($combo.Items.Count -gt 0) { $combo.SelectedIndex = 0 }
        $save = [System.Windows.Forms.Button]::new()
        $save.Text = '导入'
        $save.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $save.SetBounds(268, 86, 76, 30)
        $cancel = [System.Windows.Forms.Button]::new()
        $cancel.Text = '取消'
        $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $cancel.SetBounds(350, 86, 76, 30)
        $form.Controls.AddRange(@($label, $combo, $save, $cancel))
        $form.AcceptButton = $save
        $form.CancelButton = $cancel
        try {
          if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK -and
            $combo.SelectedIndex -ge 0) {
            $slotId = "$($slots[$combo.SelectedIndex].id)"
            $null = Invoke-DreamSkinMusicHelper -Command 'import' `
              -Arguments @($slotId, $dialog.FileName) -StateRoot $StateRoot
            $null = Invoke-DreamSkinMusicHelper -Command 'set-enabled' `
              -Arguments @('on') -StateRoot $StateRoot
            $notify.ShowBalloonTip(
              2000,
              'Codex Terraria 皮肤',
              '音乐已导入；皮肤将在数秒内热更新，请在 Codex 顶部点击 ♪。',
              [System.Windows.Forms.ToolTipIcon]::Info
            )
          }
        } finally {
          $form.Dispose()
        }
      } finally {
        $dialog.Dispose()
      }
    }
    [void]$menu.Items.Add($musicMenu)

    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '打开图片文件夹' -Action {
      Start-Process -FilePath explorer.exe -ArgumentList @($paths.Images) | Out-Null
    }
    [void]$menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '完全恢复 Codex' -Action {
      Start-DreamSkinPowerShell -Script $restoreScript -Arguments @(
        '-Port', "$Port", '-RestoreBaseTheme', '-PromptRestart'
      )
      $notify.Visible = $false
      [System.Windows.Forms.Application]::Exit()
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '彻底卸载皮肤工具…' -Action {
      Start-DreamSkinPowerShell -Script $restoreScript -Arguments @(
        '-Port', "$Port", '-Uninstall', '-PurgeAllData', '-RestoreBaseTheme',
        '-PromptRestart', '-NoRelaunch'
      )
      $notify.Visible = $false
      [System.Windows.Forms.Application]::Exit()
    }
    $null = Add-DreamSkinTrayItem -Items $menu.Items -Text '退出托盘' -Action {
      $notify.Visible = $false
      [System.Windows.Forms.Application]::Exit()
    }
  }

  $menu.add_Opening({ Rebuild-DreamSkinTrayMenu })
  $notify.add_DoubleClick({
    try {
      Start-DreamSkinPowerShell -Script $controlPanelScript -Arguments @('-Port', "$Port")
    } catch {
      Show-DreamSkinTrayError -Message $_.Exception.Message
    }
  })
  [System.Windows.Forms.Application]::Run()
} finally {
  if ($null -ne $notify) { $notify.Dispose() }
  if ($null -ne $trayIcon) { $trayIcon.Dispose() }
  if ($acquired) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
