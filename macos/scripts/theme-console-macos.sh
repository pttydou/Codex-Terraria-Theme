#!/bin/bash

# One deliberate entry point for the official appearance and local presets. A
# manual theme choice may restart a normally launched Codex exactly once, but
# the console never leaves an injector watcher or app relaunch job behind.

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

CHOICE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --choice) CHOICE="${2:-}"; shift 2 ;;
    *) fail "Unknown theme console argument: $1" ;;
  esac
done

choose_theme() {
  /usr/bin/osascript <<'APPLESCRIPT'
set choices to {"Codex 官方原版", "Terraria · 全环境随机", "配置 · 全环境随机池…", "音乐 · 导入与播放设置…", "Terraria · 森林 · 白昼", "Terraria · 森林 · 夜晚", "Terraria · 地下层", "Terraria · 洞穴层", "Terraria · 太空", "Terraria · 地狱", "Terraria · 地表猩红", "Terraria · 地下猩红", "Terraria · 神圣之地 · 白昼", "Terraria · 神圣之地 · 夜晚", "Terraria · 地下神圣", "Terraria · 地表腐化", "Terraria · 地下腐化", "Terraria · 丛林 · 白昼", "Terraria · 丛林 · 夜晚", "Terraria · 地下丛林", "Terraria · 苔原 · 白昼", "Terraria · 苔原 · 夜晚", "Terraria · 地下冰雪", "Terraria · 地表沙漠", "Terraria · 地下沙漠", "Terraria · 海洋", "Terraria · 地表夜光蘑菇", "Terraria · 地下夜光蘑菇", "Terraria · 地牢", "Terraria · 丛林神庙", "Terraria · 血月", "Terraria · 日食", "Terraria · 哥布林入侵", "Terraria · 海盗入侵", "Terraria · 火星人入侵", "Terraria · 以太", "Terraria · 墓地", "Terraria · 南瓜月", "Terraria · 霜月", "Terraria · 日耀柱", "Terraria · 星旋柱", "Terraria · 星云柱", "Terraria · 星尘柱", "Terraria · 陨石", "Terraria · 蜘蛛洞", "Terraria · 蜂巢", "Terraria · 花岗岩洞", "Terraria · 大理石洞"}
set picked to choose from list choices with title "Codex 皮肤控制台" with prompt "选择本次要使用的外观，或导入你合法持有的本地音乐。音乐默认关闭，不随皮肤包附带；若 Codex 是普通启动状态，首次应用皮肤时会自动重启一次。" default items {"Codex 官方原版"} OK button name "应用" cancel button name "取消"
if picked is false then return "cancel"
set selectedName to item 1 of picked
if selectedName is "Codex 官方原版" then return "official"
if selectedName is "Terraria · 全环境随机" then return "random"
if selectedName is "配置 · 全环境随机池…" then return "configure-random"
if selectedName is "音乐 · 导入与播放设置…" then return "configure-music"
if selectedName is "Terraria · 森林 · 白昼" then return "forest-day"
if selectedName is "Terraria · 森林 · 夜晚" then return "forest-night"
if selectedName is "Terraria · 地下层" then return "underground"
if selectedName is "Terraria · 洞穴层" then return "cavern"
if selectedName is "Terraria · 太空" then return "space"
if selectedName is "Terraria · 地狱" then return "underworld"
if selectedName is "Terraria · 地表猩红" then return "crimson"
if selectedName is "Terraria · 地下猩红" then return "underground-crimson"
if selectedName is "Terraria · 神圣之地 · 白昼" then return "hallow"
if selectedName is "Terraria · 神圣之地 · 夜晚" then return "hallow-night"
if selectedName is "Terraria · 地下神圣" then return "underground-hallow"
if selectedName is "Terraria · 地表腐化" then return "corruption"
if selectedName is "Terraria · 地下腐化" then return "underground-corruption"
if selectedName is "Terraria · 丛林 · 白昼" then return "jungle"
if selectedName is "Terraria · 丛林 · 夜晚" then return "jungle-night"
if selectedName is "Terraria · 地下丛林" then return "underground-jungle"
if selectedName is "Terraria · 苔原 · 白昼" then return "tundra"
if selectedName is "Terraria · 苔原 · 夜晚" then return "tundra-night"
if selectedName is "Terraria · 地下冰雪" then return "ice-biome"
if selectedName is "Terraria · 地表沙漠" then return "desert"
if selectedName is "Terraria · 地下沙漠" then return "underground-desert"
if selectedName is "Terraria · 海洋" then return "ocean"
if selectedName is "Terraria · 地表夜光蘑菇" then return "glowing-mushroom"
if selectedName is "Terraria · 地下夜光蘑菇" then return "underground-glowing-mushroom"
if selectedName is "Terraria · 地牢" then return "dungeon"
if selectedName is "Terraria · 丛林神庙" then return "jungle-temple"
if selectedName is "Terraria · 血月" then return "blood-moon"
if selectedName is "Terraria · 日食" then return "solar-eclipse"
if selectedName is "Terraria · 哥布林入侵" then return "goblin-invasion"
if selectedName is "Terraria · 海盗入侵" then return "pirate-invasion"
if selectedName is "Terraria · 火星人入侵" then return "martian-invasion"
if selectedName is "Terraria · 以太" then return "aether"
if selectedName is "Terraria · 墓地" then return "graveyard"
if selectedName is "Terraria · 南瓜月" then return "pumpkin-moon"
if selectedName is "Terraria · 霜月" then return "frost-moon"
if selectedName is "Terraria · 日耀柱" then return "lunar-solar"
if selectedName is "Terraria · 星旋柱" then return "lunar-vortex"
if selectedName is "Terraria · 星云柱" then return "lunar-nebula"
if selectedName is "Terraria · 星尘柱" then return "lunar-stardust"
if selectedName is "Terraria · 陨石" then return "meteorite"
if selectedName is "Terraria · 蜘蛛洞" then return "spider-nest"
if selectedName is "Terraria · 蜂巢" then return "bee-hive"
if selectedName is "Terraria · 花岗岩洞" then return "granite-cave"
if selectedName is "Terraria · 大理石洞" then return "marble-cave"
return "cancel"
APPLESCRIPT
}

