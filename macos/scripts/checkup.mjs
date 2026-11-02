import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runCommand, commandPassed, parseOutput, writeJson } from './checkup-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const stateRoot = path.join(os.homedir(), 'Library/Application Support/CodexDreamSkinStudio');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');

export function classifyCompatibility(data) {
  const mains = Array.isArray(data?.targets) ? data.targets.filter(t => t?.url === 'app://-/index.html') : [];
  if (mains?.length !== 1) return { status: 'review', detail: '无法确认唯一主窗口；辅助窗口不能代替主页面' };
  const result = mains[0].result;
  if (!result?.recommendedAction) return { status: 'review', detail: '缺少兼容性建议，不能按命令成功判定兼容' };
  const action = result.recommendedAction;
  return { status: action === 'none' ? 'pass' : ['refresh-runtime', 'update-adapter', 'inspect-runtime'].includes(action) ? 'fail' : 'review',
    detail: `主窗口建议 ${action}；仅代表当前路由结构` };
}

export function classifyInspection(report) {
  if (!Array.isArray(report?.checks) || !report.checks.length || report.checks.some(c => !c || typeof c.status !== 'string')) return { status: 'review', detail: '缺少有效检查结果' };
  const pending = report.checks.filter(c => c.status !== 'pass');
  return { status: pending.some(c => c.status === 'fail') ? 'fail' : pending.length ? 'review' : 'pass',
    detail: `${report.verdict}；当前页 ${report.score}/100；${pending.map(c => `${c.id}=${c.status}`).join(', ') || '自动项全部通过'}；不计完整验收分` };
}

export function exitFor(checks) {
  return checks.some(c => c.status === 'fail') ? 1 : !checks.length || checks.some(c => c.status !== 'pass') ? 2 : 0;
}

async function fingerprint() {
  const entries = {};
  async function walk(relative) {
    for (const e of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, e.name);
      if (e.isDirectory()) await walk(name);
      else if (/\.(?:mjs|js|sh|json|css|swift)$/.test(name)) entries[name] = sha(await fs.readFile(path.join(root, name)));
    }
  }
  for (const dir of ['scripts', 'tests', 'assets', 'local-presets', 'control-app']) await walk(dir);
  for (const name of ['VERSION', 'package.json']) entries[name] = sha(await fs.readFile(path.join(root, name)));
  const stagedTheme = await fs.readFile(path.join(stateRoot, 'theme/theme.json')).catch(() => null);
  return { scope: 'source-code-and-theme-configs; binary-resource-validation-in-tests', files: entries,
    digest: sha(JSON.stringify(entries)), stagedThemeSha256: stagedTheme ? sha(stagedTheme) : null };
}

const FOLLOW_UP = [
  'A4：森林/洞穴/太空及随机环境实际切换，结束恢复原主题；固定与随机背景都正确。',
  'A5：新会话未发送时检查四边、字体、输入框；不能用发送后页面替代。',
  'A6：长会话/代码块、会话悬停、文字选区浮条、文件左右/分栏/全宽/拖动；关闭再打开。',
  '弹层：项目首页运行 inspect:overlays，逐张复核10个入口及嵌套表单；已存在弹层先保留证据。',
  'A7：设置各相关子页，特别是使用情况/计费，进入退出至少2轮；空态与有内容均检查。',
  'A8：真实快速聊天打开/关闭2轮，检查独立窗口及返回主窗口；不以 prewarm 代替。',
  'A9：音乐 ready→playing→off、切环境后资源、伙伴入口；恢复原播放/伙伴状态。',
  'A10：真实刷新100/500/1200/2500/5000/8000ms；首帧及延迟字体、白闪、几何稳定性。',
  '看图复核所有 warn/unknown，尤其图片/渐变上的按钮文字和内部白框；补证据与ST条目。',
];

