// Real browser regression for the searchable project popover on Home.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { assessText, assessIcon } from '../scripts/inspection/report.mjs';
import { inspectScreenshotPopovers } from '../scripts/inspection/png.mjs';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to an installed playwright-core');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const css = await fs.readFile(process.env.BEFORE_CSS || new URL('../assets/dream-skin.css', import.meta.url), 'utf8');
try {
  const page = await browser.newPage({viewport:{width:1000,height:800}});
  await page.route('**/*', r=>r.abort());
  await page.setContent(`<!doctype html><html class="codex-dream-skin" data-dream-style="terraria" data-dream-variant="hallow"><style>
    html {--ds-panel-rgb:35 22 59;--ds-accent-rgb:246 155 255;--ds-panel-2-rgb:70 45 95}
    body {margin:0;background:#151124;color:#fff5d8}
    [data-slot=popover-content] {position:fixed;left:150px;top:150px;width:280px;padding:8px;
      background:oklab(0.999994 .000045 .000020 / .9);border-radius:16px;backdrop-filter:blur(8px)}
    [cmdk-root],[cmdk-list] {background:transparent} [cmdk-item] {display:block;width:100%;padding:10px;border:0;font:14px Arial;color:#fff5d8}
    [cmdk-item][aria-selected=true] {background:rgb(26 28 31 / .055)}
    input {background:transparent;color:#fff5d8;border:0;padding:8px;width:240px}
    input::placeholder {color:#b4cad4}
    #ordinary-dialog {position:absolute;left:650px;background:white;color:black;padding:10px}
  </style><main class="dream-skin-home-shell"></main>
    <div id="ordinary-dialog">Unrelated dialog</div>
    <div data-slot="popover-content" role="dialog" data-state="open"><div cmdk-root>
      <input cmdk-input placeholder="搜索项目" aria-label="Search">
      <div cmdk-list role="listbox"><div cmdk-item role="option" aria-selected="true"><span>Project A</span></div>
      <div cmdk-item role="option" aria-selected="false"><span>Project B</span></div>
      <button cmdk-item role="option"><span>New project</span></button></div></div></div></html>`);
  let before=await page.evaluate(INSPECTION_EXPRESSION);
  const detection=inspectScreenshotPopovers(await page.screenshot(),before.popovers,before.viewport);
  assert.equal(detection[0].status,'warn','new inspector must catch the original internal white popup');
  assert.equal(before.controls.length,3,'div role=option must be inspected alongside buttons');
  await page.addStyleTag({content:css});
  const selector='[data-slot="popover-content"]';
  const measurements=[];
  for(const delay of [0,500,700,1300]) {
    if(delay)await new Promise(r=>setTimeout(r,delay));
    const sample=await page.evaluate(INSPECTION_EXPRESSION);
    const colors=sample.controls.map(assessText);
    assert.equal(sample.popovers.length,1);
    assert.equal(inspectScreenshotPopovers(await page.screenshot(),sample.popovers,sample.viewport)[0].status,'pass');
    assert.ok(colors.every(c=>c.status==='pass'),JSON.stringify(colors));
    measurements.push(await page.locator(selector).evaluate(e=>({bg:getComputedStyle(e).backgroundColor,radius:getComputedStyle(e).borderRadius})));
  }
  assert.ok(measurements.every(s=>s.bg===measurements[0].bg && s.radius==='4px'));
  const normal=await page.locator('[cmdk-item]').nth(1).evaluate(e=>getComputedStyle(e).backgroundColor);
  await page.locator('[cmdk-item]').nth(1).hover();
  const hover=await page.locator('[cmdk-item]').nth(1).evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.notEqual(normal,hover);
  const hovered=await page.evaluate(INSPECTION_EXPRESSION);
  assert.ok(hovered.controls.map(assessText).every(c=>c.status==='pass'));
  await page.locator('input').fill('Project');
  assert.equal(await page.locator('input').inputValue(),'Project');
  const placeholder=await page.locator('input').evaluate(e=>getComputedStyle(e,'::placeholder').color);
  assert.notEqual(placeholder,'rgb(180, 202, 212)');
  assert.equal(await page.locator('#ordinary-dialog').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)','unrelated dialogs must not receive the picker rule');
  for(const [variant,panel] of [['forest-day','20 42 35'],['cavern','39 24 49']]) {
    await page.evaluate(({variant,panel})=>{document.documentElement.dataset.dreamVariant=variant;document.documentElement.style.setProperty('--ds-panel-rgb',panel);},{variant,panel});
    const s=await page.evaluate(INSPECTION_EXPRESSION);
    assert.ok(s.controls.map(assessText).every(c=>c.status==='pass'));
  }
  // Nested creation dialog uses semantic tokens for both inset surfaces and
  // the primary action. Verify the actual stylesheet, not copied selectors.
  await page.setContent(`<html class="codex-dream-skin" data-dream-style="terraria"><style>
    html{--ds-panel-rgb:35 22 59;--ds-panel-2-rgb:70 45 95;--ds-accent:#ef9ef4;--ds-accent-rgb:239 158 244;--ds-on-accent:#21142f}
    body{background:#171222;margin:0}.codex-dialog{position:absolute;left:150px;top:150px;width:400px;padding:20px;background:white}
    .bg-primary-soft{background:var(--color-background-primary-soft,white);padding:12px;margin:8px}
    .bg-primary-solid{background:var(--color-background-primary-solid,white);color:var(--color-text-primary-solid,white);padding:10px}
    input{background:transparent;border:0}button,input{font:14px Arial}
  </style><div role="dialog" class="codex-dialog"><h2>Create project</h2>
  <div class="bg-primary-soft"><input placeholder="Project name" aria-label="Project name"></div>
  <div class="bg-primary-soft" style="height:100px"><button>Choose folder</button></div>
  <button class="bg-primary-solid"><span>Create project</span></button></div></html>`);
  const whiteDialog=await page.evaluate(INSPECTION_EXPRESSION);
  assert.ok(whiteDialog.insetSurfaces.some(p=>p.light),'white input/folder panels must be detected');
  await page.addStyleTag({content:css});
  await page.evaluate(()=>{document.documentElement.style.setProperty('--ds-accent','#ef9ef4');document.documentElement.style.setProperty('--ds-on-accent','#21142f');});
  const darkDialog=await page.evaluate(INSPECTION_EXPRESSION);
  assert.ok(!darkDialog.insetSurfaces.some(p=>p.light));
  const primary=await page.locator('.bg-primary-solid').evaluate(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,child:getComputedStyle(e.firstElementChild).webkitTextFillColor}));
  assert.equal(primary.color,'rgb(33, 20, 47)');assert.equal(primary.bg,'rgb(239, 158, 244)');assert.equal(primary.child,primary.color);
  assert.equal(inspectScreenshotPopovers(await page.screenshot(),darkDialog.popovers,darkDialog.viewport)[0].status,'pass');
  // Reproduce the live icon chooser: semantic default icon plus a colored
  // choice. The old text-only probe missed this entirely.
  await page.locator('.codex-dialog').evaluate(e => e.insertAdjacentHTML('beforeend', `<style>
    .text-codex-icon{color:var(--color-codex-icon,#1a1c1f)}
    .fixture-icon{background:transparent;border:0}.fixture-icon svg{width:24px;height:24px}
  </style><button class="fixture-icon text-codex-icon" aria-label="Default icon"><svg viewBox="0 0 16 16"><path fill="currentColor" d="M2 2h12v12H2Z"/></svg></button>
  <button class="fixture-icon" style="color:rgb(255,103,100)" aria-label="Color preview"><svg viewBox="0 0 16 16"><path fill="none" stroke="currentColor" d="M2 2h12v12H2Z"/></svg></button>`));
  // Override only the default token to the verified broken native value.
  await page.locator('.codex-dialog').evaluate(e=>e.style.setProperty('--color-codex-icon','#1a1c1f','important'));
  const brokenIcons=await page.evaluate(INSPECTION_EXPRESSION);
  assert.ok(brokenIcons.icons.map(assessIcon).some(c=>c.status==='warn'),'icon-only control must expose the original bug');
  await page.locator('.codex-dialog').evaluate(e=>e.style.removeProperty('--color-codex-icon'));
  const fixedIcons=await page.evaluate(INSPECTION_EXPRESSION);
  assert.equal(fixedIcons.icons.length,2);
  assert.ok(fixedIcons.icons.map(assessIcon).every(c=>c.status==='pass'),JSON.stringify(fixedIcons.icons.map(assessIcon)));
  assert.equal(fixedIcons.icons[1].foreground,'rgb(255, 103, 100)','explicit colored preview stays unchanged');
  console.log('PASS: dark default icon detected, semantic token fixes actual SVG paint, explicit color preview preserved.');
  console.log('PASS: creation dialog, input/folder inset token pairing, primary button and child text, internal white-panel detection.');
  console.log('PASS: original white popover detected; full skin CSS fixes first frame, 0/500/1200/2500ms, options, hover, search, placeholder and three palettes; unrelated dialog stays unchanged.');
  // The real 26.1023 form has muted device text and a placeholder on the soft
  // inset. Sampling only dark forest/purple palettes missed marble and hive.
  const theme=JSON.parse(await fs.readFile(new URL('../local-presets/preset-terraria-random/theme.json',import.meta.url),'utf8'));
  await page.setContent(`<html class="codex-dream-skin" data-dream-style="terraria"><style>
    body{margin:0}.codex-dialog{position:absolute;left:50px;top:50px;width:450px;padding:20px}
    .bg-primary-soft{background:var(--color-background-primary-soft);padding:24px;margin:12px}
    button,input{font:13px Arial;border:0;background:transparent}
    .text-secondary{color:var(--color-text-secondary)}
  </style><div role="dialog" class="codex-dialog"><div class="bg-primary-soft"><input placeholder="Project name"></div>
    <div class="bg-primary-soft"><button class="text-secondary"><span>On this computer</span></button></div></div></html>`);
  await page.addStyleTag({content:css});
  let minContrast=Infinity;
  for(const env of theme.environmentPool) {
    await page.evaluate(colors=>{for(const [key,value] of [['--ds-panel-rgb',colors.panel],['--ds-panel-2-rgb',colors.panelAlt]])document.documentElement.style.setProperty(key,[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).join(' '));},env.colors);
    const p=await page.evaluate(INSPECTION_EXPRESSION);
    assert.equal(p.controls.length,1);
    const text=assessText(p.controls[0]);
    assert.equal(text.status,'pass',`${env.variant}: device label contrast ${text.ratio}`);
    const placeholder=await page.locator('input').evaluate(e=>getComputedStyle(e,'::placeholder').webkitTextFillColor);
    const inputText=assessText({...p.controls[0],foreground:placeholder});
    assert.equal(inputText.status,'pass',`${env.variant}: placeholder contrast ${inputText.ratio}`);
    minContrast=Math.min(minContrast,text.ratio,inputText.ratio);
  }
  console.log(`PASS: device description and input placeholder on soft insets in ${theme.environmentPool.length} real biome palettes; minimum contrast ${minContrast}:1.`);
} finally { await browser.close(); }