case "$CHOICE" in
  "") CHOICE="$(choose_theme)" ;;
  official|random|configure-random|configure-music|forest-day|forest-night|underground|cavern|space|underworld|crimson|underground-crimson|hallow|hallow-night|underground-hallow|corruption|underground-corruption|jungle|jungle-night|underground-jungle|tundra|tundra-night|ice-biome|desert|underground-desert|ocean|glowing-mushroom|underground-glowing-mushroom|dungeon|jungle-temple|blood-moon|solar-eclipse|goblin-invasion|pirate-invasion|martian-invasion|aether|graveyard|pumpkin-moon|frost-moon|lunar-solar|lunar-vortex|lunar-nebula|lunar-stardust|meteorite|spider-nest|bee-hive|granite-cave|marble-cave|cancel) ;;
  *) fail "Unknown theme choice: $CHOICE" ;;
esac
[ "$CHOICE" != "cancel" ] || exit 0

discover_codex_app
require_macos_runtime
ensure_state_root
release_codex_launchd_job

CONSOLE_LOCK="$STATE_ROOT/theme-console.lock"
acquire_console_lock() {
  local recorded_pid=""
  if /bin/mkdir "$CONSOLE_LOCK" 2>/dev/null; then
    /usr/bin/printf '%s\n' "$$" > "$CONSOLE_LOCK/pid"
    return 0
  fi
  recorded_pid="$(/bin/cat "$CONSOLE_LOCK/pid" 2>/dev/null || true)"
  case "$recorded_pid" in
    ''|*[!0-9]*) ;;
    *)
      if /bin/kill -0 "$recorded_pid" 2>/dev/null; then
        alert_user "皮肤控制台正在处理上一次切换，请稍候。"
        exit 2
      fi
      ;;
  esac
  /bin/rm -rf "$CONSOLE_LOCK"
  /bin/mkdir "$CONSOLE_LOCK" 2>/dev/null \
    || fail "Another theme switch started at the same time."
  /usr/bin/printf '%s\n' "$$" > "$CONSOLE_LOCK/pid"
}
release_console_lock() {
  [ -d "$CONSOLE_LOCK" ] || return 0
  local recorded_pid=""
  recorded_pid="$(/bin/cat "$CONSOLE_LOCK/pid" 2>/dev/null || true)"
  [ "$recorded_pid" = "$$" ] || return 0
  /bin/rm -rf "$CONSOLE_LOCK"
}
acquire_console_lock
trap release_console_lock EXIT