function markdown(report) {
  const cell = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `# Codex 皮肤升级体检\n\n时间：${report.createdAt}\n\n皮肤：${report.skinVersion}；Node：${report.nodeVersion}；端口：${report.port}；模式：${report.offline ? '离线' : '含当前页只读抽检'}。\n\n**${report.verdict}；完整验收未完成。** 本报告自动分数不代替 A1–A10，交互项必须另填证据。\n\n源码指纹：\`${report.before.digest}\`；结束指纹：\`${report.after.digest}\`。文件级哈希在 report.json。\n\n| 检查 | 状态 | 结果 |\n| --- | --- | --- |\n${report.checks.map(c => `| ${cell(c.id)} | ${c.status} | ${cell(c.detail)} |`).join('\n')}\n\n当前页原始报告：${report.inspectionPath ? `[打开报告](<${report.inspectionPath}>)` : '未取得'}\n\n命令、退出码、耗时和完整日志：同目录 report.json 与 logs/；浏览器明细在 browser/browser-report.json。\n\n## 待补交互与人工复核\n\n${FOLLOW_UP.map(t => `- [ ] ${t}`).join('\n')}\n\n## 本轮修复记录（待填写，不能用旧版结果代填）\n\n| 现象/触发/严重度 | 根因及旧错题编号 | 最小修复 | 修前失败证据 | 修后回归证据 | 状态 |\n| --- | --- | --- | --- | --- | --- |\n| 待填 | 待填 | 待填 | 待填 | 待填 | 未验收 |\n\n验收人/时间：待填。A1–A10证据分：未评。关键路径未测：见上。原主题/音乐/窗口恢复：待核对。\n\n流程：[UPGRADE_CHECKUP.md](<${path.join(root, 'UPGRADE_CHECKUP.md')}>)；错题本：[SELF_TEST_PLAYBOOK.md](<${path.join(root, 'SELF_TEST_PLAYBOOK.md')}>)。\n`;
}

