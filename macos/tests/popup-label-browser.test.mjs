// ST-018: static quota headings must be readable and independently inspected.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { assessText } from '../scripts/inspection/report.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const css = await fs.readFile(process.env.BEFORE_CSS || new URL('../assets/dream-skin.css', import.meta.url), 'utf8');
try {
  const page = await browser.newPage({viewport:{width:1000,height:900}});
  await page.route('**/*', r=>r.abort());
  await page.setContent(`<!doctype html><html class="codex-dream-skin" data-dream-style="terraria" data-theme="light"><style>
    :root,[data-theme=light]{--app-color-text-foreground-tertiary:rgba(26,28,31,.495);
      --color-codex-description:var(--app-color-text-foreground-tertiary)}
    body{margin:0;background:#151124;color:#fff5d8;font:13px Arial}
    .text-codex-description{color:var(--color-codex-description)}
    #popup{position:fixed;left:50px;top:120px;width:320px;padding:12px;background:#23163b}
    #popup p,#popup h3{margin:8px 0}#popup button{padding:8px;border:0}
    #popup h3,#popup button span{pointer-events:none}
    .bg-primary-solid{background:var(--color-background-primary-solid,#eee);color:var(--color-text-primary-solid,#111)}
    .warning{color:rgb(255,138,132)}#preview{color:rgb(255,103,100)}
    #hidden{display:none}#clipped{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px}
    #covered{position:relative}#cover{position:absolute;inset:0;background:#23163b}
  </style><main><p>PRIVATE_CONVERSATION_SENTINEL</p></main>
  <div data-theme="light"><div id="popup" role="menu">
    <div class="text-codex-description" id="quota">额度来源：你的 Pro 套餐</div>
    <h3 class="text-codex-description">Plan details</h3>
    <p class="text-codex-description">Static description</p>
    <div role="menuitem">Weekly limit</div>
    <button class="bg-primary-solid"><span>Primary action</span></button>
    <p class="warning">Warning</p><p id="preview">Color preview</p>
    <div role="dialog" id="nested"><p class="text-codex-description">Nested description</p></div>
    <p id="hidden">HIDDEN_SENTINEL</p><span id="clipped">CLIPPED_SENTINEL</span>
    <p aria-hidden="true">ARIA_HIDDEN_SENTINEL</p>
    <fieldset disabled><p>DISABLED_SENTINEL</p></fieldset>
    <div inert><p>INERT_SENTINEL</p></div>
    <div contenteditable="true">DRAFT_SENTINEL</div>
    <div id="covered"><div class="text-codex-description">OCCLUDED_SENTINEL</div><div id="cover"></div></div>
  </div></div></html>`);
  const probe=()=>page.evaluate(INSPECTION_EXPRESSION);
  const native=await probe();
  assert.equal(native.popupText.length,6,'static text, including nested popup, counted once; hidden/disabled/draft/occluded excluded');
  assert.equal(native.controls.length,2,'control text must not be duplicated in static samples');
  assert.equal(native.popupText.map(assessText).filter(c=>c.status==='warn').length,4,'native quota/descriptions reproduce dark text');
  assert.ok(!JSON.stringify(native).includes('SENTINEL'),'report never stores text contents');
  const style=await page.addStyleTag({content:css});
  let cases=0;
  for(const [name,panel,accent] of [['forest','21 47 39','132 220 158'],['cavern','35 22 59','246 155 255'],['space','18 28 54','154 192 255']]) {
    await page.evaluate(({panel,accent})=>{document.documentElement.style.setProperty('--ds-panel-rgb',panel);document.documentElement.style.setProperty('--ds-accent-rgb',accent);},{panel,accent});
    for(const kind of ['menu','dialog','popover']) {
      await page.locator('#popup').evaluate((e,kind)=>{e.setAttribute('role',kind==='menu'?'menu':'dialog');if(kind==='popover')e.setAttribute('data-slot','popover-content');else e.removeAttribute('data-slot');},kind);
      for(let cycle=0;cycle<2;cycle++) {
        await page.locator('#popup').evaluate(e=>e.style.display='none');
        assert.equal((await probe()).popupText.length,0,'closed popup is not inspected');
        await page.locator('#popup').evaluate(e=>e.style.display='');
        const p=await probe(), text=[...p.popupText,...p.controls].map(assessText);
        assert.equal(p.popupText.length,6);
        assert.ok(text.every(c=>c.status==='pass'),`${name}/${kind}/${cycle}: ${JSON.stringify(text)}`);
        assert.equal(await page.locator('#preview').evaluate(e=>getComputedStyle(e).color),'rgb(255, 103, 100)');
        assert.equal(await page.locator('.warning').evaluate(e=>getComputedStyle(e).color),'rgb(255, 138, 132)');
        await page.locator('.bg-primary-solid').hover();
        await page.locator('.bg-primary-solid').focus();
        assert.ok((await probe()).controls.map(assessText).every(c=>c.status==='pass'),'primary button remains readable on hover/focus');
        cases++;
      }
    }
  }
  // Observe late rendering, not only the initial CSS application.
  for(const ms of [500,700,1300]) {
    await new Promise(r=>setTimeout(r,ms));
    assert.ok((await probe()).popupText.map(assessText).every(c=>c.status==='pass'));
  }
  // Real menus may blur their underlay. Do not turn uncertain measurements
  // into a passing WCAG ratio; the screenshot check remains mandatory.
  await page.locator('#popup').evaluate(e=>e.style.setProperty('backdrop-filter','blur(4px)','important'));
  assert.ok((await probe()).popupText.map(assessText).every(c=>c.status==='unknown'));
  await page.locator('#popup').evaluate(e=>e.style.removeProperty('backdrop-filter'));
  if(process.env.QUOTA_PREVIEW)await page.locator('#popup').screenshot({path:process.env.QUOTA_PREVIEW});
  await style.evaluate(e=>e.remove());
  assert.equal(await page.locator('#quota').evaluate(e=>getComputedStyle(e).color),'rgba(26, 28, 31, 0.494)','uninstall restores native color');
  // Lots of ordinary controls cannot exhaust the popup label budget.
  await page.locator('main').evaluate(e=>e.innerHTML='<div style="position:fixed;left:500px;top:0;width:480px;display:flex;flex-wrap:wrap">'+Array.from({length:170},()=>'<button style="width:45px;height:25px;padding:0">A</button>').join('')+'</div>');
  const busy=await probe();
  assert.equal(busy.controls.length,160);
  assert.equal(busy.totalTextRuns,172);
  assert.equal(busy.popupText.length,6);
  console.log(`PASS: ${cases} palette/popup/reopen cases; native dark-label detection, nested ownership, hidden/clipped/occluded/disabled/draft exclusions, primary/warning/preview colors, 2.5s delay, blur unknown, independent label budget and uninstall.`);
} finally {await browser.close();}