PORT=9341
if [ -f "$STATE_PATH" ]; then
  saved_port="$(state_field port 2>/dev/null || true)"
  case "$saved_port" in
    ''|*[!0-9]*) ;;
    *) PORT="$saved_port" ;;
  esac
fi

apply_official() {
  if [ -f "$STATE_PATH" ]; then
    stop_recorded_injector \
      || fail "Could not stop the recorded skin injector; official restore stopped safely."
  fi
  release_codex_launchd_job

  if codex_is_running; then
    if verified_cdp_endpoint "$PORT"; then
      "$NODE" "$INJECTOR" --remove --port "$PORT" --theme-dir "$THEME_DIR" \
        --timeout-ms 8000 >/dev/null
    fi
    /bin/rm -f "$STATE_PATH"
    notify_user "已恢复 Codex 官方原版；Codex 保持运行。"
    return 0
  fi

  if [ -f "$THEME_BACKUP_PATH" ] && [ -f "$CONFIG_PATH" ]; then
    "$NODE" "$SCRIPT_DIR/theme-config.mjs" restore "$CONFIG_PATH" "$THEME_BACKUP_PATH"
  fi
  /bin/rm -f "$STATE_PATH"
  launch_codex_normally
  notify_user "已按官方原版启动 Codex。"
}

apply_manual_theme() {
  local theme_id="$1"
  local theme_name="$2"

  seed_bundled_presets
  [ -f "$STATE_ROOT/themes/$theme_id/theme.json" ] || fail "Theme is not installed: $theme_id"
  if [ -f "$STATE_PATH" ]; then
    stop_recorded_injector \
      || fail "Could not stop the recorded skin injector; theme switch stopped safely."
  fi
  "$SCRIPT_DIR/switch-theme-macos.sh" --id "$theme_id" --no-apply >/dev/null

  ensure_codex_skin_port_once "$PORT"
  PORT="$CODEX_SKIN_PORT"

  "$NODE" "$INJECTOR" --once --port "$PORT" --theme-dir "$THEME_DIR" \
    --timeout-ms 15000 >/dev/null
  codex_pid="$(codex_main_pids | /usr/bin/head -n 1)"
  write_state "$PORT" 0 "" "${codex_pid:-0}" "manual"
  notify_user "已应用 ${theme_name}；普通启动时最多重启一次，没有后台重启任务。"
}

