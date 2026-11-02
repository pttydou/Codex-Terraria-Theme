// Explicit, reversible UI navigation. Never sends messages or changes settings.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connectCodexTargets, verifySession, armOneShotExitFallback } from './injector.mjs';
import { parseArgs, preflight } from './inspect-skin.mjs';
import { INSPECTION_EXPRESSION } from './inspection/probe.mjs';
import { hasBlockingPopup } from './inspection/overlays.mjs';
export { hasBlockingPopup } from './inspection/overlays.mjs';
import { assessText, assessIcon, escapeHtml } from './inspection/report.mjs';
import { inspectScreenshotEdges, inspectScreenshotPopovers } from './inspection/png.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stateRoot = path.join(os.homedir(), 'Library/Application Support/CodexDreamSkinStudio');
export const SETTINGS_PAGES = [
  'general-settings', 'notifications', 'import', 'appearance', 'account', 'archived-chats',
  'parental-controls', 'trusted-contact', 'voice', 'storage', 'agent', 'personalization',
  'pets', 'keyboard-shortcuts', 'usage', 'data-controls', 'plugins-settings', 'passwords',
  'computer-use', 'chronicle', 'appshots', 'browser-use', 'cloud-computer', 'hooks-settings',
  'connections', 'codex-cloud', 'code-review', 'git-settings', 'worktrees',
];
const repeatedPages = ['general-settings', 'usage', 'appearance', 'pets'];

export function assessPageSamples(samples, expected = null) {
  if (samples.length !== 4 || samples.at(-1).elapsedMs - samples[0].elapsedMs < 2400) {
    return {status:'fail', detail:'四次延迟采样不完整'};
  }
  const route = expected === null ? 'home' : 'settings';
  if (samples.some(s => s.page.route !== route || s.page.settingsPage !== expected)) {
    return {status:'fail', detail:'没有到达预期页面或采样期间发生切页'};
  }
  if (samples.some(s => !s.verify.pass)) return {status:'fail', detail:'运行校验失败，查看对应 verify 证据'};
  if (samples.some(s => s.verify.documentOverflow?.x || s.verify.documentOverflow?.y
    || s.page.homeLayout?.status === 'warn')) return {status:'fail', detail:'文档或首页内部布局异常'};
  const low = samples.reduce((n,s) => n + s.text.filter(t=>t.status === 'warn').length,0);
  const unknown = samples.reduce((n,s) => n + s.text.filter(t=>t.status === 'unknown').length,0);
  const white = samples.some(s => s.edges?.status === 'warn'
    || s.pixels?.some(p=>p.status === 'warn') || s.page.insetSurfaces.some(x=>x.light));
  const seam = samples.some(s => s.page.sidebarEdge?.status === 'warn');
  const footer = samples.some(s => s.page.footerDecorations?.status === 'warn');
  return {status: low || white || seam || footer ? 'warn' : unknown ? 'review' : 'pass',
    detail:`低对比=${low}；浅色候选=${white}；侧栏接缝=${seam}；输入区黑边=${footer}；对比度待复核=${unknown}`};
}

export async function clickUi(session, selector, label = null) {
  const point = await session.evaluate(`(() => {
    const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e =>
      e.checkVisibility() && !e.disabled && e.getAttribute('aria-disabled') !== 'true'
      && (${JSON.stringify(label)} === null || (e.innerText || e.textContent).trim() === ${JSON.stringify(label)}));
    for (const e of candidates) {
      const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2, hit=document.elementFromPoint(x,y);
      if (r.width>0 && r.height>0 && x>=0 && y>=0 && x<innerWidth && y<innerHeight && (e===hit || e.contains(hit))) return {x,y};
    }
    return null;
  })()`);
  if (!point) throw new Error(`入口不存在或被遮挡：${selector}${label ? ' / '+label : ''}`);
  for (const type of ['mouseMoved','mousePressed','mouseReleased']) {
    await session.send('Input.dispatchMouseEvent', {type, ...point,
      ...(type === 'mouseMoved' ? {} : {button:'left',clickCount:1})});
  }
}

