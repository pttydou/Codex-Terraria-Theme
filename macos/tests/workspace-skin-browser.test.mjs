// Isolated Chromium: real stylesheet + native workspace attributes, no user CDP.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GEOMETRY_EXPRESSION, assessGeometry } from '../scripts/inspection/geometry.mjs';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const css = await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8');
try {
  const page = await browser.newPage({viewport:{width:2263,height:1000}});
  await page.route('**/*', route=>route.abort());
  await page.setContent(`<!doctype html><html class="codex-dream-skin" data-dream-style="terraria"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;--dream-skin-art:none}
    #shell{display:flex;margin-left:349px;width:calc(100% - 349px);height:100%;position:relative}
    #pane{flex:1;min-width:0;position:relative}
    #file{width:320px;flex:none}#native{width:100%;height:100%}
    [data-thread-scroll-footer]{position:absolute;inset-inline:0;bottom:0}
    [data-pip-obstacle]{width:100%;max-width:768px;margin:auto;padding:0 16px}
    .dream-skin-composer-surface{height:120px}
    #home{scrollbar-gutter:stable both-edges;overflow:hidden;height:800px}
  </style><div id="shell"><div id="pane" data-app-shell-workspace-layout="split" data-app-shell-main-content-layout>
    <main id="native" data-app-shell-main-surface class="trskin-main-surface">
      <div data-thread-scroll-footer><div data-pip-obstacle="thread-footer"><div data-codex-composer-root data-composer-placement="thread"><div class="dream-skin-composer-surface"></div></div></div></div>
    </main></div><aside id="file"></aside></div></html>`);
  await page.addStyleTag({content:css});
  for(const width of [2263,1728,1200]) {
    await page.setViewportSize({width,height:1000});
    for(const fileWidth of [0,320,560]) for(const left of [false,true]) {
      await page.evaluate(({fileWidth,left})=>{
        document.querySelector('#file').style.width=fileWidth+'px';
        document.querySelector('#shell').style.flexDirection=left?'row-reverse':'row';
        document.querySelector('#pane').setAttribute('data-app-shell-workspace-layout',fileWidth?'split':'full');
      },{fileWidth,left});
      const {p,c,border}=await page.evaluate(()=>({p:document.querySelector('#pane').getBoundingClientRect().toJSON(),c:document.querySelector('.dream-skin-composer-surface').getBoundingClientRect().toJSON(),border:getComputedStyle(document.querySelector('#native')).borderWidth}));
      assert.ok(Math.abs(c.width-(p.width-48))<1,`width ${width}, file ${fileWidth}, left ${left}: ${c.width}/${p.width}`);
      assert.ok(Math.abs(c.x-p.x-24)<1);assert.ok(c.right<=p.right-23);assert.equal(border,'0px');
    }
  }
  console.log('PASS: 18 full/split/left/right/wide/narrow cases keep composer within its pane with 24px margins; no layout border.');
  // Hosted macOS browsers can pause rAF briefly. Retry only incomplete evidence,
  // never a layout warning or context change; the production probe stays strict.
  async function observeGeometry(expected) {
    let observation, result;
    for (let attempt=1; attempt<=3; attempt++) {
      await page.bringToFront();
      await page.waitForTimeout(200);
      observation=await page.evaluate(GEOMETRY_EXPRESSION);
      result=assessGeometry(observation);
      const frames=observation.frames || [];
      const gaps=frames.slice(1).map((f,i)=>f.elapsedMs-frames[i].elapsedMs);
      const evidence={attempt,expected,...result,frames:frames.length,
        durationMs:(frames.at(-1)?.elapsedMs || 0)-(frames[0]?.elapsedMs || 0),
        maxGapMs:Math.max(0,...gaps),changedContext:observation.changedContext};
      console.log('Geometry evidence:',JSON.stringify(evidence));
      if (result.status!=='unknown' || observation.changedContext) break;
    }
    assert.equal(result.status,expected,JSON.stringify({result,observation}));
  }
  await observeGeometry('pass');
  await page.evaluate(()=>{let on=false;window.fixtureTimer=setInterval(()=>{on=!on;document.querySelector('.dream-skin-composer-surface').style.width=on?'736px':'1866px'},50)});
  try { await observeGeometry('warn'); }
  finally { await page.evaluate(()=>clearInterval(window.fixtureTimer)); }
  console.log('PASS: real animation-frame probe passes a stable layout and detects 736/1866px oscillation.');
  await page.evaluate(()=>{document.querySelector('#native').innerHTML='<header>Titlebar</header><div id="home" role="main" class="trskin-main-surface dream-skin-home-shell"></div>';});
  const home=await page.evaluate(()=>({gutter:getComputedStyle(document.querySelector('#home')).scrollbarGutter,inner:getComputedStyle(document.querySelector('#home')).backgroundImage,outer:getComputedStyle(document.querySelector('#native')).backgroundImage}));
  assert.equal(home.gutter,'auto');assert.equal(home.inner,'none');assert.ok(home.outer.includes('linear-gradient'));
  console.log('PASS: home reserves no scrollbar gutter and paints the environment on the outer canvas only.');
} finally { await browser.close(); }