configure_random_pool() {
  local summary=""
  local excluded_token=""
  local selected=""
  local excluded_count="0"
  local -a excluded_variants=()

  if ! summary="$("$NODE" "$SCRIPT_DIR/random-pool-config.mjs" show \
    "$RANDOM_POOL_CONFIG_PATH" 2>/dev/null)"; then
    summary='{"total":44,"excluded":[],"enabled":[]}'
    alert_user "原随机池配置已损坏或不兼容；请重新勾选并保存，原配置不会被直接执行。"
  fi
  excluded_token="$("$NODE" -e '
    const value = JSON.parse(process.argv[1]);
    process.stdout.write(`|${value.excluded.join("|")}|`);
  ' "$summary")"
  selected="$(/usr/bin/osascript - "$excluded_token" <<'APPLESCRIPT'
on run argv
  set excludedToken to item 1 of argv
  set allLabel to "不排除任何主题（44 套全部参与）"
  set labels to {allLabel, "森林·白昼", "森林·夜晚", "地下层", "洞穴层", "太空", "地狱", "地表猩红", "地下猩红", "神圣·白昼", "神圣·夜晚", "地下神圣", "地表腐化", "地下腐化", "丛林·白昼", "丛林·夜晚", "地下丛林", "苔原·白昼", "苔原·夜晚", "地下冰雪", "地表沙漠", "地下沙漠", "海洋", "地表夜光蘑菇", "地下夜光蘑菇", "地牢", "丛林神庙", "血月", "日食", "哥布林入侵", "海盗入侵", "火星人入侵", "以太", "墓地", "南瓜月", "霜月", "日耀柱", "星旋柱", "星云柱", "星尘柱", "陨石", "蜘蛛洞", "蜂巢", "花岗岩洞", "大理石洞"}
  set identifiers to {"all", "forest-day", "forest-night", "underground", "cavern", "space", "underworld", "crimson", "underground-crimson", "hallow", "hallow-night", "underground-hallow", "corruption", "underground-corruption", "jungle", "jungle-night", "underground-jungle", "tundra", "tundra-night", "ice-biome", "desert", "underground-desert", "ocean", "glowing-mushroom", "underground-glowing-mushroom", "dungeon", "jungle-temple", "blood-moon", "solar-eclipse", "goblin-invasion", "pirate-invasion", "martian-invasion", "aether", "graveyard", "pumpkin-moon", "frost-moon", "lunar-solar", "lunar-vortex", "lunar-nebula", "lunar-stardust", "meteorite", "spider-nest", "bee-hive", "granite-cave", "marble-cave"}
  set defaultItems to {}
  repeat with itemIndex from 2 to count of labels
    set identifier to item itemIndex of identifiers
    if excludedToken contains ("|" & identifier & "|") then set end of defaultItems to item itemIndex of labels
  end repeat
  if (count of defaultItems) is 0 then set defaultItems to {allLabel}
  set picked to choose from list labels with title "配置全环境随机池" with prompt "勾选不想参与随机轮换的主题。独立主题入口不会受影响；至少需要保留 2 套。" default items defaultItems OK button name "保存" cancel button name "取消" with multiple selections allowed
  if picked is false then return "cancel"
  if picked contains allLabel then return "none"
  set selectedIds to {}
  repeat with pickedLabel in picked
    repeat with itemIndex from 2 to count of labels
      if (item itemIndex of labels) is (pickedLabel as text) then set end of selectedIds to item itemIndex of identifiers
    end repeat
  end repeat
  set text item delimiters of AppleScript to ","
  return selectedIds as text
end run
APPLESCRIPT
)"
  [ "$selected" != "cancel" ] || return 0
  if [ "$selected" != "none" ] && [ -n "$selected" ]; then
    IFS=',' read -r -a excluded_variants <<< "$selected"
  fi
  if [ "${#excluded_variants[@]}" -eq 0 ]; then
    "$NODE" "$SCRIPT_DIR/random-pool-config.mjs" set "$RANDOM_POOL_CONFIG_PATH" >/dev/null \
      || { alert_user "无法保存随机池配置。"; return 1; }
  elif ! "$NODE" "$SCRIPT_DIR/random-pool-config.mjs" set \
    "$RANDOM_POOL_CONFIG_PATH" "${excluded_variants[@]}" >/dev/null; then
    alert_user "随机池至少需要保留 2 套主题，请减少排除项。"
    return 1
  fi
  excluded_count="${#excluded_variants[@]}"
  if [ -f "$STATE_PATH" ] && codex_is_running && verified_cdp_endpoint "$PORT"; then
    "$NODE" "$INJECTOR" --runtime-random-config "$RANDOM_POOL_CONFIG_PATH" \
      --port "$PORT" --timeout-ms 8000 >/dev/null || true
  fi
  notify_user "随机池配置已保存：排除 ${excluded_count} 套，保留 $((44 - excluded_count)) 套。"
}

