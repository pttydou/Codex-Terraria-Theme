// Codex 26.1021 shell + Markdown tokens, independent of generated class hashes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { verifySession } from '../scripts/injector.mjs';
import { luminance, parseColor } from '../scripts/inspection/report.mjs';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage();
  await page.route('**/*',r=>r.abort());
  await page.setContent(`<html class="codex-dream-skin" data-dream-style="terraria" data-theme="light"><style>
    :root{--color-surface:#fff;--color-surface-secondary:#f6f6f6;--color-surface-tertiary:#fff;
      --color-text:#1a1c1f;--color-text-user-message:#0c274a;--color-text-secondary:#555;
      --color-text-danger:#e02e2a;--color-background-composer-action-bar:#f6f6f6}
    [data-app-shell-frame]{background:color-mix(in srgb,var(--color-surface-secondary) 85%,transparent)}
    [data-app-shell-page-surface],#footer{background:var(--color-surface)}
    ._MarkdownRoot_fixture_2{color:var(--color-text)}
    [data-markdown-text-tone=user-message]{color:var(--color-text-user-message)}
    #bar{background:var(--color-background-composer-action-bar);color:var(--color-text-secondary)}
    #danger{color:var(--color-text-danger)}
    main{background:#111925;padding:30px}body{margin:0}
  </style><div data-app-shell-frame>Titlebar</div><aside data-app-shell-page-surface>Sidebar</aside>
  <main><div class="_MarkdownRoot_fixture_2"><p id="assistant">Readable reply</p></div>
  <div class="_MarkdownRoot_fixture_2" data-markdown-text-tone="user-message">Direct text without a p wrapper</div>
  <div id="footer">Composer fade</div><div id="bar">Action bar</div><span id="danger">Warning</span></main></html>`);
  const measure=()=>page.evaluate(()=>{
    const rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};
    return {text:['#assistant','[data-markdown-text-tone]'].map(s=>rgba(getComputedStyle(document.querySelector(s)).color)),
      surfaces:['[data-app-shell-frame]','[data-app-shell-page-surface]','#footer','#bar'].map(s=>rgba(getComputedStyle(document.querySelector(s)).backgroundColor)),
      danger:getComputedStyle(document.querySelector('#danger')).color};
  });
  const native=await measure();
  assert.ok(native.surfaces.every(c=>Math.min(...c.slice(0,3))>240));
  const css=await page.addStyleTag({content:await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8')});
  for(const variant of ['forest-day','cavern','blood-moon']) {
    await page.evaluate(v=>document.documentElement.dataset.dreamVariant=v,variant);
    const themed=await measure();
    assert.ok(themed.text.every(c=>Math.min(...c.slice(0,3))>180),`${variant}: Markdown inherits dark native text ${JSON.stringify(themed.text)}`);
    assert.ok(themed.surfaces.every(c=>Math.max(...c.slice(0,3))<150),`${variant}: native white shell/fade ${JSON.stringify(themed.surfaces)}`);
    assert.equal(themed.danger,native.danger,'semantic warning color is preserved');
  }
  await css.evaluate(e=>e.remove());
  assert.deepEqual(await measure(),native,'removing the skin restores official tokens');
  console.log('PASS: 26.1021 native shell/fade/action surfaces and direct Markdown text in three environments; warning color and official restore preserved.');

  // The current app keeps a hidden old conversation ahead of the live one.
  // Exercise the editor fallback too: a stable composer attribute may vanish
  // in a future update, and the visible editor must still be a required input.
  await page.setContent(`<style>body{margin:0}main{margin-left:200px;height:600px}aside{position:absolute;width:200px;height:600px}form{margin-top:300px;height:100px}textarea{width:400px;height:60px}</style>
    <div hidden><main><form><textarea></textarea></form></main></div>
    <aside class="app-shell-left-panel"></aside>
    <main id="active"><form id="composer"><textarea></textarea></form></main>`);
  const renderer = (await fs.readFile(new URL('../assets/renderer-inject.js', import.meta.url), 'utf8'))
    .replace('__DREAM_SKIN_CSS_JSON__', JSON.stringify(''))
    .replace('__DREAM_SKIN_ART_JSON__', JSON.stringify('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nxoAAAAASUVORK5CYII='))
    .replace('__DREAM_SKIN_THEME_JSON__', JSON.stringify({id:'cached-conversation-test',stylePreset:'terraria',variant:'forest-day',appearance:'dark'}))
    .replace('__DREAM_SKIN_VERSION_JSON__', JSON.stringify('fixture'))
    .replace('__DREAM_SKIN_STYLE_REVISION_JSON__', JSON.stringify('fixture'));
  await page.evaluate(renderer);
  const discovery = await page.evaluate(() => {
    const state = window.__CODEX_DREAM_SKIN_STATE__;
    const missing = state.evaluateFrontendContract({main:document.querySelector('#active'),composer:null});
    return {contract:state.frontendContract, active:document.querySelector('#composer').classList.contains('dream-skin-composer-surface'),missing};
  });
  assert.equal(discovery.active, true, 'Editor fallback must mark the visible conversation composer');
  assert.equal(discovery.contract.adapters.composer.required, true);
  assert.equal(discovery.contract.composerDiscovery, 'editor-fallback');
  assert.ok(discovery.missing.criticalMissing.includes('visible-composer'), 'A hidden first editor must not suppress incompatibility detection');
  await page.evaluate(() => window.__CODEX_DREAM_SKIN_STATE__.cleanup());
  console.log('PASS: cached hidden conversation cannot hide the visible editor or mask a missing composer.');

  // Settings content moved beside the shell titlebar; Pets includes a nested
  // main/form/editor which is a preview, never the conversation composer.
  await page.setContent(`<style>
    body{margin:0}aside{width:180px;height:700px;position:absolute}#shell{margin-left:180px;height:700px}
    header{height:44px}[data-app-shell-focus-area=main]{height:650px;padding:30px}
    main{height:150px}textarea{height:60px;width:300px}
    :root{--color-text-info:rgb(44,103,197);--color-background-primary-soft:rgba(255,255,255,.96);--color-background-primary-solid:#fff5d8}
    a{color:var(--color-text-info)}.bg-primary-soft{background:var(--color-background-primary-soft)}
    .bg-primary-solid{background:var(--color-background-primary-solid)}
    [data-avatar-overlay-material]{width:160px;height:80px;background:rgba(255,255,255,.9);color:white}
  </style><aside class="app-shell-left-panel"><button data-settings-panel-slug="general-settings">General</button>
  <button data-settings-panel-slug="pets" aria-current="page">Pets</button></aside>
  <div id="shell"><header>Titlebar</header><div data-app-shell-focus-area="main"><h1>Pets</h1>
  <a href="#">Information link</a><div data-avatar-overlay-material="css">Preview</div>
  <input id="dictionary" class="bg-primary-soft" placeholder="Jane Doe"><button class="bg-primary-solid"><span>Add plugin</span></button>
  <main><form><textarea></textarea></form></main></div></div>`);
  await page.evaluate(renderer);
  await page.addStyleTag({content:await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8')});
  const settings=await page.evaluate(()=>({
    content:document.querySelector('.trskin-settings-content')?.getAttribute('data-app-shell-focus-area'),
    header:document.querySelector('header').className,
    composers:document.querySelectorAll('.dream-skin-composer-surface').length,
    required:window.__CODEX_DREAM_SKIN_STATE__.frontendContract.adapters.composer.required,
    preview:getComputedStyle(document.querySelector('[data-avatar-overlay-material]')).backgroundColor,
    link:getComputedStyle(document.querySelector('a')).color,
  }));
  assert.equal(settings.content,'main');
  assert.ok(!settings.header.includes('trskin-settings-content'));
  assert.equal(settings.composers,0); assert.equal(settings.required,false);
  assert.notEqual(settings.preview,'rgba(255, 255, 255, 0.9)');
  assert.notEqual(settings.link,'rgb(44, 103, 197)');
  const field=await page.locator('#dictionary').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.ok(parseColor(field).slice(0,3).every(c=>c<160),'settings field must use the panel palette: '+field);
  for(const hover of [false,true]) {
    if(hover) await page.locator('button.bg-primary-solid').hover();
    const colors=await page.locator('button.bg-primary-solid').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e.querySelector('span')).webkitTextFillColor}));
    const a=luminance(parseColor(colors.bg)),b=luminance(parseColor(colors.fg));
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'primary action and nested label must keep contrast');
  }

  assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).settingsPage,'pets');
  await page.locator('[data-settings-panel-slug=pets]').evaluate(e=>e.style.transform='translateY(2000px)');
  assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).settingsPage,'pets','scrolled sidebar selection still identifies the active content');
  assert.equal((await verifySession({evaluate:expression=>page.evaluate(expression)})).composer,null);
  await page.evaluate(()=>window.__CODEX_DREAM_SKIN_STATE__.cleanup());
  console.log('PASS: settings content ownership, selected subpage, readable link/preview palette, and preview editor exclusion.');
} finally {await browser.close();}
