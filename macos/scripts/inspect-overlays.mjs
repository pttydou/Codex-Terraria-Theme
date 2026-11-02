// Explicit interactive inspection: only opens allowlisted UI and dismisses it.
// No project/branch/model selection, final submit, file picker, or message send.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connectCodexTargets, armOneShotExitFallback } from './injector.mjs';
import { parseArgs, preflight } from './inspect-skin.mjs';
import { INSPECTION_EXPRESSION } from './inspection/probe.mjs';
import { hasBlockingPopup, transientPopups } from './inspection/overlays.mjs';
import { assessText, assessIcon, escapeHtml } from './inspection/report.mjs';
import { inspectScreenshotPopovers } from './inspection/png.mjs';
const stateRoot = path.join(os.homedir(), 'Library/Application Support/CodexDreamSkinStudio');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const overlaySelector = '[data-slot="popover-content"], [role="menu"], [role="dialog"], [role="alertdialog"]';
const projectReveal = '[class~="group/nav-section-title"]:has([data-app-action-sidebar-project-create])';
export const WALK_CASES = [
  { id:'project-picker', name:'输入框项目选择', selector:'[data-composer-navigation-target="workspace-project"]' },
  { id:'home-project-picker', name:'首页项目选择', selector:'.dream-skin-home button[data-slot="popover-trigger"]' },
  { id:'create-source', name:'添加项目：设备/来源', selector:'[data-app-action-sidebar-project-create]', revealSelector:projectReveal, source:true },
  { id:'create-form', name:'添加项目：项目名称和源文件夹', selector:'[data-app-action-sidebar-project-create]', revealSelector:projectReveal, next:true },
  { id:'project-icon', name:'添加项目：图标选择', selector:'[data-app-action-sidebar-project-create]', revealSelector:projectReveal, next:true, icon:true },
  ...[['run-location','运行位置'],['branch','分支菜单'],['permissions','权限菜单'],['reasoning','模型和推理菜单']]
    .map(([id,name])=>({id,name,selector:`[data-composer-navigation-target="${id}"]`})),
  { id:'profile-menu',name:'账户菜单',selector:'button[aria-label="打开个人资料菜单"], button[aria-label="Open profile menu"]' },
  { id:'usage-menu',name:'额度来源与用量说明',selector:'button[aria-label="用量"], button[aria-label="Usage"]', staticText:true },
];
async function waitForOverlay(session, predicate = 'true') {
  const start = Date.now();
  while (Date.now()-start < 2500) {
    if(await session.evaluate(`(()=>{const nodes=[...document.querySelectorAll(${JSON.stringify(overlaySelector)})].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width>0);return nodes.length>0 && (${predicate})})()`))return;
    await sleep(50);
  }
  throw new Error('点击后未发现预期弹层；入口可能已变更');
}
async function dismiss(session) {
  for(let i=0;i<4;i++) {
    if(!await session.evaluate(`!![...document.querySelectorAll(${JSON.stringify(overlaySelector)})].find(e=>e.checkVisibility()&&e.getBoundingClientRect().width>0)`))return;
    await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await sleep(100);
  }
  throw new Error('弹层没有关闭，已停止后续点击，请查看现场');
}
export async function clickSelector(session, selector, revealSelector = null) {
  // Some native sidebar actions have a zero-width, clipped parent until the
  // section is hovered. Reveal the section before measuring the button.
  if(revealSelector) {
    const hover=await session.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(revealSelector)})].find(e=>e.checkVisibility());if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    if(hover){await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});await sleep(120);}
  }
  const point = await session.evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility()&&!e.disabled&&e.getBoundingClientRect().width>0);if(!b)return null;const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(x<0||y<0||x>=innerWidth||y>=innerHeight)return null;return {x,y}})()`);
  if(!point)return false;
  // Radix menus open on pointerdown; HTMLElement.click() does not exercise it.
  await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await sleep(80);
  const hit=await session.evaluate(`(()=>{const top=document.elementFromPoint(${point.x},${point.y});return [...document.querySelectorAll(${JSON.stringify(selector)})].some(b=>b===top||b.contains(top))})()`);
  if(!hit)return false;
  await session.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  return true;
}
export async function advanceProjectForm(session) {
  const step=await session.evaluate(`(()=>{const d=[...document.querySelectorAll('.codex-dialog')].find(e=>e.checkVisibility());if(!d)return 'missing';if([...d.querySelectorAll('input')].some(e=>e.checkVisibility()))return 'form';const b=[...d.querySelectorAll('button[type="submit"]')].find(e=>e.checkVisibility()&&['下一步','Next'].includes(e.textContent.trim()));if(!b)return 'missing';b.click();return 'next';})()`);
  if(step==='missing')throw new Error('未发现项目表单或明确的“下一步”；不点击创建/提交');
  await waitForOverlay(session, `!![...document.querySelectorAll('.codex-dialog input')].find(e=>e.checkVisibility())`);
  return step;
}
async function openCase(session, item) {
  const found=await clickSelector(session,item.selector,item.revealSelector);
  if(!found)return false;
  await waitForOverlay(session);
  if(item.source) {
    // New Codex opens the form directly; its device picker replaces the old
    // local/remote first step. Opening it does not select a device or folder.
    const form=await session.evaluate(`!![...document.querySelectorAll('.codex-dialog input')].find(e=>e.checkVisibility())`);
    if(form) {
      if(!await clickSelector(session,'.codex-dialog button[aria-label="项目所在设备"], .codex-dialog button[aria-label="Project device"]'))throw new Error('项目表单缺少已知设备入口');
      await waitForOverlay(session,`!![...document.querySelectorAll('[role="menu"]')].find(e=>e.checkVisibility())`);
    }
  }
  if(item.next) await advanceProjectForm(session);
  if(item.icon) {
    const clicked=await session.evaluate(`(()=>{const b=document.querySelector('.codex-dialog button[data-slot="popover-trigger"]');if(!b)return false;b.click();return true})()`);
    if(!clicked)throw new Error('创建表单未发现图标选择入口');
    await waitForOverlay(session, `!!document.querySelector('[data-slot="popover-content"]')`);
  }
  return true;
}
function htmlReport(report) {
  const e=escapeHtml;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><title>皮肤交互巡检</title><style>body{background:#111c29;color:#e8e4cc;font:16px/1.7 system-ui;margin:32px auto;max-width:1000px;padding:0 20px}a{color:#b2e0cb}h1,h2{color:#dcc58d}img{max-width:100%}td,th{padding:12px;border-bottom:1px solid #4a5062;text-align:left}table{width:100%}</style><h1>皮肤交互巡检</h1><p>${e(report.createdAt)} · ${e(report.version)} · Codex ${e(report.codexVersion)}</p><p>已执行 ${report.results.filter(r=>r.status!=='未测').length}/${WALK_CASES.length} 个入口；未点击最终创建/选择/发送。通过只表示当前弹层采样未发现浅色问题，不代表整个应用合格。</p>${report.error?`<p>${e(report.error)}</p>`:''}<table><tr><th>路径</th><th>结果</th><th>证据</th></tr>${report.results.map(r=>`<tr><td>${e(r.name)}</td><td>${e(r.status)}</td><td>${e(r.detail||'')} ${r.screenshot?`<a href="${e(r.screenshot)}">截图</a>`:''}</td></tr>`).join('')}</table><h2>仍需复核</h2><p>每个入口采样约 0/500/1200/2500ms，检测背景像素、内部大块纯色面板和可计算文字/图标对比度。渐变/图片/伪元素文字以及实际业务结果不自动判合格；设置子页、快速聊天、刷新时序、文件选择器未覆盖。</p>${report.results.filter(r=>r.screenshot).map(r=>`<details><summary>${e(r.name)}</summary><img src="${e(r.screenshot)}"></details>`).join('')}<p><a href="walk.json">原始检查结果</a></p></html>`;
}
export async function runWalk(options) {
  const saved=await fs.readFile(path.join(stateRoot,'state.json'),'utf8').then(JSON.parse).catch(()=>({}));
  const port=Number(options.port??process.env.CODEX_DREAM_SKIN_PORT??saved.port??9341);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('无效 CDP 端口');
  const reportRoot=path.join(options.reportRoot,'walks');
  await fs.mkdir(reportRoot,{recursive:true,mode:0o700});
  const createdAt=new Date().toISOString(), directory=await fs.mkdtemp(path.join(reportRoot,createdAt.replace(/[:.]/g,'-')+'-'));
  const report={createdAt,version:(await fs.readFile(path.join(root,'VERSION'),'utf8')).trim(),codexVersion:null,results:[],error:null};
  let cs=[], session, ownsOverlay=false;
  const persist=async()=>{
    await fs.writeFile(path.join(directory,'walk.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    await fs.writeFile(path.join(directory,'report.html'),htmlReport(report),{mode:0o600});
  };
  try {
    report.codexVersion=await preflight(port);
    cs=await connectCodexTargets(port,4000);const main=cs.filter(c=>c.target.url==='app://-/index.html');
    if(main.length!==1)throw new Error('需要唯一 Codex 主窗口');
    session=main[0].session;
    const initial=await session.evaluate(INSPECTION_EXPRESSION);
    if(hasBlockingPopup(initial))throw new Error('已有弹层打开，未改动现场。请先关闭弹层再运行交互巡检');
    if(!initial.themeId)throw new Error('未检测到运行中的皮肤');
    report.themeId=initial.themeId;
    for(const item of WALK_CASES) {
      const result={id:item.id,name:item.name,status:'未测',samples:[]};
      report.results.push(result);
      try {
        ownsOverlay=true;
        if(!await openCase(session,item)){result.detail='当前页面未找到入口';continue;}
        const start=Date.now();
        for(const t of [0,500,1200,2500]) {
          await sleep(Math.max(0,t-(Date.now()-start)));
          const page=await session.evaluate(INSPECTION_EXPRESSION);
          page.popovers=transientPopups(page);
          if(!page.popovers.length||page.themeId!==initial.themeId||page.route!==initial.route)throw new Error('采样中页面或弹层被改变，请停止操作后重测');
          if(item.staticText&&!page.popupText.length)throw new Error('没有采到额度弹层说明文字，不能将空结果算通过');
          const controls=[...page.controls,...page.popupText].filter(c=>page.popovers.some(p=>c.rect.x>=p.rect.x && c.rect.y>=p.rect.y && c.rect.x<p.rect.x+p.rect.width && c.rect.y<p.rect.y+p.rect.height)).map(assessText);
          result.samples.push({elapsedMs:Date.now()-start,viewport:page.viewport,popovers:page.popovers,icons:page.icons.map(assessIcon).map(({layers,...c})=>c),controls:controls.map(({layers,...c})=>c),insetSurfaces:page.insetSurfaces});
          if(t===0||t===2500) {
            const shot=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64');
            const file=`${item.id}-${t}.png`;await fs.writeFile(path.join(directory,file),bytes,{mode:0o600});
            result.samples.at(-1).pixels=inspectScreenshotPopovers(bytes,page.popovers,page.viewport);
            if(t===2500)result.screenshot=file;
          }
        }
        const low=result.samples.flatMap(s=>s.controls).filter(c=>c.status==='warn');
        const unknown=result.samples.flatMap(s=>s.controls).filter(c=>c.status==='unknown');
        const badIcons=result.samples.flatMap(s=>s.icons).filter(c=>c.status==='warn');
        const unknownIcons=result.samples.flatMap(s=>s.icons).filter(c=>c.status==='unknown');
        const white=result.samples.some(s=>s.pixels?.some(p=>p.status==='warn') || s.insetSurfaces?.some(p=>p.light));
        result.status=white||low.length||badIcons.length?'疑似问题':'已检查';
        result.detail=`浅色面板=${white}；低对比文字=${low.length}；文字待复核=${unknown.length}；低对比图标=${badIcons.length}；图标待复核=${unknownIcons.length}`;
      } catch(error) {result.status='失败';result.detail=error.message;}
      finally {await persist();await dismiss(session);ownsOverlay=false;}
    }
  } catch(error) {report.error=error.message;}
  finally {
    if(ownsOverlay&&session)await dismiss(session).catch(error=>{report.error=error.message;});
    cs.forEach(c=>c.session.close());
    for(const item of WALK_CASES)if(!report.results.some(r=>r.id===item.id))report.results.push({id:item.id,name:item.name,status:'未测',detail:'巡检未到达此入口'});
    await persist();
  }
  const result={reportPath:path.join(directory,'report.html'),completed:report.results.filter(r=>r.status==='已检查').length,total:WALK_CASES.length,failed:Boolean(report.error)||report.results.some(r=>['失败','疑似问题','未测'].includes(r.status))};
  if(options.open)await promisify(execFile)('/usr/bin/open',[result.reportPath]);
  return result;
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)) {
 try {const options=parseArgs(process.argv.slice(2));if(options.help)console.log('交互巡检：会依次打开并关闭项目、创建表单、图标、分支、权限、模型与账户入口。请先关闭弹层并保持页面不动。参数：--port / --open / --report-root。');else{const r=await runWalk(options);console.log(JSON.stringify(r,null,2));if(r.failed&&!options.console)process.exitCode=2;}}
 catch(error){console.error(error.message);process.exitCode=1;}
 finally{armOneShotExitFallback();}
}