reapply_music_config() {
  [ -f "$STATE_PATH" ] || return 0
  [ -f "$THEME_DIR/theme.json" ] || return 0
  codex_is_running || return 0
  verified_cdp_endpoint "$PORT" || return 0
  "$NODE" "$INJECTOR" --once --port "$PORT" --theme-dir "$THEME_DIR" \
    --timeout-ms 8000 >/dev/null
}

configure_music() {
  local action=""
  local catalog_token=""
  local selected_slot=""
  local selected_file=""
  local selected_volume=""
  local selected_gap=""
  local selected_fade=""
  local selected_mode=""
  local summary=""

  action="$(/usr/bin/osascript <<'APPLESCRIPT'
set choices to {"导入本地音乐…", "启用环境音乐", "暂停环境音乐", "多首按顺序播放", "多首随机播放", "设置音量…", "设置曲间等待…", "设置渐入时长…", "换环境时立即换曲", "换环境时播完当前曲", "Codex 隐藏时暂停", "Codex 隐藏时继续播放", "查看当前设置"}
set picked to choose from list choices with title "Terraria 环境音乐" with prompt "音乐文件只保存在本机皮肤目录。首次播放需在 Codex 顶部点击 ♪；切换环境时会自动改用该环境的音乐池。" default items {"导入本地音乐…"} OK button name "继续" cancel button name "取消"
if picked is false then return "cancel"
set selectedName to item 1 of picked
if selectedName is "导入本地音乐…" then return "import"
if selectedName is "启用环境音乐" then return "enable"
if selectedName is "暂停环境音乐" then return "disable"
if selectedName is "多首按顺序播放" then return "sequential"
if selectedName is "多首随机播放" then return "random"
if selectedName is "设置音量…" then return "volume"
if selectedName is "设置曲间等待…" then return "gap"
if selectedName is "设置渐入时长…" then return "fade"
if selectedName is "换环境时立即换曲" then return "environment-immediate"
if selectedName is "换环境时播完当前曲" then return "environment-after-current"
if selectedName is "Codex 隐藏时暂停" then return "hidden-pause"
if selectedName is "Codex 隐藏时继续播放" then return "hidden-continue"
return "show"
APPLESCRIPT
)"
  [ "$action" != "cancel" ] || return 0
  case "$action" in
    import)
      catalog_token="$("$NODE" -e '
        const fs = require("fs");
        const catalog = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const config = (() => {
          try { return JSON.parse(fs.readFileSync(process.argv[2], "utf8")); }
          catch { return { tracks: {} }; }
        })();
        process.stdout.write(catalog.slots.map((slot) =>
          `${slot.id}\\t${slot.name}\\t${config.tracks?.[slot.id]?.length || 0}`
        ).join("\\n"));
      ' "$MUSIC_CATALOG_PATH" "$MUSIC_CONFIG_PATH")"
      selected_slot="$(/usr/bin/osascript - "$catalog_token" <<'APPLESCRIPT'
on run argv
  set rows to paragraphs of (item 1 of argv)
  set labels to {}
  set identifiers to {}
  repeat with rowText in rows
    set AppleScript's text item delimiters to tab
    set fields to text items of (rowText as text)
    set AppleScript's text item delimiters to ""
    if (count of fields) is 3 then
      set end of identifiers to item 1 of fields
      set end of labels to ((item 2 of fields) & "（已导入 " & (item 3 of fields) & " 首）")
    end if
  end repeat
  set picked to choose from list labels with title "选择音乐槽" with prompt "选择这首文件应对应的泰拉瑞亚环境音乐。一个槽可导入多首。" OK button name "选择" cancel button name "取消"
  if picked is false then return "cancel"
  set pickedLabel to item 1 of picked
  repeat with itemIndex from 1 to count of labels
    if item itemIndex of labels is pickedLabel then return item itemIndex of identifiers
  end repeat
  return "cancel"
