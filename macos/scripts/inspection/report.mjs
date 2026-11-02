import { summarizeCompatibility } from '../injector.mjs';
import { assessGeometry } from './geometry.mjs';

export function parseColor(value) {
  if (value === 'transparent') return [0, 0, 0, 0];
  const match = /^rgba?\(([^)]+)\)$/.exec(value || '');
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,\/]+/);
  if (parts.length < 3 || parts.length > 4) return null;
  const color = parts.map((part, i) => parseFloat(part) * (part.endsWith('%') ? (i === 3 ? 0.01 : 2.55) : 1));
  if (color.length === 3) color.push(1);
  return color.every((v, i) => Number.isFinite(v) && v >= 0 && v <= (i === 3 ? 1 : 255)) ? color : null;
}
export function composite(front, back) {
  const alpha = front[3] + back[3] * (1 - front[3]);
  return [0, 1, 2].map(i => alpha ? (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0).concat(alpha);
}
export function backgroundFor(layers = []) {
  // Ancestor opacity/filter affect even opaque descendants. Unknown is safer
  // than claiming WCAG contrast from a color hidden under a gradient/image.
  if (layers.some(layer => layer.complex)) return null;
  let accumulated = [0, 0, 0, 0];
  for (const layer of layers) {
    if (accumulated[3] >= 0.999) return accumulated;
    if (layer.image && layer.image !== 'none') return null;
    const color = parseColor(layer.color);
    if (!color) return null;
    accumulated = composite(accumulated, color);
  }
  return accumulated[3] >= 0.999 ? accumulated : null;
}
export function luminance(color) {
  return color.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function assessContrast(control, threshold) {
  const bg = backgroundFor(control.layers), fg = parseColor(control.foreground);
  if (!bg || !fg) return { ...control, status: 'unknown', ratio: null };
  const a = luminance(composite(fg, bg)), b = luminance(bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return { ...control, ratio: Math.round(ratio * 100) / 100, threshold, status: ratio >= threshold ? 'pass' : 'warn' };
}
export function assessText(control) {
  return assessContrast(control, control.fontSize >= 24 || (control.fontSize >= 18.66 && control.fontWeight >= 700) ? 3 : 4.5);
}
export function assessIcon(control) { return assessContrast(control, 3); }
const cases = [
  ['endpoint', '连接到真实 Codex 主窗口', 10, 'ST-003'],
  ['runtime', '运行版本和暂存主题一致', 15, 'ST-007'],
  ['contract', '适配器、样式和安全模式', 15, 'ST-001 / ST-004'],
  ['markers', '当前路由的关键标记唯一', 10, 'ST-001'],
  ['overflow', '页面没有横纵溢出', 10, 'ST-005 / ST-006'],
  ['stability', '2.5 秒内字体、表面与逐帧布局稳定', 10, 'ST-001 / ST-004 / ST-010'],
  ['contrast', '控件、弹层说明文字与图标对比度', 10, 'ST-002 / ST-009 / ST-011 / ST-018'],
  ['edges', '窗口边缘、侧栏/输入区接缝与弹层候选', 5, 'ST-005 / ST-006 / ST-009 / ST-011 / ST-016 / ST-017'],
  ['decoration', 'Terraria 音乐和伙伴入口', 10, 'ST-007'],
  ['evidence', '首末截图和连续采样证据', 5, 'ST-003'],
];
export const UNTESTED = [
  '源码测试、doctor/payload（使用 npm test、npm run doctor 单独执行）',
  '新会话进入过程和发送前后变化', '设置各子页、悬停及弹窗交互', '快速聊天打开/关闭生命周期',
  '森林、洞穴、太空等环境切换', '音乐实际播放、暂停及伙伴交互',
  '刷新后的首帧与 5/8 秒延迟', '图片、渐变、伪元素和阴影下的文字及全部白边人工复核',
];
export function contextKey(sample) {
  if (!sample?.page || !sample.verify) return null;
  const p = sample.page;
  if (p.route === 'settings' && !p.settingsPage) return null;
  return JSON.stringify([p.route, p.settingsPage, p.themeId, p.environment, p.style, p.viewport,
    p.workspace,
    (p.popovers || []).map(popup => [popup.kind, popup.rect])]);
}
function signature(sample) {
  const v = sample.verify, p = sample.page;
  return JSON.stringify({ surfaces: Object.fromEntries(Object.entries(p.surfaces).map(([name, s]) => [name, [s.count, s.appearance, s.rect]])),
    controls: p.controls.map(c => [c.component, c.foreground, c.fontFamily, c.fontSize, c.layers]),
    popupText: p.popupText,
    popovers: p.popovers,
    icons: p.icons,
    version: v.version, installed: v.installed, styleEnabled: v.styleEnabled,
    safety: v.frontendCompatibility?.safety?.mode, fonts: p.fontsStatus,
    composerCount: v.visibleComposerMarkerCount });
}
export function assessRun(raw, previous = null) {
  const checks = cases.map(([id, title, weight, notebook]) => ({ id, title, weight, notebook, status: 'untested', detail: '未取得可用证据' }));
  const put = (id, status, detail) => Object.assign(checks.find(c => c.id === id), { status, detail });
  const samples = raw.samples || [], last = samples.at(-1);
  put('endpoint', raw.connected ? 'pass' : 'fail', raw.connected ? '已验证进程身份，仅检查 app://-/index.html 主窗口' : raw.error || '无法连接主窗口；请先从皮肤控制台启动皮肤');
  const compatibility = last ? summarizeCompatibility({ installed: last.verify.installed, skinVersion: last.verify.version,
    styleEnabled: last.verify.styleEnabled, frontendCompatibility: last.verify.frontendCompatibility }, raw.version) : null;
  let contrast = [], brightEdges = [];
  if (last) {
    const p = last.page;
    put('runtime', samples.some(s => !s.verify.installed || s.verify.version !== raw.version || (raw.expectedThemeId && s.page.themeId !== raw.expectedThemeId)) ? 'fail' : raw.expectedThemeId ? 'pass' : 'unknown',
      `磁盘 ${raw.version}；运行 ${last.verify.version || '未注入'}；暂存主题 ${raw.expectedThemeId || '未知'}；运行主题 ${p.themeId || '未知'}`);
    const actions = samples.map(s => summarizeCompatibility({ installed: s.verify.installed, skinVersion: s.verify.version,
      styleEnabled: s.verify.styleEnabled, frontendCompatibility: s.verify.frontendCompatibility }, raw.version).recommendedAction);
    const severe = actions.filter(a => !['none', 'inspect-fallback', 'wait-and-recheck'].includes(a));
    put('contract', severe.length ? 'fail' : actions.some(a => a !== 'none') ? 'warn' : 'pass', `建议：${[...new Set(actions)].join(', ')}；末次安全模式 ${last.verify.frontendCompatibility?.safety?.mode || '未知'}`);
    const requiredMissing = samples.some(s => {
      const adapters = s.verify.frontendCompatibility?.adapters;
      if (!adapters) return true;
      return ['main', 'composer'].some(name => adapters[name]?.required && s.page.surfaces[name]?.count !== 1)
        || s.page.surfaces.main.count > 1 || s.page.surfaces.composer.count > 1
        || (s.page.route === 'settings' && s.page.surfaces.settings.count !== 1);
    });
    put('markers', requiredMissing ? 'fail' : 'pass', `可见 main=${p.surfaces.main.count} / composer=${p.surfaces.composer.count} / settings=${p.surfaces.settings.count}；按各次路由 required 判断`);
    put('overflow', samples.some(s => s.verify.documentOverflow.x || s.verify.documentOverflow.y || s.page.homeLayout?.status === 'warn') ? 'fail' : 'pass', `末次横向=${last.verify.documentOverflow.x}，纵向=${last.verify.documentOverflow.y}；首页布局=${p.homeLayout?.issues?.join(', ') || '无已知异常'}`);
    const enough = samples.length === 4 && last.elapsedMs - samples[0].elapsedMs >= 2400;
    const sameContext = Boolean(contextKey(last)) && samples.every(s => contextKey(s) === contextKey(last));
    const stable = samples.every(s => signature(s) === signature(last));
    const geometry = assessGeometry(raw.geometry);
    put('stability', !enough ? 'untested' : !sameContext || geometry.status === 'unknown' ? 'unknown'
      : stable && p.fontsStatus === 'loaded' && geometry.status === 'pass' ? 'pass' : 'warn',
      !sameContext ? '采样期间路由、窗口或环境发生变化，请在同一页面重测'
        : `实际采样时间：${samples.map(s => s.elapsedMs).join('/')} ms；${stable ? '关键表面未变化' : '关键表面有变化'}；${geometry.detail}；不代表刷新首帧通过`);
    contrast = samples.flatMap(s => [
      ...s.page.controls.map(c => ({ ...assessText(c), kind:'text', elapsedMs: s.elapsedMs })),
      ...(s.page.popupText || []).map(c => ({ ...assessText(c), kind:'popup-text', elapsedMs: s.elapsedMs })),
      ...(s.page.icons || []).map(c => ({ ...assessIcon(c), kind:'icon', elapsedMs: s.elapsedMs })),
    ]);
    const low = contrast.filter(c => c.status === 'warn'), unknown = contrast.filter(c => c.status === 'unknown');
    const truncated = samples.some(s => s.page.totalTextRuns > s.page.controls.length
      || s.page.totalPopupTextRuns > (s.page.popupText?.length || 0) || s.page.totalIconPaints > s.page.icons?.length);
    put('contrast', low.length ? 'warn' : unknown.length || truncated || !contrast.length ? 'unknown' : 'pass',
      `四次共 ${contrast.length} 个文字/图标样本：低于阈值 ${low.length}，背景不可计算 ${unknown.length}${truncated ? '，超出采样上限' : ''}。图片/渐变需看截图`);
    const imageEdges = raw.imageEdges || [];
    brightEdges = imageEdges.flatMap(s => (s.candidates || []).map(c => ({ screenshot: s.screenshot, ...c })));
    const popoverFindings = imageEdges.flatMap(s => (s.popovers || []).map(c => ({ screenshot: s.screenshot, ...c })));
    brightEdges.push(...popoverFindings.filter(c => c.status === 'warn'));
    brightEdges.push(...samples.flatMap(s => (s.page.insetSurfaces || []).filter(p => p.light)
      .map(p => ({ ...p, kind: 'dialog-inset', elapsedMs:s.elapsedMs }))));
    const sidebarSeams = samples.filter(s => s.page.sidebarEdge?.status === 'warn');
    const footerSeams = samples.filter(s => s.page.footerDecorations?.status === 'warn');
    put('edges', brightEdges.length || sidebarSeams.length || footerSeams.length ? 'warn' : imageEdges.length !== 2 || imageEdges.some(s => s.status === 'unknown')
      || popoverFindings.some(c => c.status === 'unknown') ? 'unknown' : 'pass',
      `首末截图浅色候选 ${brightEdges.length}；侧栏外延背景异常 ${sidebarSeams.length} 次；输入区外围背景异常 ${footerSeams.length} 次；检查外缘 0/2/8 像素和 ${popoverFindings.length} 个可见弹层样本。未打开的弹层、普通内部白框和其他深蓝异常未覆盖`);
    put('decoration', p.style !== 'terraria' ? 'unknown' : samples.every(s => s.page.musicButton && s.page.companionCount > 0 && !['error', null].includes(s.page.musicState)) ? 'pass' : 'warn',
      `音乐状态 ${p.musicState || '未知'}，音乐入口 ${p.musicButton ? '存在' : '缺失'}，可见伙伴容器 ${p.companionCount}；未测试播放/点击`);
  }
  put('evidence', raw.screenshots?.length === 2 && samples.length === 4 ? 'pass' : 'fail', `保存 ${samples.length}/4 次采样、${raw.screenshots?.length || 0}/2 张截图${raw.error ? `；${raw.error}` : ''}`);
  const key = contextKey(last);
  const comparable = Boolean(key && previous?.comparisonKey === key && previous?.schema === 1);
  const regressions = comparable ? checks.filter(c => ['fail', 'warn'].includes(c.status)
    && previous.checks?.find(old => old.id === c.id)?.status === 'pass').map(c => c.id) : [];
  return { schema: 1, createdAt: raw.createdAt, version: raw.version, codexVersion: raw.codexVersion,
    scope: '当前主窗口自动抽检；不是完整验收', score: checks.filter(c => c.status === 'pass').reduce((n, c) => n + c.weight, 0),
    verdict: checks.some(c => c.status === 'fail') ? '发现故障' : checks.every(c => c.status === 'pass') ? '自动项通过，仍需完整验收' : '需要复核或补测',
    completeAcceptance: false, comparisonKey: key, baseline: comparable ? previous.createdAt : null,
    regressions, checks, untested: UNTESTED, compatibility,
    contrastFindings: contrast.filter(c => c.status !== 'pass').map(({ layers, ...c }) => c), brightEdges,
    screenshots: raw.screenshots || [], route: last?.page.route || '未连接', environment: last?.page.environment || null };
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = { pass: '通过', fail: '失败', warn: '疑似问题', unknown: '待复核', untested: '未测' };
export function renderHtml(report) {
  const e = escapeHtml;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><title>Codex 皮肤检验报告</title>
<style>body{margin:0;background:#101d25;color:#ecedda;font:16px/1.7 system-ui,sans-serif}main{max-width:1060px;margin:auto;padding:32px}h1,h2{color:#e6c171}p{color:#c4d3d3}a{color:#b5e6d4}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #3a515b;vertical-align:top}.pass{color:#a7dbb5}.fail{color:#ffb2a1}.warn,.unknown,.untested{color:#eed09a}img{max-width:100%;border:1px solid #536570}small{color:#b7c4c5}code{overflow-wrap:anywhere}details{margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main>
<h1>Codex 皮肤检验</h1><p>${e(report.createdAt)} · 皮肤 ${e(report.version)} · Codex ${e(report.codexVersion || '未知')} · ${e(report.route)} / ${e(report.environment || '未知环境')}</p>
<h2>${e(report.verdict)} · 自动抽检 ${report.score}/100</h2><p>${e(report.scope)}。待复核、疑似和未测项不得分；高分不代表所有页面无问题。</p>
<p>${report.baseline ? `对比同主题、环境、路由和窗口尺寸的上次记录 ${e(report.baseline)}；新增异常项：${e(report.regressions.join(', ') || '无')}` : '没有可比较的上一份报告；本次保留为历史，不进行跨场景分数比较。'}</p>
<table><thead><tr><th>检查项</th><th>状态</th><th>证据与排查方向</th></tr></thead><tbody>${report.checks.map(c => `<tr><td>${e(c.title)}<br><small>${c.weight} 分</small></td><td class="${c.status}">${names[c.status]}</td><td>${e(c.detail)}<br><small>错题本 ${e(c.notebook)}</small></td></tr>`).join('')}</tbody></table>
<h2>尚未验收</h2><ul>${report.untested.map(t => `<li>${e(t)}</li>`).join('')}</ul><p>建议：升级后重跑本工具，再按 SELF_TEST_PLAYBOOK.md 补齐新会话、设置、快速聊天和环境切换；有疑似问题时保留报告，按对应 ST 编号记录根因和复测结果。</p>
<details><summary>文字与边缘的疑似问题（坐标用于对照截图）</summary><pre>${e(JSON.stringify({ text: report.contrastFindings, edges: report.brightEdges }, null, 2))}</pre></details>
<h2>现场截图</h2><p>截图保存在本机，可能包含当前会话内容；没有自动上传。采样时间从启动检验算起，不是页面首次绘制时间。</p>
${report.screenshots.map(s => `<figure><figcaption>${e(s)}</figcaption><a href="${e(s)}"><img src="${e(s)}" alt="当前 Codex 窗口截图"></a></figure>`).join('')}
<p><a href="report.json">结构化结论</a> · <a href="samples.json">原始样式和结构样本</a></p></main></html>`;
}
