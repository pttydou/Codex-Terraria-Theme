// Native sidebar ::after paint and resize handle, isolated from the user's app.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { readScreenshotPng } from '../scripts/inspection/png.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const css = await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8');
const oldCss = process.env.BEFORE_CSS ? await fs.readFile(process.env.BEFORE_CSS,'utf8') : null;
const strip = (bytes, x) => {
  const p=readScreenshotPng(bytes), values=[];
  for(let y=100;y<500;y+=20) for(let dx=7;dx<17;dx++) {
    const i=(y*p.width+Math.round(x)+dx)*p.channels;
    values.push(...p.pixels.subarray(i,i+3));
  }
  return values;
};
try {
  const page=await browser.newPage({viewport:{width:1200,height:700},deviceScaleFactor:1});
  await page.route('**/*',r=>r.abort());
  let count=0;
  for(const tag of ['aside','div']) for(const wide of [false,true])
    for(const route of ['conversation','home','settings']) for(const width of [800,1700]) {
      await page.setViewportSize({width,height:700});
      await page.setContent(`<!doctype html><html class="codex-dream-skin" data-dream-style="terraria"
        data-dream-art-wide="${wide}" data-dream-task-mode="ambient" data-dream-variant="${wide?'forest-day':'spider-nest'}">
        <style>*{box-sizing:border-box}body{margin:0;display:flex;height:700px}
        html{--dream-skin-art:linear-gradient(#302c45,#463756)}
        .app-shell-left-panel{flex:none;width:280px;height:100%;position:relative;z-index:10;background:#302c45}
        .app-shell-left-panel::after{content:"";position:absolute;top:0;bottom:0;right:-20px;width:20px;background:inherit;pointer-events:none}
        #handle{position:absolute;inset-block:0;right:-8px;width:16px;cursor:col-resize;z-index:1}
        #main{flex:1;min-width:0;height:100%;position:relative;background:#18141f}
        [data-thread-scroll-footer]{position:absolute;bottom:24px;inset-inline:0}
        .dream-skin-composer-surface{height:96px}
        </style><${tag} class="app-shell-left-panel"><div id="handle" role="separator"></div></${tag}>
        <main id="main" data-app-shell-workspace-layout="full" data-app-shell-main-content-layout ${route==='settings'?'class="trskin-settings-content"':'data-trskin-main-surface class="trskin-main-surface '+(route==='home'?'dream-skin-home-shell':'')+'"'}>
        ${route==='home'?'<div data-feature="game-source"></div>':''}
        <div data-thread-scroll-footer><div data-pip-obstacle="thread-footer"><div data-codex-composer-root data-composer-placement="thread"><div class="dream-skin-composer-surface"></div></div></div></div></main></html>`);
      if(oldCss && count===0) {
        const style=await page.addStyleTag({content:oldCss});
        assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).sidebarEdge.status,'warn','old CSS must reproduce the internal seam');
        const x=await page.locator('.app-shell-left-panel').evaluate(e=>e.getBoundingClientRect().right);
        const before=strip(await page.screenshot(),x);
        const hide=await page.addStyleTag({content:'.app-shell-left-panel::after{content:none!important}'});
        assert.notDeepEqual(before,strip(await page.screenshot(),x),'old pseudo must paint over the actual main pixels');
        await hide.evaluate(e=>e.remove());await style.evaluate(e=>e.remove());
        console.log('PASS: old CSS reproduces a painted 20px internal strip and the new probe flags it.');
      }
      await page.addStyleTag({content:css});
      const state=await page.evaluate(INSPECTION_EXPRESSION);
      assert.equal(state.sidebarEdge.status,'pass',`${tag}/${wide}/${route}/${width}`);
      const geometry=()=>page.evaluate(()=>{
        const r=e=>e.getBoundingClientRect().toJSON(),s=document.querySelector('.app-shell-left-panel');
        return {sidebar:r(s),main:r(document.querySelector('#main')),handle:r(document.querySelector('#handle')),
          composer:r(document.querySelector('.dream-skin-composer-surface')),pseudoWidth:getComputedStyle(s,'::after').width};
      });
      const before=await geometry(),pixels=strip(await page.screenshot(),before.sidebar.right);
      const hide=await page.addStyleTag({content:'.app-shell-left-panel::after{content:none!important}'});
      assert.deepEqual(strip(await page.screenshot(),before.sidebar.right),pixels,'transparent extension must reveal the same main pixels as no pseudo');
      assert.deepEqual(await geometry(),before,'clearing paint must not change geometry');
      await hide.evaluate(e=>e.remove());
      assert.equal(before.pseudoWidth,'20px');assert.equal(before.main.x,before.sidebar.right);
      assert.ok(before.composer.x>=before.main.x&&before.composer.right<=before.main.right);
      await page.evaluate(()=>{
        const panel=document.querySelector('.app-shell-left-panel');let drag;
        document.querySelector('#handle').onpointerdown=e=>{drag={x:e.clientX,width:panel.getBoundingClientRect().width};};
        document.onpointermove=e=>{if(drag)panel.style.width=(drag.width+e.clientX-drag.x)+'px';};
        document.onpointerup=()=>{drag=null;};
      });
      await page.mouse.move(before.handle.x+before.handle.width/2,300);
      await page.mouse.down();await page.mouse.move(before.handle.x+before.handle.width/2+36,300,{steps:3});await page.mouse.up();
      const after=await geometry();
      assert.ok(Math.abs(after.sidebar.width-before.sidebar.width-36)<1,'resize hit target must still work');
      assert.equal(after.main.x,after.sidebar.right);
      assert.ok(after.composer.right<=after.main.right);
      // Removing the skin restores native paint; hidden sidebars are not reported.
      await page.evaluate(()=>document.documentElement.classList.remove('codex-dream-skin'));
      assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).sidebarEdge.status,'warn');
      await page.locator('.app-shell-left-panel').evaluate(e=>e.style.display='none');
      assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).sidebarEdge,null);
      count++;
    }
  console.log(`PASS: ${count} sidebar host/art/route/viewport cases; pixel continuity, unchanged geometry, real pointer dragging and uninstall restoration.`);
} finally {await browser.close();}
