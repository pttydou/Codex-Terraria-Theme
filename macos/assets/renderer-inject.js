((cssText, artDataUrl, themeConfig) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const DISABLED_KEY = "__CODEX_DREAM_SKIN_DISABLED__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const HUD_ID = "codex-dream-skin-hud";
  const MUSIC_INPUT_ID = "codex-dream-skin-music-files";
  const MUSIC_BUTTON_ID = "codex-dream-skin-music-toggle";
  const MUSIC_ATTACH_KEY = "__CODEX_DREAM_SKIN_ATTACH_MUSIC__";
  const MAIN_SURFACE_CLASS = "trskin-main-surface";
  const MAIN_SURFACE_ATTR = "data-trskin-main-surface";
  const APP_HEADER_CLASS = "trskin-app-header";
  const APP_HEADER_ATTR = "data-trskin-app-header";
  const SHELL_ATTR = "data-dream-shell";
  const PLATFORM_ATTR = "data-dream-platform";
  const CARD_INDEX_ATTR = "data-dream-card-index";
  const CARD_ICON_ATTR = "data-dream-card-icon";
  const CARD_ICON_STYLE = "--dream-card-icon";
  const COMPOSER_SAFE_WIDTH_STYLE = "--dream-skin-composer-safe-width";
  const COMPOSER_SHIFT_STYLE = "--dream-skin-composer-shift-x";
  const COMPOSER_SURFACE_CLASS = "dream-skin-composer-surface";
  const COMPOSER_DOCK_CLASS = "dream-skin-composer-dock";
  const COMPOSER_RAIL_CLASS = "dream-skin-composer-rail";
  const COMPOSER_DECORATION_CLASS = "dream-skin-composer-decoration";
  const COMPOSER_STABLE_SELECTORS = [
    "[data-composer-surface-variant]",
    "[data-composer-utility-bar-variant]",
  ];
  const COMPOSER_BLOCKER_SELECTOR = 'aside, [role="complementary"]';
  const COMPOSER_EDITOR_SELECTOR = 'textarea, [contenteditable="true"]';
  const SETTINGS_ACTIVE_CLASS = "trskin-settings-active";
  const SETTINGS_LIGHT_SURFACE_CLASS = "trskin-settings-light-surface";
  const LIGHT_SURFACE_INSET_CLASS = "trskin-light-surface-inset";
  const HOME_EMPTY_SLOT_CLASS = "dream-skin-home-empty-slot";
  const LIGHT_SURFACE_CANDIDATE_SELECTOR =
    'button, [role="button"], [role="row"], [role="listitem"], li, tr';
  const SETTINGS_PANEL_SELECTOR = "[data-settings-panel-slug]";
  const SETTINGS_SURFACE_SELECTOR = "div, section, article, form, fieldset";
  const IDLE_THREAD_MESSAGES_CLASS = "dream-skin-idle-thread-messages";
  const IDLE_THREAD_SPACER_CLASS = "dream-skin-idle-thread-spacer";
  const HOME_LAYOUT_CLASSES = [
    "dream-skin-home-content",
    "dream-skin-home-hero-rail",
    "dream-skin-home-hero",
    "dream-skin-home-hero-inner",
    "dream-skin-home-copy",
    "dream-skin-home-suggestions",
  ];
  const ART_ATTRS = [
    "data-dream-art-wide", "data-dream-art-safe", "data-dream-task-mode",
    "data-dream-art-safe-area", "data-dream-art-task-mode", "data-dream-art-aspect",
    "data-dream-art-ready", "data-dream-style", "data-dream-variant", "data-dream-torch",
    "data-dream-companion", "data-dream-companion-frame",
    "data-dream-companion-animated", "data-dream-companion-size",
    "data-dream-environment-mode",
    "data-dream-background-mode", "data-dream-music-state",
  ];
  const elementIsVisible = (candidate) => {
    if (!candidate) return false;
    const box = candidate.getBoundingClientRect?.();
    if (box) {
      if (box.width <= 0 || box.height <= 0) return false;
      if (typeof innerWidth === "number" && typeof innerHeight === "number" &&
        (box.right <= 0 || box.bottom <= 0 || box.left >= innerWidth || box.top >= innerHeight)) {
        return false;
      }
    }
    try {
      const style = getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return false;
    } catch {}
    return true;
  };
  const directComposerLayout = (candidate) => {
    if (!candidate) return null;
    if (candidate.matches?.("[data-composer-layout]")) return candidate;
    return [...(candidate.children || [])].find((child) =>
      child.matches?.("[data-composer-layout]")) ||
      candidate.querySelector?.(":scope > [data-composer-layout]") || null;
  };
  const parseComputedColor = (value) => {
    const source = String(value || "").trim().toLowerCase();
    if (!source || source === "transparent") return null;
    const perceptual = /^(oklab|oklch|lab|lch)\((.*)\)$/.exec(source);
    if (perceptual) {
      const lightnessToken = perceptual[2].match(/-?[\d.]+%?/)?.[0];
      if (!lightnessToken) return null;
      const numeric = Number.parseFloat(lightnessToken);
      if (!Number.isFinite(numeric)) return null;
      const lightness = lightnessToken.endsWith("%") ? numeric / 100 : numeric;
      const alphaToken = perceptual[2].split("/")[1]?.match(/[\d.]+%?/)?.[0];
      const alpha = alphaToken == null ? 1 : Math.max(0, Math.min(1,
        alphaToken.endsWith("%") ? Number.parseFloat(alphaToken) / 100 : Number(alphaToken)));
      return { alpha, luminance: Math.max(0, Math.min(1, lightness)) ** 2 };
    }
    const colorFunction = /^color\(\s*[a-z0-9-]+\s+(.+)\)$/.exec(source);
    const functional = colorFunction || /^(rgba?)\((.*)\)$/.exec(source);
    if (!functional) return null;
    const contents = colorFunction ? colorFunction[1] : functional[2];
    const numbers = contents.match(/-?[\d.]+%?/g) || [];
    if (numbers.length < 3) return null;
    const channel = (token) => {
      const numeric = Number.parseFloat(token);
      if (!Number.isFinite(numeric)) return NaN;
      if (token.endsWith("%")) return numeric * 2.55;
      return colorFunction ? numeric * 255 : numeric;
    };
    const alphaToken = numbers[3];
    const alpha = alphaToken == null ? 1 : Math.max(0, Math.min(1,
      alphaToken.endsWith("%") ? Number.parseFloat(alphaToken) / 100 : Number(alphaToken)));
    const channels = numbers.slice(0, 3).map(channel);
    if (channels.some((entry) => !Number.isFinite(entry))) return null;
    const linear = (entry) => {
      const normalized = Math.max(0, Math.min(255, entry)) / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return {
      alpha,
      luminance: 0.2126 * linear(channels[0])
        + 0.7152 * linear(channels[1])
        + 0.0722 * linear(channels[2]),
    };
  };
  const computedSurfaceColor = (candidate, pseudo = null) => {
    try {
      return parseComputedColor(getComputedStyle(candidate, pseudo).backgroundColor);
    } catch {
      return null;
    }
  };
  const computedPaintIsLight = (candidate) => {
    for (const pseudo of [null, "::before", "::after"]) {
      let style = null;
      try { style = getComputedStyle(candidate, pseudo); } catch {}
      if (!style) continue;
      const solid = parseComputedColor(style.backgroundColor);
      if (solid && solid.alpha >= 0.72 && solid.luminance >= 0.72) return true;
      const colors = String(style.backgroundImage || "")
        .match(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/gi) || [];
      const painted = colors.map(parseComputedColor).filter((color) => color && color.alpha >= 0.45);
      if (painted.length && painted.every((color) => color.luminance >= 0.72)) return true;
    }
    return false;
  };
  const isSettingsLightSurface = (candidate) => {
    if (!candidate?.matches?.(SETTINGS_SURFACE_SELECTOR) || !elementIsVisible(candidate)) return false;
    const box = candidate.getBoundingClientRect?.();
    if (!box || box.width < 140 || box.height < 36 || box.width * box.height < 4500) return false;
    const color = computedSurfaceColor(candidate);
    return Boolean(color && color.alpha >= 0.82 && color.luminance >= 0.82);
  };
  const syncSettingsContrastMarkers = (root = document.documentElement) => {
    const panels = [...(document.querySelectorAll?.(SETTINGS_PANEL_SELECTOR) || [])]
      .filter(elementIsVisible);
    const active = panels.length > 0;
    root?.classList?.toggle?.(SETTINGS_ACTIVE_CLASS, active);
    const lightSurfaces = new Set();
    if (active) {
      const settingsMain = panels.find((panel) =>
        panel.closest?.('[role="main"], main'))?.closest?.('[role="main"], main') ||
        findCodexMainSurface();
      const scope = settingsMain || document.body || document;
      const candidates = [scope, ...(scope.querySelectorAll?.(SETTINGS_SURFACE_SELECTOR) || [])];
      for (const candidate of candidates) {
        if (isSettingsLightSurface(candidate)) lightSurfaces.add(candidate);
      }
    }
    for (const candidate of document.querySelectorAll?.(`.${SETTINGS_LIGHT_SURFACE_CLASS}`) || []) {
      if (!lightSurfaces.has(candidate)) candidate.classList?.remove?.(SETTINGS_LIGHT_SURFACE_CLASS);
    }
    for (const candidate of lightSurfaces) candidate.classList?.add?.(SETTINGS_LIGHT_SURFACE_CLASS);
    return lightSurfaces;
  };
  const lightSurfaceIsProtected = (candidate) => Boolean(candidate?.closest?.([
    "header", `.${COMPOSER_SURFACE_CLASS}`, `.${COMPOSER_DOCK_CLASS}`,
    ".dream-skin-home", SETTINGS_PANEL_SELECTOR,
    '[class*="_markdown"]', '[data-message-author-role]', "article",
    "pre", "code", "svg", "img", "picture", "video", "canvas",
    "form", "fieldset", "input", "textarea", "select",
  ].join(",")));
  const alignedRepeatedLightRows = (scope) => {
    const candidates = [...(scope?.querySelectorAll?.(LIGHT_SURFACE_CANDIDATE_SELECTOR) || [])]
      .filter((candidate) => {
        if (!elementIsVisible(candidate) || lightSurfaceIsProtected(candidate)) return false;
        const box = candidate.getBoundingClientRect?.();
        if (!box || box.width < 260 || box.height < 28 || box.height > 112) return false;
        return computedPaintIsLight(candidate);
      });
    const groups = new Map();
    for (const candidate of candidates) {
      let parent = candidate.parentElement;
      for (let depth = 0; parent && parent !== scope && depth < 4;
        depth += 1, parent = parent.parentElement) {
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(candidate);
      }
    }
    const marked = new Set();
    for (const [group, rows] of groups) {
      if (rows.length < 2) continue;
      const uniqueRows = [...new Set(rows)];
      if (uniqueRows.length < 2) continue;
      const reference = uniqueRows[0].getBoundingClientRect();
      const aligned = uniqueRows.filter((candidate) => {
        const box = candidate.getBoundingClientRect();
        return Math.abs(box.left - reference.left) <= 8
          && Math.abs(box.width - reference.width) <= Math.max(24, reference.width * 0.12);
      });
      const alignedBoxes = aligned.map((candidate) => candidate.getBoundingClientRect());
      const groupBox = group.getBoundingClientRect?.();
      if (groupBox && alignedBoxes.length >= 2) {
        const rowsTop = Math.min(...alignedBoxes.map((box) => box.top));
        const rowsBottom = Math.max(...alignedBoxes.map((box) => box.bottom));
        if (groupBox.width > reference.width + 160
          || groupBox.height > Math.min(720, Math.max(240, rowsBottom - rowsTop + 160))) continue;
      }
      if (aligned.length >= 2) for (const candidate of aligned) marked.add(candidate);
    }
    return marked;
  };
  const syncLightSurfaceMarkers = (scope) => {
    const previousMarkers = [...(document.querySelectorAll?.(`.${LIGHT_SURFACE_INSET_CLASS}`) || [])];
    for (const candidate of previousMarkers) candidate.classList?.remove?.(LIGHT_SURFACE_INSET_CLASS);
    if (!scope || scope.classList?.contains?.("dream-skin-home-shell")) return new Set();
    const marked = alignedRepeatedLightRows(scope);
    for (const candidate of marked) candidate.classList?.add?.(LIGHT_SURFACE_INSET_CLASS);
    return marked;
  };
  const homeSlotHasContent = (candidate) => {
    if (!candidate) return false;
    if (String(candidate.textContent || "").trim()) return true;
    if (candidate.matches?.([
      "button", "a", "input", "textarea", "select", "img", "picture", "video", "audio",
      "svg", "canvas", '[role="alert"]', '[role="status"]', '[role="dialog"]',
      '[data-feature]', '[data-composer-layout]', '[data-composer-surface-variant]',
      '[data-composer-utility-bar-variant]',
    ].join(","))) return true;
    if (candidate.querySelector?.([
      "button", "a", "input", "textarea", "select", "img", "picture", "video", "audio",
      "svg", "canvas", '[role="alert"]', '[role="status"]', '[role="dialog"]',
      '[data-feature]', '[data-composer-layout]', '[data-composer-surface-variant]',
      '[data-composer-utility-bar-variant]',
    ].join(","))) return true;
    const paintedNodes = [candidate, ...(candidate.querySelectorAll?.("*") || [])].slice(0, 64);
    for (const node of paintedNodes) {
      for (const pseudo of [null, "::before", "::after"]) {
        try {
          if (String(getComputedStyle(node, pseudo).backgroundImage || "").includes("url(")) return true;
        } catch {}
      }
    }
    return false;
  };
  const syncHomeEmptySlots = (home, homeContent) => {
    for (const candidate of document.querySelectorAll?.(`.${HOME_EMPTY_SLOT_CLASS}`) || []) {
      candidate.classList?.remove?.(HOME_EMPTY_SLOT_CLASS);
    }
    if (!home || !homeContent) return new Set();
    const emptySlots = new Set();
    for (const candidate of home.children || []) {
      if (candidate === homeContent) break;
      if (!homeSlotHasContent(candidate)) emptySlots.add(candidate);
    }
    for (const candidate of emptySlots) candidate.classList?.add?.(HOME_EMPTY_SLOT_CLASS);
    return emptySlots;
  };
  const findComposerSurface = ({ mark = false } = {}) => {
    const candidates = [];
    const addCandidate = (candidate) => {
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    };
    for (const selector of COMPOSER_STABLE_SELECTORS) {
      for (const candidate of document.querySelectorAll?.(selector) || []) addCandidate(candidate);
    }
    for (const candidate of document.querySelectorAll?.(".composer-surface-chrome") || []) {
      addCandidate(candidate);
    }
    const editor = document.querySelector?.(COMPOSER_EDITOR_SELECTOR) || null;
    addCandidate(editor?.closest?.(
      '[data-composer-layout], [data-composer-surface-variant], '
      + '[data-composer-utility-bar-variant], .composer-surface-chrome, form',
    ) || editor?.parentElement || editor);
    if (editor) {
      candidates.sort((left, right) =>
        Number(right === editor || right.contains?.(editor)) -
        Number(left === editor || left.contains?.(editor)));
    }

    let active = null;
    for (const candidate of candidates) {
      const layout = directComposerLayout(candidate);
      const surface = layout || candidate;
      if (elementIsVisible(surface)) {
        active = surface;
        break;
      }
    }
    if (mark) {
      for (const candidate of document.querySelectorAll?.(`.${COMPOSER_SURFACE_CLASS}`) || []) {
        if (candidate !== active) candidate.classList?.remove?.(COMPOSER_SURFACE_CLASS);
      }
      active?.classList?.add?.(COMPOSER_SURFACE_CLASS);
    }
    return active;
  };
  const findCodexMainSurface = ({ mark = false } = {}) => {
    const composer = findComposerSurface();
    const composerMain = composer?.closest?.("main") || null;
    const legacyHeader = document.querySelector("header.app-header-tint");
    const nativeHeader = legacyHeader ||
      composerMain?.querySelector?.(":scope > header") ||
      [...(document.querySelectorAll?.("main > header") || [])].find((candidate) => {
        const box = candidate.getBoundingClientRect?.();
        return !box || (box.width > 0 && box.height > 0);
      }) || null;
    const legacyMain = document.querySelector("main.main-surface");
    const candidates = [];
    const addCandidate = (candidate) => {
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    };
    addCandidate(composer?.closest?.("main"));
    addCandidate(nativeHeader?.closest?.("main"));
    addCandidate(document.querySelector(`main.${MAIN_SURFACE_CLASS}`));
    addCandidate(legacyMain);
    for (const candidate of document.querySelectorAll?.("main") || []) addCandidate(candidate);
    addCandidate(document.querySelector("main"));

    const sidebar = document.querySelector(
      'aside.app-shell-left-panel, aside, nav[aria-label], [data-testid*="sidebar"]',
    );
    const sidebarBox = sidebar?.getBoundingClientRect?.();
    const headerMain = nativeHeader?.closest?.("main") || null;
    const score = (candidate) => {
      let value = 0;
      if (candidate === composerMain) value += 1000;
      if (candidate === headerMain) value += 700;
      if (candidate === legacyMain) value += 500;
      if (candidate.classList?.contains?.(MAIN_SURFACE_CLASS)) value += 400;
      if (candidate.querySelector?.(":scope > header.app-header-tint")) value += 220;
      if (composer && (candidate === composer || candidate.contains?.(composer))) value += 180;
      if (candidate.querySelector?.('.thread-scroll-container, [data-feature="game-source"]')) value += 120;
      const box = candidate.getBoundingClientRect?.();
      if (box) {
        if (box.width <= 0 || box.height <= 0) value -= 2000;
        if (sidebarBox?.width > 0) {
          if (box.left >= sidebarBox.right - 4) value += 160;
          else if (box.left < sidebarBox.right - 20) value -= 140;
          if (typeof innerWidth === "number" && box.width >= innerWidth * 0.95) value -= 80;
        }
      }
      return value;
    };
    const selected = candidates.sort((left, right) => score(right) - score(left))[0] || null;
    if (mark) {
      for (const candidate of document.querySelectorAll?.(
        `main.${MAIN_SURFACE_CLASS}, main[${MAIN_SURFACE_ATTR}]`,
      ) || []) {
        if (candidate === selected) continue;
        candidate.classList?.remove?.(MAIN_SURFACE_CLASS);
        candidate.removeAttribute?.(MAIN_SURFACE_ATTR);
      }
      selected?.classList?.add?.(MAIN_SURFACE_CLASS);
      selected?.setAttribute?.(MAIN_SURFACE_ATTR, "true");
      const selectedHeader = selected?.querySelector?.(":scope > header") ||
        (nativeHeader?.closest?.("main") === selected ? nativeHeader : null);
      for (const candidate of document.querySelectorAll?.(
        `header.${APP_HEADER_CLASS}, header[${APP_HEADER_ATTR}]`,
      ) || []) {
        if (candidate === selectedHeader) continue;
        candidate.classList?.remove?.(APP_HEADER_CLASS);
        candidate.removeAttribute?.(APP_HEADER_ATTR);
      }
      selectedHeader?.classList?.add?.(APP_HEADER_CLASS);
      selectedHeader?.setAttribute?.(APP_HEADER_ATTR, "true");
    }
    return selected;
  };
  const VERSION = __DREAM_SKIN_VERSION_JSON__;
  const STYLE_REVISION = __DREAM_SKIN_STYLE_REVISION_JSON__;
  const THEME = themeConfig && typeof themeConfig === "object" ? themeConfig : {};
  const dreamPlatform = (() => {
    if (typeof navigator === "undefined") return "other";
    const name = navigator.userAgentData?.platform || navigator.platform || "";
    if (/win/i.test(name)) return "windows";
    if (/mac/i.test(name)) return "macos";
    return "other";
  })();
  const ART_METADATA = THEME.artMetadata && typeof THEME.artMetadata === "object"
    ? THEME.artMetadata : null;
  const ANALYSIS_CACHE_KEY = "__CODEX_DREAM_SKIN_ANALYSIS_CACHE__";
  const THEME_VARIABLES = [
    "--ds-bg", "--ds-panel", "--ds-panel-2", "--ds-green", "--ds-lime",
    "--ds-cyan", "--ds-purple", "--ds-text", "--ds-muted", "--ds-line",
    "--ds-bg-rgb", "--ds-panel-rgb", "--ds-panel-2-rgb", "--ds-accent-rgb",
    "--ds-accent-alt-rgb", "--ds-secondary-rgb", "--ds-highlight-rgb",
    "--ds-text-rgb", "--ds-muted-rgb", "--ds-line-rgb",
    "--dream-art-focus-x", "--dream-art-focus-y", "--dream-art-position",
    "--dream-skin-focus-x", "--dream-skin-focus-y", "--dream-skin-art-position",
    "--dream-skin-name", "--dream-skin-tagline", "--dream-skin-project-prefix",
    "--dream-skin-project-label", "--dream-active-torch", "--dream-active-companion",
    "--dream-active-accent-1", "--dream-active-accent-2", "--dream-active-accent-3",
  ];
  const THEME_ASSET_VARIABLES = Object.keys(
    THEME.assetDataUrls && typeof THEME.assetDataUrls === "object" ? THEME.assetDataUrls : {},
  ).map((key) => `--dream-asset-${key}`);
  const assetDataUrls = THEME.assetDataUrls && typeof THEME.assetDataUrls === "object"
    ? THEME.assetDataUrls : {};
  const animatedAssetKeys = new Set(
    Array.isArray(THEME.animatedAssetKeys)
      ? THEME.animatedAssetKeys.filter((key) =>
        typeof key === "string" && Object.hasOwn(assetDataUrls, key))
      : [],
  );
  const assetDimensions = THEME.assetDimensions && typeof THEME.assetDimensions === "object"
    ? THEME.assetDimensions : {};
  const MAX_COMPANION_ASPECT_RATIO = 4.5;
  const LAZY_ASSET_MODE = THEME.stylePreset === "terraria";
  const CSS_ASSET_KEYS = new Set(
    [...String(cssText).matchAll(/--dream-asset-([a-z0-9-]+)/g)]
      .map((match) => match[1])
      .filter((key) => Object.hasOwn(assetDataUrls, key)),
  );
  const materializedAssetKeys = new Set();
  const allEnvironmentPool = Array.isArray(THEME.environmentPool)
    ? THEME.environmentPool.filter((environment) =>
      environment && typeof environment === "object"
      && typeof environment.variant === "string"
      && typeof environment.backgroundKey === "string"
      && Object.hasOwn(assetDataUrls, environment.backgroundKey))
    : [];
  const configuredEnvironmentVariants = Array.isArray(THEME.enabledEnvironmentVariants)
    ? new Set(THEME.enabledEnvironmentVariants.filter((variant) => typeof variant === "string"))
    : null;
  const configuredEnvironmentPool = configuredEnvironmentVariants
    ? allEnvironmentPool.filter((environment) =>
      configuredEnvironmentVariants.has(environment.variant))
    : allEnvironmentPool;
  let environmentPool = configuredEnvironmentPool.length >= 2
    ? configuredEnvironmentPool : allEnvironmentPool;
  let environmentIntervalMs = Number.isInteger(THEME.environmentIntervalMs)
    ? THEME.environmentIntervalMs : 600000;
  let backgroundMode = THEME.backgroundMode === "rotate" ? "rotate" : "fixed";
  let backgroundIntervalMs = Number.isInteger(THEME.backgroundIntervalMs)
    ? Math.min(3600000, Math.max(60000, THEME.backgroundIntervalMs)) : 900000;
  const musicConfig = THEME.music && typeof THEME.music === "object" ? THEME.music : {};
  const musicEnabled = musicConfig.enabled === true;
  const musicVolume = typeof musicConfig.volume === "number"
    ? Math.min(1, Math.max(0, musicConfig.volume)) : 0.35;
  const musicPlaybackMode = musicConfig.playbackMode === "random" ? "random" : "sequential";
  const musicTrackGapMs = Number.isInteger(musicConfig.trackGapMs)
    ? Math.min(30000, Math.max(0, musicConfig.trackGapMs)) : 0;
  const musicFadeInMs = Number.isInteger(musicConfig.fadeInMs)
    ? Math.min(5000, Math.max(0, musicConfig.fadeInMs)) : 0;
  // Background playback is the default. Only an explicit opt-in may pause
  // music when Codex is hidden or moved behind another application.
  const musicPauseWhenHidden = musicConfig.pauseWhenHidden === true;
  const musicEnvironmentChangeMode = musicConfig.environmentChangeMode === "after-current"
    ? "after-current" : "immediate";
  const musicSoundtrackMode = ["classic", "otherworld", "mixed"]
    .includes(musicConfig.soundtrackMode) ? musicConfig.soundtrackMode : "classic";
  const musicTrackChangeMode = musicConfig.trackChangeMode === "fixed" ? "fixed" : "rotate";
  const musicTrackMetadata = Array.isArray(musicConfig.tracks)
    ? musicConfig.tracks.filter((track) =>
      track && typeof track === "object"
      && typeof track.slotId === "string"
      && typeof track.fileName === "string"
      && typeof track.displayName === "string")
    : [];
  let activeTheme = environmentPool.length > 0
    ? environmentPool[Math.floor(Math.random() * environmentPool.length)]
    : THEME;
  let activeArt = activeTheme.art && typeof activeTheme.art === "object" ? activeTheme.art : {};
  const validAssetPool = (pool) => Array.isArray(pool)
    ? [...new Set(pool)].filter((key) =>
      typeof key === "string" && Object.hasOwn(assetDataUrls, key))
    : [];
  const companionMetrics = (key) => {
    const dimensions = assetDimensions[key];
    const width = Number(dimensions?.width) || 0;
    const height = Number(dimensions?.height) || 0;
    if (width <= 0 || height <= 0) {
      return { width, height, minDimension: 0, maxDimension: 0, area: 0, aspectRatio: 1 };
    }
    return {
      width,
      height,
      minDimension: Math.min(width, height),
      maxDimension: Math.max(width, height),
      area: width * height,
      aspectRatio: Math.max(width / height, height / width),
    };
  };
  const isDisplayableCompanion = (key) => {
    const { width, height, aspectRatio } = companionMetrics(key);
    return width <= 0 || height <= 0 || aspectRatio <= MAX_COMPANION_ASPECT_RATIO;
  };
  const validCompanionPool = (pool) =>
    validAssetPool(pool).filter(isDisplayableCompanion);
  const companionSizeClass = (key) => {
    const { minDimension, maxDimension, area, aspectRatio } = companionMetrics(key);
    if (maxDimension <= 0) return "regular";
    if (minDimension <= 10 || maxDimension <= 16 || area <= 256) return "tiny";
    if (minDimension <= 18 || maxDimension <= 24 || area <= 576) return "small";
    if (aspectRatio >= 2.4) return "wide";
    return "regular";
  };
  const backgroundPoolFor = (theme) => {
    const pool = validAssetPool(theme?.backgroundPool);
    if (pool.length > 0) return pool;
    const key = typeof theme?.backgroundKey === "string"
      && Object.hasOwn(assetDataUrls, theme.backgroundKey) ? theme.backgroundKey : null;
    return key ? [key] : [];
  };
  const chooseBackground = (pool, current = null) => {
    if (pool.length < 1) return null;
    const alternatives = pool.filter((key) => key !== current);
    const choices = alternatives.length > 0 ? alternatives : pool;
    return choices[Math.floor(Math.random() * choices.length)];
  };
  const validCompanionWeights = (weights, pool) => {
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) return {};
    const allowed = new Set(pool);
    return Object.fromEntries(Object.entries(weights).filter(([key, weight]) =>
      allowed.has(key) && Number.isInteger(weight) && weight >= 1 && weight <= 1000));
  };
  const weightedChoice = (pool, weights) => {
    if (pool.length < 1) return null;
    const total = pool.reduce((sum, key) => sum + (weights[key] || 100), 0);
    let cursor = Math.random() * total;
    for (const key of pool) {
      cursor -= weights[key] || 100;
      if (cursor < 0) return key;
    }
    return pool[pool.length - 1];
  };
  const chooseTorch = (theme) => {
    const pool = validAssetPool(theme?.torchPool);
    if (pool.length > 0) return { key: pool[Math.floor(Math.random() * pool.length)], pool };
    const key = typeof theme?.torchKey === "string"
      && Object.hasOwn(assetDataUrls, theme.torchKey) ? theme.torchKey : null;
    return { key, pool: [] };
  };
  let cardIconPool = validAssetPool(activeTheme.cardIconPool || THEME.cardIconPool);
  let activeTorch = chooseTorch(activeTheme);
  let torchKey = activeTorch.key;
  let torchPool = activeTorch.pool;
  let companionPool = validCompanionPool(activeTheme.companionPool || THEME.companionPool);
  let companionWeights = validCompanionWeights(
    activeTheme.companionWeights || THEME.companionWeights,
    companionPool,
  );
  let accentKeys = validAssetPool(activeTheme.accentKeys);
  let companionKey = null;
  let backgroundPool = backgroundPoolFor(activeTheme);
  let backgroundKey = chooseBackground(backgroundPool);
  const installToken = {};
  const existingAnalysisCache = window[ANALYSIS_CACHE_KEY];
  const analysisCache = existingAnalysisCache && typeof existingAnalysisCache.get === "function" &&
    typeof existingAnalysisCache.set === "function" ? existingAnalysisCache : new Map();
  window[ANALYSIS_CACHE_KEY] = analysisCache;
  let artAnalysis = typeof THEME.artKey === "string" ? analysisCache.get(THEME.artKey) ?? null : null;
  let analysisTimer = null;
  let samplingNativeShell = false;
  let rootObserver = null;
  const now = () => typeof performance === "object" && typeof performance.now === "function"
    ? performance.now() : Date.now();
  const metrics = {
    ensureCalls: 0,
    rootPasses: 0,
    routePasses: 0,
    layoutReads: 0,
    attributeWrites: 0,
    styleWrites: 0,
    textWrites: 0,
    analysisRuns: 0,
    analysisCacheHits: artAnalysis ? 1 : 0,
    assetVariablesMounted: 0,
    assetVariablesReleased: 0,
    materializedAssetPeak: 0,
    mutationBatches: 0,
    mutationBatchesIgnored: 0,
    composerGeometryReads: 0,
    scrollCorrections: 0,
    firstEnsureMs: null,
    analysisMs: null,
  };
  window[DISABLED_KEY] = false;

  const previous = window[STATE_KEY];
  const previousScrollPinned = previous?.conversationScrollState?.pinned;
  const previousMusicWantsPlayback = previous?.music?.wantsPlayback === true || Boolean(
    previous?.music?.userUnlocked === true
      && previous?.music?.pausedByUser === false
      && (
        previous?.music?.audio?.paused === false
        || previous?.music?.pausedForHidden === true
      ),
  );
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();

  if (previous?.observer) previous.observer.disconnect();
  if (previous?.rootObserver) previous.rootObserver.disconnect();
  if (previous?.resizeObserver) previous.resizeObserver.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.cardIconTimer) clearInterval(previous.cardIconTimer);
  // 1.6.3 used a rotating torch timer. Clear it during hot upgrades so a
  // legacy closure cannot keep replacing the now-fixed biome torch.
  if (previous?.torchTimer) clearInterval(previous.torchTimer);
  if (previous?.companionTimer) clearInterval(previous.companionTimer);
  if (previous?.environmentTimer) clearInterval(previous.environmentTimer);
  if (previous?.backgroundTimer) clearInterval(previous.backgroundTimer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(previous.scheduler.frame);
  }
  if (previous?.composerGeometryTimer) clearTimeout(previous.composerGeometryTimer);
  if (previous?.analysisTimer) clearTimeout(previous.analysisTimer);
  if (previous?.resizeHandler) window.removeEventListener("resize", previous.resizeHandler);
  if (previous?.mediaHandler && previous?.mediaQuery) {
    try { previous.mediaQuery.removeEventListener("change", previous.mediaHandler); } catch {}
  }
  if (previous?.motionMediaHandler && previous?.motionMediaQuery) {
    try { previous.motionMediaQuery.removeEventListener("change", previous.motionMediaHandler); } catch {}
  }
  if (previous?.visibilityHandler) {
    try { document.removeEventListener("visibilitychange", previous.visibilityHandler); } catch {}
  }
  previous?.music?.cleanup?.();
  previous?.conversationScrollState?.cleanup?.();
  for (const name of previous?.themeAssetVariables || []) {
    document.documentElement?.style.removeProperty(name);
  }
  for (const name of (document.documentElement?.getAttribute("style") || "")
    .match(/--dream-asset-[a-z0-9-]+(?=\s*:)/g) || []) {
    document.documentElement?.style.removeProperty(name);
  }
  for (const name of [
    "--dream-active-accent-1", "--dream-active-accent-2", "--dream-active-accent-3",
  ]) document.documentElement?.style.removeProperty(name);
  for (const candidate of document.querySelectorAll(`[${CARD_ICON_ATTR}]`)) {
    candidate.style?.removeProperty(CARD_ICON_STYLE);
    candidate.removeAttribute(CARD_ICON_ATTR);
  }
  const legacyChrome = document.getElementById(CHROME_ID);
  const legacyOrbit = legacyChrome?.querySelector?.(".dream-skin-orbit");
  if (legacyOrbit && String(legacyOrbit.tagName || "").toLowerCase() !== "img") {
    legacyChrome.remove();
  }

  const cssString = (value) => JSON.stringify(String(value ?? ""));

  const setStyleProperty = (root, name, value) => {
    if (root.style.getPropertyValue(name) !== value) {
      root.style.setProperty(name, value);
      metrics.styleWrites += 1;
    }
  };

  const setAttribute = (root, name, value) => {
    const normalized = String(value);
    if (root.getAttribute(name) !== normalized) {
      root.setAttribute(name, normalized);
      metrics.attributeWrites += 1;
    }
  };

  const setTextContent = (node, value) => {
    if (node && node.textContent !== value) {
      node.textContent = value;
      metrics.textWrites += 1;
    }
  };

  const desiredAssetKeys = () => {
    if (!LAZY_ASSET_MODE) return new Set(Object.keys(assetDataUrls));
    const keys = new Set(CSS_ASSET_KEYS);
    const add = (key) => {
      if (typeof key === "string" && Object.hasOwn(assetDataUrls, key)) keys.add(key);
    };
    add(backgroundKey);
    add(torchKey);
    add(companionKey);
    for (const key of cardIconPool) add(key);
    for (const key of accentKeys) add(key);
    return keys;
  };

  const syncMaterializedAssets = (root) => {
    if (!root?.style) return [];
    const desired = desiredAssetKeys();
    for (const key of [...materializedAssetKeys]) {
      if (desired.has(key)) continue;
      root.style.removeProperty(`--dream-asset-${key}`);
      materializedAssetKeys.delete(key);
      metrics.assetVariablesReleased += 1;
    }
    for (const key of desired) {
      if (materializedAssetKeys.has(key)) continue;
      const dataUrl = assetDataUrls[key];
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue;
      setStyleProperty(root, `--dream-asset-${key}`, `url(${cssString(dataUrl)})`);
      materializedAssetKeys.add(key);
      metrics.assetVariablesMounted += 1;
    }
    metrics.materializedAssetPeak = Math.max(
      metrics.materializedAssetPeak,
      materializedAssetKeys.size,
    );
    const state = window[STATE_KEY];
    if (state) state.materializedAssetCount = materializedAssetKeys.size;
    return [...materializedAssetKeys];
  };

  const parseRgb = (value) => {
    if (!value || value === "transparent") return null;
    const hex = String(value).trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const number = Number.parseInt(hex[1], 16);
      return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
    }
    const m = String(value).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const rgbString = (value) => {
    const rgb = parseRgb(value);
    return rgb ? `${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)}` : null;
  };

  const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

  const rgbToHsl = ({ r, g, b }) => {
    const values = [r, g, b].map((value) => value / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: lightness };
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;
    if (max === values[0]) hue = (values[1] - values[2]) / delta + (values[1] < values[2] ? 6 : 0);
    else if (max === values[1]) hue = (values[2] - values[0]) / delta + 2;
    else hue = (values[0] - values[1]) / delta + 4;
    return { h: hue * 60, s: saturation, l: lightness };
  };

  const hslToRgb = ({ h, s, l }) => {
    const hue = ((h % 360) + 360) % 360 / 360;
    if (s === 0) {
      const neutral = Math.round(l * 255);
      return { r: neutral, g: neutral, b: neutral };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = hue + offset;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: channel(1 / 3) * 255, g: channel(0) * 255, b: channel(-1 / 3) * 255 };
  };

  const luminance = ({ r, g, b }) => {
    const lin = [r, g, b].map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };

  /** Detect Codex app light/dark shell for CSS branching. */
  const detectShellMode = () => {
    const root = document.documentElement;
    const body = document.body;
    const cls = `${root.className || ""} ${body?.className || ""}`.toLowerCase();

    if (/\b(dark|theme-dark|appearance-dark)\b/.test(cls)) return "dark";
    if (/\b(light|theme-light|appearance-light)\b/.test(cls)) return "light";

    const dataTheme = (
      root.getAttribute("data-theme") ||
      root.getAttribute("data-appearance") ||
      root.getAttribute("data-color-mode") ||
      body?.getAttribute("data-theme") ||
      body?.getAttribute("data-appearance") ||
      ""
    ).toLowerCase();
    if (dataTheme.includes("dark")) return "dark";
    if (dataTheme.includes("light")) return "light";

    // Radios in profile menu (if present in DOM)
    const checked = document.querySelector('input[name="appearance-theme"]:checked');
    if (checked) {
      const label = (checked.getAttribute("aria-label") || checked.value || "").toLowerCase();
      if (label.includes("暗") || label.includes("dark")) return "dark";
      if (label.includes("浅") || label.includes("light")) return "light";
      if (label.includes("系统") || label.includes("system")) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }

    // The skin itself declares color-scheme on :root.  Once installed,
    // reading getComputedStyle(root) directly would therefore keep `auto`
    // themes locked to the previous shell mode. Temporarily remove only our
    // own root class/attribute, sample the native computed scheme, then restore
    // synchronously. Mutation records created by this probe are drained below
    // so the root observer does not schedule a redundant ensure pass.
    try {
      const hadSkin = root.classList.contains("codex-dream-skin");
      const savedShell = root.getAttribute(SHELL_ATTR);
      samplingNativeShell = true;
      if (hadSkin) root.classList.remove("codex-dream-skin");
      if (savedShell !== null) root.removeAttribute(SHELL_ATTR);
      let colorScheme = "";
      try {
        colorScheme = getComputedStyle(root).colorScheme || "";
      } finally {
        if (hadSkin) root.classList.add("codex-dream-skin");
        if (savedShell !== null) root.setAttribute(SHELL_ATTR, savedShell);
        rootObserver?.takeRecords?.();
        samplingNativeShell = false;
      }
      if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
      if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";
    } catch {
      samplingNativeShell = false;
    }

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}

    // Only use surface luminance before the skin owns those surfaces. Sampling
    // our own translucent layers would create route-dependent light/dark flips.
    if (!root.classList.contains("codex-dream-skin")) {
      const samples = [
        body,
        findCodexMainSurface(),
        document.querySelector("aside.app-shell-left-panel"),
      ].filter(Boolean);
      let votesLight = 0;
      let votesDark = 0;
      for (const el of samples) {
        try {
          const rgb = parseRgb(getComputedStyle(el).backgroundColor);
          if (!rgb) continue;
          const L = luminance(rgb);
          if (L >= 0.55) votesLight += 1;
          else if (L <= 0.25) votesDark += 1;
        } catch {}
      }
      if (votesLight > votesDark) return "light";
      if (votesDark > votesLight) return "dark";
    }
    return "light";
  };

  const makeAdaptivePalette = (sample, shell) => {
    const source = sample || { r: 108, g: 126, b: 136 };
    const hsl = rgbToHsl(source);
    const hue = hsl.s < 0.12 ? 214 : hsl.h;
    const saturation = clamp(hsl.s, 0.38, 0.72);
    const accent = hslToRgb({ h: hue, s: saturation, l: shell === "light" ? 0.42 : 0.66 });
    const accentAlt = hslToRgb({ h: hue + 12, s: saturation * 0.82, l: shell === "light" ? 0.52 : 0.73 });
    const secondary = hslToRgb({ h: hue - 24, s: saturation * 0.64, l: shell === "light" ? 0.56 : 0.62 });
    const highlight = hslToRgb({ h: hue + 24, s: saturation * 0.76, l: shell === "light" ? 0.36 : 0.58 });
    const neutral = (lightness, chroma = 0.08) => rgbToHex(hslToRgb({ h: hue, s: chroma, l: lightness }));
    return shell === "light" ? {
      background: neutral(0.965, 0.07),
      panel: neutral(0.987, 0.035),
      panelAlt: neutral(0.945, 0.09),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.13, 0.10),
      muted: neutral(0.42, 0.08),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .24)`,
    } : {
      background: neutral(0.055, 0.045),
      panel: neutral(0.085, 0.04),
      panelAlt: neutral(0.125, 0.05),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.93, 0.025),
      muted: neutral(0.69, 0.03),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .28)`,
    };
  };

  const resolvedShell = () => {
    if (activeTheme.appearance === "light" || activeTheme.appearance === "dark") {
      return activeTheme.appearance;
    }
    if (THEME.appearance === "light" || THEME.appearance === "dark") return THEME.appearance;
    // Image luminance may tune accents and scrims, but auto appearance follows
    // Codex/ChatGPT (or the OS fallback) so a bright wallpaper cannot flip a
    // native dark session back to a light shell after analysis.
    return detectShellMode();
  };

  const applyTheme = (root, shell) => {
    const colors = activeTheme.colors || THEME.colors || {};
    const explicit = new Set(Array.isArray(activeTheme.explicitColorKeys)
      ? activeTheme.explicitColorKeys : THEME.explicitColorKeys || []);
    const adaptive = makeAdaptivePalette(artAnalysis?.accentRgb, shell);
    const legacyLight = !THEME.appearance && shell === "light";
    const structural = new Set(["background", "panel", "panelAlt", "text", "muted"]);
    const pick = (name) => {
      const allowExplicit = explicit.has(name) && !(legacyLight && structural.has(name));
      return allowExplicit && typeof colors[name] === "string" ? colors[name] : adaptive[name];
    };
    const accent = pick("accent");
    const accentAlt = explicit.has("accentAlt") ? pick("accentAlt") : (explicit.has("accent") ? accent : adaptive.accentAlt);
    const variables = {
      "--ds-bg": pick("background"),
      "--ds-panel": pick("panel"),
      "--ds-panel-2": pick("panelAlt"),
      "--ds-green": accent,
      "--ds-lime": accentAlt,
      "--ds-cyan": pick("secondary"),
      "--ds-purple": pick("highlight"),
      "--ds-text": pick("text"),
      "--ds-muted": pick("muted"),
      "--ds-line": explicit.has("line") && typeof colors.line === "string" ? colors.line : adaptive.line,
    };

    for (const [name, value] of Object.entries(variables)) {
      if (typeof value === "string" && value) setStyleProperty(root, name, value);
    }
    const rgbVariables = {
      "--ds-bg-rgb": variables["--ds-bg"],
      "--ds-panel-rgb": variables["--ds-panel"],
      "--ds-panel-2-rgb": variables["--ds-panel-2"],
      "--ds-accent-rgb": variables["--ds-green"],
      "--ds-accent-alt-rgb": variables["--ds-lime"],
      "--ds-secondary-rgb": variables["--ds-cyan"],
      "--ds-highlight-rgb": variables["--ds-purple"],
      "--ds-text-rgb": variables["--ds-text"],
      "--ds-muted-rgb": variables["--ds-muted"],
      "--ds-line-rgb": variables["--ds-line"],
    };
    for (const [name, value] of Object.entries(rgbVariables)) {
      const rgb = rgbString(value);
      if (rgb) setStyleProperty(root, name, rgb);
    }
    const activeName = activeTheme.name || THEME.name || "Codex Dream Skin";
    setStyleProperty(
      root,
      "--dream-skin-name",
      cssString(environmentPool.length > 1 ? `${activeName} · 随机` : activeName),
    );
    setStyleProperty(
      root,
      "--dream-skin-tagline",
      cssString(activeTheme.tagline || THEME.tagline || "Make something wonderful."),
    );
    setStyleProperty(
      root,
      "--dream-skin-project-prefix",
      cssString(activeTheme.projectPrefix || THEME.projectPrefix || "选择项目 · "),
    );
    setStyleProperty(
      root,
      "--dream-skin-project-label",
      cssString(activeTheme.projectLabel || THEME.projectLabel || "◉  选择项目"),
    );
  };

  const applyArtMetadata = (root) => {
    const profile = artAnalysis || ART_METADATA;
    const inferredSafe = profile?.safeArea || "center";
    const safeArea = activeArt.safeArea && activeArt.safeArea !== "auto"
      ? activeArt.safeArea : inferredSafe;
    const canonicalSafe = ["left", "right", "center", "none"].includes(safeArea)
      ? safeArea : "center";
    const focusX = typeof activeArt.focusX === "number" ? activeArt.focusX
      : profile?.focusX ?? (safeArea === "left" ? 0.72 : safeArea === "right" ? 0.28 : 0.5);
    const focusY = typeof activeArt.focusY === "number" ? activeArt.focusY : profile?.focusY ?? 0.5;
    const taskMode = activeArt.taskMode && activeArt.taskMode !== "auto"
      ? activeArt.taskMode : profile?.taskMode || "ambient";
    const wide = profile?.wide || false;
    const aspect = profile?.aspect || "unknown";
    const focusXValue = `${(clamp(focusX, 0, 1) * 100).toFixed(2)}%`;
    const focusYValue = `${(clamp(focusY, 0, 1) * 100).toFixed(2)}%`;

    setAttribute(root, "data-dream-art-wide", wide ? "true" : "false");
    setAttribute(root, "data-dream-art-safe", canonicalSafe);
    setAttribute(root, "data-dream-task-mode", taskMode);
    setAttribute(root, "data-dream-art-safe-area", safeArea);
    setAttribute(root, "data-dream-art-task-mode", taskMode);
    setAttribute(root, "data-dream-art-aspect", aspect);
    setAttribute(root, "data-dream-art-ready", artAnalysis ? "true" : "false");
    setStyleProperty(root, "--dream-art-focus-x", focusXValue);
    setStyleProperty(root, "--dream-art-focus-y", focusYValue);
    setStyleProperty(root, "--dream-art-position", `${focusXValue} ${focusYValue}`);
    setStyleProperty(root, "--dream-skin-focus-x", focusXValue);
    setStyleProperty(root, "--dream-skin-focus-y", focusYValue);
    setStyleProperty(root, "--dream-skin-art-position", `${focusXValue} ${focusYValue}`);
  };

  const analyzeArt = () => new Promise((resolve) => {
    const startedAt = now();
    metrics.analysisRuns += 1;
    if (typeof window.Image !== "function" || !document?.createElement) {
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(null);
      return;
    }
    const image = new window.Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (analysisTimer) clearTimeout(analysisTimer);
      analysisTimer = null;
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(value);
    };
    analysisTimer = setTimeout(() => finish(null), 6000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const ratio = image.naturalWidth / image.naturalHeight;
        if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Invalid image dimensions");
        const maxDimension = 96;
        const width = Math.max(16, Math.round(ratio >= 1 ? maxDimension : maxDimension * ratio));
        const height = Math.max(16, Math.round(ratio >= 1 ? maxDimension / ratio : maxDimension));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        const samples = new Array(width * height);
        const bins = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
        let lightTotal = 0;
        let count = 0;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] < 32) continue;
            const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
            const light = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
            const hsl = rgbToHsl(rgb);
            samples[y * width + x] = { light, saturation: hsl.s };
            lightTotal += light;
            count += 1;
            if (hsl.s >= 0.16 && hsl.l >= 0.16 && hsl.l <= 0.86) {
              const bin = bins[Math.min(23, Math.floor(hsl.h / 15))];
              const weight = hsl.s * (1 - Math.abs(hsl.l - 0.52) * 0.85);
              bin.weight += weight;
              bin.r += rgb.r * weight;
              bin.g += rgb.g * weight;
              bin.b += rgb.b * weight;
            }
          }
        }
        if (!count) throw new Error("Image has no visible pixels");
        const brightness = lightTotal / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let pixels = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = samples[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              pixels += 1;
              const previous = x > start ? samples[y * width + x - 1] : null;
              const above = y > 0 ? samples[(y - 1) * width + x] : null;
              if (previous) { edges += Math.abs(sample.light - previous.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = pixels ? total / pixels : 0;
          const variance = pixels ? Math.max(0, totalSquared / pixels - mean * mean) : 1;
          return Math.sqrt(variance) * 0.58 + (edgeCount ? edges / edgeCount : 1) * 0.42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * 0.38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * 0.86) safeArea = "left";
        else if (rightInformation < leftInformation * 0.86) safeArea = "right";

        let saliencyTotal = 0;
        let saliencyX = 0;
        let saliencyY = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sample = samples[y * width + x];
            if (!sample) continue;
            const previous = x > 0 ? samples[y * width + x - 1] : null;
            const above = y > 0 ? samples[(y - 1) * width + x] : null;
            const edge = (previous ? Math.abs(sample.light - previous.light) : 0) +
              (above ? Math.abs(sample.light - above.light) : 0);
            const weight = 0.01 + Math.abs(sample.light - brightness) * 0.48 +
              sample.saturation * 0.34 + edge * 0.28;
            saliencyTotal += weight;
            saliencyX += (x + 0.5) / width * weight;
            saliencyY += (y + 0.5) / height * weight;
          }
        }
        let focusX = saliencyTotal ? saliencyX / saliencyTotal : 0.5;
        let focusY = saliencyTotal ? saliencyY / saliencyTotal : 0.5;
        if (safeArea === "left") focusX = Math.max(0.64, focusX);
        if (safeArea === "right") focusX = Math.min(0.36, focusX);
        focusX = clamp(focusX, 0.12, 0.88);
        focusY = clamp(focusY, 0.18, 0.82);

        const accentBin = bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best, bins[0]);
        const accentRgb = accentBin.weight > 0 ? {
          r: accentBin.r / accentBin.weight,
          g: accentBin.g / accentBin.weight,
          b: accentBin.b / accentBin.weight,
        } : null;
        const aspect = ratio >= 2.25 ? "ultrawide" : ratio >= 1.45 ? "wide"
          : ratio >= 1.08 ? "landscape" : ratio >= 0.9 ? "square" : "portrait";
        finish({
          width: image.naturalWidth,
          height: image.naturalHeight,
          ratio,
          wide: ratio >= 1.75,
          aspect,
          brightness,
          shell: brightness >= 0.58 ? "light" : "dark",
          safeArea,
          focusX,
          focusY,
          taskMode: ratio >= 2.25 ? "banner" : "ambient",
          accentRgb,
        });
      } catch {
        finish(null);
      }
    };
    image.src = artUrl;
  });

  let chromeParts = null;
  let observedShellMain = null;
  let resizeObserver = null;
  let observedComposerDock = null;
  let composerGeometryTimer = null;
  let composerGeometryAttempts = 0;
  let conversationScrollState = null;
  let inheritedScrollPinned = previousScrollPinned;
  let motionMediaQuery = null;
  let motionMediaHandler = null;
  let visibilityHandler = null;

  const syncCompanionImage = () => {
    const orbit = chromeParts?.orbit;
    if (!orbit) return false;
    const dataUrl = companionKey ? assetDataUrls[companionKey] : null;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      orbit.removeAttribute("src");
      orbit.removeAttribute("data-dream-companion-key");
      return false;
    }
    setAttribute(orbit, "src", dataUrl);
    setAttribute(orbit, "data-dream-companion-key", companionKey);
    return true;
  };

  const clearCardIcon = (candidate) => {
    candidate.style?.removeProperty(CARD_ICON_STYLE);
    candidate.removeAttribute(CARD_ICON_ATTR);
  };

  const applyFixedCardIcons = () => {
    if (window[DISABLED_KEY] || cardIconPool.length < 4) return false;
    const buttons = [...document.querySelectorAll(`[${CARD_INDEX_ATTR}]`)]
      .sort((left, right) => Number(left.getAttribute(CARD_INDEX_ATTR)) - Number(right.getAttribute(CARD_INDEX_ATTR)));
    if (buttons.length === 0 || buttons.length > 4) return false;
    buttons.forEach((button, index) => {
      const key = cardIconPool[index];
      setStyleProperty(button, CARD_ICON_STYLE, `var(--dream-asset-${key})`);
      setAttribute(button, CARD_ICON_ATTR, key);
    });
    return true;
  };

  const applyFixedTorch = () => {
    if (window[DISABLED_KEY]) return null;
    const root = document.documentElement;
    if (!root) return null;
    if (!torchKey) {
      root.style.removeProperty("--dream-active-torch");
      root.removeAttribute("data-dream-torch");
      syncMaterializedAssets(root);
      return null;
    }
    syncMaterializedAssets(root);
    setStyleProperty(root, "--dream-active-torch", `var(--dream-asset-${torchKey})`);
    setAttribute(root, "data-dream-torch", torchKey);
    return torchKey;
  };

  const applyEnvironmentAccents = () => {
    const root = document.documentElement;
    if (!root) return [];
    syncMaterializedAssets(root);
    for (let index = 0; index < 3; index += 1) {
      const key = accentKeys[index];
      const name = `--dream-active-accent-${index + 1}`;
      if (key) setStyleProperty(root, name, `var(--dream-asset-${key})`);
      else root.style.removeProperty(name);
    }
    return [...accentKeys];
  };

  const createMusicController = () => {
    let input = document.getElementById(MUSIC_INPUT_ID);
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.hidden = true;
      input.id = MUSIC_INPUT_ID;
      input.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(input);
    }
    let button = document.getElementById(MUSIC_BUTTON_ID);
    if (button) button.remove();
    if (musicEnabled) {
      button = document.createElement("button");
      button.id = MUSIC_BUTTON_ID;
      button.type = "button";
      button.textContent = "♪";
      button.setAttribute("aria-label", "播放环境音乐");
      button.title = "播放环境音乐";
      (document.body || document.documentElement).appendChild(button);
    }

    let audio = null;
    let blobUrl = null;
    let currentTrack = null;
    let currentPool = [];
    let currentPoolVariant = activeTheme.variant || THEME.variant || "default";
    let pendingEnvironment = null;
    let fileMap = new Map();
    // A fixed-environment switch hot-replaces the renderer in the same Codex
    // document. Preserve the user's play/pause intent across that replacement:
    // actively playing music continues with the new environment, while an
    // explicit pause stays paused.
    let userUnlocked = previousMusicWantsPlayback;
    let pausedByUser = !previousMusicWantsPlayback;
    let pausedForHidden = false;
    let lastMusicEvent = "initialized";
    let resumeAfterHiddenAdvance = false;
    let nextTrackTimer = null;
    let queuedAdvance = false;
    let fadeTimer = null;
    let playRequestId = 0;
    const sequenceIndexes = new Map();

    const setMusicState = (state, title) => {
      document.documentElement?.setAttribute("data-dream-music-state", state);
      if (!button) return;
      const labels = {
        playing: "♫ 播放中",
        paused: "▶ 继续播放",
        waiting: "… 等待",
        unavailable: "♪ 未导入",
        error: "♪ 播放失败",
      };
      button.dataset.state = state;
      button.textContent = labels[state] || "♪ 音乐";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.setAttribute("aria-pressed", state === "playing" ? "true" : "false");
    };

    const stopFade = () => {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
    };

    const cancelNextTrack = () => {
      const wasQueued = Boolean(nextTrackTimer);
      if (nextTrackTimer) clearTimeout(nextTrackTimer);
      nextTrackTimer = null;
      queuedAdvance = false;
      return wasQueued;
    };

    const releaseSource = () => {
      playRequestId += 1;
      cancelNextTrack();
      stopFade();
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      currentTrack = null;
    };

    const ensureAudio = () => {
      if (audio) return audio;
      audio = new Audio();
      audio.preload = "metadata";
      audio.volume = musicVolume;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onAudioError);
      return audio;
    };

    const startFadeIn = () => {
      const player = ensureAudio();
      stopFade();
      if (musicFadeInMs < 1 || musicVolume <= 0) {
        player.volume = musicVolume;
        return;
      }
      const steps = Math.max(1, Math.ceil(musicFadeInMs / 50));
      let step = 0;
      player.volume = 0;
      fadeTimer = setInterval(() => {
        step += 1;
        player.volume = musicVolume * Math.min(1, step / steps);
        if (step >= steps) stopFade();
      }, 50);
    };

    const poolForSlots = (slots, bySlot) => slots.flatMap(
      (slotId) => bySlot.get(slotId) || [],
    );

    const poolFor = (theme) => {
      const classicSlots = Array.isArray(theme?.musicPool)
        ? theme.musicPool.filter((slotId) => typeof slotId === "string") : [];
      const otherworldSlots = Array.isArray(theme?.otherworldMusicPool)
        ? theme.otherworldMusicPool.filter((slotId) => typeof slotId === "string") : [];
      const bySlot = new Map();
      for (const track of musicTrackMetadata) {
        if (!fileMap.has(track.fileName)) continue;
        const entries = bySlot.get(track.slotId) || [];
        entries.push(track);
        bySlot.set(track.slotId, entries);
      }
      const classicTracks = poolForSlots(classicSlots, bySlot);
      const otherworldTracks = poolForSlots(otherworldSlots, bySlot);
      if (musicSoundtrackMode === "mixed") {
        const seen = new Set();
        return [...classicTracks, ...otherworldTracks].filter((track) => {
          if (seen.has(track.fileName)) return false;
          seen.add(track.fileName);
          return true;
        });
      }
      if (musicSoundtrackMode === "otherworld") {
        return otherworldTracks.length > 0 ? otherworldTracks : classicTracks;
      }
      return classicTracks.length > 0 ? classicTracks : otherworldTracks;
    };

    const chooseNext = (forceAdvance = false) => {
      if (currentPool.length < 1) return null;
      if (!forceAdvance && currentTrack
        && currentPool.some((track) => track.fileName === currentTrack.fileName)) {
        return currentTrack;
      }
      if (musicPlaybackMode === "random") {
        const alternatives = currentPool.filter((track) =>
          track.fileName !== currentTrack?.fileName);
        const choices = alternatives.length > 0 ? alternatives : currentPool;
        return choices[Math.floor(Math.random() * choices.length)];
      }
      const currentIndex = sequenceIndexes.get(currentPoolVariant) ?? 0;
      const nextIndex = forceAdvance && currentTrack
        ? (currentIndex + 1) % currentPool.length : currentIndex % currentPool.length;
      sequenceIndexes.set(currentPoolVariant, nextIndex);
      return currentPool[nextIndex];
    };

    const loadTrack = (track) => {
      const file = track && fileMap.get(track.fileName);
      if (!file) return false;
      releaseSource();
      const player = ensureAudio();
      blobUrl = URL.createObjectURL(file);
      currentTrack = track;
      player.src = blobUrl;
      player.load();
      return true;
    };

    const playSelected = async (forceAdvance = false) => {
      if (!musicEnabled
        || (musicPauseWhenHidden && document.visibilityState === "hidden")) return false;
      const track = chooseNext(forceAdvance);
      if (!track) {
        releaseSource();
        setMusicState("unavailable", "当前环境尚未导入音乐");
        return false;
      }
      if (!currentTrack || currentTrack.fileName !== track.fileName) {
        if (!loadTrack(track)) return false;
      }
      const player = ensureAudio();
      const requestId = ++playRequestId;
      try {
        await player.play();
        if (requestId !== playRequestId || player !== audio
          || currentTrack?.fileName !== track.fileName) return false;
        startFadeIn();
        pausedByUser = false;
        lastMusicEvent = "play-started";
        setMusicState("playing", `暂停：${track.displayName}`);
        return true;
      } catch {
        if (requestId !== playRequestId || player !== audio
          || currentTrack?.fileName !== track.fileName) return false;
        pausedByUser = true;
        lastMusicEvent = "play-rejected";
        setMusicState("paused", `点击播放：${track.displayName}`);
        return false;
      }
    };

    function onEnded() {
      stopFade();
      if (!userUnlocked || pausedByUser
        || (musicPauseWhenHidden && document.visibilityState === "hidden")) return;
      if (pendingEnvironment) {
        currentPool = pendingEnvironment.pool;
        currentPoolVariant = pendingEnvironment.variant;
        pendingEnvironment = null;
        releaseSource();
        queuePlay(false);
        return;
      }
      queuePlay(musicTrackChangeMode === "rotate");
    }

    function onAudioError() {
      stopFade();
      lastMusicEvent = "audio-error";
      setMusicState("error", `无法播放：${currentTrack?.displayName || "当前音乐"}`);
    }

    function queuePlay(forceAdvance) {
      cancelNextTrack();
      if (musicTrackGapMs < 1) {
        playSelected(forceAdvance);
        return;
      }
      queuedAdvance = forceAdvance;
      setMusicState("waiting", `等待 ${musicTrackGapMs / 1000} 秒后播放下一首`);
      nextTrackTimer = setTimeout(() => {
        const shouldAdvance = queuedAdvance;
        nextTrackTimer = null;
        queuedAdvance = false;
        playSelected(shouldAdvance);
      }, musicTrackGapMs);
    }

    const setEnvironment = (theme) => {
      if (!musicEnabled) {
        currentPool = [];
        pendingEnvironment = null;
        releaseSource();
        setMusicState("disabled", "环境音乐未启用");
        return 0;
      }
      const nextPool = poolFor(theme);
      const nextVariant = theme?.variant || THEME.variant || "default";
      const currentTrackIsShared = currentTrack
        && nextPool.some((track) => track.fileName === currentTrack.fileName);
      if (musicEnvironmentChangeMode === "after-current" && currentTrack
        && audio && !audio.paused && !currentTrackIsShared) {
        pendingEnvironment = { pool: nextPool, variant: nextVariant };
        setMusicState("playing", `当前曲结束后切换到 ${nextVariant}`);
        return nextPool.length;
      }
      pendingEnvironment = null;
      currentPool = nextPool;
      currentPoolVariant = nextVariant;
      if (currentTrack && !currentTrackIsShared) {
        releaseSource();
      }
      if (currentTrackIsShared && audio && !audio.paused) {
        setMusicState("playing", `暂停：${currentTrack.displayName}`);
        return nextPool.length;
      }
      if (nextPool.length < 1) {
        setMusicState("unavailable", "当前环境尚未导入音乐");
      } else if (userUnlocked && !pausedByUser
        && (!musicPauseWhenHidden || document.visibilityState !== "hidden")) {
        playSelected(false);
      } else {
        setMusicState("ready", `点击播放：${nextPool[0].displayName}`);
      }
      return nextPool.length;
    };

    const attachFiles = () => {
      fileMap = new Map(Array.from(input.files || []).map((file) => [file.name, file]));
      return setEnvironment(activeTheme);
    };

    const toggle = () => {
      userUnlocked = true;
      const displayedAsActive = button?.dataset.state === "playing"
        || button?.dataset.state === "waiting";
      if (displayedAsActive || nextTrackTimer || (audio && !audio.paused)) {
        pausedByUser = true;
        lastMusicEvent = "user-paused";
        playRequestId += 1;
        cancelNextTrack();
        stopFade();
        audio?.pause();
        setMusicState("paused", `继续播放：${currentTrack?.displayName || "环境音乐"}`);
      } else {
        pausedByUser = false;
        lastMusicEvent = "user-resume-requested";
        playSelected(false);
      }
    };

    const handleVisibility = () => {
      if (!musicPauseWhenHidden) return;
      if (document.visibilityState === "hidden") {
        const hadQueuedTrack = Boolean(nextTrackTimer);
        resumeAfterHiddenAdvance = hadQueuedTrack && queuedAdvance;
        pausedForHidden = Boolean(audio && !audio.paused) || hadQueuedTrack;
        lastMusicEvent = "hidden-paused";
        playRequestId += 1;
        cancelNextTrack();
        stopFade();
        audio?.pause();
        return;
      }
      if (pausedForHidden && userUnlocked && !pausedByUser) {
        queuePlay(resumeAfterHiddenAdvance);
      }
      pausedForHidden = false;
      resumeAfterHiddenAdvance = false;
    };

    const cleanup = () => {
      button?.removeEventListener("click", toggle);
      button?.remove();
      input?.remove();
      pendingEnvironment = null;
      if (audio) {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onAudioError);
      }
      releaseSource();
      fileMap.clear();
      if (window[MUSIC_ATTACH_KEY] === attachFiles) delete window[MUSIC_ATTACH_KEY];
      document.documentElement?.removeAttribute("data-dream-music-state");
    };

    button?.addEventListener("click", toggle);
    setMusicState(musicEnabled ? "unavailable" : "disabled",
      musicEnabled ? "请先在皮肤控制台导入环境音乐" : "环境音乐未启用");
    window[MUSIC_ATTACH_KEY] = attachFiles;
    return {
      attachFiles,
      cleanup,
      handleVisibility,
      setEnvironment,
      get audio() { return audio; },
      get currentTrack() { return currentTrack; },
      get currentPool() { return [...currentPool]; },
      get userUnlocked() { return userUnlocked; },
      get pausedByUser() { return pausedByUser; },
      get pausedForHidden() { return pausedForHidden; },
      get wantsPlayback() {
        return userUnlocked && !pausedByUser
          && (Boolean(nextTrackTimer) || pausedForHidden || audio?.paused === false);
      },
      get lastMusicEvent() { return lastMusicEvent; },
      pauseWhenHidden: musicPauseWhenHidden,
      soundtrackMode: musicSoundtrackMode,
      trackChangeMode: musicTrackChangeMode,
    };
  };

  let musicController = null;

  const rotateBackground = () => {
    if (window[DISABLED_KEY] || backgroundPool.length < 2) return backgroundKey;
    const root = document.documentElement;
    if (!root) return backgroundKey;
    backgroundKey = chooseBackground(backgroundPool, backgroundKey);
    syncMaterializedAssets(root);
    setStyleProperty(root, "--dream-skin-art", `var(--dream-asset-${backgroundKey})`);
    const state = window[STATE_KEY];
    if (state) {
      state.backgroundKey = backgroundKey;
      state.backgroundPool = backgroundPool;
    }
    return backgroundKey;
  };

  const rotateCompanion = () => {
    if (window[DISABLED_KEY] || companionPool.length < 1) return null;
    const root = document.documentElement;
    if (!root) return null;
    const current = root.getAttribute("data-dream-companion");
    const choices = companionPool.filter((key) => key !== current);
    const candidates = choices.length > 0 ? choices : companionPool;
    const key = weightedChoice(candidates, companionWeights);
    companionKey = key;
    syncMaterializedAssets(root);
    setStyleProperty(root, "--dream-active-companion", `var(--dream-asset-${key})`);
    setAttribute(root, "data-dream-companion", key);
    setAttribute(
      root,
      "data-dream-companion-animated",
      animatedAssetKeys.has(key) || /^data:image\/(?:gif|webp);/i.test(assetDataUrls[key] || "")
        ? "true" : "false",
    );
    setAttribute(
      root,
      "data-dream-companion-size",
      companionSizeClass(key),
    );
    root.removeAttribute("data-dream-companion-frame");
    syncCompanionImage();
    if (window[STATE_KEY]) {
      window[STATE_KEY].companionKey = key;
      window[STATE_KEY].companionFrame = null;
    }
    return key;
  };

  const rotateEnvironment = () => {
    if (window[DISABLED_KEY] || environmentPool.length < 2) return null;
    const currentVariant = activeTheme.variant;
    const choices = environmentPool.filter((environment) =>
      environment.variant !== currentVariant);
    activeTheme = choices[Math.floor(Math.random() * choices.length)];
    activeArt = activeTheme.art && typeof activeTheme.art === "object" ? activeTheme.art : {};
    backgroundPool = backgroundPoolFor(activeTheme);
    backgroundKey = chooseBackground(backgroundPool);
    cardIconPool = validAssetPool(activeTheme.cardIconPool || THEME.cardIconPool);
    activeTorch = chooseTorch(activeTheme);
    torchKey = activeTorch.key;
    torchPool = activeTorch.pool;
    companionPool = validCompanionPool(activeTheme.companionPool || THEME.companionPool);
    companionWeights = validCompanionWeights(
      activeTheme.companionWeights || THEME.companionWeights,
      companionPool,
    );
    accentKeys = validAssetPool(activeTheme.accentKeys);
    companionKey = null;
    document.querySelectorAll(`[${CARD_ICON_ATTR}]`).forEach(clearCardIcon);
    ensure({ root: true, route: true, layout: false });
    applyFixedTorch();
    applyEnvironmentAccents();
    rotateCompanion();
    applyFixedCardIcons();
    musicController?.setEnvironment(activeTheme);
    const state = window[STATE_KEY];
    if (state) {
      state.activeEnvironment = activeTheme.variant;
      state.backgroundKey = backgroundKey;
      state.backgroundPool = backgroundPool;
      state.cardIconPool = cardIconPool;
      state.torchKey = torchKey;
      state.torchPool = torchPool;
      state.companionPool = companionPool;
      state.companionWeights = companionWeights;
      state.accentKeys = accentKeys;
      state.syncRuntimeTimers?.();
    }
    return activeTheme.variant;
  };
  const updateRandomConfiguration = (configuration = {}) => {
    const enabledVariants = Array.isArray(configuration.enabledVariants)
      ? [...new Set(configuration.enabledVariants.filter((variant) => typeof variant === "string"))]
      : [];
    const enabled = new Set(enabledVariants);
    const nextPool = allEnvironmentPool.filter((environment) => enabled.has(environment.variant));
    if (allEnvironmentPool.length >= 2 && nextPool.length < 2) {
      throw new Error("Random environment configuration must keep at least two environments");
    }
    const nextEnvironmentIntervalMs = Number(configuration.environmentIntervalMs);
    const nextBackgroundIntervalMs = Number(configuration.backgroundIntervalMs);
    if (
      !Number.isInteger(nextEnvironmentIntervalMs)
      || nextEnvironmentIntervalMs < 60000
      || nextEnvironmentIntervalMs > 3600000
    ) throw new Error("Invalid random environment interval");
    if (
      !Number.isInteger(nextBackgroundIntervalMs)
      || nextBackgroundIntervalMs < 60000
      || nextBackgroundIntervalMs > 3600000
    ) throw new Error("Invalid background interval");
    if (!["fixed", "rotate"].includes(configuration.backgroundMode)) {
      throw new Error("Invalid background rotation mode");
    }

    if (allEnvironmentPool.length >= 2) environmentPool = nextPool;
    environmentIntervalMs = nextEnvironmentIntervalMs;
    backgroundMode = configuration.backgroundMode;
    backgroundIntervalMs = nextBackgroundIntervalMs;
    const state = window[STATE_KEY];
    if (state) {
      stopTimer(state, "environmentTimer");
      stopTimer(state, "backgroundTimer");
      state.environmentPool = environmentPool;
      state.environmentIntervalMs = environmentIntervalMs;
      state.backgroundMode = backgroundMode;
      state.backgroundIntervalMs = backgroundIntervalMs;
    }

    let switchedEnvironment = false;
    if (
      environmentPool.length >= 2
      && !environmentPool.some((environment) => environment.variant === activeTheme.variant)
    ) {
      switchedEnvironment = Boolean(rotateEnvironment());
    } else {
      ensure({ root: true, route: true, layout: false });
      syncRuntimeTimers();
    }
    return {
      activeEnvironment: activeTheme.variant || THEME.variant || "default",
      enabledCount: environmentPool.length,
      switchedEnvironment,
      musicState: musicController ? {
        unlocked: musicController.userUnlocked === true,
        paused: musicController.audio?.paused !== false,
        track: musicController.currentTrack?.fileName ?? null,
      } : null,
    };
  };
  musicController = createMusicController();

  const ensureStyle = (root) => {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = cssText;
      style.dataset.dreamSkinVersion = VERSION;
      (document.head || root).appendChild(style);
    } else if (style.dataset.dreamSkinStyleRevision !== STYLE_REVISION) {
      style.textContent = cssText;
    }
    style.dataset.dreamSkinVersion = VERSION;
    style.dataset.dreamSkinStyleRevision = STYLE_REVISION;
    return style;
  };

  const applyRootState = (root) => {
    metrics.rootPasses += 1;
    ensureStyle(root);
    const shell = resolvedShell();
    setAttribute(root, SHELL_ATTR, shell);
    setAttribute(root, PLATFORM_ATTR, dreamPlatform);
    setAttribute(root, "data-dream-style", activeTheme.stylePreset || THEME.stylePreset || "default");
    setAttribute(root, "data-dream-variant", activeTheme.variant || THEME.variant || "default");
    setAttribute(root, "data-dream-environment-mode", environmentPool.length > 1 ? "random" : "fixed");
    setAttribute(root, "data-dream-background-mode", backgroundMode);
    syncMaterializedAssets(root);
    setStyleProperty(
      root,
      "--dream-skin-art",
      backgroundKey ? `var(--dream-asset-${backgroundKey})` : `url("${artUrl}")`,
    );
    applyTheme(root, shell);
    applyArtMetadata(root);
    root.classList.add("codex-dream-skin");
    return shell;
  };

  const conversationIsAtBottom = (scroller) => {
    if (!scroller) return true;
    const reverse = getComputedStyle(scroller).flexDirection === "column-reverse";
    if (reverse) return scroller.scrollTop >= -4;
    return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 4;
  };

  const conversationIsStreaming = (scroller) => {
    if (!scroller) return false;
    if (scroller.querySelector?.(
      '[aria-busy="true"], [data-state="streaming"], '
      + '[data-is-streaming="true"], [data-testid*="stop"]',
    )) return true;
    return [...(scroller.querySelectorAll?.("button") || [])].some((button) => {
      const label = [
        button.getAttribute?.("aria-label"),
        button.getAttribute?.("title"),
        button.textContent,
      ].filter(Boolean).join(" ");
      return /\b(?:stop|cancel)\b|停止|取消生成/i.test(label);
    });
  };

  const syncConversationIdleLayout = (scroller) => {
    const contentRoot = scroller?.firstElementChild || null;
    const contentChildren = [...(contentRoot?.children || [])];
    const activeComposer = findComposerSurface();
    const composer = activeComposer ? contentChildren.find((candidate) =>
      candidate === activeComposer || candidate.contains?.(activeComposer)) || null : null;
    const composerIndex = contentChildren.indexOf(composer);
    const messageRail = composerIndex > 0 ? contentChildren[composerIndex - 1] : null;
    const messageStack = messageRail?.firstElementChild || null;
    const messageChildren = [...(messageStack?.children || [])];
    const spacer = messageChildren.at(-1) || null;
    const validSpacer = Boolean(
      spacer
      && spacer.childElementCount === 0
      && !(spacer.textContent || "").trim()
      && spacer.classList?.contains("shrink-0"),
    );
    const idle = validSpacer && !conversationIsStreaming(scroller);
    for (const candidate of document.querySelectorAll?.(`.${IDLE_THREAD_MESSAGES_CLASS}`) || []) {
      if (candidate !== messageStack || !idle) candidate.classList.remove(IDLE_THREAD_MESSAGES_CLASS);
    }
    for (const candidate of document.querySelectorAll?.(`.${IDLE_THREAD_SPACER_CLASS}`) || []) {
      if (candidate !== spacer || !idle) candidate.classList.remove(IDLE_THREAD_SPACER_CLASS);
    }
    messageStack?.classList?.toggle(IDLE_THREAD_MESSAGES_CLASS, idle);
    spacer?.classList?.toggle(IDLE_THREAD_SPACER_CLASS, idle);
  };

  const conversationBottomTarget = (scroller) => {
    if (getComputedStyle(scroller).flexDirection === "column-reverse") {
      // Codex owns the negative scroll offset for its reverse/virtualized
      // thread. Writing zero here moves the completed answer upward and
      // leaves a viewport-sized blank region above the composer.
      return null;
    }
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  };

  const scheduleConversationBottomPin = () => {
    const state = conversationScrollState;
    if (!state?.pinned || state.pinTimer) return;
    state.pinTimer = setTimeout(() => {
      state.pinTimer = null;
      if (!state.pinned || state.element !== document.querySelector(".thread-scroll-container")) return;
      const target = conversationBottomTarget(state.element);
      if (target == null) return;
      if (Math.abs(state.element.scrollTop - target) <= 1) return;
      state.programmatic = true;
      state.element.scrollTop = target;
      state.programmatic = false;
      metrics.scrollCorrections += 1;
    }, 32);
  };

  const syncConversationScrollState = () => {
    const scroller = document.querySelector(".thread-scroll-container");
    if (conversationScrollState?.element === scroller) {
      syncConversationIdleLayout(scroller);
      if (conversationScrollState.pinned && !conversationIsAtBottom(scroller)) {
        scheduleConversationBottomPin();
      }
      return;
    }
    conversationScrollState?.cleanup?.();
    conversationScrollState = null;
    if (!scroller) return;

    const listeners = [];
    const state = {
      element: scroller,
      pinned: inheritedScrollPinned ?? true,
      programmatic: false,
      userIntentUntil: 0,
      pinTimer: null,
      contentObserver: null,
      cleanup: null,
    };
    inheritedScrollPinned = null;
    const listen = (name, handler, options) => {
      scroller.addEventListener?.(name, handler, options);
      listeners.push([name, handler, options]);
    };
    const markUserIntent = () => { state.userIntentUntil = now() + 650; };
    const onScroll = () => {
      const atBottom = conversationIsAtBottom(scroller);
      if (state.programmatic) return;
      if (state.userIntentUntil >= now()) state.pinned = atBottom;
      else if (atBottom) state.pinned = true;
      else if (state.pinned) scheduleConversationBottomPin();
    };
    listen("wheel", markUserIntent, { passive: true });
    listen("touchstart", markUserIntent, { passive: true });
    listen("pointerdown", markUserIntent, { passive: true });
    listen("keydown", markUserIntent);
    listen("scroll", onScroll, { passive: true });
    if (typeof ResizeObserver === "function") {
      state.contentObserver = new ResizeObserver(() => {
        syncConversationIdleLayout(scroller);
        if (state.pinned) scheduleConversationBottomPin();
      });
      state.contentObserver.observe(scroller.firstElementChild || scroller);
    }
    state.cleanup = () => {
      if (state.pinTimer) clearTimeout(state.pinTimer);
      state.pinTimer = null;
      state.contentObserver?.disconnect();
      for (const [name, handler, options] of listeners) {
        scroller.removeEventListener?.(name, handler, options);
      }
    };
    conversationScrollState = state;
    syncConversationIdleLayout(scroller);
    if (window[STATE_KEY]?.installToken === installToken) {
      window[STATE_KEY].conversationScrollState = state;
    }
    if (state.pinned) {
      const target = conversationBottomTarget(scroller);
      if (target != null && Math.abs(scroller.scrollTop - target) > 1) {
        state.programmatic = true;
        scroller.scrollTop = target;
        state.programmatic = false;
        metrics.scrollCorrections += 1;
      }
      if (target != null) scheduleConversationBottomPin();
    }
  };

  const syncComposerGeometry = (shellMain, { settle = false } = {}) => {
    const legacyRail = document.querySelector(
      `.thread-scroll-container .sticky:has(.${COMPOSER_SURFACE_CLASS}) `
      + `> .relative.z-10:has(.${COMPOSER_SURFACE_CLASS})`,
    );
    const composer = findComposerSurface();
    const ancestors = [];
    for (let candidate = composer?.parentElement; candidate && candidate !== shellMain;
      candidate = candidate.parentElement) {
      ancestors.push(candidate);
      if (ancestors.length >= 12) break;
    }
    const semanticDockIndex = ancestors.findIndex((candidate) => {
      let style = null;
      try { style = getComputedStyle(candidate); } catch {}
      return ["sticky", "fixed"].includes(style?.position)
        && candidate.contains?.(composer);
    });
    const semanticDock = semanticDockIndex >= 0 ? ancestors[semanticDockIndex] : null;
    const semanticRail = (semanticDockIndex >= 0
      ? ancestors.slice(0, semanticDockIndex).reverse()
      : ancestors.slice().reverse()).find((candidate) => {
      let style = null;
      try { style = getComputedStyle(candidate); } catch {}
      return ["relative", "absolute"].includes(style?.position)
        && candidate.contains?.(composer);
    }) || null;
    const rail = semanticRail || legacyRail;
    const dock = semanticDock || rail?.parentElement || null;
    for (const candidate of document.querySelectorAll?.(`.${COMPOSER_RAIL_CLASS}`) || []) {
      if (candidate !== rail) candidate.classList?.remove?.(COMPOSER_RAIL_CLASS);
    }
    for (const candidate of document.querySelectorAll?.(`.${COMPOSER_DOCK_CLASS}`) || []) {
      if (candidate !== dock) candidate.classList?.remove?.(COMPOSER_DOCK_CLASS);
    }
    rail?.classList?.add?.(COMPOSER_RAIL_CLASS);
    dock?.classList?.add?.(COMPOSER_DOCK_CLASS);
    const decorations = new Set();
    for (const candidate of [...(dock?.children || []), ...(rail?.querySelectorAll?.("*") || [])]) {
      if (candidate === rail || candidate === composer || candidate.contains?.(composer)
        || String(candidate.textContent || "").trim()
        || candidate.matches?.("[role], img, svg, video, canvas")
        || candidate.querySelector?.("button, input, textarea, select, [role], img, svg, video, canvas")) continue;
      let style = null;
      try { style = getComputedStyle(candidate); } catch {}
      if (["absolute", "fixed"].includes(style?.position) && style?.pointerEvents === "none") {
        decorations.add(candidate);
      }
    }
    for (const candidate of document.querySelectorAll?.(`.${COMPOSER_DECORATION_CLASS}`) || []) {
      if (!decorations.has(candidate)) candidate.classList?.remove?.(COMPOSER_DECORATION_CLASS);
    }
    for (const candidate of decorations) candidate.classList?.add?.(COMPOSER_DECORATION_CLASS);
    if (observedComposerDock && observedComposerDock !== rail) {
      observedComposerDock.style?.removeProperty(COMPOSER_SAFE_WIDTH_STYLE);
      observedComposerDock.style?.removeProperty(COMPOSER_SHIFT_STYLE);
    }
    observedComposerDock = rail;
    if (!rail || !shellMain || (activeTheme.stylePreset || THEME.stylePreset) !== "terraria") return;
    rail.style?.removeProperty(COMPOSER_SAFE_WIDTH_STYLE);
    rail.style?.removeProperty(COMPOSER_SHIFT_STYLE);
    const shellBox = shellMain.getBoundingClientRect();
    const dockBox = dock?.getBoundingClientRect?.() || null;
    const railBox = rail.getBoundingClientRect?.() || dockBox;
    const widthBox = dockBox || railBox;
    if (!railBox || !widthBox) return;
    metrics.composerGeometryReads += 1;
    const safeLeft = shellBox.left + 15;
    let safeRight = shellBox.right - 15;
    for (const candidate of document.querySelectorAll?.(COMPOSER_BLOCKER_SELECTOR) || []) {
      if (candidate === rail || candidate === dock || candidate.contains?.(rail)
        || rail.contains?.(candidate) || dock?.contains?.(candidate)) continue;
      let blockerBox = null;
      let style = null;
      try {
        blockerBox = candidate.getBoundingClientRect();
        style = getComputedStyle(candidate);
      } catch {}
      if (!blockerBox || blockerBox.width < 160 || blockerBox.height < 80
        || blockerBox.left <= safeLeft || blockerBox.left < shellBox.left + shellBox.width * 0.5
        || blockerBox.right < shellBox.right - 2
        || blockerBox.bottom <= widthBox.top || blockerBox.top >= widthBox.bottom
        || style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") continue;
      safeRight = Math.min(safeRight, blockerBox.left - 15);
    }
    safeRight = Math.max(safeLeft, safeRight);
    const availableWidth = Math.max(0, safeRight - safeLeft);
    const nativeDockWidth = Math.max(0, widthBox.width);
    const readableCap = Math.max(nativeDockWidth, shellBox.height * 1.5);
    const composerWidth = Math.min(availableWidth, readableCap);
    const composerLeft = safeLeft + (availableWidth - composerWidth) / 2;
    const shift = composerLeft - railBox.left;
    setStyleProperty(rail, COMPOSER_SAFE_WIDTH_STYLE, `${Math.round(composerWidth * 100) / 100}px`);
    setStyleProperty(rail, COMPOSER_SHIFT_STYLE, `${Math.round(shift * 100) / 100}px`);
    if (settle) {
      composerGeometryAttempts = 16;
      if (!composerGeometryTimer) {
        const settleGeometry = () => {
          composerGeometryTimer = null;
          if (window[STATE_KEY]?.installToken !== installToken || window[DISABLED_KEY]) return;
          syncComposerGeometry(shellMain);
          composerGeometryAttempts -= 1;
          if (composerGeometryAttempts > 0) {
            composerGeometryTimer = setTimeout(settleGeometry, 100);
            window[STATE_KEY].composerGeometryTimer = composerGeometryTimer;
          } else {
            window[STATE_KEY].composerGeometryTimer = null;
          }
        };
        composerGeometryTimer = setTimeout(settleGeometry, 70);
        if (window[STATE_KEY]?.installToken === installToken) {
          window[STATE_KEY].composerGeometryTimer = composerGeometryTimer;
        }
      }
    }
  };

  const syncRouteState = (shell, { layout = false } = {}) => {
    metrics.routePasses += 1;
    const root = document.documentElement;
    if (!root) return;
    shell ||= root.getAttribute(SHELL_ATTR) || resolvedShell();
    syncSettingsContrastMarkers(root);
    findComposerSurface({ mark: true });
    const shellMain = findCodexMainSurface({ mark: true });
    const homeIndicator = document.querySelector('[data-testid="home-icon"]');
    const home = homeIndicator?.closest('[role="main"]') ||
      [...document.querySelectorAll('[role="main"]')].find((candidate) =>
        candidate.querySelector('[data-feature="game-source"]')) || null;
    for (const candidate of document.querySelectorAll('[role="main"].dream-skin-home')) {
      if (candidate !== home) candidate.classList.remove("dream-skin-home");
    }
    if (home) home.classList.add("dream-skin-home");
    const homeSource = home?.querySelector('[data-feature="game-source"]') || null;
    const homeCopy = homeSource?.parentElement || null;
    const homeHeroInner = homeCopy?.parentElement || null;
    const homeHero = homeHeroInner?.parentElement || null;
    const homeHeroRail = homeHero?.parentElement || null;
    const homeContent = home && homeSource
      ? [...home.children].find((candidate) => candidate.contains(homeSource)) || null
      : null;
    syncHomeEmptySlots(home, homeContent);
    let nativeSuggestionGroup = home?.querySelector('.group\\/home-suggestions') || null;
    if (!nativeSuggestionGroup && homeHero) {
      for (const candidate of homeHero.querySelectorAll("div")) {
        if (candidate.contains(homeSource) || candidate.querySelectorAll("button").length !== 4) {
          continue;
        }
        if (!nativeSuggestionGroup || nativeSuggestionGroup.contains(candidate)) {
          nativeSuggestionGroup = candidate;
        }
      }
    }
    const homeLayoutTargets = new Map([
      ["dream-skin-home-content", homeContent],
      ["dream-skin-home-hero-rail", homeHeroRail],
      ["dream-skin-home-hero", homeHero],
      ["dream-skin-home-hero-inner", homeHeroInner],
      ["dream-skin-home-copy", homeCopy],
      ["dream-skin-home-suggestions", nativeSuggestionGroup],
    ]);
    for (const className of HOME_LAYOUT_CLASSES) {
      const activeTarget = homeLayoutTargets.get(className);
      for (const candidate of document.querySelectorAll(`.${className}`)) {
        if (candidate !== activeTarget) candidate.classList.remove(className);
      }
      activeTarget?.classList.add(className);
    }
    const homeSuggestionButtons = new Set(
      nativeSuggestionGroup?.querySelectorAll("button") || [],
    );
    for (const candidate of document.querySelectorAll(`[${CARD_INDEX_ATTR}]`)) {
      if (!homeSuggestionButtons.has(candidate)) {
        candidate.removeAttribute(CARD_INDEX_ATTR);
        clearCardIcon(candidate);
      }
    }
    let suggestionIndex = 0;
    for (const candidate of homeSuggestionButtons) {
      suggestionIndex += 1;
      setAttribute(candidate, CARD_INDEX_ATTR, String(suggestionIndex));
    }
    applyFixedCardIcons();
    const homeUtilityBars = new Set(home
      ? [...home.querySelectorAll(
        '[data-composer-home-utility-bar-position], [class*="_homeUtilityBar_"]',
      )].filter(elementIsVisible)
      : []);
    for (const candidate of document.querySelectorAll(".dream-skin-home-utility")) {
      if (!homeUtilityBars.has(candidate)) candidate.classList.remove("dream-skin-home-utility");
    }
    for (const candidate of homeUtilityBars) candidate.classList.add("dream-skin-home-utility");

    if (!shellMain || !document.body) return;
    shellMain.classList.toggle("dream-skin-home-shell", Boolean(home));
    syncLightSurfaceMarkers(shellMain);
    const nativeHeader = shellMain.querySelector?.(`:scope > header.${APP_HEADER_CLASS}`) ||
      shellMain.querySelector?.(":scope > header");
    // The HUD is a real header flex item. Exclude it while rediscovering
    // Codex's native rails so repeated route passes cannot mistake the HUD
    // itself for the trailing rail.
    const headerChildren = [...(nativeHeader?.children || [])]
      .filter((candidate) => candidate.id !== HUD_ID);
    const titleRail = headerChildren.find((candidate) => {
      const className = typeof candidate.className === "string" ? candidate.className : "";
      return className.includes("flex-1") && className.includes("min-w-0");
    }) || null;
    const leadingRail = titleRail?.previousElementSibling || null;
    const titleIndex = headerChildren.indexOf(titleRail);
    // Codex keeps an invisible fixed transition rail before the real trailing
    // controls on current builds. The final child after the title is the
    // in-flow rail that must share flex space with the HUD.
    const trailingCandidates = titleIndex >= 0
      ? headerChildren.slice(titleIndex + 1).filter((candidate) => candidate.id !== HUD_ID)
      : [];
    const trailingRail = trailingCandidates.at(-1) || null;
    const headerTargets = new Map([
      ["dream-skin-app-header", nativeHeader],
      ["dream-skin-header-leading", leadingRail],
      ["dream-skin-header-title-rail", titleRail],
      ["dream-skin-header-trailing", trailingRail],
    ]);
    for (const [className, activeTarget] of headerTargets) {
      for (const candidate of document.querySelectorAll(`.${className}`)) {
        if (candidate !== activeTarget) candidate.classList.remove(className);
      }
      activeTarget?.classList.add(className);
    }
    const openLocationButton = nativeHeader?.querySelector?.(
      'button[aria-label="打开位置"], button[aria-label="Open location"], button:has(img[alt="VS Code"])',
    ) || null;
    const openLocationGroup = openLocationButton?.parentElement?.parentElement || null;
    for (const candidate of document.querySelectorAll(".dream-skin-open-location-control")) {
      if (!openLocationGroup?.contains?.(candidate)) {
        candidate.classList.remove("dream-skin-open-location-control");
      }
    }
    for (const candidate of document.querySelectorAll(".dream-skin-open-location-group")) {
      if (candidate !== openLocationGroup) candidate.classList.remove("dream-skin-open-location-group");
    }
    openLocationGroup?.classList?.add("dream-skin-open-location-group");
    for (const candidate of openLocationGroup?.querySelectorAll?.("button") || []) {
      candidate.classList.add("dream-skin-open-location-control");
    }
    syncConversationScrollState();
    syncComposerGeometry(shellMain, { settle: layout });
    if (observedShellMain !== shellMain) {
      resizeObserver?.disconnect();
      resizeObserver?.observe(shellMain);
      observedShellMain = shellMain;
      layout = true;
    }
    let chrome = document.getElementById(CHROME_ID);
    let created = false;
    if (!chrome || chrome.parentElement !== document.body) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.setAttribute("aria-hidden", "true");
      chrome.innerHTML = `
        <div class="dream-skin-brand">
          <span class="dream-skin-portal-mark">◉</span>
          <span><b></b><small></small></span>
        </div>
        <div class="dream-skin-status"><i></i><span></span></div>
        <div class="dream-skin-quote"></div>
        <img class="dream-skin-orbit" alt="" draggable="false">`;
      document.body.appendChild(chrome);
      created = true;
      chromeParts = null;
    }
    // Reuse a detached HUD when Codex replaces the native header during a
    // route transition. This preserves the music controller and its active
    // Audio instance instead of silently orphaning the button.
    const legacyHud = chrome.querySelector(".terraria-hud");
    let hud = document.getElementById(HUD_ID) ||
      chromeParts?.hud ||
      (legacyHud?.classList ? legacyHud : null);
    if (!hud) {
      hud = document.createElement("div");
      hud.className = "terraria-hud";
    }
    // Health and mana decorations were removed from the product HUD. Clear
    // every legacy copy so a hot upgrade cannot leave one behind in a stale
    // header or transition fallback.
    for (const decoration of document.querySelectorAll(".dream-skin-particles")) {
      decoration.remove();
    }
    hud.id = HUD_ID;
    for (const candidate of document.querySelectorAll(".terraria-hud")) {
      if (candidate !== hud) candidate.remove();
    }
    if (nativeHeader) {
      const before = trailingRail && trailingRail.parentElement === nativeHeader
        ? trailingRail
        : null;
      if (hud.parentElement !== nativeHeader || hud.nextElementSibling !== before) {
        nativeHeader.insertBefore(hud, before);
      }
      hud.classList.add("terraria-hud-native");
      hud.classList.remove("terraria-hud-fallback");
    } else {
      if (hud.parentElement !== document.body) document.body.appendChild(hud);
      hud.classList.add("terraria-hud-fallback");
      hud.classList.remove("terraria-hud-native");
    }
    if (!chromeParts || chromeParts.chrome !== chrome || chromeParts.hud !== hud) {
      chromeParts = {
        chrome,
        name: chrome.querySelector(".dream-skin-brand b"),
        subtitle: chrome.querySelector(".dream-skin-brand small"),
        status: chrome.querySelector(".dream-skin-status span"),
        quote: chrome.querySelector(".dream-skin-quote"),
        hud,
        orbit: chrome.querySelector(".dream-skin-orbit"),
      };
    }
    const musicButton = document.getElementById(MUSIC_BUTTON_ID) ||
      hud.querySelector(`#${MUSIC_BUTTON_ID}`);
    if (musicButton && chromeParts.hud && musicButton.parentElement !== chromeParts.hud) {
      chromeParts.hud.appendChild(musicButton);
    }
    syncCompanionImage();
    const activeName = activeTheme.name || THEME.name || "Codex Dream Skin";
    setTextContent(
      chromeParts.name,
      environmentPool.length > 1 ? `${activeName} · 随机` : activeName,
    );
    setTextContent(
      chromeParts.subtitle,
      activeTheme.brandSubtitle || THEME.brandSubtitle || "CODEX DREAM SKIN",
    );
    const activeStatus = activeTheme.statusText || THEME.statusText || "DREAM SKIN ONLINE";
    setTextContent(
      chromeParts.status,
      environmentPool.length > 1 ? `随机轮换 · ${activeStatus}` : activeStatus,
    );
    setTextContent(
      chromeParts.quote,
      activeTheme.quote || THEME.quote || "MAKE SOMETHING WONDERFUL",
    );
    if (layout || created) {
      metrics.layoutReads += 1;
      const shellBox = shellMain.getBoundingClientRect();
      setStyleProperty(chrome, "left", `${Math.round(shellBox.left)}px`);
      setStyleProperty(chrome, "top", `${Math.round(shellBox.top)}px`);
      setStyleProperty(chrome, "width", `${Math.round(shellBox.width)}px`);
      setStyleProperty(chrome, "height", `${Math.round(shellBox.height)}px`);
    }
    chrome.classList.toggle("dream-skin-home-shell", Boolean(home));
    if (chrome.dataset.dreamShell !== shell) {
      chrome.dataset.dreamShell = shell;
      metrics.attributeWrites += 1;
    }
  };

  const ensure = ({ root: rootPass = true, route = true, layout = true } = {}) => {
    if (window[DISABLED_KEY]) return;
    const root = document.documentElement;
    if (!root) return;
    metrics.ensureCalls += 1;
    const shell = rootPass ? applyRootState(root) : null;
    if (route) syncRouteState(shell, { layout });
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window[DISABLED_KEY] = true;
    document.documentElement?.classList.remove("codex-dream-skin");
    document.documentElement?.classList.remove(SETTINGS_ACTIVE_CLASS);
    document.documentElement?.removeAttribute(SHELL_ATTR);
    document.documentElement?.removeAttribute(PLATFORM_ATTR);
    for (const name of ART_ATTRS) document.documentElement?.removeAttribute(name);
    document.documentElement?.style.removeProperty("--dream-skin-art");
    for (const name of THEME_VARIABLES) document.documentElement?.style.removeProperty(name);
    for (const name of THEME_ASSET_VARIABLES) document.documentElement?.style.removeProperty(name);
    materializedAssetKeys.clear();
    for (const name of (document.documentElement?.getAttribute("style") || "")
      .match(/--dream-asset-[a-z0-9-]+(?=\s*:)/g) || []) {
      document.documentElement?.style.removeProperty(name);
    }
    document.querySelectorAll(".dream-skin-home").forEach((node) => node.classList.remove("dream-skin-home"));
    document.querySelectorAll(".dream-skin-home-shell").forEach((node) => node.classList.remove("dream-skin-home-shell"));
    document.querySelectorAll?.(`main.${MAIN_SURFACE_CLASS}, main[${MAIN_SURFACE_ATTR}]`)
      .forEach((node) => {
        node.classList?.remove?.(MAIN_SURFACE_CLASS);
        node.removeAttribute?.(MAIN_SURFACE_ATTR);
      });
    document.querySelectorAll?.(`header.${APP_HEADER_CLASS}, header[${APP_HEADER_ATTR}]`)
      .forEach((node) => {
        node.classList?.remove?.(APP_HEADER_CLASS);
        node.removeAttribute?.(APP_HEADER_ATTR);
      });
    document.querySelectorAll(".dream-skin-home-utility").forEach((node) => node.classList.remove("dream-skin-home-utility"));
    document.querySelectorAll(`.${COMPOSER_SURFACE_CLASS}`).forEach((node) =>
      node.classList.remove(COMPOSER_SURFACE_CLASS));
    document.querySelectorAll(`.${SETTINGS_LIGHT_SURFACE_CLASS}`).forEach((node) =>
      node.classList.remove(SETTINGS_LIGHT_SURFACE_CLASS));
    for (const className of [
      LIGHT_SURFACE_INSET_CLASS,
      HOME_EMPTY_SLOT_CLASS,
      COMPOSER_DOCK_CLASS,
      COMPOSER_RAIL_CLASS,
      COMPOSER_DECORATION_CLASS,
    ]) {
      document.querySelectorAll(`.${className}`).forEach((node) => node.classList.remove(className));
    }
    for (const className of HOME_LAYOUT_CLASSES) {
      document.querySelectorAll(`.${className}`).forEach((node) => node.classList.remove(className));
    }
    for (const className of [
      "dream-skin-app-header",
      "dream-skin-header-leading",
      "dream-skin-header-title-rail",
      "dream-skin-header-trailing",
      "dream-skin-open-location-control",
      "dream-skin-open-location-group",
      IDLE_THREAD_MESSAGES_CLASS,
      IDLE_THREAD_SPACER_CLASS,
    ]) {
      document.querySelectorAll(`.${className}`).forEach((node) => node.classList.remove(className));
    }
    document.querySelectorAll(`[${CARD_INDEX_ATTR}], [${CARD_ICON_ATTR}]`).forEach((node) => {
      node.removeAttribute(CARD_INDEX_ATTR);
      clearCardIcon(node);
    });
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(HUD_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
    state?.music?.cleanup?.();
    state?.observer?.disconnect();
    state?.rootObserver?.disconnect();
    state?.resizeObserver?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.cardIconTimer) clearInterval(state.cardIconTimer);
    if (state?.torchTimer) clearInterval(state.torchTimer);
    if (state?.companionTimer) clearInterval(state.companionTimer);
    if (state?.environmentTimer) clearInterval(state.environmentTimer);
    if (state?.backgroundTimer) clearInterval(state.backgroundTimer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.scheduler.frame);
    }
    if (state?.composerGeometryTimer) clearTimeout(state.composerGeometryTimer);
    if (analysisTimer) clearTimeout(analysisTimer);
    if (state?.resizeHandler) window.removeEventListener("resize", state.resizeHandler);
    if (state?.mediaHandler && state?.mediaQuery) {
      try { state.mediaQuery.removeEventListener("change", state.mediaHandler); } catch {}
    }
    if (state?.motionMediaHandler && state?.motionMediaQuery) {
      try { state.motionMediaQuery.removeEventListener("change", state.motionMediaHandler); } catch {}
    }
    if (state?.visibilityHandler) {
      try { document.removeEventListener("visibilitychange", state.visibilityHandler); } catch {}
    }
    state?.conversationScrollState?.cleanup?.();
    observedComposerDock?.style?.removeProperty(COMPOSER_SAFE_WIDTH_STYLE);
    observedComposerDock?.style?.removeProperty(COMPOSER_SHIFT_STYLE);
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null, frame: null, root: false, route: false, layout: false };
  const flushScheduledEnsure = () => {
    if (scheduler.frame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(scheduler.frame);
    }
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.frame = null;
    scheduler.timeout = null;
    const pending = { root: scheduler.root, route: scheduler.route, layout: scheduler.layout };
    scheduler.root = false;
    scheduler.route = false;
    scheduler.layout = false;
    ensure(pending);
  };
  const scheduleEnsure = ({ root = false, route = true, layout = false } = {}) => {
    scheduler.root ||= root;
    scheduler.route ||= route;
    scheduler.layout ||= layout;
    if (scheduler.timeout || scheduler.frame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      scheduler.frame = requestAnimationFrame(flushScheduledEnsure);
      scheduler.timeout = setTimeout(flushScheduledEnsure, 96);
    } else {
      scheduler.timeout = setTimeout(flushScheduledEnsure, 64);
    }
  };
  const ROUTE_MUTATION_SELECTOR = [
    "main",
    '[role="main"]',
    '[data-testid="home-icon"]',
    ".group\\/home-suggestions",
    '[data-composer-home-utility-bar-position]',
    '[data-composer-surface-variant]',
    '[data-composer-utility-bar-variant]',
    '[data-composer-layout]',
    SETTINGS_PANEL_SELECTOR,
    '[class*="_homeUtilityBar_"]',
    `.${HOME_EMPTY_SLOT_CLASS}`,
    `.${LIGHT_SURFACE_INSET_CLASS}`,
    `.${COMPOSER_SURFACE_CLASS}`,
    ".composer-surface-chrome",
    "header.app-header-tint",
  ].join(",");
  const ROUTE_MUTATION_ATTRIBUTES = new Set([
    "data-composer-home-utility-bar-position",
    "data-composer-surface-variant",
    "data-composer-utility-bar-variant",
    "data-composer-layout",
    "data-settings-panel-slug",
  ]);
  const nodeTouchesRouteSurface = (node) => {
    if (!node) return false;
    if (node === document.documentElement || node === document.body) return true;
    if (node.nodeType !== 1) return false;
    try {
      return Boolean(node.closest?.(`.${HOME_EMPTY_SLOT_CLASS}, .${LIGHT_SURFACE_INSET_CLASS}`)
        || node.matches?.(ROUTE_MUTATION_SELECTOR)
        || node.querySelector?.(ROUTE_MUTATION_SELECTOR)
        || node.matches?.(LIGHT_SURFACE_CANDIDATE_SELECTOR)
        || node.querySelector?.(LIGHT_SURFACE_CANDIDATE_SELECTOR));
    } catch {
      return false;
    }
  };
  const mutationNeedsRouteSync = (mutations) => mutations.some((mutation) => {
    if (mutation.type === "characterData") {
      return Boolean(mutation.target?.parentElement?.closest?.(`.${HOME_EMPTY_SLOT_CLASS}`));
    }
    if (mutation.type === "attributes") {
      return ROUTE_MUTATION_ATTRIBUTES.has(mutation.attributeName);
    }
    if (mutation.type !== "childList") return false;
    if (nodeTouchesRouteSurface(mutation.target)) return true;
    return [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]
      .some(nodeTouchesRouteSurface);
  });
  const mutationTouchesComposerBoundary = (mutations) => mutations.some((mutation) => {
    const candidates = mutation.type === "childList"
      ? [mutation.target, ...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]
      : [mutation.target];
    return candidates.some((node) => {
      if (node?.nodeType !== 1) return false;
      try {
        if (node.matches?.(COMPOSER_BLOCKER_SELECTOR)
          || node.closest?.(COMPOSER_BLOCKER_SELECTOR)
          || node.querySelector?.(COMPOSER_BLOCKER_SELECTOR)) return true;
        const shellMain = document.querySelector?.(`main.${MAIN_SURFACE_CLASS}`)
          || findCodexMainSurface();
        const shellBox = shellMain?.getBoundingClientRect?.();
        if (!shellBox) return false;
        const positioned = [node, ...(node.querySelectorAll?.("*") || [])].slice(0, 48);
        return positioned.some((candidate) => {
          const box = candidate.getBoundingClientRect?.();
          let style = null;
          try { style = getComputedStyle(candidate); } catch {}
          return Boolean(box && ["absolute", "fixed", "sticky"].includes(style?.position)
            && box.width >= 160 && box.height >= 80
            && box.left >= shellBox.left + shellBox.width * 0.5
            && box.right >= shellBox.right - 2);
        });
      } catch {
        return false;
      }
    });
  });
  const observer = new MutationObserver((mutations) => {
    metrics.mutationBatches += 1;
    if (!mutationNeedsRouteSync(mutations)) {
      metrics.mutationBatchesIgnored += 1;
      return;
    }
    scheduleEnsure({ route: true, layout: mutationTouchesComposerBoundary(mutations) });
  });
  const nativeAppearanceSnapshot = () => {
    const nativeClass = (node) => String(node?.className || "")
      .split(/\s+/)
      .filter((name) => name && name !== "codex-dream-skin" && name !== SETTINGS_ACTIVE_CLASS)
      .sort()
      .join(" ");
    const attributes = (node) => ["data-theme", "data-appearance", "data-color-mode"]
      .map((name) => node?.getAttribute?.(name) || "")
      .join("|");
    return `${nativeClass(document.documentElement)}|${attributes(document.documentElement)}`
      + `|${nativeClass(document.body)}|${attributes(document.body)}`;
  };
  let observedAppearance = nativeAppearanceSnapshot();
  rootObserver = new MutationObserver(() => {
    if (samplingNativeShell) return;
    const nextAppearance = nativeAppearanceSnapshot();
    if (nextAppearance === observedAppearance) return;
    observedAppearance = nextAppearance;
    scheduleEnsure({ root: true, route: true });
  });
  const resizeHandler = () => scheduleEnsure({ route: true, layout: true });
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => scheduleEnsure({ route: true, layout: true }));
  }

  let mediaQuery = null;
  let mediaHandler = null;
  try {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaHandler = () => scheduleEnsure({ root: true, route: true });
  } catch {}

  const stopTimer = (state, name) => {
    if (!state?.[name]) return;
    clearInterval(state[name]);
    state[name] = null;
  };
  const syncRuntimeTimers = ({ refreshCompanion = false } = {}) => {
    const state = window[STATE_KEY];
    if (!state) return false;
    const visible = document.visibilityState !== "hidden";
    if (!visible) {
      stopTimer(state, "timer");
      stopTimer(state, "companionTimer");
      stopTimer(state, "environmentTimer");
      stopTimer(state, "backgroundTimer");
      return false;
    }
    if (!state.timer) state.timer = setInterval(() => ensure(), 10000);
    if (motionMediaQuery?.matches) {
      stopTimer(state, "companionTimer");
      stopTimer(state, "environmentTimer");
      stopTimer(state, "backgroundTimer");
      return true;
    }
    if (refreshCompanion) rotateCompanion();
    if (companionPool.length >= 2 && !state.companionTimer) {
      state.companionTimer = setInterval(rotateCompanion, 12000);
    }
    if (environmentPool.length >= 2 && !state.environmentTimer) {
      state.environmentTimer = setInterval(rotateEnvironment, environmentIntervalMs);
    }
    if (backgroundMode === "rotate" && backgroundPool.length >= 2
      && !state.backgroundTimer) {
      state.backgroundTimer = setInterval(rotateBackground, backgroundIntervalMs);
    } else if (backgroundMode !== "rotate" || backgroundPool.length < 2) {
      stopTimer(state, "backgroundTimer");
    }
    return true;
  };
  try {
    motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionMediaHandler = () => syncRuntimeTimers({
      refreshCompanion: !motionMediaQuery.matches,
    });
  } catch {}
  visibilityHandler = () => {
    if (document.visibilityState !== "hidden") {
      ensure({ root: true, route: true, layout: true });
    }
    syncRuntimeTimers();
    window[STATE_KEY]?.music?.handleVisibility?.();
  };

  window[STATE_KEY] = {
    ensure,
    cleanup,
    observer,
    rootObserver,
    resizeObserver,
    composerGeometryTimer,
    timer: null,
    cardIconTimer: null,
    companionTimer: null,
    environmentTimer: null,
    backgroundTimer: null,
    scheduler,
    resizeHandler,
    mediaQuery,
    mediaHandler,
    motionMediaQuery,
    motionMediaHandler,
    visibilityHandler,
    syncRuntimeTimers,
    conversationScrollState,
    syncConversationScrollState,
    syncComposerGeometry,
    artUrl,
    installToken,
    analysis: artAnalysis,
    artMetadata: ART_METADATA,
    metrics,
    version: VERSION,
    themeId: THEME.id || "custom",
    themeAssetVariables: THEME_ASSET_VARIABLES,
    cardIconPool,
    applyFixedCardIcons,
    torchKey,
    torchPool,
    applyFixedTorch,
    accentKeys,
    applyEnvironmentAccents,
    companionPool,
    companionWeights,
    companionKey: null,
    companionFrame: null,
    lazyAssetMode: LAZY_ASSET_MODE,
    materializedAssetCount: 0,
    materializedAssetKeys,
    syncMaterializedAssets,
    rotateCompanion,
    backgroundMode,
    backgroundIntervalMs,
    backgroundPool,
    backgroundKey,
    rotateBackground,
    environmentPool,
    environmentIntervalMs,
    activeEnvironment: activeTheme.variant || THEME.variant || "default",
    rotateEnvironment,
    updateRandomConfiguration,
    music: musicController,
    detectShellMode,
  };
  const firstEnsureStartedAt = now();
  ensure({ layout: !previous || !document.getElementById(CHROME_ID) });
  metrics.firstEnsureMs = Number((now() - firstEnsureStartedAt).toFixed(3));
  if (previous?.artUrl && previous.artUrl !== artUrl) URL.revokeObjectURL(previous.artUrl);

  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...ROUTE_MUTATION_ATTRIBUTES],
  });
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode"],
  });
  if (document.body) {
    rootObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode"],
    });
  }
  applyFixedTorch();
  applyEnvironmentAccents();
  rotateCompanion();
  musicController.setEnvironment(activeTheme);
  syncRuntimeTimers();
  window.addEventListener("resize", resizeHandler, { passive: true });
  document.addEventListener?.("visibilitychange", visibilityHandler);
  if (mediaHandler && mediaQuery) {
    mediaQuery.addEventListener("change", mediaHandler);
  }
  if (motionMediaHandler && motionMediaQuery) {
    motionMediaQuery.addEventListener("change", motionMediaHandler);
  }
  const analysisPromise = artAnalysis ? Promise.resolve(null) : analyzeArt();
  window[STATE_KEY].analysisTimer = analysisTimer;
  analysisPromise.then((analysis) => {
    const state = window[STATE_KEY];
    if (!analysis || state?.installToken !== installToken || window[DISABLED_KEY]) return;
    artAnalysis = analysis;
    state.analysis = analysis;
    if (typeof THEME.artKey === "string") {
      analysisCache.set(THEME.artKey, analysis);
      while (analysisCache.size > 8) analysisCache.delete(analysisCache.keys().next().value);
    }
    ensure({ root: true, route: false, layout: false });
  }).catch(() => {});
  return {
    installed: true,
    version: VERSION,
    themeId: THEME.id || "custom",
    shell: resolvedShell(),
    analysis: artAnalysis,
  };
})(__DREAM_SKIN_CSS_JSON__, __DREAM_SKIN_ART_JSON__, __DREAM_SKIN_THEME_JSON__)