end run
APPLESCRIPT
)"
      [ "$selected_slot" != "cancel" ] || return 0
      selected_file="$(/usr/bin/osascript <<'APPLESCRIPT'
set picked to choose file with prompt "选择本机音乐（MP3、M4A、WAV、OGG 或 FLAC；单文件不超过 64 MB）"
return POSIX path of picked
APPLESCRIPT
)" || return 0
      "$NODE" "$SCRIPT_DIR/music-config.mjs" import \
        "$MUSIC_CONFIG_PATH" "$MUSIC_LIBRARY_ROOT" "$MUSIC_CATALOG_PATH" \
        "$selected_slot" "$selected_file" >/dev/null \
        || { alert_user "导入失败：请确认文件格式、扩展名和 64 MB 大小限制。"; return 1; }
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-enabled "$MUSIC_CONFIG_PATH" on >/dev/null
      reapply_music_config
      notify_user "音乐已导入并启用；回到 Codex 点击顶部 ♪ 开始播放。"
      ;;
    enable)
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-enabled "$MUSIC_CONFIG_PATH" on >/dev/null
      reapply_music_config
      notify_user "环境音乐已启用；请在 Codex 顶部点击 ♪。"
      ;;
    disable)
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-enabled "$MUSIC_CONFIG_PATH" off >/dev/null
      reapply_music_config
      notify_user "环境音乐已暂停并释放当前音频。"
      ;;
    sequential|random)
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-mode "$MUSIC_CONFIG_PATH" "$action" >/dev/null
      reapply_music_config
      [ "$action" = "random" ] \
        && notify_user "同一环境的多首音乐将随机播放。" \
        || notify_user "同一环境的多首音乐将按导入顺序播放。"
      ;;
    volume)
      selected_volume="$(/usr/bin/osascript <<'APPLESCRIPT'
set choices to {"10%", "20%", "30%", "35%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"}
set picked to choose from list choices with title "环境音乐音量" with prompt "建议先从 35% 开始。" default items {"35%"} OK button name "保存" cancel button name "取消"
if picked is false then return "cancel"
return text 1 thru -2 of item 1 of picked
APPLESCRIPT
)"
      [ "$selected_volume" != "cancel" ] || return 0
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-volume \
        "$MUSIC_CONFIG_PATH" "$selected_volume" >/dev/null
      reapply_music_config
      notify_user "环境音乐音量已设为 ${selected_volume}%；如播放已停止，请重新点击顶部 ♪。"
      ;;
    gap)
      selected_gap="$(/usr/bin/osascript <<'APPLESCRIPT'
set choices to {"0 秒（无间隔）", "1 秒", "2 秒", "3 秒", "5 秒", "10 秒", "15 秒", "30 秒"}
set picked to choose from list choices with title "音乐曲间等待" with prompt "一首自然结束后，等待多久再播放下一首？" default items {"0 秒（无间隔）"} OK button name "保存" cancel button name "取消"
if picked is false then return "cancel"
return word 1 of (item 1 of picked)
APPLESCRIPT
)"
      [ "$selected_gap" != "cancel" ] || return 0
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-gap \
        "$MUSIC_CONFIG_PATH" "$selected_gap" >/dev/null
      reapply_music_config
      notify_user "曲间等待已设为 ${selected_gap} 秒。"
      ;;
    fade)
      selected_fade="$(/usr/bin/osascript <<'APPLESCRIPT'
