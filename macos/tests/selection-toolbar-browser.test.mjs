// Real body portal from Codex 26.901, without conversation content.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { assessText } from '../scripts/inspection/report.mjs';
import { inspectScreenshotPopovers } from '../scripts/inspection/png.mjs';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const css=await fs.readFile(new URL('../assets/dream-skin.css',import.meta.url),'utf8');
try {
  const page=await browser.newPage({viewport:{width:900,height:600}});
  await page.route('**/*',r=>r.abort());
  await page.setContent(`<html class="codex-dream-skin" data-dream-style="terraria"><style>
    body{margin:0;background:#171525;color:#fff5d8;font:14px Arial}
    main{padding:20px}#portal{position:fixed;left:200px;top:220px}
    [role=presentation]{display:flex;width:max-content;overflow:hidden;border:1px solid #ccc;border-radius:8px;background:oklab(.999994 .000045 .000020 / .9);backdrop-filter:blur(8px)}
    button{padding:6px;font:14px Arial;background:transparent;color:#fff5d8;border:0}
    .bg-border{width:1px;background:#ddd}button:hover{background:rgba(26,28,31,.08)}
    #unrelated{background:white;color:black;padding:12px}
  </style><main><p id="text">Select this fixture text to open the contextual actions.</p><div id="unrelated">Unrelated content</div></main>
  <div id="portal"><div role="presentation" class="pointer-events-auto flex w-fit max-w-full overflow-hidden rounded-lg border border-border/70 bg-surface-elevated-secondary/90 shadow-lg backdrop-blur-sm">
    <button>添加到对话</button><div aria-hidden="true" class="bg-border"></div><button>更多详情</button><div aria-hidden="true" class="bg-border"></div><button>在侧边聊天中提问</button>
  </div></div></html>`);
  const inspect=async()=>{
    const s=await page.evaluate(INSPECTION_EXPRESSION), p=s.popovers.filter(p=>p.kind==='selection-actions');
    assert.equal(p.length,1);
    return {s,p,pixels:inspectScreenshotPopovers(await page.screenshot(),p,s.viewport),text:s.controls.map(assessText)};
  };
  assert.equal((await inspect()).pixels[0].status,'warn','white presentation portal must be detected');
  await page.addStyleTag({content:css});
  for(const variant of ['forest-night','hallow','spider-nest']) {
    await page.evaluate(v=>document.documentElement.setAttribute('data-dream-variant',v),variant);
    for(const state of ['default','hover','focus']) {
      if(state==='hover')await page.locator('#portal button').nth(1).hover();
      if(state==='focus') {await page.mouse.move(10,10);await page.locator('#portal button').nth(2).focus();}
      const r=await inspect();assert.equal(r.pixels[0].status,'pass');assert.equal(r.text.length,3);
      assert.ok(r.text.every(c=>c.status==='pass'),JSON.stringify({variant,state,text:r.text}));
      assert.equal(await page.locator('#portal [role=presentation]').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
      await page.locator('#portal button').nth(2).blur();await page.mouse.move(10,10);
    }
  }
  await page.evaluate(()=>{window.submits=0;document.querySelectorAll('#portal button').forEach(b=>b.addEventListener('click',()=>window.submits++));document.addEventListener('selectionchange',()=>document.querySelector('#portal').hidden=!window.getSelection().toString());});
  for(let i=0;i<2;i++) {
    await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#text'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);});
    await page.locator('#portal').waitFor({state:'visible'});
    assert.equal((await inspect()).pixels[0].status,'pass');
    await page.evaluate(()=>window.getSelection().removeAllRanges());await page.locator('#portal').waitFor({state:'hidden'});
  }
  assert.equal(await page.evaluate(()=>window.submits),0);
  assert.equal(await page.locator('#unrelated').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  console.log('PASS: original white portal detected; three palettes x default/hover/focus readable; selection reopen/dismiss retains skin, no action invoked, unrelated background unchanged.');
} finally {await browser.close();}
