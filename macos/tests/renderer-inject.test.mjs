import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const macosRoot = path.resolve(here, "..");
const template = await fs.readFile(path.join(macosRoot, "assets", "renderer-inject.js"), "utf8");
const css = await fs.readFile(path.join(macosRoot, "assets", "dream-skin.css"), "utf8");
const windowsChromeConfig = await fs.readFile(
  path.resolve(macosRoot, "../windows/TRSkin/core/scripts/config-utf8.ps1"),
  "utf8",
);
const windowsStartScript = await fs.readFile(
  path.resolve(macosRoot, "../windows/TRSkin/core/scripts/start-dream-skin.ps1"),
  "utf8",
);

assert.match(
  windowsChromeConfig,
  /appearanceLightChromeTheme[^\r\n]*ink = "#F8FAFC"/,
  "Windows native caption glyphs must use a light ink color above the dark Terraria title bar.",
);
assert.doesNotMatch(
  windowsChromeConfig,
  /appearanceLightChromeTheme[^\r\n]*ink = "#4A235F"/,
  "Windows native caption glyphs must not reuse the old low-contrast purple ink.",
);
assert.match(
  windowsChromeConfig,
  /DreamSkinManagedAppearanceTheme = 'appearanceTheme = "dark"'/,
  "Windows installs must request Chromium's dark native frame so caption buttons stay visible.",
);
assert.match(
  windowsChromeConfig,
  /Write-DreamSkinAppearanceMarker -BackupPath \$BackupPath -AppearanceThemeManaged \$true/,
  "Windows installs must record that the user's original appearance mode needs restoring.",
);
assert.match(
  windowsChromeConfig,
  /restoreLegacyAppearance -or \(\$null -ne \$appearanceMarker[\s\S]{0,160}appearanceThemeManaged/,
  "Restoring the official appearance must restore the user's pre-install appearance mode.",
);
assert.match(
  windowsStartScript,
  /\$arguments = @\([\s\S]{0,120}'--force-dark-mode'[\s\S]{0,160}'--remote-debugging-address=127\.0\.0\.1'/,
  "Windows must launch Chromium in native dark mode so caption controls use light glyphs.",
);

assert.doesNotMatch(
  css,
  /main\.trskin-main-surface\s*>\s*header\.trskin-app-header\s*\{[^}]*\b(?:position|z-index)\s*:/,
  "The skin must preserve Codex's native fixed header so the side-panel toggle remains reachable.",
);
assert.doesNotMatch(
  css,
  /main\.trskin-main-surface:not\(\.dream-skin-home-shell\)\s*>\s*header\.trskin-app-header\s*\{[^}]*\b(?:position|z-index)\s*:/,
  "Task styling must preserve the native header position and stacking layer so HUD controls remain clickable.",
);
assert.match(
  css,
  /\.dream-skin-idle-thread-messages\s*\{[\s\S]{0,100}margin-top:\s*auto !important;[\s\S]{0,260}\.dream-skin-idle-thread-spacer\s*\{[\s\S]{0,180}height:\s*0 !important;/,
  "Completed short threads must settle above the composer without retaining Codex's empty viewport spacer.",
);
assert.match(
  css,
  /#codex-dream-skin-music-toggle\s*\{[\s\S]{0,260}width:\s*112px;[\s\S]{0,80}height:\s*44px;/,
  "The music control must expose a large, clearly clickable hit target.",
);
assert.match(
  css,
  /\.terraria-hud\s*\{[\s\S]{0,260}position:\s*static;[\s\S]{0,260}display:\s*flex;[\s\S]{0,180}flex:\s*0 0 auto;[\s\S]{0,180}align-items:\s*center;/,
  "The music controller must be a native flex item rather than a header overlay.",
);
assert.match(
  css,
  /\.dream-skin-app-header\s*>\s*\.terraria-hud-native\s*\{[\s\S]{0,180}align-self:\s*center;/,
  "The steady-state HUD must participate directly in the native Codex header.",
);
assert.match(
  css,
  /body\s*>\s*\.terraria-hud-fallback\s*\{[\s\S]{0,180}position:\s*fixed;/,
  "A bounded fallback must keep the HUD reachable only while the native header is absent.",
);
assert.doesNotMatch(
  css,
  /\.terraria-hud\s*\{[^}]*(?:position:\s*absolute|z-index:\s*2147483001|right:\s*82px)/,
  "The steady-state HUD must not use global overlay coordinates.",
);
assert.doesNotMatch(
  css,
  /#codex-dream-skin-music-toggle\s*\{[^}]*(?:position:\s*fixed|right:\s*314px|top:\s*5px)/,
  "The music control must not use viewport magic numbers that drift at Windows DPI scaling.",
);
assert.match(
  css,
  /#codex-dream-skin-music-toggle:focus-visible\s*\{[\s\S]{0,120}outline:/,
  "The enlarged music control must retain a visible keyboard focus state.",
);
assert.match(
  css,
  /#codex-dream-skin-music-toggle\s*\{[\s\S]{0,700}-webkit-app-region:\s*no-drag !important;/,
  "The title-bar music control must opt out of Electron's drag region so physical clicks reach it.",
);
assert.doesNotMatch(
  css,
  /main\.trskin-main-surface:not\(\.dream-skin-home-shell\)\s*>\s*\*\s*\{[^}]*\bposition\s*:/,
  "Task-route child layering must not overwrite the native header position.",
);
assert.match(
  css,
  /\.dream-skin-home\s*>\s*\.dream-skin-home-content\s*\{[\s\S]{0,220}min-height:\s*0 !important;[\s\S]{0,120}height:\s*auto !important;[\s\S]{0,120}flex:\s*1 1 0% !important;/,
  "The marked home content must consume only the viewport space left after optional banners.",
);
assert.match(
  css,
  /html\.codex-dream-skin\s+\.dream-skin-home\s*\{[\s\S]{0,240}overflow-y:\s*hidden !important;/,
  "The new-task home must keep its composer dock in the viewport instead of exposing a page scrollbar.",
);
assert.doesNotMatch(
  css,
  /\.dream-skin-home\s*>\s*\.dream-skin-home-content\s*\{[^}]*min-height:\s*100% !important;/,
  "Optional banners must not be added on top of a second full-height home content area.",
);
assert.match(
  css,
  /@media\s*\(max-height:\s*760px\)[\s\S]{0,300}\.dream-skin-home\s+\.dream-skin-home-hero-rail\s*\{[\s\S]{0,120}flex-basis:\s*350px !important;/,
  "Short windows must shrink decorative home artwork before clipping the composer.",
);
assert.doesNotMatch(
  css,
  /\.dream-skin-home\s*>\s*div:first-child/,
  "Home layout must not depend on the optional native banner slot being first.",
);
assert.match(
  css,
  /\.dream-skin-home\s+\.dream-skin-home-hero\s*\{[\s\S]{0,760}background-image:\s*var\(--dream-skin-art\) !important;/,
  "The renderer-marked home hero must paint the selected environment artwork.",
);
assert.equal(
  template.includes('const HOME_LAYOUT_CLASSES = [')
    && template.includes('["dream-skin-home-hero", homeHero]')
    && template.includes("const homeLayoutTargets = new Map("),
  true,
  "The renderer must assign stable home layout classes across Codex DOM revisions.",
);
assert.match(
  template,
  /homeHero\.querySelectorAll\("div"\)[\s\S]{0,500}querySelectorAll\("button"\)\.length !== 4/,
  "The renderer must recover the native four-card group if Codex renames its suggestion class.",
);

assert.doesNotMatch(
  css,
  /background-image:\s*var\(--dream-skin-art\),\s*var\(--dream-skin-art\)/,
  "The home hero must not stack duplicate copies of the selected image.",
);
assert.match(
  css,
  /data-dream-art-safe="left"[\s\S]{0,140}--ds-art-position:\s*100% var\(--ds-focus-y\);/,
  "A left text-safe image must preserve its right-side subject on narrower windows.",
);
assert.doesNotMatch(
  css,
  /background-size:\s*auto 100% !important;/,
  "Wide home artwork must not leave an unpainted half-card by fitting only to height.",
);
assert.doesNotMatch(
  css,
  /background-size:\s*100% 100%,\s*100% 100%,\s*100% auto;/,
  "Wide task artwork must cover the full route instead of ending above the composer.",
);
assert.match(
  css,
  /data-dream-art-task-mode="ambient"[\s\S]{0,500}body\s*\{[\s\S]{0,500}background-image:\s*var\(--dream-skin-art\) !important;[\s\S]{0,200}background-size:\s*cover !important;/,
  "Wide ambient task artwork should cover the full application window.",
);
assert.match(
  css,
  /data-dream-task-mode="banner"[\s\S]{0,900}body\s*\{[\s\S]{0,500}background-image:\s*var\(--dream-skin-art\) !important;[\s\S]{0,200}background-size:\s*cover !important;/,
  "Wide banner task artwork should use the same full-window wallpaper contract as ambient routes.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]:has\(main\.trskin-main-surface\.dream-skin-home-shell\)[\s\S]{0,100}body\s*\{[\s\S]{0,300}background-image:\s*var\(--dream-skin-art\) !important;/,
  "Wide home artwork should use the same full-window image as utility routes.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]:has\(main\.trskin-main-surface\.dream-skin-home-shell\)[\s\S]{0,120}body\s*\{[\s\S]{0,260}background-position:\s*var\(--ds-art-position\) !important;/,
  "Wide home artwork must honor the configured focal point instead of forcing a centered crop.",
);
assert.match(
  css,
  /data-dream-art-task-mode="ambient"[\s\S]{0,260}data-dream-art-wide="true"\]:has\(main\.trskin-main-surface:not\(\.dream-skin-home-shell\)\)[\s\S]{0,120}body\s*\{[\s\S]{0,260}background-position:\s*var\(--ds-art-position\) !important;/,
  "Wide task artwork must retain the same focal point as the home route.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]\s+\.composer-surface-chrome\s*\{[\s\S]{0,500}backdrop-filter:\s*none !important;/,
  "Wide artwork should use one uniform composer surface without a split blur layer.",
);
assert.match(
  css,
  /--ds-immersive-composer-solid:\s*rgb\(var\(--ds-panel-rgb\) \/ \.74\);/,
  "The light composer should retain enough transparency to reveal the selected artwork.",
);
assert.match(
  css,
  /data-dream-shell="light"\]\[data-dream-art-wide="true"\][\s\S]{0,100}\.composer-surface-chrome\s*\{[\s\S]{0,400}backdrop-filter:\s*blur\(8px\) saturate\(102%\) !important;/,
  "The translucent light composer should softly separate text from detailed artwork.",
);
assert.match(
  template,
  /\[class\*="_homeUtilityBar_"\][\s\S]{0,500}dream-skin-home-utility/,
  "The renderer should give the current native home utility bar a stable theme class.",
);
assert.match(
  css,
  /\.dream-skin-home:has\(\.dream-skin-home-utility\)[\s\S]{0,120}\.composer-surface-chrome\s*\{[\s\S]{0,180}border-radius:\s*0 0 22px 22px !important;/,
  "The home utility bar and composer should render as one continuous control.",
);
assert.match(
  css,
  /\.composer-surface-chrome button:not\(\[class~="bg-token-foreground"\]\)[\s\S]{0,100}color:\s*var\(--ds-muted\) !important;/,
  "Composer controls must remain readable when Codex native tokens lag behind a forced dark appearance.",
);
assert.match(
  css,
  /\.composer-surface-chrome button:not\(\[class~="bg-token-foreground"\]\) \*\s*\{[\s\S]{0,80}color:\s*currentColor !important;/,
  "Nested labels inside composer controls must inherit the corrected theme color.",
);
assert.match(
  css,
  /\.composer-surface-chrome p\.placeholder::after\s*\{[\s\S]{0,120}color:\s*rgb\(var\(--ds-muted-rgb\) \/ \.82\) !important;[\s\S]{0,80}opacity:\s*1 !important;/,
  "Composer placeholder text must not inherit a stale native color with double opacity.",
);
assert.match(
  css,
  /header\.trskin-app-header\s*\{[\s\S]{0,180}background:\s*transparent !important;/,
  "Wide artwork should not paint a separate opaque header band.",
);
assert.match(
  css,
  /\.thread-scroll-container \.bg-gradient-to-t\.from-token-main-surface-primary\s*\{[\s\S]{0,100}background:\s*transparent !important;/,
  "Wide artwork should remove the native opaque fade behind the sticky composer.",
);
assert.match(
  css,
  /div\.sticky:has\(input\[type="text"\]\)[\s\S]{0,100}background:\s*transparent !important;/,
  "Search routes should not retain the native opaque sticky band.",
);
assert.match(
  css,
  /\[class~="bg-token-main-surface-primary"\]\[class~="h-full"\]\[class~="w-full"\][\s\S]{0,100}background:\s*transparent !important;/,
  "Full-size utility route wrappers should not hide the selected artwork.",
);
assert.match(
  css,
  /data-dream-style="terraria"[\s\S]{0,5000}--terraria-frame:/,
  "Terraria styling must stay gated behind explicit theme metadata.",
);
assert.match(
  css,
  /data-dream-variant="cavern"[\s\S]{0,400}background-size:\s*640px 384px !important;/,
  "The original 160x96 cavern tile should scale at an exact 4x pixel multiple.",
);
assert.match(
  css,
  /data-dream-style="terraria"[\s\S]{0,1800}--terraria-reading-text:\s*#fff5d8;/,
  "Terraria themes should define a background-independent reading color.",
);
assert.match(
  css,
  /--color-token-foreground:\s*var\(--terraria-reading-text\) !important;/,
  "Terraria themes should remap native foreground tokens at their source.",
);
assert.match(
  css,
  /main\.trskin-main-surface:not\(\.dream-skin-home-shell\)::after\s*\{[\s\S]{0,260}background:\s*linear-gradient/,
  "Terraria task routes should retain a stable contrast scrim above every wallpaper.",
);
assert.match(
  css,
  /data-dream-style="terraria"\] main\.trskin-main-surface:not\(\.dream-skin-home-shell\)::before\s*\{[\s\S]{0,220}background-image:\s*var\(--dream-skin-art\) !important;[\s\S]{0,180}opacity:\s*\.96;/,
  "Terraria task routes should expose the environment artwork as a dedicated image layer.",
);
assert.match(
  css,
  /aside\.app-shell-left-panel\s*\{[\s\S]{0,420}rgb\(var\(--ds-panel-2-rgb\) \/ \.76\)[\s\S]{0,180}var\(--dream-skin-art\) var\(--biome-sidebar-art-position\) \/ cover no-repeat/,
  "Terraria sidebars should visibly combine the environment artwork with a readable color scrim.",
);
assert.match(
  css,
  /radial-gradient\(circle at 78% 18%, var\(--biome-glow\), transparent 34%\)[\s\S]{0,180}rgb\(var\(--ds-bg-rgb\) \/ \.78\)/,
  "Biome task artwork should keep a stable lower reading shade without hiding the image.",
);
assert.match(
  css,
  /data-dream-variant="dungeon"\][\s\S]{0,180}aside\.app-shell-left-panel\s*\{[\s\S]{0,120}160px 450px !important;[\s\S]{0,100}no-repeat, repeat !important;/,
  "Dungeon sidebars should keep their original wall tile crisp instead of stretching it.",
);
assert.match(
  css,
  /\[class\*="text-token-foreground"\][\s\S]{0,260}color:\s*var\(--terraria-reading-text\) !important;/,
  "Native foreground tokens should not turn dark over a Terraria wallpaper.",
);
assert.match(
  css,
  /\[class\*="activity-header"\][\s\S]{0,300}--terraria-reading-muted\) !important;/,
  "Native activity rows should stay legible over a Terraria wallpaper.",
);
assert.doesNotMatch(
  css,
  /#codex-dream-skin-chrome(?:::before|::after)?[^}]*--dream-(?:active-)?accent-/,
  "The home route must not scatter extra biome monsters or items around native controls.",
);
for (const variant of [
  "space", "underworld", "crimson", "hallow", "corruption", "jungle",
  "tundra", "desert", "ocean", "glowing-mushroom", "dungeon", "jungle-temple",
  "blood-moon", "solar-eclipse", "goblin-invasion", "pirate-invasion", "martian-invasion",
  "aether", "graveyard",
  "pumpkin-moon", "frost-moon",
  "lunar-solar",
  "lunar-vortex", "lunar-nebula", "lunar-stardust", "meteorite",
  "spider-nest", "bee-hive", "granite-cave", "marble-cave",
]) {
  assert.match(
    css,
    new RegExp(`data-dream-variant="${variant}"`),
    `The ${variant} environment should have a dedicated Terraria CSS variant.`,
  );
}
assert.match(
  css,
  /data-dream-variant="blood-moon"[\s\S]{0,700}--biome-glow:\s*rgb\(255 79 94 \/ \.34\)/,
  "Blood Moon should have a dedicated red event palette.",
);
assert.match(
  css,
  /data-dream-variant="solar-eclipse"[\s\S]{0,700}--biome-glow:\s*rgb\(255 214 90 \/ \.29\)/,
  "Solar Eclipse should have a dedicated black-and-gold event palette.",
);
assert.match(
  css,
  /data-dream-variant="aether"[\s\S]{0,900}--biome-glow:\s*rgb\(202 167 255 \/ \.42\)/,
  "Aether should have a dedicated shimmer palette.",
);
assert.match(
  css,
  /data-dream-companion\$="mothron"[\s\S]{0,180}width:\s*112px;[\s\S]{0,80}height:\s*86px;/,
  "Mothron should use a larger safe companion box.",
);
assert.match(
  css,
  /data-dream-companion\*="martian-saucer"[\s\S]{0,180}width:\s*176px;[\s\S]{0,80}height:\s*78px;/,
  "Martian Saucer should use a wide safe companion box.",
);
assert.match(
  css,
  /data-dream-companion\*="blood-eel"[\s\S]{0,180}width:\s*150px;[\s\S]{0,80}height:\s*56px;/,
  "The complete Blood Eel sprite should use a wide safe companion box.",
);
assert.match(
  css,
  /data-dream-variant="space"[\s\S]{0,240}background-size:\s*128px 128px !important;/,
  "The 64px space wallpaper should remain crisp at an exact 2x pixel multiple.",
);
assert.match(
  css,
  /data-dream-variant="dungeon"[\s\S]{0,240}background-size:\s*160px 450px !important;/,
  "The 80x225 dungeon tile should remain crisp at an exact 2x pixel multiple.",
);
assert.match(
  css,
  /data-dream-variant="jungle-temple"[\s\S]{0,240}background-size:\s*128px 128px !important;/,
  "The 64px temple wall should remain crisp at an exact 2x pixel multiple.",
);
assert.match(
  template,
  /homeSuggestionButtons[\s\S]{0,500}CARD_INDEX_ATTR/,
  "The renderer should assign stable ordered hooks to wrapped native suggestion buttons.",
);
assert.equal(
  template.includes("home?.querySelector('.group\\\\/home-suggestions')"),
  true,
  "The suggestion group selector should emit one CSS escape for the slash at runtime.",
);
assert.equal(
  template.includes(".group\\\\\\\\/home-suggestions"),
  false,
  "The renderer source must not double-escape the suggestion group class.",
);
for (const [index, asset] of [[1, "explore"], [2, "build"], [3, "review"], [4, "fix"]]) {
  assert.match(
    css,
    new RegExp(`data-dream-card-index="${index}"[\\s\\S]{0,180}--dream-asset-${asset}`),
    `Suggestion card ${index} should use the ${asset} Terraria asset.`,
  );
}
assert.doesNotMatch(
  css,
  /home-suggestions button:nth-child\(/,
  "Suggestion icons must not depend on nth-child because each native button is wrapped.",
);
assert.match(
  css,
  /data-dream-style="terraria"\] \.dream-skin-orbit\s*\{[\s\S]{0,180}bottom:\s*122px;[\s\S]{0,140}width:\s*56px;/,
  "The Terraria companion should stay above the composer action row.",
);
assert.match(
  css,
  /data-dream-companion-animated="true"[\s\S]{0,120}\.dream-skin-orbit\s*\{[\s\S]{0,160}filter:\s*none !important;[\s\S]{0,100}animation:\s*none !important;/,
  "Animated companions must avoid filtered transform layers that reveal their GIF canvas.",
);
assert.match(
  template,
  /data-dream-companion-animated[\s\S]{0,1000}data:image\\\/\(\?:gif\|webp\)/,
  "The renderer must retain safe fallback detection for GIF and animated WebP companions.",
);
assert.match(
  template,
  /const animatedAssetKeys = new Set/,
  "The renderer must receive explicit animation metadata for APNG assets.",
);
assert.match(
  template,
  /const assetDimensions = THEME\.assetDimensions/,
  "The renderer must receive source dimensions for companion display sizing.",
);
assert.match(
  template,
  /const MAX_COMPANION_ASPECT_RATIO = 4\.5;/,
  "The renderer must cap companion aspect ratios.",
);
assert.match(
  template,
  /const validCompanionPool = \(pool\) =>\s*validAssetPool\(pool\)\.filter\(isDisplayableCompanion\);/,
  "Extreme multipart sprites must be rejected before companion selection.",
);
assert.match(
  css,
  /data-dream-companion-size="tiny"[\s\S]{0,100}\.dream-skin-orbit\s*\{[\s\S]{0,120}min-width:\s*96px;[\s\S]{0,80}min-height:\s*76px;/,
  "Tiny official sprites must receive a larger transform-free paint box.",
);
assert.match(
  css,
  /data-dream-companion-size="wide"[\s\S]{0,100}\.dream-skin-orbit\s*\{[\s\S]{0,120}min-width:\s*132px;[\s\S]{0,80}min-height:\s*66px;/,
  "Wide complete sprites must receive a larger transform-free paint box.",
);
assert.match(
  template,
  /animatedAssetKeys\.has\(key\) \|\| \/\^data:image/,
  "The renderer must honor explicit APNG animation metadata before legacy MIME fallback.",
);
assert.match(
  template,
  /<img class="dream-skin-orbit" alt="" draggable="false">/,
  "Companions must use a real image element so animated transparency is composited correctly.",
);
assert.match(
  template,
  /const syncCompanionImage = \(\) => \{[\s\S]{0,700}setAttribute\(orbit, "src", dataUrl\)/,
  "The companion image source must follow the currently selected asset.",
);
assert.match(
  css,
  /data-dream-style="terraria"\]\[data-dream-variant\][\s\S]{0,80}main\.trskin-main-surface \.composer-surface-chrome\s*\{[\s\S]{0,220}inset 0 0 0 1px[\s\S]{0,140}0 0 0 2px rgb\(var\(--ds-accent-rgb\) \/ \.48\) !important;/,
  "The Terraria composer should use a sharp accent frame without a dark offset shell or blur.",
);
assert.doesNotMatch(
  css,
  /main\.trskin-main-surface \.composer-surface-chrome\s*\{[\s\S]{0,260}var\(--biome-glow\)/,
  "The Terraria composer frame should not blur over dark biome artwork.",
);
assert.match(
  css,
  /\.thread-scroll-container \.sticky:has\(\.composer-surface-chrome\)\s*\{[\s\S]{0,260}background:\s*transparent !important;[\s\S]{0,180}box-shadow:\s*none !important;[\s\S]{0,100}padding-bottom:\s*0 !important;/,
  "The task composer dock should not expose a dark 16px strip below the input.",
);
assert.match(
  css,
  /> \.pointer-events-none\.absolute\s*\{[\s\S]{0,100}display:\s*none !important;[\s\S]{0,100}background:\s*none !important;/,
  "The native decoration-only footer fade should be hidden even when Codex nests its gradient differently.",
);
assert.match(
  css,
  /> \.pointer-events-none\.absolute[\s\S]{0,80}> \.bg-gradient-to-t\s*\{[\s\S]{0,80}background:\s*none !important;/,
  "The expanded task footer should not add a dark native fade behind progress rows.",
);
assert.match(
  css,
  /> \.relative\.z-10:has\(\.composer-surface-chrome\)[\s\S]{0,120}\.pointer-events-none\.absolute\.bg-gradient-to-t\s*\{[\s\S]{0,120}display:\s*none !important;[\s\S]{0,180}background-image:\s*none !important;/,
  "A nested progress or tool-status rail must not restore the full-width dark footer gradient.",
);
assert.match(
  css,
  /> \.relative\.z-10:has\(\.composer-surface-chrome\)\s*\{[\s\S]{0,260}background:\s*transparent !important;[\s\S]{0,260}width:\s*min\(100%, var\(--dream-skin-composer-safe-width, 100%\)\) !important;[\s\S]{0,180}max-width:\s*none !important;[\s\S]{0,160}margin-inline:\s*0 !important;[\s\S]{0,160}padding-inline:\s*0 !important;/,
  "The task composer rail should not expose dark centered gutters around the input.",
);
assert.match(
  css,
  /transform:\s*translateX\(var\(--dream-skin-composer-shift-x, 0px\)\) !important;/,
  "The expanded task composer should accept a measured horizontal correction at responsive widths.",
);
assert.doesNotMatch(
  template,
  /dream-skin-particles[^\n]*<i>/,
  "The header HUD must not create health or mana decorations that can cover native controls.",
);
assert.match(
  css,
  /data-dream-platform="windows"\][\s\S]{0,100}\.dream-skin-header-leading\s*\{[\s\S]{0,100}width:\s*72px !important;/,
  "Windows title alignment should not retain Codex's oversized macOS-style leading spacer.",
);
assert.match(
  css,
  /\.dream-skin-header-title-rail\s*\{[\s\S]{0,220}min-width:\s*0 !important;[\s\S]{0,160}overflow:\s*hidden !important;[\s\S]{0,160}padding-right:\s*0 !important;/,
  "Long native task titles must truncate naturally beside the flex HUD without magic padding.",
);
assert.match(
  css,
  /data-dream-companion\$="wyvern"[\s\S]{0,140}data-dream-companion\$="bone-serpent"[\s\S]{0,140}data-dream-companion\$="devourer"[\s\S]{0,120}width:\s*180px;/,
  "The random pack's long Wyvern, Bone Serpent, and Devourer should retain their safe wide companion box.",
);
assert.match(
  css,
  /\.dream-skin-open-location-control\s*\{[\s\S]{0,180}color:\s*var\(--terraria-reading-text\) !important;[\s\S]{0,180}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.92\) !important;/,
  "The native VS Code/open-location controls must keep high-contrast text and chrome.",
);
assert.match(
  css,
  /\.dream-skin-orbit\s*\{[\s\S]{0,240}object-fit:\s*contain;[\s\S]{0,120}background:\s*none !important;/,
  "The right-side companion must render as a transparent image instead of a CSS background.",
);
assert.match(
  css,
  /data-dream-variant="cavern"\][\s\S]{0,100}\.dream-skin-orbit\s*\{[\s\S]{0,120}bottom:\s*126px;[\s\S]{0,100}width:\s*70px;/,
  "The wider cavern minecart should use its own safe offset above the composer.",
);
assert.match(
  template,
  /const key = cardIconPool\[index\][\s\S]{0,220}CARD_ICON_ATTR/,
  "Each suggestion card should receive its environment's fixed item at the same index.",
);
assert.doesNotMatch(
  template,
  /setInterval\(randomizeCardIcons|const shuffled = \[\.\.\.cardIconPool\]/,
  "Suggestion-card items must never reshuffle while the environment is unchanged.",
);
assert.match(
  template,
  /setInterval\(rotateCompanion,\s*12000\)/,
  "Environment companions should rotate at a low-frequency twelve-second interval.",
);
assert.match(
  template,
  /const key = weightedChoice\(candidates, companionWeights\)/,
  "A companion rotation should never immediately repeat the current companion.",
);
assert.match(
  template,
  /const LAZY_ASSET_MODE = THEME\.stylePreset === "terraria";[\s\S]{0,220}materializedAssetKeys = new Set\(\)/,
  "Terraria themes should use bounded runtime asset materialization.",
);
assert.match(
  template,
  /for \(const key of \[\.\.\.materializedAssetKeys\]\)[\s\S]{0,240}removeProperty\(`--dream-asset-\$\{key\}`\)[\s\S]{0,900}materializedAssetKeys\.add\(key\)/,
  "Environment switches should release stale CSS assets before mounting the active set.",
);
assert.match(
  template,
  /mutationNeedsRouteSync[\s\S]{0,700}mutationBatchesIgnored[\s\S]{0,180}scheduleEnsure\(\{ route: true \}\)/,
  "Streaming-only DOM mutations should be filtered before route synchronization.",
);
assert.match(
  template,
  /getComputedStyle\(scroller\)\.flexDirection === "column-reverse"[\s\S]{0,300}scroller\.scrollTop >= -4/,
  "Conversation bottom detection must support Codex's negative column-reverse scroll coordinates.",
);
assert.match(
  template,
  /markUserIntent[\s\S]{0,700}state\.pinned = atBottom[\s\S]{0,800}contentObserver = new ResizeObserver/,
  "Bottom anchoring must stop after explicit user scrolling and only follow later content growth while pinned.",
);
assert.match(
  template,
  /document\.visibilityState !== "hidden"[\s\S]{0,900}setInterval\(\(\) => ensure\(\), 10000\)/,
  "Hidden Codex windows should pause skin maintenance and visible windows should use a low-frequency fallback.",
);
assert.match(
  template,
  /nativeAppearanceSnapshot[\s\S]{0,280}name !== "codex-dream-skin"[\s\S]{0,900}nextAppearance === observedAppearance/,
  "The native appearance observer must ignore the skin's own temporary root-class probe.",
);
assert.doesNotMatch(
  template,
  /attributeFilter:\s*\[[^\]]*"style"/,
  "Root style writes must not feed the native appearance observer.",
);
assert.doesNotMatch(template, /setInterval\(rotateTorch/, "Biome torches must remain fixed.");
assert.match(
  template,
  /if \(!torchKey\)[\s\S]{0,220}removeProperty\("--dream-active-torch"\)[\s\S]{0,160}removeAttribute\("data-dream-torch"\)/,
  "Entering an environment without a Torch God's Favor mapping must clear the previous torch.",
);
assert.match(
  css,
  /svg\[aria-roledescription\][\s\S]{0,120}:is\(\.nodeLabel, \.edgeLabel\)[\s\S]{0,180}color:\s*#172033 !important;[\s\S]{0,100}text-shadow:\s*none !important;/,
  "Diagram labels on native light nodes must not inherit cream Terraria prose text.",
);
assert.match(
  css,
  /\[data-dream-torch\][\s\S]{0,100}#codex-dream-skin-chrome::after/,
  "The lower-left torch decoration must only exist when an environment declares one.",
);
assert.doesNotMatch(
  css,
  /--dream-active-torch,\s*var\(--dream-asset-torch\)/,
  "Environments without a dedicated torch must not fall back to a generic torch asset.",
);
assert.match(
  template,
  /previous\?\.torchTimer[\s\S]{0,80}clearInterval\(previous\.torchTimer\)/,
  "Hot upgrades must clear the legacy rotating-torch timer.",
);
assert.match(
  template,
  /previous\?\.themeAssetVariables[\s\S]{0,140}removeProperty\(name\)/,
  "Hot theme replacement must remove stale asset variables from the previous theme.",
);
assert.match(
  template,
  /new Audio\(\)[\s\S]{0,220}preload = "metadata"/,
  "Environment music must use one lazily created metadata-only Audio instance.",
);
assert.match(
  template,
  /addEventListener\("ended", onEnded\)[\s\S]{0,7000}queuePlay\(musicTrackChangeMode === "rotate"\)/,
  "A completed track must either advance or repeat according to the saved track behavior.",
);
assert.match(
  template,
  /musicTrackGapMs[\s\S]{0,8000}setTimeout\([\s\S]{0,300}musicTrackGapMs/,
  "Environment music must support a bounded delay between tracks.",
);
assert.match(
  template,
  /musicFadeInMs[\s\S]{0,7000}setInterval\([\s\S]{0,300}50\)/,
  "Environment music must support a bounded low-overhead fade-in.",
);
assert.match(
  template,
  /musicEnvironmentChangeMode === "after-current"[\s\S]{0,7000}pendingEnvironment/,
  "Environment changes must support finishing the current track before switching pools.",
);
assert.match(
  template,
  /musicPlaybackMode === "random"[\s\S]{0,500}currentTrack\?\.fileName/,
  "Random playback must avoid immediately repeating the current track.",
);
assert.match(
  template,
  /removeAttribute\("src"\)[\s\S]{0,100}audio\.load\(\)[\s\S]{0,120}revokeObjectURL/,
  "Music cleanup must unload the decoder before revoking the current Blob URL.",
);
assert.match(
  template,
  /match\(\/--dream-asset-\[a-z0-9-\]\+[\s\S]{0,140}removeProperty\(name\)/,
  "Hot upgrades from older renderers must discover and clear legacy inline asset variables.",
);
assert.match(
  template,
  /previous\?\.cardIconTimer[\s\S]{0,80}clearInterval\(previous\.cardIconTimer\)/,
  "Hot upgrades must clear the legacy card-icon shuffle timer.",
);
assert.equal(
  template.includes('const HUD_ID = "codex-dream-skin-hud"')
    && template.includes(".filter((candidate) => candidate.id !== HUD_ID)"),
  true,
  "Header rediscovery must exclude the renderer-owned HUD from Codex's native rails.",
);
assert.match(
  template,
  /document\.getElementById\(HUD_ID\)\s*\|\|[\s\S]{0,100}chromeParts\?\.hud\s*\|\|[\s\S]{0,100}legacyHud\?\.classList/,
  "A route transition must reuse a detached HUD and its live music controller.",
);
assert.match(
  template,
  /nativeHeader\.insertBefore\(hud, before\)[\s\S]{0,180}terraria-hud-native[\s\S]{0,180}terraria-hud-fallback/,
  "The HUD must move into the native header and retain only a transient fallback.",
);
assert.match(
  template,
  /document\.getElementById\(HUD_ID\)\?\.remove\(\)/,
  "Official restore must remove a HUD that no longer lives under the chrome overlay.",
);
assert.match(
  template,
  /document\.querySelectorAll\("\.dream-skin-particles"\)[\s\S]{0,500}decoration\.remove\(\)[\s\S]{0,1800}chromeParts\.hud\.appendChild\(musicButton\)/,
  "Hot upgrades must remove legacy health/mana nodes and retain only the music controller.",
);

function createStyleDeclaration() {
  const values = new Map();
  return {
    values,
    getPropertyValue(name) { return values.get(name) ?? ""; },
    setProperty(name, value) { values.set(name, value); },
    removeProperty(name) { values.delete(name); },
  };
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    values,
    add(...names) { for (const name of names) values.add(name); },
    remove(...names) { for (const name of names) values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
  };
}

function createFixture(theme, {
  nativeShell = "light",
  analysisFixture = null,
  analysisCache = null,
  reducedMotion = false,
  visibilityState = "visible",
  conversation = null,
  composerRail = null,
  audioPlay = null,
  nativeHeader = false,
} = {}) {
  let fixtureShell = nativeShell;
  const nodes = new Map();
  const attributes = new Map();
  const bodyAttributes = new Map();
  const observers = [];
  const resizeObservers = [];
  const timers = new Map();
  const intervals = new Map();
  const documentListeners = new Map();
  const threadListeners = new Map();
  let nextTimer = 1;
  let nextInterval = 0;
  let nextBlob = 1;
  const rootStyle = createStyleDeclaration();
  const root = {
    className: nativeShell === "dark" ? "electron-dark" : "electron-light",
    classList: createClassList(),
    style: rootStyle,
    appendChild(node) {
      node.parentElement = root;
      if (node.id) nodes.set(node.id, node);
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
  };
  const body = {
    className: "",
    appendChild(node) {
      node.parentElement = body;
      if (node.id) nodes.set(node.id, node);
    },
    getAttribute(name) { return bodyAttributes.get(name) ?? null; },
    setAttribute(name, value) { bodyAttributes.set(name, String(value)); },
  };
  let activeNativeHeader = null;
  const createNativeHeader = () => {
    const createRail = (className = "") => ({
      className,
      classList: createClassList(className.split(/\s+/).filter(Boolean)),
      parentElement: null,
    });
    const leading = createRail("native-leading");
    const title = createRail("flex-1 min-w-0");
    const transitionTrailing = createRail("invisible fixed native-transition-trailing");
    const trailing = createRail("native-trailing");
    const header = {
      className: "app-header-tint",
      classList: createClassList(["app-header-tint"]),
      children: [leading, title, transitionTrailing, trailing],
      insertBefore(node, before) {
        node.parentElement?.removeChild?.(node);
        const index = before ? this.children.indexOf(before) : -1;
        if (index >= 0) this.children.splice(index, 0, node);
        else this.children.push(node);
        node.parentElement = this;
        if (node.id) nodes.set(node.id, node);
      },
      removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) this.children.splice(index, 1);
        node.parentElement = null;
      },
    };
    for (const rail of header.children) rail.parentElement = header;
    Object.defineProperty(title, "previousElementSibling", {
      configurable: true,
      get() {
        const index = header.children.indexOf(title);
        return index > 0 ? header.children[index - 1] : null;
      },
    });
    return { header, leading, title, transitionTrailing, trailing };
  };
  if (nativeHeader) activeNativeHeader = createNativeHeader();
  const shellBox = { left: 280, top: 36, width: 1000, height: 764 };
  const shellMain = {
    classList: createClassList(),
    querySelector(selector) {
      return selector === ":scope > header" || selector === ":scope > header.trskin-app-header"
        ? activeNativeHeader?.header || null
        : null;
    },
    getBoundingClientRect() {
      return {
        ...shellBox,
        right: shellBox.left + shellBox.width,
        bottom: shellBox.top + shellBox.height,
      };
    },
  };
  const threadSpacer = conversation ? {
    className: "shrink-0",
    classList: createClassList(["shrink-0"]),
    childElementCount: 0,
    textContent: "",
  } : null;
  const threadTurn = conversation ? {
    className: "relative shrink-0",
    classList: createClassList(["relative", "shrink-0"]),
    childElementCount: 1,
    textContent: "completed turn",
  } : null;
  const threadMessages = conversation ? {
    className: "relative flex flex-col gap-3",
    classList: createClassList(["relative", "flex", "flex-col", "gap-3"]),
    children: [threadTurn, threadSpacer],
  } : null;
  const threadMessageRail = conversation ? {
    className: "mx-auto relative flex flex-1 flex-col",
    classList: createClassList(["mx-auto", "relative", "flex", "flex-1", "flex-col"]),
    firstElementChild: threadMessages,
    querySelector() { return null; },
  } : null;
  const threadComposer = conversation ? {
    className: "sticky bottom-0",
    classList: createClassList(["sticky", "bottom-0"]),
    querySelector(selector) {
      return selector === ".composer-surface-chrome" ? {} : null;
    },
  } : null;
  const threadContent = conversation ? {
    children: [threadMessageRail, threadComposer],
  } : {};
  const threadScroller = conversation ? {
    scrollTop: conversation.scrollTop ?? 0,
    scrollHeight: conversation.scrollHeight ?? 2400,
    clientHeight: conversation.clientHeight ?? 800,
    firstElementChild: threadContent,
    querySelector(selector) {
      if (conversation.streaming && (
        selector.includes('[aria-busy="true"]')
        || selector.includes('[data-state="streaming"]')
      )) return {};
      return null;
    },
    querySelectorAll(selector) {
      return selector === "button" ? [] : [];
    },
    addEventListener(name, handler) { threadListeners.set(name, handler); },
    removeEventListener(name, handler) {
      if (threadListeners.get(name) === handler) threadListeners.delete(name);
    },
  } : null;
  const composerRailBox = composerRail ? { ...composerRail } : null;
  const composerRailElement = composerRail ? {
    getBoundingClientRect() {
      return {
        ...composerRailBox,
        right: composerRailBox.left + composerRailBox.width,
        bottom: (composerRailBox.top ?? 0) + (composerRailBox.height ?? 100),
      };
    },
  } : null;
  const composerDock = composerRail ? {
    style: createStyleDeclaration(),
    parentElement: composerRailElement,
  } : null;

  const createElement = (tagName) => {
    if (tagName === "canvas" && analysisFixture) {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: analysisFixture.pixels }; },
          };
        },
      };
    }
    const childNodes = new Map();
    const createChild = () => {
      const childAttributes = new Map();
      return {
        parentElement: null,
        textContent: "",
        appendChild(node) { node.parentElement = this; },
        querySelector() { return null; },
        getAttribute(name) { return childAttributes.get(name) ?? null; },
        setAttribute(name, value) { childAttributes.set(name, String(value)); },
        removeAttribute(name) { childAttributes.delete(name); },
      };
    };
    const listeners = new Map();
    const element = {
      id: "",
      dataset: {},
      style: createStyleDeclaration(),
      classList: createClassList(),
      parentElement: null,
      textContent: "",
      innerHTML: "",
      files: [],
      appendChild(node) { node.parentElement = element; },
      insertBefore(node) { node.parentElement = element; },
      setAttribute() {},
      addEventListener(name, handler) { listeners.set(name, handler); },
      removeEventListener(name, handler) {
        if (listeners.get(name) === handler) listeners.delete(name);
      },
      dispatch(name) { return listeners.get(name)?.(); },
      querySelector(selector) {
        if (!childNodes.has(selector)) childNodes.set(selector, createChild());
        return childNodes.get(selector);
      },
      remove() { if (element.id) nodes.delete(element.id); },
    };
    return element;
  };

  const document = {
    documentElement: root,
    head: root,
    body,
    visibilityState,
    addEventListener(name, handler) { documentListeners.set(name, handler); },
    removeEventListener(name, handler) {
      if (documentListeners.get(name) === handler) documentListeners.delete(name);
    },
    createElement,
    getElementById(id) { return nodes.get(id) ?? null; },
    querySelector(selector) {
      if (selector === "main.trskin-main-surface" || selector === "main") return shellMain;
      if (selector === "main.trskin-main-surface > header.trskin-app-header") {
        return activeNativeHeader?.header || null;
      }
      if (selector === ".thread-scroll-container") return threadScroller;
      if (selector.includes(".thread-scroll-container .sticky:has(.composer-surface-chrome)")) {
        return composerDock;
      }
      return null;
    },
    querySelectorAll() { return []; },
  };
  const colorMediaQuery = {
    get matches() { return fixtureShell === "dark"; },
    addEventListener() {},
    removeEventListener() {},
  };
  const motionMediaQuery = {
    get matches() { return reducedMotion; },
    addEventListener() {},
    removeEventListener() {},
  };
  const revokedUrls = [];
  const audioInstances = [];
  class FixtureAudio {
    constructor() {
      this.listeners = new Map();
      this.paused = true;
      this.src = "";
      this.volume = 1;
      this.preload = "";
      audioInstances.push(this);
    }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    removeEventListener(name, handler) {
      if (this.listeners.get(name) === handler) this.listeners.delete(name);
    }
    play() {
      this.paused = false;
      return audioPlay ? audioPlay(this) : Promise.resolve();
    }
    pause() { this.paused = true; }
    load() {}
    removeAttribute(name) { if (name === "src") this.src = ""; }
    dispatch(name) { return this.listeners.get(name)?.(); }
  }
  const window = {
    addEventListener() {},
    removeEventListener() {},
    matchMedia(query) {
      return query.includes("reduced-motion") ? motionMediaQuery : colorMediaQuery;
    },
  };
  if (analysisCache) window.__CODEX_DREAM_SKIN_ANALYSIS_CACHE__ = analysisCache;
  if (analysisFixture) {
    window.Image = class {
      naturalWidth = analysisFixture.naturalWidth;
      naturalHeight = analysisFixture.naturalHeight;
      set src(_) { this.onload(); }
    };
  }
  const context = {
    window,
    document,
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.target = null;
        resizeObservers.push(this);
      }
      observe(target) { this.target = target; }
      disconnect() { this.target = null; }
    },
    URL: {
      createObjectURL() { return `blob:fixture-${nextBlob++}`; },
      revokeObjectURL(value) { revokedUrls.push(value); },
    },
    Blob,
    Audio: FixtureAudio,
    Uint8Array,
    atob,
    getComputedStyle(node) {
      const skinShell = root.classList.contains("codex-dream-skin")
        ? (attributes.get("data-dream-shell") || "dark") : fixtureShell;
      return {
        colorScheme: skinShell,
        backgroundColor: fixtureShell === "dark" ? "rgb(24, 24, 27)" : "rgb(250, 250, 250)",
        flexDirection: node === threadScroller
          ? (conversation?.flexDirection || "column-reverse") : "row",
      };
    },
    setInterval(callback, delay) {
      const id = ++nextInterval;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    cancelAnimationFrame() {},
  };
  const payloadFor = (nextTheme, cssText = ".fixture { background: var(--dream-asset-logo); }") => template
    .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(cssText))
    .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify("data:image/png;base64,AA=="))
    .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify(nextTheme))
    .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify("test"))
    .replace("__DREAM_SKIN_STYLE_REVISION_JSON__", JSON.stringify(cssText));
  const flushTimers = (maximumDelay = Infinity) => {
    const pending = [...timers.entries()].filter(([, timer]) => timer.delay <= maximumDelay);
    for (const [id, timer] of pending) {
      timers.delete(id);
      timer.callback();
    }
  };

  return {
    attributes,
    audioInstances,
    body,
    bodyAttributes,
    context,
    flushTimers,
    intervals,
    nodes,
    observers,
    payload: payloadFor(theme),
    payloadFor,
    revokedUrls,
    resizeObservers,
    root,
    rootStyle,
    shellMain,
    shellBox,
    composerDock,
    composerRailBox,
    threadListeners,
    threadMessages,
    threadSpacer,
    threadScroller,
    timers,
    window,
    get nativeHeader() { return activeNativeHeader; },
    replaceNativeHeader() {
      activeNativeHeader = createNativeHeader();
      return activeNativeHeader;
    },
    setNativeShell(value) { fixtureShell = value; },
    setVisibility(value) {
      document.visibilityState = value;
      documentListeners.get("visibilitychange")?.();
    },
    setConversationStreaming(value) {
      if (conversation) conversation.streaming = Boolean(value);
    },
  };
}

const defaults = createFixture({
  id: "default-contract",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
});
const defaultResult = vm.runInNewContext(defaults.payload, defaults.context);
assert.equal(defaultResult.installed, true);
assert.equal(
  defaults.shellMain.classList.contains("trskin-main-surface"),
  true,
  "The renderer must mark its semantic content main with a skin-owned stable class.",
);
assert.equal(defaults.attributes.get("data-dream-shell"), "light");
assert.equal(defaults.attributes.get("data-dream-art-safe-area"), "center");
assert.equal(defaults.attributes.get("data-dream-art-task-mode"), "ambient");
assert.equal(defaults.attributes.get("data-dream-art-ready"), "false");
assert.equal(defaults.rootStyle.values.get("--dream-art-position"), "50.00% 50.00%");
const defaultMetrics = defaults.window.__CODEX_DREAM_SKIN_STATE__.metrics;
assert.equal(defaultMetrics.rootPasses, 1);
assert.equal(defaultMetrics.routePasses, 1);
assert.equal(defaultMetrics.layoutReads, 1);
const irrelevantMutation = {
  type: "childList",
  target: { nodeType: 1, matches: () => false, querySelector: () => null },
  addedNodes: [],
  removedNodes: [],
};
for (let index = 0; index < 50; index += 1) defaults.observers[0].callback([irrelevantMutation]);
assert.equal(defaults.timers.size, 0, "Streaming-only DOM mutations should not schedule a route scan.");
const relevantMutation = {
  type: "childList",
  target: defaults.root,
  addedNodes: [],
  removedNodes: [],
};
for (let index = 0; index < 50; index += 1) defaults.observers[0].callback([relevantMutation]);
assert.equal(defaults.timers.size, 1, "Mutation bursts should coalesce into one scheduled ensure.");
defaults.flushTimers(64);
assert.equal(defaultMetrics.rootPasses, 1, "Subtree mutations must not recompute root theme tokens.");
assert.equal(defaultMetrics.routePasses, 2);
assert.equal(defaultMetrics.layoutReads, 1, "Subtree mutations must not force shell layout reads.");
assert.equal(defaultMetrics.mutationBatchesIgnored, 50);
assert.equal(defaults.resizeObservers.length, 1);
assert.ok(defaults.resizeObservers[0].target);

const nativeHudFixture = createFixture({
  id: "native-header-hud",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
  music: { enabled: true, tracks: [] },
}, { nativeHeader: true });
vm.runInNewContext(nativeHudFixture.payload, nativeHudFixture.context);
const mountedHud = nativeHudFixture.nodes.get("codex-dream-skin-hud");
const mountedMusicButton = nativeHudFixture.nodes.get("codex-dream-skin-music-toggle");
assert.equal(mountedHud.parentElement, nativeHudFixture.nativeHeader.header);
assert.deepEqual(
  nativeHudFixture.nativeHeader.header.children,
  [
    nativeHudFixture.nativeHeader.leading,
    nativeHudFixture.nativeHeader.title,
    nativeHudFixture.nativeHeader.transitionTrailing,
    mountedHud,
    nativeHudFixture.nativeHeader.trailing,
  ],
  "The HUD must ignore fixed transition rails and sit immediately before the real native actions.",
);
assert.equal(mountedMusicButton.parentElement, mountedHud);
const replacementHeader = nativeHudFixture.replaceNativeHeader();
nativeHudFixture.window.__CODEX_DREAM_SKIN_STATE__.ensure({ route: true });
assert.equal(
  nativeHudFixture.nodes.get("codex-dream-skin-hud"),
  mountedHud,
  "Replacing the conversation header must reuse the existing HUD.",
);
assert.equal(mountedHud.parentElement, replacementHeader.header);
assert.equal(mountedMusicButton.parentElement, mountedHud);
defaults.shellBox.left = 196;
defaults.shellBox.width = 1084;
defaults.resizeObservers[0].callback([]);
defaults.flushTimers(64);
assert.equal(defaultMetrics.layoutReads, 2, "Shell ResizeObserver changes must refresh chrome geometry.");
const defaultChrome = defaults.nodes.get("codex-dream-skin-chrome");
assert.equal(defaultChrome.style.values.get("left"), "196px");
assert.equal(defaultChrome.style.values.get("width"), "1084px");
defaults.observers[1].callback([{ type: "attributes", target: defaults.root, attributeName: "class" }]);
assert.equal(defaults.timers.size, 0, "The skin's own root class must not create an observer feedback loop.");

const responsiveTask = createFixture({
  id: "responsive-task-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "dungeon",
}, {
  conversation: {
    scrollTop: -420,
    scrollHeight: 3600,
    clientHeight: 900,
    flexDirection: "column-reverse",
  },
  composerRail: {
    left: 200,
    top: 800,
    width: 1000,
    height: 120,
  },
});
vm.runInNewContext(responsiveTask.payload, responsiveTask.context);
let responsiveState = responsiveTask.window.__CODEX_DREAM_SKIN_STATE__;
assert.equal(
  responsiveTask.threadScroller.scrollTop,
  -420,
  "The skin must preserve Codex's native negative offset in a reverse scroll container.",
);
assert.equal(
  responsiveTask.threadMessages.classList.contains("dream-skin-idle-thread-messages"),
  true,
  "A completed short thread must bottom-align its real message stack.",
);
assert.equal(
  responsiveTask.threadSpacer.classList.contains("dream-skin-idle-thread-spacer"),
  true,
  "A completed short thread must collapse only the verified empty spacer.",
);
responsiveTask.setConversationStreaming(true);
responsiveTask.resizeObservers[1].callback([]);
responsiveTask.flushTimers(32);
assert.equal(
  responsiveTask.threadMessages.classList.contains("dream-skin-idle-thread-messages"),
  false,
  "The native answer viewport must remain available while a response is streaming.",
);
assert.equal(
  responsiveTask.threadSpacer.classList.contains("dream-skin-idle-thread-spacer"),
  false,
);
responsiveTask.setConversationStreaming(false);
responsiveTask.resizeObservers[1].callback([]);
responsiveTask.flushTimers(32);
assert.equal(
  responsiveTask.threadMessages.classList.contains("dream-skin-idle-thread-messages"),
  true,
  "The message stack must settle again when streaming finishes.",
);
assert.equal(
  responsiveTask.composerDock.style.values.get("--dream-skin-composer-safe-width"),
  "970px",
);
assert.equal(
  responsiveTask.composerDock.style.values.get("--dream-skin-composer-shift-x"),
  "95px",
  "A mid-width composer that would enter the sidebar must shift into the main-surface safe area.",
);
responsiveTask.flushTimers(32);
responsiveTask.threadListeners.get("wheel")();
responsiveTask.threadScroller.scrollTop = -260;
responsiveTask.threadListeners.get("scroll")();
assert.equal(responsiveState.conversationScrollState.pinned, false);
responsiveTask.resizeObservers[1].callback([]);
responsiveTask.flushTimers(32);
assert.equal(
  responsiveTask.threadScroller.scrollTop,
  -260,
  "Content growth must not pull a user away from the message they deliberately scrolled up to read.",
);
responsiveTask.threadScroller.scrollTop = 0;
responsiveTask.threadListeners.get("scroll")();
assert.equal(responsiveState.conversationScrollState.pinned, true);
responsiveTask.threadScroller.scrollTop = -120;
responsiveTask.resizeObservers[1].callback([]);
responsiveTask.flushTimers(32);
assert.equal(
  responsiveTask.threadScroller.scrollTop,
  -120,
  "Lazy assets must not overwrite Codex's native reverse-scroll anchor with zero.",
);
responsiveTask.threadListeners.get("wheel")();
responsiveTask.threadScroller.scrollTop = -180;
responsiveTask.threadListeners.get("scroll")();
vm.runInNewContext(responsiveTask.payloadFor({
  id: "responsive-task-hot-theme",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "cavern",
}), responsiveTask.context);
responsiveState = responsiveTask.window.__CODEX_DREAM_SKIN_STATE__;
assert.equal(
  responsiveTask.threadScroller.scrollTop,
  -180,
  "Hot theme replacement must preserve an intentional read position instead of forcing the bottom.",
);
assert.equal(responsiveState.conversationScrollState.pinned, false);

const conventionalTask = createFixture({
  id: "conventional-scroll-contract",
  stylePreset: "terraria",
}, {
  conversation: {
    scrollTop: 900,
    scrollHeight: 2400,
    clientHeight: 800,
    flexDirection: "column",
  },
});
vm.runInNewContext(conventionalTask.payload, conventionalTask.context);
assert.equal(
  conventionalTask.threadScroller.scrollTop,
  1600,
  "A conventional non-reverse thread should still receive the skin's bottom correction.",
);

// Auto appearance must continue following the native shell after the skin is
// already installed. The fixture makes the injected root color-scheme win
// whenever our class remains on <html>, so a temporary native probe is needed
// for each light → dark → light transition.
const shellFollow = createFixture({
  id: "shell-follow",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
});
shellFollow.root.className = "";
vm.runInNewContext(shellFollow.payload, shellFollow.context);
assert.equal(shellFollow.attributes.get("data-dream-shell"), "light");
shellFollow.setNativeShell("dark");
shellFollow.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(shellFollow.attributes.get("data-dream-shell"), "dark");
shellFollow.setNativeShell("light");
shellFollow.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(shellFollow.attributes.get("data-dream-shell"), "light");

defaults.root.className = "";
defaults.body.setAttribute("data-theme", "dark");
defaults.observers[1].callback([{ type: "attributes", target: defaults.body }]);
defaults.flushTimers(64);
assert.equal(defaults.attributes.get("data-dream-shell"), "dark", "Body theme changes must apply without the fallback interval.");

const synchronousWide = createFixture({
  id: "synchronous-wide",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
  artKey: "wide-art",
  artMetadata: {
    width: 2400,
    height: 1350,
    ratio: 2400 / 1350,
    wide: true,
    aspect: "wide",
    taskMode: "ambient",
  },
});
vm.runInNewContext(synchronousWide.payload, synchronousWide.context);
assert.equal(synchronousWide.attributes.get("data-dream-art-wide"), "true");
assert.equal(synchronousWide.attributes.get("data-dream-art-aspect"), "wide");
assert.equal(synchronousWide.attributes.get("data-dream-art-task-mode"), "ambient");
assert.equal(synchronousWide.attributes.get("data-dream-art-ready"), "false");

const cachedAnalysis = {
  width: 2400,
  height: 1350,
  ratio: 2400 / 1350,
  wide: true,
  aspect: "wide",
  taskMode: "ambient",
  safeArea: "left",
  focusX: 0.72,
  focusY: 0.48,
  accentRgb: { r: 180, g: 90, b: 110 },
};
const cached = createFixture({
  id: "cached-wide",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
  artKey: "cached-art",
  artMetadata: synchronousWide.window.__CODEX_DREAM_SKIN_STATE__.artMetadata,
}, { analysisCache: new Map([["cached-art", cachedAnalysis]]) });
vm.runInNewContext(cached.payload, cached.context);
assert.equal(cached.attributes.get("data-dream-art-ready"), "true");
assert.equal(cached.attributes.get("data-dream-art-safe-area"), "left");
assert.equal(cached.window.__CODEX_DREAM_SKIN_STATE__.metrics.analysisCacheHits, 1);
assert.equal(cached.window.__CODEX_DREAM_SKIN_STATE__.metrics.analysisRuns, 0);

const previousWideState = synchronousWide.window.__CODEX_DREAM_SKIN_STATE__;
const stableStyle = synchronousWide.nodes.get("codex-dream-skin-style");
vm.runInNewContext(synchronousWide.payloadFor({
  id: "switched-wide",
  appearance: "dark",
  art: { safeArea: "right", taskMode: "ambient" },
  artKey: "switched-art",
  artMetadata: {
    width: 2400,
    height: 1350,
    ratio: 2400 / 1350,
    wide: true,
    aspect: "wide",
    taskMode: "ambient",
  },
}, ".fixture { color: red; }"), synchronousWide.context);
assert.equal(synchronousWide.nodes.get("codex-dream-skin-style"), stableStyle);
assert.equal(stableStyle.textContent, ".fixture { color: red; }");
assert.equal(stableStyle.dataset.dreamSkinVersion, "test");
assert.equal(synchronousWide.rootStyle.values.get("--dream-skin-art"), 'url("blob:fixture-2")');
assert.deepEqual(synchronousWide.revokedUrls, ["blob:fixture-1"]);
assert.equal(previousWideState.cleanup(), false, "An old async cleanup must not remove the new theme.");

const brightPixels = new Uint8ClampedArray(96 * 32 * 4);
for (let offset = 0; offset < brightPixels.length; offset += 4) {
  brightPixels[offset] = 245;
  brightPixels[offset + 1] = 224;
  brightPixels[offset + 2] = 224;
  brightPixels[offset + 3] = 255;
}
const nativeDark = createFixture({
  id: "native-dark-contract",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
}, {
  nativeShell: "dark",
  analysisFixture: { naturalWidth: 2400, naturalHeight: 800, pixels: brightPixels },
});
vm.runInNewContext(nativeDark.payload, nativeDark.context);
await Promise.resolve();
await Promise.resolve();
nativeDark.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(nativeDark.window.__CODEX_DREAM_SKIN_STATE__.analysis.shell, "light");
assert.equal(nativeDark.attributes.get("data-dream-shell"), "dark");
assert.match(nativeDark.rootStyle.values.get("--ds-bg"), /^#[0-9a-f]{6}$/);
assert.ok(Number.parseInt(nativeDark.rootStyle.values.get("--ds-bg").slice(1), 16) < 0x303030);

const explicit = createFixture({
  id: "explicit-contract",
  appearance: "dark",
  art: { focusX: 0.15, focusY: 0.8, safeArea: "none", taskMode: "off" },
});
const explicitResult = vm.runInNewContext(explicit.payload, explicit.context);
assert.equal(explicitResult.shell, "dark");
assert.equal(explicit.attributes.get("data-dream-shell"), "dark");
assert.equal(explicit.attributes.get("data-dream-art-safe-area"), "none");
assert.equal(explicit.attributes.get("data-dream-art-safe"), "none");
assert.equal(explicit.attributes.get("data-dream-art-task-mode"), "off");
assert.equal(explicit.rootStyle.values.get("--dream-art-position"), "15.00% 80.00%");
assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__.analysis, null);

const banner = createFixture({
  id: "banner-contract",
  appearance: "auto",
  art: { safeArea: "left", taskMode: "banner" },
  artMetadata: {
    width: 2560,
    height: 1440,
    ratio: 2560 / 1440,
    wide: true,
    aspect: "ultrawide",
    taskMode: "banner",
    safeArea: "left",
    focusX: 0.72,
    focusY: 0.44,
  },
});
vm.runInNewContext(banner.payload, banner.context);
assert.equal(banner.attributes.get("data-dream-art-wide"), "true");
assert.equal(banner.attributes.get("data-dream-art-task-mode"), "banner");
assert.equal(banner.attributes.get("data-dream-task-mode"), "banner");

const terraria = createFixture({
  id: "terraria-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "forest-day",
  assetDataUrls: {
    logo: "data:image/png;base64,AA==",
    health: "data:image/png;base64,AA==",
    explore: "data:image/png;base64,AA==",
    build: "data:image/png;base64,AA==",
    review: "data:image/png;base64,AA==",
    fix: "data:image/png;base64,AA==",
    "torch-green": "data:image/png;base64,AA==",
    "companion-a": "data:image/png;base64,AA==",
    "companion-b": "data:image/png;base64,AA==",
    "companion-crawltipede": "data:image/png;base64,AA==",
  },
  animatedAssetKeys: ["companion-a"],
  assetDimensions: {
    "companion-a": { width: 10, height: 10 },
    "companion-b": { width: 16, height: 12 },
    "companion-crawltipede": { width: 488, height: 44 },
  },
  cardIconPool: ["explore", "build", "review", "fix"],
  torchKey: "torch-green",
  companionPool: ["companion-a", "companion-b", "companion-crawltipede"],
  companionWeights: {
    "companion-a": 100,
    "companion-b": 3,
    "companion-crawltipede": 1000,
  },
  art: { safeArea: "left", taskMode: "ambient" },
});
vm.runInNewContext(terraria.payload, terraria.context);
assert.equal(terraria.attributes.get("data-dream-style"), "terraria");
assert.equal(terraria.attributes.get("data-dream-variant"), "forest-day");
assert.equal(
  terraria.rootStyle.values.get("--dream-asset-logo"),
  'url("data:image/png;base64,AA==")',
);
assert.deepEqual(
  [...terraria.window.__CODEX_DREAM_SKIN_STATE__.cardIconPool],
  ["explore", "build", "review", "fix"],
);
assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.cardIconTimer, null);
assert.equal(typeof terraria.window.__CODEX_DREAM_SKIN_STATE__.applyFixedCardIcons, "function");
assert.deepEqual(
  [...terraria.window.__CODEX_DREAM_SKIN_STATE__.companionPool],
  ["companion-a", "companion-b"],
  "Extreme multipart companions must not enter the live selection pool.",
);
assert.deepEqual(
  { ...terraria.window.__CODEX_DREAM_SKIN_STATE__.companionWeights },
  { "companion-a": 100, "companion-b": 3 },
);
assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.torchKey, "torch-green");
assert.notEqual(terraria.window.__CODEX_DREAM_SKIN_STATE__.companionTimer, null);
assert.equal(terraria.attributes.has("data-dream-torch"), true);
assert.equal(terraria.attributes.has("data-dream-companion"), true);
assert.equal(terraria.attributes.get("data-dream-companion-size"), "tiny");
const firstCompanion = terraria.attributes.get("data-dream-companion");
const firstCompanionVariable = `--dream-asset-${firstCompanion}`;
const secondCompanion = firstCompanion === "companion-a" ? "companion-b" : "companion-a";
const companionImage = terraria.nodes
  .get("codex-dream-skin-chrome")
  .querySelector(".dream-skin-orbit");
assert.equal(
  terraria.attributes.get("data-dream-companion-animated"),
  firstCompanion === "companion-a" ? "true" : "false",
);
assert.equal(
  companionImage.getAttribute("src"),
  firstCompanion === "companion-a"
    ? "data:image/png;base64,AA=="
    : "data:image/png;base64,AA==",
);
assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.lazyAssetMode, true);
assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.materializedAssetCount, 7);
assert.equal(terraria.rootStyle.values.has(firstCompanionVariable), true);
assert.equal(terraria.rootStyle.values.has(`--dream-asset-${secondCompanion}`), false);
assert.equal(terraria.rootStyle.values.has("--dream-asset-health"), false);
terraria.window.__CODEX_DREAM_SKIN_STATE__.rotateCompanion();
assert.notEqual(
  terraria.attributes.get("data-dream-companion"),
  firstCompanion,
  "A companion rotation must not immediately repeat the current sprite.",
);
assert.equal(
  terraria.attributes.get("data-dream-companion-animated"),
  secondCompanion === "companion-a" ? "true" : "false",
);
assert.equal(terraria.attributes.get("data-dream-companion-size"), "tiny");
assert.equal(
  companionImage.getAttribute("src"),
  secondCompanion === "companion-a"
    ? "data:image/png;base64,AA=="
    : "data:image/png;base64,AA==",
);
assert.equal(terraria.rootStyle.values.has(firstCompanionVariable), false);
assert.equal(terraria.rootStyle.values.has(`--dream-asset-${secondCompanion}`), true);
assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.materializedAssetCount, 7);
assert.equal(
  terraria.attributes.get("data-dream-torch"),
  "torch-green",
  "Companion rotation must not change the fixed biome torch.",
);

const normalizedCompanions = createFixture({
  id: "normalized-companion-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "jungle",
  assetDataUrls: {
    background: "data:image/png;base64,AA==",
    "companion-wide": "data:image/png;base64,AA==",
    "companion-flat-small": "data:image/png;base64,AA==",
  },
  assetDimensions: {
    "companion-wide": { width: 78, height: 24 },
    "companion-flat-small": { width: 34, height: 8 },
  },
  backgroundKey: "background",
  companionPool: ["companion-wide", "companion-flat-small"],
});
vm.runInNewContext(normalizedCompanions.payload, normalizedCompanions.context);
const normalizedFirst = normalizedCompanions.attributes.get("data-dream-companion");
assert.equal(
  normalizedCompanions.attributes.get("data-dream-companion-size"),
  normalizedFirst === "companion-wide" ? "wide" : "tiny",
  "Companion sizing must use the visible short edge and aspect ratio.",
);
normalizedCompanions.window.__CODEX_DREAM_SKIN_STATE__.rotateCompanion();
const normalizedSecond = normalizedCompanions.attributes.get("data-dream-companion");
assert.notEqual(normalizedSecond, normalizedFirst);
assert.equal(
  normalizedCompanions.attributes.get("data-dream-companion-size"),
  normalizedSecond === "companion-wide" ? "wide" : "tiny",
);

const musicFixture = createFixture({
  id: "music-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "forest-day",
  musicPool: ["overworld-day"],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "sequential",
    trackChangeMode: "rotate",
    pauseWhenHidden: true,
    tracks: [
      { slotId: "overworld-day", fileName: "track-a.wav", displayName: "A" },
      { slotId: "overworld-day", fileName: "track-b.wav", displayName: "B" },
    ],
  },
});
vm.runInNewContext(musicFixture.payload, musicFixture.context);
const musicInput = musicFixture.nodes.get("codex-dream-skin-music-files");
const musicButton = musicFixture.nodes.get("codex-dream-skin-music-toggle");
musicInput.files = [{ name: "track-a.wav" }, { name: "track-b.wav" }];
assert.equal(
  musicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__(),
  2,
  "The CDP-populated hidden input should expose both files to the environment playlist.",
);
assert.equal(
  musicFixture.audioInstances.length,
  0,
  "Importing music metadata must not allocate a decoder before the user's first click.",
);
assert.equal(musicButton.textContent, "♪ 音乐");
musicButton.dispatch("click");
await new Promise((resolve) => setImmediate(resolve));
assert.equal(musicFixture.audioInstances.length, 1);
assert.equal(musicButton.textContent, "♫ 播放中");
let musicState = musicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(musicState.pauseWhenHidden, true);
assert.equal(musicState.currentTrack.displayName, "A");
assert.equal(musicState.audio.paused, false);
musicButton.dispatch("click");
assert.equal(musicState.audio.paused, true);
assert.equal(musicButton.dataset.state, "paused");
assert.equal(musicButton.textContent, "▶ 继续播放");
musicButton.dispatch("click");
await new Promise((resolve) => setImmediate(resolve));
assert.equal(musicState.audio.paused, false);
assert.equal(musicButton.dataset.state, "playing");
assert.equal(musicButton.textContent, "♫ 播放中");
assert.equal(
  musicFixture.audioInstances.length,
  1,
  "Pausing and resuming must reuse the current Audio element.",
);
musicState.audio.dispatch("ended");
await Promise.resolve();
assert.equal(musicState.currentTrack.displayName, "B");
assert.equal(
  musicFixture.audioInstances.length,
  1,
  "Sequential playback must reuse a single Audio element.",
);
musicFixture.setVisibility("hidden");
assert.equal(musicState.audio.paused, true);
musicFixture.setVisibility("visible");
await Promise.resolve();
assert.equal(musicState.audio.paused, false);
musicFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();
assert.equal(musicFixture.nodes.has("codex-dream-skin-music-files"), false);
assert.equal(musicFixture.nodes.has("codex-dream-skin-music-toggle"), false);
assert.equal(musicState.audio.listeners.size, 0);
assert.equal(musicState.audio.paused, true);
assert.equal(musicState.audio.src, "");
assert.equal(
  musicFixture.revokedUrls.length,
  3,
  "Track replacement and official restore must revoke both music Blobs plus the skin-art Blob.",
);
assert.equal(
  musicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__,
  undefined,
  "Official restore must remove the music bridge.",
);

const randomMusicFixture = createFixture({
  id: "random-music-contract",
  appearance: "dark",
  variant: "forest-day",
  stylePreset: "terraria",
  musicPool: ["overworld-day"],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "random",
    trackChangeMode: "rotate",
    tracks: [
      { slotId: "overworld-day", fileName: "track-a.wav", displayName: "A" },
      { slotId: "overworld-day", fileName: "track-b.wav", displayName: "B" },
      { slotId: "overworld-day", fileName: "track-c.wav", displayName: "C" },
    ],
  },
});
randomMusicFixture.context.Math = Object.create(Math);
randomMusicFixture.context.Math.random = () => 0;
vm.runInNewContext(randomMusicFixture.payload, randomMusicFixture.context);
const randomMusicInput = randomMusicFixture.nodes.get("codex-dream-skin-music-files");
randomMusicInput.files = [
  { name: "track-a.wav" },
  { name: "track-b.wav" },
  { name: "track-c.wav" },
];
randomMusicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
randomMusicFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
await Promise.resolve();
let randomMusicState = randomMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(randomMusicState.currentTrack.displayName, "A");
randomMusicState.audio.dispatch("ended");
await Promise.resolve();
randomMusicState = randomMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(
  randomMusicState.currentTrack.displayName,
  "B",
  "Random playback must exclude the current track when another track exists.",
);
randomMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

const fixedMusicFixture = createFixture({
  id: "fixed-music-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "forest-day",
  musicPool: ["overworld-day"],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "random",
    trackChangeMode: "fixed",
    tracks: [
      { slotId: "overworld-day", fileName: "track-a.wav", displayName: "A" },
      { slotId: "overworld-day", fileName: "track-b.wav", displayName: "B" },
    ],
  },
});
fixedMusicFixture.context.Math = Object.create(Math);
fixedMusicFixture.context.Math.random = () => 0;
vm.runInNewContext(fixedMusicFixture.payload, fixedMusicFixture.context);
const fixedMusicInput = fixedMusicFixture.nodes.get("codex-dream-skin-music-files");
fixedMusicInput.files = [{ name: "track-a.wav" }, { name: "track-b.wav" }];
fixedMusicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
fixedMusicFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
await Promise.resolve();
const fixedMusicState = fixedMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(fixedMusicState.currentTrack.displayName, "A");
fixedMusicState.audio.dispatch("ended");
await Promise.resolve();
assert.equal(
  fixedMusicState.currentTrack.displayName,
  "A",
  "Fixed-track mode must loop the selected environment track instead of advancing.",
);
fixedMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

const otherworldMusicFixture = createFixture({
  id: "otherworld-music-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "forest-day",
  musicPool: ["overworld-day"],
  otherworldMusicPool: ["otherworld-forest-day"],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "sequential",
    soundtrackMode: "otherworld",
    trackChangeMode: "fixed",
    tracks: [
      { slotId: "overworld-day", fileName: "classic.wav", displayName: "Classic" },
      {
        slotId: "otherworld-forest-day",
        fileName: "otherworld.wav",
        displayName: "Otherworld",
      },
    ],
  },
});
vm.runInNewContext(otherworldMusicFixture.payload, otherworldMusicFixture.context);
const otherworldMusicInput = otherworldMusicFixture.nodes
  .get("codex-dream-skin-music-files");
otherworldMusicInput.files = [{ name: "classic.wav" }, { name: "otherworld.wav" }];
otherworldMusicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
otherworldMusicFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
await Promise.resolve();
assert.equal(
  otherworldMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music.currentTrack.displayName,
  "Otherworld",
  "Otherworld soundtrack mode must select the environment's Otherworld pool.",
);
otherworldMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

let rejectStaleMusicPlay;
let musicPlayAttempts = 0;
const rapidEnvironmentFixture = createFixture({
  id: "rapid-environment-music-contract",
  appearance: "dark",
  stylePreset: "terraria",
  assetDataUrls: {
    forest: "data:image/png;base64,AA==",
    cavern: "data:image/png;base64,AA==",
  },
  environmentPool: [
    {
      variant: "forest-day",
      backgroundKey: "forest",
      musicPool: ["overworld-day"],
    },
    {
      variant: "cavern",
      backgroundKey: "cavern",
      musicPool: ["underground"],
    },
  ],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "sequential",
    environmentChangeMode: "immediate",
    tracks: [
      { slotId: "overworld-day", fileName: "forest.wav", displayName: "Forest" },
      { slotId: "underground", fileName: "cavern.wav", displayName: "Cavern" },
    ],
  },
}, {
  audioPlay() {
    musicPlayAttempts += 1;
    if (musicPlayAttempts === 1) {
      return new Promise((resolve, reject) => {
        rejectStaleMusicPlay = reject;
      });
    }
    return Promise.resolve();
  },
});
rapidEnvironmentFixture.context.Math = Object.create(Math);
rapidEnvironmentFixture.context.Math.random = () => 0;
vm.runInNewContext(rapidEnvironmentFixture.payload, rapidEnvironmentFixture.context);
const rapidMusicInput = rapidEnvironmentFixture.nodes.get("codex-dream-skin-music-files");
rapidMusicInput.files = [{ name: "forest.wav" }, { name: "cavern.wav" }];
rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
rapidEnvironmentFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.rotateEnvironment();
await Promise.resolve();
rejectStaleMusicPlay(new Error("stale source"));
await Promise.resolve();
await Promise.resolve();
let rapidMusicState = rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(rapidMusicState.currentTrack.displayName, "Cavern");
assert.equal(rapidMusicState.audio.paused, false);
assert.equal(
  rapidEnvironmentFixture.attributes.get("data-dream-music-state"),
  "playing",
  "A stale play rejection must not pause the replacement environment track.",
);
rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.rotateEnvironment();
await Promise.resolve();
rapidMusicState = rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(rapidMusicState.currentTrack.displayName, "Forest");
assert.equal(rapidMusicState.audio.paused, false);
assert.equal(musicPlayAttempts, 3);
rapidEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

const tunedMusicFixture = createFixture({
  id: "tuned-music-contract",
  appearance: "dark",
  variant: "forest-day",
  stylePreset: "terraria",
  musicPool: ["overworld-day"],
  music: {
    enabled: true,
    volume: 0.4,
    playbackMode: "sequential",
    trackGapMs: 1000,
    fadeInMs: 100,
    environmentChangeMode: "immediate",
    tracks: [
      { slotId: "overworld-day", fileName: "track-a.wav", displayName: "A" },
      { slotId: "overworld-day", fileName: "track-b.wav", displayName: "B" },
    ],
  },
});
vm.runInNewContext(tunedMusicFixture.payload, tunedMusicFixture.context);
const tunedMusicInput = tunedMusicFixture.nodes.get("codex-dream-skin-music-files");
tunedMusicInput.files = [{ name: "track-a.wav" }, { name: "track-b.wav" }];
tunedMusicFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
tunedMusicFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
await new Promise((resolve) => setImmediate(resolve));
let tunedMusicState = tunedMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(tunedMusicState.pauseWhenHidden, false);
assert.equal(tunedMusicState.audio.volume, 0);
const fadeInterval = [...tunedMusicFixture.intervals.values()]
  .find((interval) => interval.delay === 50);
assert.ok(fadeInterval);
fadeInterval.callback();
fadeInterval.callback();
assert.equal(tunedMusicState.audio.volume, 0.4);
tunedMusicFixture.setVisibility("hidden");
assert.equal(
  tunedMusicState.audio.paused,
  false,
  "Missing legacy settings must default to background playback while Codex is hidden.",
);
tunedMusicState.audio.dispatch("ended");
await Promise.resolve();
assert.equal(tunedMusicState.currentTrack.displayName, "A");
tunedMusicFixture.flushTimers(999);
assert.equal(tunedMusicState.currentTrack.displayName, "A");
tunedMusicFixture.flushTimers(1000);
await Promise.resolve();
tunedMusicState = tunedMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(
  tunedMusicState.currentTrack.displayName,
  "B",
  "The configured inter-track gap must delay advancing to the next track.",
);
tunedMusicFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

const deferredEnvironmentFixture = createFixture({
  id: "deferred-environment-music-contract",
  appearance: "dark",
  stylePreset: "terraria",
  assetDataUrls: {
    forest: "data:image/png;base64,AA==",
    cavern: "data:image/png;base64,AA==",
  },
  environmentPool: [
    {
      variant: "forest-day",
      backgroundKey: "forest",
      musicPool: ["overworld-day"],
    },
    {
      variant: "cavern",
      backgroundKey: "cavern",
      musicPool: ["underground"],
    },
  ],
  music: {
    enabled: true,
    volume: 0.35,
    playbackMode: "sequential",
    trackGapMs: 0,
    fadeInMs: 0,
    pauseWhenHidden: true,
    environmentChangeMode: "after-current",
    tracks: [
      { slotId: "overworld-day", fileName: "forest.wav", displayName: "Forest" },
      { slotId: "underground", fileName: "cavern.wav", displayName: "Cavern" },
    ],
  },
});
deferredEnvironmentFixture.context.Math = Object.create(Math);
deferredEnvironmentFixture.context.Math.random = () => 0;
vm.runInNewContext(deferredEnvironmentFixture.payload, deferredEnvironmentFixture.context);
const deferredMusicInput = deferredEnvironmentFixture.nodes
  .get("codex-dream-skin-music-files");
deferredMusicInput.files = [{ name: "forest.wav" }, { name: "cavern.wav" }];
deferredEnvironmentFixture.window.__CODEX_DREAM_SKIN_ATTACH_MUSIC__();
deferredEnvironmentFixture.nodes.get("codex-dream-skin-music-toggle").dispatch("click");
await Promise.resolve();
let deferredMusicState = deferredEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(deferredMusicState.currentTrack.displayName, "Forest");
deferredEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.rotateEnvironment();
assert.equal(
  deferredMusicState.currentTrack.displayName,
  "Forest",
  "Deferred environment switching must let the current track finish.",
);
deferredMusicState.audio.dispatch("ended");
await Promise.resolve();
deferredMusicState = deferredEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.music;
assert.equal(deferredMusicState.currentTrack.displayName, "Cavern");
deferredEnvironmentFixture.window.__CODEX_DREAM_SKIN_STATE__.cleanup();

const genericAssets = createFixture({
  id: "generic-assets-contract",
  appearance: "dark",
  assetDataUrls: {
    logo: "data:image/png;base64,AA==",
    extra: "data:image/png;base64,AA==",
  },
});
vm.runInNewContext(genericAssets.payload, genericAssets.context);
assert.equal(genericAssets.window.__CODEX_DREAM_SKIN_STATE__.lazyAssetMode, false);
assert.equal(genericAssets.window.__CODEX_DREAM_SKIN_STATE__.materializedAssetCount, 2);
assert.equal(genericAssets.rootStyle.values.has("--dream-asset-logo"), true);
assert.equal(genericAssets.rootStyle.values.has("--dream-asset-extra"), true);

const randomTerraria = createFixture({
  id: "terraria-random-contract",
  appearance: "dark",
  stylePreset: "terraria",
  variant: "forest-day",
  assetDataUrls: {
    "forest-card-1": "data:image/png;base64,AA==",
    "forest-card-2": "data:image/png;base64,AA==",
    "forest-card-3": "data:image/png;base64,AA==",
    "forest-card-4": "data:image/png;base64,AA==",
    "forest-art": "data:image/png;base64,AA==",
    "forest-art-alt": "data:image/png;base64,AA==",
    "forest-a": "data:image/png;base64,AA==",
    "forest-b": "data:image/png;base64,AA==",
    "forest-c": "data:image/png;base64,AA==",
    "underworld-card-1": "data:image/png;base64,AA==",
    "underworld-card-2": "data:image/png;base64,AA==",
    "underworld-card-3": "data:image/png;base64,AA==",
    "underworld-card-4": "data:image/png;base64,AA==",
    "underworld-art": "data:image/png;base64,AA==",
    "underworld-torch": "data:image/png;base64,AA==",
    "underworld-a": "data:image/png;base64,AA==",
    "underworld-b": "data:image/png;base64,AA==",
    "underworld-c": "data:image/png;base64,AA==",
  },
  environmentIntervalMs: 600000,
  backgroundMode: "rotate",
  backgroundIntervalMs: 900000,
  environmentPool: [
    {
      variant: "forest-day",
      name: "Terraria · 森林",
      backgroundKey: "forest-art",
      backgroundPool: ["forest-art", "forest-art-alt"],
      companionPool: ["forest-a", "forest-b", "forest-c"],
      companionWeights: { "forest-a": 100, "forest-b": 25, "forest-c": 3 },
      cardIconPool: ["forest-card-1", "forest-card-2", "forest-card-3", "forest-card-4"],
      explicitColorKeys: ["background", "accent"],
      colors: { background: "#102d28", accent: "#f4d65e" },
      art: { focusX: 0.54, focusY: 0.48, safeArea: "left", taskMode: "ambient" },
    },
    {
      variant: "underworld",
      name: "Terraria · 地狱",
      statusText: "地狱熔岩层",
      backgroundKey: "underworld-art",
      torchKey: "underworld-torch",
      companionPool: ["underworld-a", "underworld-b", "underworld-c"],
      companionWeights: { "underworld-a": 100, "underworld-b": 55, "underworld-c": 10 },
      cardIconPool: ["underworld-card-1", "underworld-card-2", "underworld-card-3", "underworld-card-4"],
      explicitColorKeys: ["background", "accent"],
      colors: { background: "#061f35", accent: "#58dbff" },
      art: { focusX: 0.5, focusY: 0.46, safeArea: "left", taskMode: "ambient" },
    },
  ],
});
let randomValue = 0;
randomTerraria.context.Math = Object.create(Math);
randomTerraria.context.Math.random = () => randomValue;
vm.runInNewContext(randomTerraria.payload, randomTerraria.context);
const randomState = randomTerraria.window.__CODEX_DREAM_SKIN_STATE__;
assert.equal(randomTerraria.attributes.get("data-dream-environment-mode"), "random");
assert.equal(randomTerraria.attributes.get("data-dream-variant"), "forest-day");
assert.equal(randomTerraria.rootStyle.values.get("--dream-skin-art"), "var(--dream-asset-forest-art)");
assert.equal(randomTerraria.attributes.has("data-dream-torch"), false);
assert.deepEqual([...randomState.torchPool], []);
assert.deepEqual([...randomState.cardIconPool], [
  "forest-card-1", "forest-card-2", "forest-card-3", "forest-card-4",
]);
assert.equal(randomState.environmentPool.length, 2);
assert.equal(randomState.environmentIntervalMs, 600000);
assert.equal(randomState.backgroundMode, "rotate");
assert.equal(randomState.backgroundIntervalMs, 900000);
assert.deepEqual([...randomState.backgroundPool], ["forest-art", "forest-art-alt"]);
assert.equal(randomState.activeEnvironment, "forest-day");
assert.notEqual(randomState.environmentTimer, null);
const originalMusicController = randomState.music;
const updatedRandomConfiguration = randomState.updateRandomConfiguration({
  enabledVariants: ["forest-day", "underworld"],
  environmentIntervalMs: 180000,
  backgroundMode: "rotate",
  backgroundIntervalMs: 240000,
});
assert.equal(updatedRandomConfiguration.activeEnvironment, "forest-day");
assert.equal(updatedRandomConfiguration.switchedEnvironment, false);
assert.equal(randomState.activeEnvironment, "forest-day");
assert.equal(randomState.environmentIntervalMs, 180000);
assert.equal(randomState.backgroundIntervalMs, 240000);
assert.equal(
  randomState.music,
  originalMusicController,
  "Saving random settings must preserve the live music controller.",
);
assert.equal(randomState.materializedAssetCount, 6);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-forest-art"), true);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-underworld-torch"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-underworld-art"), false);
assert.equal(randomTerraria.intervals.size, 4, "Visible random mode should run maintenance, companion, environment, and background timers.");
assert.equal(randomState.rotateBackground(), "forest-art-alt");
assert.equal(
  randomTerraria.rootStyle.values.get("--dream-skin-art"),
  "var(--dream-asset-forest-art-alt)",
);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-forest-art"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-forest-art-alt"), true);
randomTerraria.setVisibility("hidden");
assert.equal(randomState.timer, null);
assert.equal(randomState.companionTimer, null);
assert.equal(randomState.environmentTimer, null);
assert.equal(randomTerraria.intervals.size, 0, "Hidden Codex windows should release all skin timers.");
randomTerraria.setVisibility("visible");
assert.equal(randomTerraria.intervals.size, 4, "Visible Codex windows should restore bounded skin timers.");
assert.equal(randomState.rotateEnvironment(), "underworld");
assert.equal(randomTerraria.attributes.get("data-dream-variant"), "underworld");
assert.equal(randomTerraria.rootStyle.values.get("--dream-skin-art"), "var(--dream-asset-underworld-art)");
assert.equal(randomTerraria.attributes.get("data-dream-torch"), "underworld-torch");
assert.deepEqual([...randomState.cardIconPool], [
  "underworld-card-1", "underworld-card-2", "underworld-card-3", "underworld-card-4",
]);
assert.ok(["underworld-a", "underworld-b", "underworld-c"].includes(
  randomTerraria.attributes.get("data-dream-companion"),
));
assert.deepEqual(
  { ...randomState.companionWeights },
  { "underworld-a": 100, "underworld-b": 55, "underworld-c": 10 },
);
assert.equal(randomState.materializedAssetCount, 7);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-forest-art"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-forest-card-1"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-underworld-art"), true);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-underworld-card-1"), true);
assert.equal(randomState.activeEnvironment, "underworld");
assert.equal(randomState.backgroundTimer, null);
assert.equal(randomTerraria.intervals.size, 3);
randomValue = 0.99;
assert.equal(randomState.rotateEnvironment(), "forest-day", "Environment rotation must not repeat immediately.");
assert.equal(randomTerraria.attributes.has("data-dream-torch"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-active-torch"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-asset-underworld-torch"), false);
assert.equal(randomState.materializedAssetCount, 6);
assert.notEqual(randomState.backgroundTimer, null);
assert.equal(randomTerraria.intervals.size, 4);
assert.equal(randomState.cleanup(), true);
assert.equal(randomTerraria.attributes.has("data-dream-environment-mode"), false);
assert.equal(randomTerraria.rootStyle.values.has("--dream-active-accent-1"), false);

assert.equal(terraria.window.__CODEX_DREAM_SKIN_STATE__.cleanup(), true);
assert.equal(terraria.attributes.has("data-dream-style"), false);
assert.equal(terraria.attributes.has("data-dream-torch"), false);
assert.equal(terraria.attributes.has("data-dream-companion"), false);
assert.equal(terraria.rootStyle.values.has("--dream-asset-logo"), false);
assert.equal(terraria.rootStyle.values.has("--dream-active-torch"), false);
assert.equal(terraria.rootStyle.values.has("--dream-active-companion"), false);

assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__.cleanup(), true);
assert.equal(explicit.root.classList.contains("codex-dream-skin"), false);
assert.equal(explicit.attributes.has("data-dream-shell"), false);
assert.equal(explicit.attributes.has("data-dream-art-safe-area"), false);
assert.equal(explicit.attributes.has("data-dream-art-task-mode"), false);
assert.equal(explicit.rootStyle.values.has("--dream-art-position"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-style"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-chrome"), false);
assert.deepEqual(explicit.revokedUrls, ["blob:fixture-1"]);
await Promise.resolve();
await Promise.resolve();
assert.equal(explicit.root.classList.contains("codex-dream-skin"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-style"), false);
assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__, undefined);

console.log("PASS: renderer honors adaptive art metadata, fallback, and cleanup behavior.");