set choices to {"0 秒（关闭）", "0.5 秒", "1 秒", "1.5 秒", "2 秒", "3 秒", "5 秒"}
set picked to choose from list choices with title "音乐渐入时长" with prompt "每次开始或恢复播放时，从静音渐入到设定音量。" default items {"0 秒（关闭）"} OK button name "保存" cancel button name "取消"
if picked is false then return "cancel"
return word 1 of (item 1 of picked)
APPLESCRIPT
)"
      [ "$selected_fade" != "cancel" ] || return 0
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-fade \
        "$MUSIC_CONFIG_PATH" "$selected_fade" >/dev/null
      reapply_music_config
      notify_user "音乐渐入已设为 ${selected_fade} 秒。"
      ;;
    environment-immediate|environment-after-current)
      [ "$action" = "environment-after-current" ] \
        && selected_mode="after-current" \
        || selected_mode="immediate"
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-environment-mode \
        "$MUSIC_CONFIG_PATH" "$selected_mode" >/dev/null
      reapply_music_config
      [ "$selected_mode" = "after-current" ] \
        && notify_user "切换环境后，会先播完当前曲目再使用新环境音乐。" \
        || notify_user "切换环境后，会立即使用新环境音乐。"
      ;;
    hidden-pause|hidden-continue)
      [ "$action" = "hidden-pause" ] && selected_mode="on" || selected_mode="off"
      "$NODE" "$SCRIPT_DIR/music-config.mjs" set-hidden \
        "$MUSIC_CONFIG_PATH" "$selected_mode" >/dev/null
      reapply_music_config
      [ "$selected_mode" = "on" ] \
        && notify_user "Codex 窗口隐藏时将暂停音乐，回来后继续。" \
        || notify_user "Codex 窗口隐藏时音乐会继续播放。"
      ;;
    show)
      summary="$("$NODE" -e '
        const fs = require("fs");
        let value = { enabled: false, volume: 35, playbackMode: "sequential", tracks: {} };
        try { value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch {}
        const count = Object.values(value.tracks || {}).flat().length;
        const slots = Object.values(value.tracks || {}).filter((items) => items.length).length;
        const gap = value.trackGapSeconds ?? 0;
        const fade = value.fadeInSeconds ?? 0;
        const hidden = value.pauseWhenHidden ?? false;
        const environment = value.environmentChangeMode ?? "immediate";
        process.stdout.write(`状态：${value.enabled ? "启用" : "暂停"}\\n音量：${value.volume}%\\n模式：${value.playbackMode === "random" ? "随机" : "顺序"}\\n曲间等待：${gap} 秒\\n渐入：${fade} 秒\\n环境切换：${environment === "after-current" ? "播完当前曲" : "立即换曲"}\\n窗口隐藏：${hidden ? "暂停" : "继续播放"}\\n已导入：${count} 首 / ${slots} 个音乐槽`);
      ' "$MUSIC_CONFIG_PATH")"
      alert_user "$summary"
      ;;
  esac
}