function renderReport(report) {
  const e=escapeHtml;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><style>body{background:#14202b;color:#f0ead6;font:16px/1.6 system-ui;max-width:1100px;margin:30px auto;padding:20px}td,th{border-bottom:1px solid #69737a;padding:8px;text-align:left}a{color:#8edbea}img{max-width:100%}</style><h1>首页与设置巡检</h1><p>Codex ${e(report.codexVersion || 'unknown')} · ${e(report.createdAt)} · 返回首页 ${report.restored}。已执行路径不代表全应用合格。</p><p>${e(report.error || '')}</p><table><tr><th>页面</th><th>状态</th><th>结果</th></tr>${report.results.map(r=>`<tr><td>${e(r.id)}</td><td>${e(r.status)}</td><td>${e(r.detail || '')} ${r.image ? `<a href="${e(r.image)}">截图</a>` : ''}</td></tr>`).join('')}</table><h2>仍须专项验证</h2><ul>${report.remaining.map(x=>`<li>${e(x)}</li>`).join('')}</ul>${report.results.filter(r=>r.image).map(r=>`<details><summary>${e(r.id)}</summary><img src="${e(r.image)}"></details>`).join('')}</html>`;
}

export async function runPages(options) {
  const saved=await fs.readFile(path.join(stateRoot,'state.json'),'utf8').then(JSON.parse).catch(()=>({}));
  const port=Number(options.port ?? process.env.CODEX_DREAM_SKIN_PORT ?? saved.port ?? 9341);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('无效 CDP 端口');
  const parent=path.join(options.reportRoot,'pages');
  await fs.mkdir(parent,{recursive:true,mode:0o700});
  const directory=await fs.mkdtemp(path.join(parent,new Date().toISOString().replace(/[:.]/g,'-')+'-'));
  const report={schema:1,createdAt:new Date().toISOString(),scope:'home-settings',completeAcceptance:false,
    results:[],error:null,restored:false,remaining:[
      '项目/模型等弹层：另运行 inspect:overlays', '实际快速聊天/独立 Mini 窗口',
      '文件左右与拖拽/全屏', '固定与随机环境资源', '音乐实际播放', '真实刷新首帧', '截图人工复核',
    ]};
  let connections=[], session, started=false, interrupted=false, expectedPage=null, signal=null;
  const onSignal=name=>{signal=name;};
  const sigint=()=>onSignal('SIGINT'), sigterm=()=>onSignal('SIGTERM');
  process.on('SIGINT',sigint); process.on('SIGTERM',sigterm);
  const persist=async()=>{
    await fs.writeFile(path.join(directory,'pages.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    await fs.writeFile(path.join(directory,'report.html'),renderReport(report),{mode:0o600});
  };
  const snapshot=()=>session.evaluate(INSPECTION_EXPRESSION);
  function assertPage(page, expected) {
    if (page.route !== (expected === null ? 'home' : 'settings') || page.settingsPage !== expected) {
      interrupted=true;
      throw new Error('页面已被切换；停止巡检并保留用户当前页面');
    }
    if (signal) throw new Error(`巡检已取消：${signal}`);
  }
  async function waitUntil(expression) {
    const start=Date.now();
    while (Date.now()-start<5000) {
      if (signal) throw new Error(`巡检已取消：${signal}`);
      if (await session.evaluate(expression)) return;
      await sleep(80);
    }
    throw new Error('页面没有在5秒内到达预期状态');
  }
  async function capture(id, expected=null) {
    const result={id,status:'fail',samples:[]}; report.results.push(result);
    const start=Date.now();
    let firstSampleAt=start;
    for (const t of [0,500,1200,2500]) {
      await sleep(Math.max(0,t-(Date.now()-firstSampleAt)));
      const page=await snapshot(); assertPage(page,expected);
      const verify=await verifySession(session);
      const text=[...page.controls.map(assessText),...page.popupText.map(assessText),...page.icons.map(assessIcon)];
      const sampledAt=Date.now();
      if (t===0) firstSampleAt=sampledAt;
      const row={elapsedMs:sampledAt-start,page,verify,text}; result.samples.push(row);
      if (t===0 || t===2500) {
        const shot=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const bytes=Buffer.from(shot.data,'base64'), file=`${id}-${t}.png`;
        await fs.writeFile(path.join(directory,file),bytes,{mode:0o600});
        row.edges=inspectScreenshotEdges(bytes);
        row.pixels=inspectScreenshotPopovers(bytes,page.popovers,page.viewport);
        result.image=file;
      }
    }
    Object.assign(result,assessPageSamples(result.samples,expected));
    await persist(); console.error(`${id}: ${result.status} ${result.detail}`);
  }
  async function home() {
    assertPage(await snapshot(),expectedPage);
    await clickUi(session,'button','首页');
    await waitUntil(`!![...document.querySelectorAll('[role="main"]')].find(e=>e.checkVisibility()&&e.querySelector('[data-feature="game-source"]'))`);
    expectedPage=null; assertPage(await snapshot(),null);
  }
  async function settings() {
    assertPage(await snapshot(),null);
    const draft=await session.evaluate(`!![...document.querySelectorAll('.dream-skin-composer-surface [contenteditable="true"],.dream-skin-composer-surface textarea')].find(e=>e.checkVisibility()&&(e.value||e.textContent||'').trim())`);
    if (draft) {interrupted=true; throw new Error('首页出现输入内容；停止切页并保留草稿');}
    await clickUi(session,'button[aria-label="打开个人资料菜单"],button[aria-label="Open profile menu"]');
    await waitUntil(`!![...document.querySelectorAll('[role="menu"]')].find(e=>e.checkVisibility())`);
    const label=await session.evaluate(`[...document.querySelectorAll('[role="menuitem"]')].filter(e=>e.checkVisibility()).map(e=>(e.innerText||e.textContent).trim()).find(t=>/^(设置|Settings)(\\s|$)/.test(t))`);
    if (!label) throw new Error('账户菜单缺少设置入口');
    await clickUi(session,'[role="menuitem"]',label);
    await waitUntil(`!!document.querySelector('[data-settings-panel-slug][aria-current="page"]')`);
    expectedPage=(await snapshot()).settingsPage;
  }
  async function page(slug,id) {
    assertPage(await snapshot(),expectedPage);
    const selector=`button[data-settings-panel-slug="${slug}"]`;
    if (!await session.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) {
      report.results.push({id,status:'untested',detail:'该版本未提供此入口'}); await persist(); return;
    }
    await session.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});true`);
    await clickUi(session,selector);
    await waitUntil(`!!document.querySelector(${JSON.stringify(selector+'[aria-current="page"]')})`);
    expectedPage=slug; await capture(id,slug);
    // Only scroll the owned settings content. Never scroll inputs, preview editors or navigation.
    assertPage(await snapshot(),slug);
    const scrolled=await session.evaluate(`(()=>{
      const candidates=[...document.querySelectorAll('.trskin-settings-content, .trskin-settings-content div')];
      const e=candidates.find(e=>e.checkVisibility()&&e.scrollHeight>e.clientHeight+40&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&!e.closest('form,[contenteditable="true"]'));
      if(!e)return false;e.scrollTop=e.scrollHeight;return true;
    })()`);
    if (scrolled) await capture(id+'-bottom',slug);
  }
  try {
    report.codexVersion=await preflight(port);
    connections=await connectCodexTargets(port,4000);
    const mains=connections.filter(c=>c.target.url==='app://-/index.html');
    if (mains.length!==1) throw new Error('必须只有一个主窗口');
    session=mains[0].session;
    const initial=await snapshot();
    report.initial={themeId:initial.themeId,environment:initial.environment,viewport:initial.viewport,route:initial.route,popupKinds:initial.popovers.map(p=>p.kind)};
    const draft=await session.evaluate(`!![...document.querySelectorAll('.ProseMirror, textarea')].find(e=>e.checkVisibility()&&(e.value||e.textContent||'').trim())`);
    if (initial.route!=='home' || draft || hasBlockingPopup(initial)) {
      throw new Error('请从没有草稿和弹层的项目新会话首页运行；不自动离开有内容的会话');
    }
    started=true; await capture('home-before');
    for (let round=1;round<=2;round++) {
      await settings();
      if (round===1) {
        report.discovered=await session.evaluate(`[...document.querySelectorAll('[data-settings-panel-slug]')].map(e=>e.getAttribute('data-settings-panel-slug'))`);
        for (const slug of report.discovered.filter(s=>!SETTINGS_PAGES.includes(s))) {
          report.results.push({id:'settings-'+slug,status:'untested',detail:'新增或外部入口，核实后再加入清单'});
        }
      }
      for (const slug of round===1 ? SETTINGS_PAGES : repeatedPages) await page(slug,`settings-${round}-${slug}`);
      await home(); await capture(`home-return-${round}`);
    }
  } catch (error) {report.error=String(error.message);}
  finally {
    // Never navigate back after user-driven route changes or typed input.
    if (started && session && !interrupted && !signal) {
      try {
        if (expectedPage!==null) await home();
        report.restored=(await snapshot()).route==='home';
      } catch(error) {report.restoreError=error.message;}
    }
    connections.forEach(c=>c.session.close());
    process.off('SIGINT',sigint); process.off('SIGTERM',sigterm);
    await persist();
  }
  const result={reportPath:path.join(directory,'report.html'),
    failed:Boolean(report.error)||!report.restored||report.results.some(r=>r.status==='fail'),
    review:report.results.some(r=>r.status!=='pass')||report.remaining.length>0,completeAcceptance:false};
  if (options.open) {
    try {await promisify(execFile)('/usr/bin/open',[result.reportPath],{timeout:5000});}
    catch {result.openError='报告已保存，但自动打开失败';}
  }
  return result;
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    const options=parseArgs(process.argv.slice(2));
    if (options.help) console.log('npm run inspect:pages -- [--port 9341] [--open]\n从无草稿的新会话首页开始，设置子页和底部巡检、往返两轮；执行期间不要操作客户端。未测不算通过。');
    else {
      const result=await runPages(options); console.log(JSON.stringify(result,null,2));
      process.exitCode=result.failed ? 1 : result.review ? 2 : 0;
    }
  } catch(error) {console.error(error.message); process.exitCode=1;}
  finally {armOneShotExitFallback();}
}