export async function main(args) {
  const options = { offline: false, interactive: false, outputRoot: path.join(stateRoot, 'reports/checkups') };
  for (let i=0; i<args.length; i++) {
    if (args[i] === '--offline') options.offline = true;
    else if (args[i] === '--interactive') options.interactive = true;
    else if (args[i] === '--help') {
      console.log('npm run checkup -- [--offline | --interactive] [--port 9341] [--output-root DIR]\n源码/隔离浏览器/doctor/兼容报告/当前页抽检；默认不切页。--interactive 从无草稿首页追加设置巡检，不自动修复。退出0=自动项通过，1=失败，2=待复核或未测；始终不代表完整验收。'); return 0;
    } else if (['--port', '--output-root'].includes(args[i])) {
      const key = args[i], value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${key} 缺少参数`);
      if (key === '--port') options.port = value; else options.outputRoot = path.resolve(value);
    } else throw new Error(`未知参数 ${args[i]}`);
  }
  if (options.offline && options.interactive) throw new Error('--offline 不能与 --interactive 同用');
  const saved = await readJson(path.join(stateRoot, 'state.json')).catch(() => ({}));
  const port = Number(options.port ?? process.env.CODEX_DREAM_SKIN_PORT ?? saved.port ?? 9341);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须为 1–65535');
  await fs.mkdir(options.outputRoot, { recursive: true, mode: 0o700 });
  const directory = await fs.mkdtemp(path.join(options.outputRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-'));
  const report = { schema: 1, createdAt: new Date().toISOString(), skinVersion: (await fs.readFile(path.join(root, 'VERSION'), 'utf8')).trim(),
    nodeVersion: process.version, port, offline: options.offline, interactive: options.interactive, completeAcceptance: false, checks: [], commands: [], before: await fingerprint() };
  const add = (id, verdict) => { report.checks.push({ id, ...verdict }); console.log(`${id}: ${verdict.status} — ${verdict.detail}`); };
  async function run(id, command, argv, timeoutMs=60000) {
    console.log(`Checking ${id}…`);
    const result = await runCommand({ command, args: argv, cwd: root, directory: path.join(directory, 'logs'), id, timeoutMs,
      env: { ...process.env, NODE: process.execPath } });
    const { stdout, ...evidence } = result; report.commands.push({ id, ...evidence }); return result;
  }
  const source = await run('source', '/bin/bash', ['tests/run-tests.sh'], 180000);
  add('source', { status: commandPassed(source) ? 'pass' : 'fail', detail: '源码/资源/语法/payload；实际输出见 logs/source.stdout.log' });
  const browser = await run('browser', process.execPath, ['tests/run-browser-tests.mjs', '--report-dir', path.join(directory, 'browser')], 1000000);
  const br = await readJson(path.join(directory, 'browser/browser-report.json')).catch(() => null);
  const browserPass = commandPassed(browser) && br?.status === 'pass' && br.tests?.length > 0
    && br.discovered?.length === br.tests.length && br.tests.every(t => t.status === 'pass');
  add('browser', { status: browserPass ? 'pass' : br?.status === 'blocked' ? 'review' : 'fail',
    detail: br?.error || `隔离浏览器 ${br?.tests?.filter(t => t.status === 'pass').length || 0}/${br?.discovered?.length || 0} 套通过；不代表真实 Codex 页面已覆盖` });
  if (options.offline) {
    for (const id of ['doctor', 'compatibility', 'inspection']) add(id, { status: 'untested', detail: '--offline，未连接客户端' });
  } else {
    const doctor = await run('doctor', '/bin/bash', ['scripts/doctor-macos.sh', '--require-live', '--port', String(port)]);
    const d = parseOutput(doctor);
    report.doctor = d;
    add('doctor', { status: commandPassed(doctor) && d?.pass && d.live && d.port === port ? 'pass' : 'fail',
      detail: d ? `Codex ${d.codexVersion}；live=${d.live}；主题 ${d.theme?.name}` : '未取得 live doctor 证据，查 stderr' });
    const compatibility = await run('compatibility', '/bin/bash', ['scripts/compatibility-report-macos.sh', '--port', String(port)]);
    add('compatibility', commandPassed(compatibility) ? classifyCompatibility(parseOutput(compatibility)) : { status: 'fail', detail: '兼容性采集失败，查 stderr' });
    const inspection = await run('inspection', process.execPath, ['scripts/inspect-skin.mjs', '--port', String(port)]);
    const pointer = parseOutput(inspection);
    if (pointer?.reportPath) report.inspectionPath = pointer.reportPath;
    const ir = pointer?.reportPath ? await readJson(path.join(path.dirname(pointer.reportPath), 'report.json')).catch(() => null) : null;
    add('inspection', ir && (commandPassed(inspection) || inspection.code === 2) ? classifyInspection(ir) : { status: 'fail', detail: '当前页采集失败，查 stderr' });
  }
  if (options.interactive) {
    const pages = await run('pages', process.execPath, ['scripts/inspect-pages.mjs', '--port', String(port),
      '--report-root', directory], 600000);
    const result = parseOutput(pages);
    report.pagesPath = result?.reportPath || null;
    add('pages', {status: !result || result.failed ? 'fail' : result.review ? 'review' : 'pass',
      detail: result ? `首页/设置巡检：${result.reportPath}；截图仍需复核` : '未取得页面巡检结果，查 stderr'});
  }
  report.after = await fingerprint();
  add('consistency', { status: report.before.digest === report.after.digest && report.before.stagedThemeSha256 === report.after.stagedThemeSha256 ? 'pass' : 'review',
    detail: '核对检查期间源码和暂存主题配置是否变化；变化后需要重跑，不能拼接两套基线' });
  report.exitCode = exitFor(report.checks);
  report.verdict = report.exitCode === 1 ? '发现失败项' : report.exitCode === 2 ? '需要复核或补测' : '自动项通过';
  await writeJson(path.join(directory, 'report.json'), report);
  await fs.writeFile(path.join(directory, 'report.md'), markdown(report), { mode: 0o600 });
  console.log(`Report: ${path.join(directory, 'report.md')}`);
  return report.exitCode;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
