// Native 26.1021 home hierarchy: the hero rail is now inside a horizontal row.
// Exercise the real renderer/stylesheet, long names and a cached hidden homepage.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { verifySession } from '../scripts/injector.mjs';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const root = new URL('../', import.meta.url);
const css = await fs.readFile(process.env.BEFORE_CSS || new URL('assets/dream-skin.css',root),'utf8');
const renderer = (await fs.readFile(new URL('assets/renderer-inject.js',root),'utf8'))
  .replace('__DREAM_SKIN_CSS_JSON__',JSON.stringify(css))
  .replace('__DREAM_SKIN_ART_JSON__',JSON.stringify('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nxoAAAAASUVORK5CYII='))
  .replace('__DREAM_SKIN_THEME_JSON__',JSON.stringify({id:'home-regression',stylePreset:'terraria',variant:'forest-day'}))
  .replace('__DREAM_SKIN_VERSION_JSON__',JSON.stringify('fixture'))
  .replace('__DREAM_SKIN_STYLE_REVISION_JSON__',JSON.stringify('fixture'));
try {
  const page = await browser.newPage();
  await page.route('**/*',r=>r.abort());
  await page.setContent(`<style>
    *{box-sizing:border-box}html,body{margin:0;height:100%}aside{width:280px;height:100%;position:absolute}
    main{height:100%;margin-left:280px;display:flex;flex-direction:column}
    #home{container-type:size;display:flex;flex:1;min-height:0;flex-direction:column}
    #layout{display:flex;flex:1;flex-direction:column;min-height:0}#contents{display:contents}
    #row{display:flex;align-items:flex-end;justify-content:center;flex:1 1 0;min-height:fit-content;padding-bottom:24px}
    #rail{display:flex;width:100%;justify-content:center}#hero{display:flex;justify-content:center;position:relative;min-width:0}
    #inner{display:flex;width:100%;min-height:112px;align-items:flex-end;justify-content:center}
    #copy{display:flex;flex-direction:column;width:100%;align-items:center;gap:24px}
    [data-feature=game-source]{display:flex;max-width:100%;min-width:0;text-align:center;white-space:pre-wrap}
    #title{display:inline-block;max-width:100%}button{font:inherit;display:inline-block;max-width:100%;white-space:normal;overflow-wrap:break-word}
    #suggestions{position:absolute;top:100%}#dock{flex:1 0 0;display:flex;flex-direction:column;justify-content:flex-end;min-height:fit-content}
    form{height:120px;flex:none}textarea{width:100%;height:70px}
  </style><aside class="app-shell-left-panel"></aside><main>
  <div hidden id="cached"><div role="main"><div data-feature="game-source">Hidden old home</div></div></div>
  <div id="home" role="main"><div id="layout"><div id="contents"><div id="row"><div id="rail"><div id="hero"><div id="inner"><div id="copy">
  <div data-testid="home-icon"></div><div data-feature="game-source"><span id="title">我们应该在<button>kwaishop-lang-bridge-vault</button>中做些什么？</span></div>
  </div></div><div id="suggestions"><section class="group/home-suggestions"></section></div></div></div></div>
  <div id="dock"><form data-codex-composer-root><textarea></textarea></form></div></div></div></div>
  <div hidden id="conversation"><form><textarea></textarea></form></div></main>`);
  await page.evaluate(renderer);
  let cases=0;
  for(const direction of ['row','column']) for(const width of [800,1200,1700]) for(const height of [640,1000]) {
    await page.setViewportSize({width,height});
    await page.evaluate(d=>document.querySelector('#row').style.flexDirection=d,direction);
    for(const name of ['交接配齐环境','kwaishop-lang-bridge-vault','verylongprojectnamewithoutbreaks'.repeat(3)]) {
      await page.locator('#title button').evaluate((e,n)=>e.textContent=n,name);
      const layout=await page.evaluate(()=>{
        const r=id=>document.querySelector(id).getBoundingClientRect().toJSON();
        return {home:r('#home'),rail:r('#rail'),hero:r('#hero'),title:r('#home [data-feature=game-source]'),button:r('#title button')};
      });
      const label=JSON.stringify({direction,width,height,name});
      assert.ok(layout.rail.width >= layout.home.width - 4,`rail squeezed: ${label} ${JSON.stringify(layout)}`);
      for(const part of ['title','button']) {
        assert.ok(layout[part].left >= layout.hero.left && layout[part].right <= layout.hero.right,`${part} horizontal overflow: ${label} ${JSON.stringify(layout)}`);
        assert.ok(layout[part].top >= layout.hero.top && layout[part].bottom <= layout.hero.bottom,`${part} vertical overflow: ${label}`);
      }
      const inspection=await page.evaluate(INSPECTION_EXPRESSION);
      assert.equal(inspection.route,'home');
      if(inspection.homeLayout) assert.equal(inspection.homeLayout.status,'pass',JSON.stringify(inspection.homeLayout));
      cases++;
    }
  }
  // A control regression: force the historical narrow rail and ensure the live probe catches it.
  await page.setViewportSize({width:1700,height:1000});
  await page.addStyleTag({content:'#row{flex-direction:row!important}#rail{width:440px!important}#hero{height:200px!important}'});
  assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).homeLayout?.status,'warn','inspection must detect squeezed/overflowing home content');
  await page.evaluate(()=>{document.querySelector('#home').hidden=true;document.querySelector('#home').style.display='none';document.querySelector('#conversation').hidden=false;window.__CODEX_DREAM_SKIN_STATE__.ensure();});
  assert.equal((await verifySession({evaluate:expression=>page.evaluate(expression)})).homeRoute,false,'verification must ignore cached homepage too');
  assert.equal((await page.evaluate(INSPECTION_EXPRESSION)).route,'conversation','cached home must not masquerade as active homepage');
  assert.equal(await page.locator('.dream-skin-home').count(),0,'renderer must drop hidden home ownership');
  console.log(`PASS: ${cases} native row/column home layouts, three viewport widths, short/tall windows and long project names; clipping detector and cached-route cleanup.`);
} finally {await browser.close();}