case "$CHOICE" in
  official) apply_official ;;
  forest-day) apply_manual_theme "preset-terraria-forest-day" "Terraria · 森林 · 白昼" ;;
  forest-night) apply_manual_theme "preset-terraria-forest-night" "Terraria · 森林 · 夜晚" ;;
  underground) apply_manual_theme "preset-terraria-underground" "Terraria · 地下层" ;;
  random) apply_manual_theme "preset-terraria-random" "Terraria · 全环境随机" ;;
  configure-random) configure_random_pool ;;
  configure-music) configure_music ;;
  cavern) apply_manual_theme "preset-terraria-cavern" "Terraria · 洞穴层" ;;
  space) apply_manual_theme "preset-terraria-space" "Terraria · 太空" ;;
  underworld) apply_manual_theme "preset-terraria-underworld" "Terraria · 地狱" ;;
  crimson) apply_manual_theme "preset-terraria-crimson" "Terraria · 地表猩红" ;;
  underground-crimson) apply_manual_theme "preset-terraria-underground-crimson" "Terraria · 地下猩红" ;;
  hallow) apply_manual_theme "preset-terraria-hallow" "Terraria · 神圣之地 · 白昼" ;;
  hallow-night) apply_manual_theme "preset-terraria-hallow-night" "Terraria · 神圣之地 · 夜晚" ;;
  underground-hallow) apply_manual_theme "preset-terraria-underground-hallow" "Terraria · 地下神圣" ;;
  corruption) apply_manual_theme "preset-terraria-corruption" "Terraria · 地表腐化" ;;
  underground-corruption) apply_manual_theme "preset-terraria-underground-corruption" "Terraria · 地下腐化" ;;
  jungle) apply_manual_theme "preset-terraria-jungle" "Terraria · 丛林 · 白昼" ;;
  jungle-night) apply_manual_theme "preset-terraria-jungle-night" "Terraria · 丛林 · 夜晚" ;;
  underground-jungle) apply_manual_theme "preset-terraria-underground-jungle" "Terraria · 地下丛林" ;;
  tundra) apply_manual_theme "preset-terraria-tundra" "Terraria · 苔原 · 白昼" ;;
  tundra-night) apply_manual_theme "preset-terraria-tundra-night" "Terraria · 苔原 · 夜晚" ;;
  ice-biome) apply_manual_theme "preset-terraria-ice-biome" "Terraria · 地下冰雪" ;;
  desert) apply_manual_theme "preset-terraria-desert" "Terraria · 地表沙漠" ;;
  underground-desert) apply_manual_theme "preset-terraria-underground-desert" "Terraria · 地下沙漠" ;;
  ocean) apply_manual_theme "preset-terraria-ocean" "Terraria · 海洋" ;;
  glowing-mushroom) apply_manual_theme "preset-terraria-glowing-mushroom" "Terraria · 地表夜光蘑菇" ;;
  underground-glowing-mushroom) apply_manual_theme "preset-terraria-underground-glowing-mushroom" "Terraria · 地下夜光蘑菇" ;;
  dungeon) apply_manual_theme "preset-terraria-dungeon" "Terraria · 地牢" ;;
  jungle-temple) apply_manual_theme "preset-terraria-jungle-temple" "Terraria · 丛林神庙" ;;
  blood-moon) apply_manual_theme "preset-terraria-blood-moon" "Terraria · 血月" ;;
  solar-eclipse) apply_manual_theme "preset-terraria-solar-eclipse" "Terraria · 日食" ;;
  goblin-invasion) apply_manual_theme "preset-terraria-goblin-invasion" "Terraria · 哥布林入侵" ;;
  pirate-invasion) apply_manual_theme "preset-terraria-pirate-invasion" "Terraria · 海盗入侵" ;;
  martian-invasion) apply_manual_theme "preset-terraria-martian-invasion" "Terraria · 火星人入侵" ;;
  aether) apply_manual_theme "preset-terraria-aether" "Terraria · 以太" ;;
  graveyard) apply_manual_theme "preset-terraria-graveyard" "Terraria · 墓地" ;;
  pumpkin-moon) apply_manual_theme "preset-terraria-pumpkin-moon" "Terraria · 南瓜月" ;;
  frost-moon) apply_manual_theme "preset-terraria-frost-moon" "Terraria · 霜月" ;;
  lunar-solar) apply_manual_theme "preset-terraria-lunar-solar" "Terraria · 日耀柱" ;;
  lunar-vortex) apply_manual_theme "preset-terraria-lunar-vortex" "Terraria · 星旋柱" ;;
  lunar-nebula) apply_manual_theme "preset-terraria-lunar-nebula" "Terraria · 星云柱" ;;
  lunar-stardust) apply_manual_theme "preset-terraria-lunar-stardust" "Terraria · 星尘柱" ;;
  meteorite) apply_manual_theme "preset-terraria-meteorite" "Terraria · 陨石" ;;
  spider-nest) apply_manual_theme "preset-terraria-spider-nest" "Terraria · 蜘蛛洞" ;;
  bee-hive) apply_manual_theme "preset-terraria-bee-hive" "Terraria · 蜂巢" ;;
  granite-cave) apply_manual_theme "preset-terraria-granite-cave" "Terraria · 花岗岩洞" ;;
  marble-cave) apply_manual_theme "preset-terraria-marble-cave" "Terraria · 大理石洞" ;;
esac
