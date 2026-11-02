// Serialized into the renderer. Read-only: no events, styles, globals or DOM writes.
export function inspectPage() {
  // The selection action portal has presentation semantics, not menu/dialog.
  // Match its elevated surface and direct buttons without depending on labels
  // or a CSS module hash; also support native semantic toolbars.
  const actionSurface = '[role="toolbar"], [role="presentation"][class*="bg-surface-elevated-secondary"]:has(> button)';
  const imageSummary = value => value.replace(/url\([^)]*\)/g, 'url([image])');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
      && r.top < innerHeight && r.left < innerWidth
      && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const layersFor = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      const pseudoPaint = ['::before', '::after'].some((pseudo) => {
        const p = getComputedStyle(node, pseudo);
        return !['none', 'normal'].includes(p.content) && p.display !== 'none';
      });
      layers.push({ color: s.backgroundColor, image: imageSummary(s.backgroundImage),
        complex: pseudoPaint || s.opacity !== '1' || s.filter !== 'none'
          || s.backdropFilter !== 'none' || s.mixBlendMode !== 'normal' });
    }
    return layers;
  };
  const appearance = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { font: s.fontFamily, fontSize: s.fontSize, color: s.webkitTextFillColor || s.color,
      background: s.backgroundColor, image: imageSummary(s.backgroundImage), border: s.borderColor };
  };
  const surfaces = {};
  for (const [name, selector] of Object.entries({ body: 'body', main: '[data-trskin-main-surface], .trskin-main-surface',
    composer: '.dream-skin-composer-surface', editor: 'textarea, [contenteditable="true"]', settings: '.trskin-settings-content' })) {
    const nodes = [...document.querySelectorAll(selector)].filter(visible);
    surfaces[name] = { count: nodes.length, appearance: appearance(nodes[0]), rect: nodes[0] ? rect(nodes[0]) : null };
  }
  const controls = [], popupText = [];
  let totalTextRuns = 0, totalPopupTextRuns = 0;
  const controlSelector = 'button, [role="button"], a[href], [role="option"], [role="menuitem"]';
  const popupSelector = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], '
    + '[role="tooltip"], [data-slot="popover-content"], [data-slot="dialog-content"], ' + actionSurface;
  const excludedText = ':disabled, [aria-disabled="true"], [inert], [aria-hidden="true"], '
    + 'script, style, textarea, input, [contenteditable]:not([contenteditable="false"])';
  const collectText = (el, index, isPopup) => {
    if (!visible(el) || el.closest(excludedText)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || !visible(node.parentElement)) continue;
      const parent = node.parentElement;
      if (parent.closest(excludedText)) continue;
      // Each text run belongs either to its nearest control or to its nearest
      // popup. Static labels need their own budget so long sidebars cannot
      // crowd them out. Never collect text content or conversation prose.
      if (isPopup ? parent.closest(controlSelector) || parent.closest(popupSelector) !== el
        : parent.closest(controlSelector) !== el) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      const parentBox = parent.getBoundingClientRect();
      // Exclude accessibility-only labels clipped into a 1px box.
      const parentStyle = getComputedStyle(parent);
      if (r.width < 2 || r.height < 2 || parentBox.width < 2 || parentBox.height < 2
        || parentStyle.clipPath !== 'none' || parentStyle.clip !== 'auto') continue;
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (!top || !(parent === top || parent.contains(top)
        || (parentStyle.pointerEvents === 'none' && top.contains(parent)))) continue;
      if (isPopup) totalPopupTextRuns++; else totalTextRuns++;
      const samples = isPopup ? popupText : controls;
      if (samples.length >= 160) continue;
      const s = getComputedStyle(parent);
      samples.push({ component: `${isPopup ? 'popup-text:' : ''}${el.tagName.toLowerCase()}[${index}]`, rect: rect(parent),
        foreground: s.webkitTextFillColor || s.color, fontFamily: s.fontFamily, fontSize: parseFloat(s.fontSize),
        fontWeight: parseInt(s.fontWeight, 10), layers: layersFor(parent) });
    }
  };
  [...document.querySelectorAll(controlSelector)].forEach((el, index) => collectText(el, index, false));
  [...document.querySelectorAll(popupSelector)].forEach((el, index) => collectText(el, index, true));
  const state = window.__CODEX_DREAM_SKIN_STATE__ || {};
  // Inspect actual SVG paint, including icon-only controls. A button's text
  // color alone cannot detect a dark path or stroke. Multicolor icons retain
  // their individual paints; this is an observation, never a recoloring rule.
  const icons = [];
  let totalIconPaints = 0;
  const iconSelector = '[role="dialog"] button svg, [role="menu"] svg, [data-slot="popover-content"] button svg, '
    + `:is(${actionSurface}) button svg`;
  for (const [index, svg] of [...document.querySelectorAll(iconSelector)].entries()) {
    if (!visible(svg) || svg.closest(':disabled, [aria-disabled="true"], [inert]')) continue;
    const r = svg.getBoundingClientRect(), control = svg.closest(controlSelector);
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!control || !top || !control.contains(top)) continue;
    const paints = new Set();
    for (const shape of svg.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse, use')) {
      if (!visible(shape)) continue;
      const style = getComputedStyle(shape);
      for (const kind of ['fill', 'stroke']) {
        const foreground = style[kind];
        if (foreground === 'none' || paints.has(foreground)) continue;
        paints.add(foreground);
        totalIconPaints++;
        if (icons.length >= 160) continue;
        const layers = layersFor(shape);
        if (style[`${kind}Opacity`] !== '1') layers[0].complex = true;
        icons.push({ component: `svg[${index}].${kind}`, rect: rect(svg), foreground, layers });
      }
    }
  }
  const popovers = [...document.querySelectorAll('[data-slot="popover-content"], [role="menu"], [role="dialog"], [role="alertdialog"], ' + actionSurface)]
    .filter(visible).map(el => ({
      kind: el.getAttribute('role') === 'presentation' ? 'selection-actions'
        : el.querySelector('[cmdk-root]') ? 'searchable-picker' : el.getAttribute('role') || 'popover',
      rect: rect(el), appearance: appearance(el),
    }));
  const insetSurfaces = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-slot="popover-content"], .trskin-settings-content')]
    .filter(visible).flatMap(popup => [...popup.querySelectorAll('div, section, fieldset, input, textarea')]
      .filter(visible).slice(0, 160).flatMap(el => {
        const r = rect(el), s = getComputedStyle(el);
        if (r.width < 100 || r.height < 28 || r.width * r.height < 3500) return [];
        // Classify only opaque neutral/near-white paint. Gradients and media
        // still need the screenshot check; don't treat unknown as dark.
        const rgb = /^rgba?\(([^)]+)\)$/.exec(s.backgroundColor);
        const channels = rgb?.[1].split(/[\s,\/]+/).map(Number);
        const lab = /^oklab\(\s*([\d.]+).*?(?:\/\s*([\d.]+))?\)$/.exec(s.backgroundColor);
        const light = Boolean(channels && channels.slice(0,3).every(c => c > 220) && (channels[3] ?? 1) > .8)
          || Boolean(lab && Number(lab[1]) > .94 && Number(lab[2] ?? 1) > .8);
        return [{ rect:r, background:s.backgroundColor, light }];
      }));
  const settingsSlugs = [...new Set([...document.querySelectorAll('[data-settings-panel-slug][aria-current="page"]')]
    // A selected sidebar item may scroll out of view while its page stays active.
    .filter(el => el.checkVisibility({checkVisibilityCSS:true}) && el.getBoundingClientRect().width > 0)
    .map(el => el.getAttribute('data-settings-panel-slug')))].sort();
  const home = [...document.querySelectorAll('[role="main"]')].find(el =>
    visible(el) && el.querySelector('[data-feature="game-source"]'));
  const homeLayout = home ? (() => {
    const hero = home.querySelector('.dream-skin-home-hero');
    const title = home.querySelector('[data-feature="game-source"]');
    if (!hero || !title) return { status: 'warn', issues: ['missing-home-layout'] };
    const box = hero.getBoundingClientRect(), homeBox = home.getBoundingClientRect();
    const issues = [];
    if (homeBox.width >= 600 && box.width < homeBox.width * .6) issues.push('squeezed-home-hero');
    for (const el of [title, ...title.querySelectorAll('button')]) {
      const r = el.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1
        || el.scrollWidth > el.clientWidth + 2) issues.push('home-content-overflow');
    }
    return {status: issues.length ? 'warn' : 'pass', issues: [...new Set(issues)], hero: rect(hero), title: rect(title)};
  })() : null;
  // Window-edge pixels miss painted native chrome inside the window. Observe
  // the sidebar's outward pseudo-element without moving its resize hit target.
  const sidebar = [...document.querySelectorAll('.app-shell-left-panel')].find(visible);
  const sidebarEdge = sidebar ? (() => {
    const s = getComputedStyle(sidebar, '::after');
    const overhang = s.position === 'absolute' ? Math.max(0, -parseFloat(s.right) || 0) : 0;
    const active = !['none', 'normal'].includes(s.content) && s.display !== 'none'
      && s.visibility !== 'hidden' && Number(s.opacity) > 0 && parseFloat(s.width) > 0;
    const clear = s.backgroundColor === 'transparent' || /[,/]\s*0(?:\.0*)?\s*\)$/.test(s.backgroundColor);
    return {status: active && overhang > 2 && (s.backgroundImage !== 'none' || !clear) ? 'warn' : 'pass',
      rect: rect(sidebar), overhang, background: s.backgroundColor, image: imageSummary(s.backgroundImage)};
  })() : null;
  const footer = [...document.querySelectorAll('[data-thread-scroll-footer]')].find(visible);
  const footerDecorations = footer ? (() => {
    const nodes = [...footer.querySelectorAll(':scope > div.absolute.pointer-events-none:empty'),
      ...(footer.closest('.thread-scroll-container')?.querySelectorAll(
        '.sticky.pointer-events-none > div.absolute.pointer-events-none:empty') || [])];
    const layers = nodes.filter(visible).map(el => {
      const s = getComputedStyle(el);
      const clear = s.backgroundColor === 'transparent' || /[,/]\s*0(?:\.0*)?\s*\)$/.test(s.backgroundColor);
      return {rect:rect(el), background:s.backgroundColor, image:imageSummary(s.backgroundImage),
        painted: Number(s.opacity) > 0 && (!clear || s.backgroundImage !== 'none' || s.boxShadow !== 'none')};
    });
    return {status:layers.some(l=>l.painted) ? 'warn' : 'pass', layers};
  })() : null;
  return {
    route: settingsSlugs.length || surfaces.settings.count ? 'settings'
      : home ? 'home'
      : [...document.querySelectorAll('[contenteditable="true"], textarea')].some(visible) ? 'conversation' : 'other',
    homeLayout, sidebarEdge, footerDecorations,
    settingsPage: settingsSlugs.length ? settingsSlugs.join(',') : null,
    viewport: { width: innerWidth, height: innerHeight, scale: devicePixelRatio },
    themeId: state.themeId || null,
    environment: state.activeEnvironment?.id || state.activeEnvironment || null,
    style: document.documentElement.getAttribute('data-dream-style'),
    musicState: document.documentElement.getAttribute('data-dream-music-state'),
    musicButton: Boolean(document.getElementById('codex-dream-skin-music-toggle')),
    companionCount: [...document.querySelectorAll('.dream-skin-orbit')].filter(visible).length,
    workspace: (() => {
      const composer = document.querySelector('.dream-skin-composer-surface');
      const native = composer?.closest('[data-app-shell-workspace-layout]');
      const pane = composer?.closest('[data-app-shell-main-content-layout]');
      return native ? { layout: native.getAttribute('data-app-shell-workspace-layout'), pane: pane ? rect(pane) : null } : null;
    })(),
    fontsStatus: document.fonts.status, surfaces, controls, totalTextRuns, popupText, totalPopupTextRuns,
    icons, totalIconPaints, popovers, insetSurfaces,
  };
}
export const INSPECTION_EXPRESSION = `(${inspectPage.toString()})()`;
