// Reproduce split native footer backplate/fade without touching the user's app.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { readScreenshotPng } from '../scripts/inspection/png.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const css=await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8');
const sample=(bytes,points)=>{
  const p=readScreenshotPng(bytes);
  return points.flatMap(([x,y])=>{const i=(Math.floor(y)*p.width+Math.floor(x))*p.channels;return [...p.pixels.subarray(i,i+3)];});
};
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  await page.route('**/*',r=>r.abort());let count=0;
  for(const width of [900,1700]) for(const layout of ['full','left','right']) {
    await page.setViewportSize({width,height:700});
    await page.setContent(`<!doctype html><html class="codex-dream-skin" data-dream-style="terraria" data-dream-variant="space">
      <style>*{box-sizing:border-box}html,body{margin:0;height:700px}body{display:flex}
      #file{width:${layout==='full'?0:280}px;flex:none;order:${layout==='left'?-1:1}}
      #pane{flex:1;min-width:0;height:700px;position:relative;background:linear-gradient(120deg,#315262,#5a4275)}
      .thread-scroll-container{position:relative;height:100%}#messages{display:flex;flex-direction:column;height:100%}
      .sticky{position:sticky;bottom:0;margin-top:auto;height:calc(128px + var(--status-height));flex:none;pointer-events:none}
      .absolute{position:absolute}.pointer-events-none{pointer-events:none}
      .fade{top:calc(var(--status-height) - 32px);height:32px;inset-inline:0;background:linear-gradient(to top,#050915,transparent)}
      [data-thread-scroll-footer]{position:absolute;inset-inline:0;bottom:0;padding-bottom:16px;pointer-events:none}
      .surface{height:128px;inset-inline:0;bottom:0;background:#050915}
      [data-pip-obstacle]{position:relative;z-index:1;pointer-events:auto}
      .dream-skin-composer-surface{height:112px}#status{height:var(--status-height);position:relative}
      #status button{background:#18314f;color:#ecedda;border:0}#status:empty{height:0}
      textarea{height:70px;width:90%;pointer-events:auto}
      </style><main id="pane" data-app-shell-workspace-layout="${layout==='full'?'full':'split'}" data-app-shell-main-content-layout style="--status-height:0px">
      <div class="thread-scroll-container"><div id="messages"><p>Conversation fixture</p>
        <div class="sticky pointer-events-none"><div class="fade absolute pointer-events-none"></div></div></div>
        <div data-thread-scroll-footer><div class="surface absolute pointer-events-none"></div>
          <div data-pip-obstacle="thread-footer"><div data-codex-composer-root data-composer-placement="thread">
            <div id="status"></div><div class="dream-skin-composer-surface"><textarea></textarea><button id="send">Send</button></div>
          </div></div>
        </div></div></main><aside id="file"></aside></html>`);
    const geometry=()=>page.evaluate(()=>{
      const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {pane:r('#pane'),composer:r('.dream-skin-composer-surface'),footer:r('[data-thread-scroll-footer]'),status:r('#status')};
    });
    if(process.env.BEFORE_CSS && count===0) {
      const old=await page.addStyleTag({content:await fs.readFile(process.env.BEFORE_CSS,'utf8')});
      const p=await page.evaluate(INSPECTION_EXPRESSION);
      assert.equal(p.footerDecorations.status,'warn');assert.equal(p.footerDecorations.layers.filter(l=>l.painted).length,2);
      const g=await geometry(),points=[[g.pane.x+8,g.composer.y+50],[g.pane.x+g.pane.width/2,g.composer.y-16]];
      const painted=sample(await page.screenshot(),points);
      const clear=await page.addStyleTag({content:'.fade,.surface{background:none!important}'});
      const unpainted=sample(await page.screenshot(),points);
      assert.notDeepEqual(unpainted.slice(0,3),painted.slice(0,3),'old backplate must darken the left margin');
      assert.notDeepEqual(unpainted.slice(3),painted.slice(3),'old fade must darken the area above the composer');
      await clear.evaluate(e=>e.remove());await old.evaluate(e=>e.remove());
      console.log('PASS: old CSS leaves both black footer layers; new probe and actual pixels reproduce the failure.');
    }
    await page.addStyleTag({content:css});
    await page.locator('textarea').fill('Retain this draft');
    for(const statusHeight of [0,32,64]) {
      await page.evaluate(h=>{document.querySelector('#pane').style.setProperty('--status-height',h+'px');document.querySelector('#status').innerHTML=h===0?'':h===32?'<button>1 file changed +95</button>':'<div><button>Working: tool progress</button></div>';},statusHeight);
      const p=await page.evaluate(INSPECTION_EXPRESSION);
      assert.equal(p.footerDecorations.status,'pass');assert.equal(p.footerDecorations.layers.length,2);
      const g=await geometry();
      assert.ok(Math.abs(g.composer.width-(g.pane.width-48))<1);
      assert.ok(Math.abs(g.composer.x-g.pane.x-24)<1);
      const points=[[g.pane.x+8,g.composer.y+50],[g.pane.right-8,g.composer.y+50],[g.pane.x+g.pane.width/2,g.composer.y-16]];
      const pixels=sample(await page.screenshot(),points);
      const hide=await page.addStyleTag({content:'.fade,.surface{visibility:hidden!important}'});
      assert.deepEqual(sample(await page.screenshot(),points),pixels,'surrounding pixels must match an absent native backdrop');
      assert.deepEqual(await geometry(),g,'paint removal must preserve footer and status geometry');
      await hide.evaluate(e=>e.remove());
      assert.equal(await page.locator('textarea').inputValue(),'Retain this draft');
      await page.locator('#send').click();
      if(statusHeight) {await page.locator('#status button').click();assert.notEqual(await page.locator('#status button').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');}
      count++;
    }
    await page.evaluate(()=>document.documentElement.classList.remove('codex-dream-skin'));
    assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).footerDecorations.status,'warn','uninstall must restore native paint');
  }
  console.log(`PASS: ${count} native full/left/right and empty/changes/progress cases; surrounding pixels, unchanged geometry, draft, clickable status/send controls and uninstall.`);
} finally {await browser.close();}
