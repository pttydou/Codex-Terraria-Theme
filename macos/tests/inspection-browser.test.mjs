// Optional integration test in an isolated Chrome process, never the user's CDP.
// Set PLAYWRIGHT_MODULE to an installed playwright-core entry, CHROME_PATH if needed.
import assert from 'node:assert/strict';
import { INSPECTION_EXPRESSION } from '../scripts/inspection/probe.mjs';
import { hasBlockingPopup, transientPopups } from '../scripts/inspection/overlays.mjs';
import { clickSelector, WALK_CASES, advanceProjectForm } from '../scripts/inspect-overlays.mjs';
import { assessText } from '../scripts/inspection/report.mjs';
import { inspectScreenshotEdges } from '../scripts/inspection/png.mjs';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to run the isolated browser fixtures');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.route('**/*', route => route.abort());
  await page.setContent(`<!doctype html><style>
    body {margin:0;background:#111;color:white;min-height:700px;font:16px Arial}
    button {display:block;margin:16px;padding:14px;color:white;background:black;border:0;font:16px Arial}
    #bad {background:white;color:white} #good {background:white;color:black}
    #fill {background:white;color:black;-webkit-text-fill-color:white}
    #gradient {background:linear-gradient(black,#555)} #alpha {color:rgba(255,255,255,.1)}
    #hidden {display:none} #clip {position:absolute;width:1px;height:1px;clip:rect(0,0,0,0)}
    #image {background-image:url(data:image/png;base64,c2VjcmV0)}
    input {margin:16px} .dream-skin-composer-surface {width:80%;background:#222}
  </style><main data-trskin-main-surface>
    <button id="bad">White on white</button><button id="good"><span>Readable</span></button>
    <button id="fill">Text fill overrides color</button><button id="gradient">Gradient</button>
    <button id="alpha">Low opacity</button><button disabled>Disabled</button>
    <button id="hidden">Hidden</button><button id="image">Image</button>
    <button><span id="clip">Accessibility only</span><svg width="20" height="20"></svg></button>
    <div class="dream-skin-composer-surface"><input id="focus"></div></main>`);
  await page.locator('#focus').focus();
  await page.mouse.move(300, 600);
  await page.evaluate(() => { window.events = []; for (const type of ['keydown','mousemove','blur']) document.addEventListener(type,e=>window.events.push(e.type),true); });
  const snapshot = await page.evaluate(INSPECTION_EXPRESSION);
  const byIndex = i => snapshot.controls.filter(c => c.component === `button[${i}]`).map(assessText);
  assert.equal(byIndex(0)[0].status,'warn');
  assert.equal(byIndex(1)[0].status,'pass');
  assert.equal(byIndex(2)[0].status,'warn');
  assert.equal(byIndex(3)[0].status,'unknown');
  assert.equal(byIndex(4)[0].status,'warn');
  assert.equal(byIndex(5).length,0); assert.equal(byIndex(6).length,0); assert.equal(byIndex(8).length,0);
  assert.equal(snapshot.surfaces.main.count,1); assert.equal(snapshot.surfaces.composer.count,1);
  assert.ok(!JSON.stringify(snapshot).includes('c2VjcmV0'));
  assert.ok(!JSON.stringify(snapshot).includes('White on white'));
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'focus');
  console.log('PASS: real DOM contrast, text-fill, transparency, gradient, disabled/hidden/clipped labels, markers, redaction, focus and events.');
  const before = snapshot.surfaces.main.appearance.font;
  await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>{document.querySelector('main').style.fontFamily='monospace';resolve();},100)));
  assert.notEqual((await page.evaluate(INSPECTION_EXPRESSION)).surfaces.main.appearance.font,before);
  await page.addStyleTag({ content:'html {border-left:4px solid white}' });
  const pixels=inspectScreenshotEdges(await page.screenshot());
  assert.equal(pixels.status,'warn'); assert.ok(pixels.candidates.some(c=>c.side==='left'));
  console.log('PASS: delayed font and actual Chrome white-border screenshot.');
  await page.setContent(`<style>body{margin:0}[role=toolbar]{height:44px}#popup{position:absolute;top:80px;padding:20px}#hidden{display:none}</style>
    <div role="toolbar"><button>Persistent titlebar</button></div>
    <div id="hidden" role="dialog">Cached dialog</div>`);
  let portals=await page.evaluate(INSPECTION_EXPRESSION);
  assert.equal(portals.popovers.length,1,'visual probe still observes native toolbar');
  assert.equal(hasBlockingPopup(portals),false,'persistent toolbar must not block a walk');
  assert.equal(transientPopups(portals).length,0,'toolbar alone cannot pass an opened-popup check');
  await page.locator('body').evaluate(e=>e.insertAdjacentHTML('beforeend','<div id="popup" role="menu">Quota label</div>'));
  for(const role of ['menu','dialog','alertdialog']) {
    await page.locator('#popup').evaluate((e,role)=>e.setAttribute('role',role),role);
    portals=await page.evaluate(INSPECTION_EXPRESSION);
    assert.equal(hasBlockingPopup(portals),true);
    assert.equal(transientPopups(portals).length,1);
    assert.equal(transientPopups(portals)[0].kind,role);
  }
  await page.locator('#popup').evaluate(e=>{e.setAttribute('role','presentation');e.className='bg-surface-elevated-secondary';e.innerHTML='<button>Selection action</button>';});
  portals=await page.evaluate(INSPECTION_EXPRESSION);
  assert.equal(hasBlockingPopup(portals),true,'selection portal remains protected');
  assert.equal(transientPopups(portals)[0].kind,'selection-actions');
  await page.locator('#popup').evaluate(e=>e.remove());
  assert.equal(hasBlockingPopup(await page.evaluate(INSPECTION_EXPRESSION)),false);
  console.log('PASS: persistent toolbar stays visible to inspection, cannot block/start a popup walk, real menus/dialogs/selection portals remain protected.');
  await page.setContent(`<style>body{margin:0}.header{position:absolute;left:10px;top:50px;width:250px;display:flex;justify-content:space-between}
    .actions{width:0;overflow:hidden;pointer-events:none}.header:hover .actions{width:60px;pointer-events:auto}
    .actions button{width:60px}#decoy{position:absolute;left:260px;top:50px;width:100px;height:30px}</style>
    <button id="decoy">Unrelated</button><div class="header group/nav-section-title"><span>Projects</span>
    <div class="actions"><button data-app-action-sidebar-project-create>Add</button></div></div>`);
  await page.evaluate(()=>{window.clicked=[];document.querySelectorAll('button').forEach(b=>b.onclick=()=>window.clicked.push(b.id||'create'));});
  await page.mouse.move(400,400);
  const cdp=await page.context().newCDPSession(page);
  const session={evaluate:expression=>page.evaluate(expression),send:(method,args)=>cdp.send(method,args)};
  const create=WALK_CASES.find(c=>c.id==='create-source');
  assert.equal(await clickSelector(session,create.selector),false,'clipped stale button position must not click underlying content');
  assert.deepEqual(await page.evaluate(()=>window.clicked),[]);
  assert.equal(await clickSelector(session,create.selector,create.revealSelector),true);
  assert.deepEqual(await page.evaluate(()=>window.clicked),['create'],'real hover reveals and remeasures before one authorized click');
  await cdp.detach();
  console.log('PASS: hover-only sidebar action is revealed before measuring; hidden stale coordinates never click neighboring content.');
  await page.setContent('<div class="codex-dialog" role="dialog"><input aria-label="Project name"><button type="submit">创建项目</button></div>');
  await page.evaluate(()=>{window.submits=0;document.querySelector('button').onclick=()=>window.submits++;});
  assert.equal(await advanceProjectForm(session),'form','new one-step form requires no Next click');
  assert.equal(await page.evaluate(()=>window.submits),0);
  await page.locator('input').evaluate(e=>e.remove());
  await assert.rejects(advanceProjectForm(session),/不点击创建/);
  assert.equal(await page.evaluate(()=>window.submits),0,'unknown flow must never click final submit');
  await page.locator('button').evaluate(e=>{e.textContent='Next';e.onclick=()=>{window.submits++;e.insertAdjacentHTML('beforebegin','<input aria-label="Project name">');};});
  assert.equal(await advanceProjectForm(session),'next','legacy explicit Next flow still supported');
  assert.equal(await page.evaluate(()=>window.submits),1);
  console.log('PASS: direct and legacy project forms supported; missing Next never becomes final submit.');
  if(process.env.INSPECTION_REPORT) {
    await page.unroute('**/*');
    await page.goto(new URL(`file://${process.env.INSPECTION_REPORT}`).href);
    await page.waitForLoadState('load');
    assert.equal(await page.locator('tbody tr').count(),10);
    assert.equal(await page.locator('img').count(),2);
    assert.equal(await page.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(process.env.REPORT_PREVIEW) await page.screenshot({path:process.env.REPORT_PREVIEW});
    await page.setViewportSize({width:560,height:800});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    console.log('PASS: report loads both local screenshots; desktop/narrow layouts do not overflow.');
  }
} finally { await browser.close(); }
