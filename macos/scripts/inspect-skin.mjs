import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connectCodexTargets, verifySession, armOneShotExitFallback } from './injector.mjs';
import { INSPECTION_EXPRESSION } from './inspection/probe.mjs';
import { GEOMETRY_EXPRESSION } from './inspection/geometry.mjs';
import { inspectScreenshotEdges, inspectScreenshotPopovers } from './inspection/png.mjs';
import { assessRun, contextKey, renderHtml } from './inspection/report.mjs';
const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const stateRoot = path.join(os.homedir(), 'Library/Application Support/CodexDreamSkinStudio');
const readJson = async name => JSON.parse(await fs.readFile(name, 'utf8'));

export function parseArgs(args) {
  const options = { open: false, console: false, reportRoot: path.join(stateRoot, 'reports') };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--open') options.open = true;
    else if (arg === '--console') options.console = true;
    else if (arg === '--help') options.help = true;
    else if (['--port', '--report-root'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} 缺少参数`);
      if (arg === '--port') options.port = value;
      else options.reportRoot = path.resolve(value);
    } else throw new Error(`未知参数：${arg}`);
  }
  if (options.port !== undefined && (!/^\d+$/.test(options.port) || Number(options.port) < 1 || Number(options.port) > 65535)) throw new Error('端口必须为 1–65535');
  return options;
}

export async function preflight(port) {
  // Fixed shell program, paths/ports passed as argv, never interpolated code.
  const { stdout } = await exec('/bin/bash', ['-c', `
. "$1/common-macos.sh"
discover_codex_app
require_macos_runtime
verified_cdp_endpoint "$2" || { printf '未找到可验证的 Codex CDP 端口 %s\\n' "$2" >&2; exit 1; }
printf '%s' "$CODEX_VERSION"
`, 'inspect-preflight', here, String(port)], { timeout: 15000, maxBuffer: 64 * 1024 });
  return stdout.trim();
}

async function collect(raw, directory) {
  let sessions = [], stopped = false, timer;
  const work = (async () => {
    raw.codexVersion = await preflight(raw.port);
    if (stopped) return;
    sessions = await connectCodexTargets(raw.port, 4000);
    if (stopped) { sessions.forEach(s => s.session.close()); return; }
    const candidates = sessions.filter(s => s.target.url === 'app://-/index.html');
    // Multiple main windows cannot be silently treated as the current one.
    if (candidates.length !== 1) throw new Error(`找到 ${candidates.length} 个主窗口；请保留一个待测主窗口后重试`);
    const { session } = candidates[0];
    sessions.filter(s => s.session !== session).forEach(s => s.session.close());
    raw.connected = true;
    const geometry = session.evaluate(GEOMETRY_EXPRESSION)
      .then(value => { raw.geometry = value; }, error => { raw.geometry = { error: error.message }; });
    const start = performance.now();
    for (const [i, offset] of [0, 500, 1200, 2500].entries()) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, offset - (performance.now() - start))));
      if (stopped) return;
      const verify = await verifySession(session);
      const page = await session.evaluate(INSPECTION_EXPRESSION);
      if (stopped) return;
      raw.samples.push({ elapsedMs: Math.round(performance.now() - start), verify, page });
      if (i === 0 || i === 3) {
        // Unlike injector.capture(), this preserves hover, focus and open dialogs.
        const shot = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        if (stopped) return;
        const name = i === 0 ? 'first.png' : 'last.png';
        const bytes = Buffer.from(shot.data, 'base64');
        await fs.writeFile(path.join(directory, name), bytes, { mode: 0o600 });
        raw.screenshots.push(name);
        try { raw.imageEdges.push({ screenshot: name, ...inspectScreenshotEdges(bytes),
          popovers: inspectScreenshotPopovers(bytes, page.popovers, page.viewport) }); }
        catch (error) { raw.imageEdges.push({ screenshot: name, status: 'unknown', reason: error.message }); }
      }
    }
    await geometry;
  })();
  try {
    await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('检验超过 30 秒，已保存可用证据')), 30000); })]);
  } finally {
    stopped = true;
    clearTimeout(timer);
    sessions.forEach(s => s.session.close());
  }
}

export async function runInspection(options) {
  const saved = await readJson(path.join(stateRoot, 'state.json')).catch(() => ({}));
  const port = Number(options.port ?? process.env.CODEX_DREAM_SKIN_PORT ?? saved.port ?? 9341);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('状态文件或环境变量中的 CDP 端口无效');
  await fs.mkdir(options.reportRoot, { recursive: true, mode: 0o700 });
  const createdAt = new Date().toISOString();
  const directory = await fs.mkdtemp(path.join(options.reportRoot, createdAt.replace(/[:.]/g, '-') + '-'));
  const theme = await readJson(path.join(stateRoot, 'theme/theme.json')).catch(() => ({}));
  const raw = { createdAt, version: (await fs.readFile(path.join(root, 'VERSION'), 'utf8')).trim(),
    codexVersion: null, nodeVersion: process.version, port, expectedThemeId: theme.id || null,
    connected: false, samples: [], screenshots: [], imageEdges: [], error: null };
  try { await collect(raw, directory); }
  catch (error) { raw.error = String(error.stderr || error.message).trim().slice(0, 1500); }
  let previous = null;
  const key = contextKey(raw.samples.at(-1));
  if (key) {
    const entries = await fs.readdir(options.reportRoot, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory() && e.name !== path.basename(directory)).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 50)) {
      const candidate = await readJson(path.join(options.reportRoot, entry.name, 'report.json')).catch(() => null);
      if (candidate?.schema === 1 && candidate.comparisonKey === key) { previous = candidate; break; }
    }
  }
  const report = assessRun(raw, previous);
  await fs.writeFile(path.join(directory, 'samples.json'), JSON.stringify(raw, null, 2) + '\n', { mode: 0o600 });
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  const htmlPath = path.join(directory, 'report.html');
  await fs.writeFile(htmlPath, renderHtml(report), { mode: 0o600 });
  const result = { verdict: report.verdict, score: report.score, completeAcceptance: false, reportPath: htmlPath,
    failed: report.checks.some(c => c.status === 'fail') };
  const pointer = path.join(options.reportRoot, `.latest-${path.basename(directory)}.json`);
  await fs.writeFile(pointer, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(pointer, path.join(options.reportRoot, 'latest.json'));
  if (options.open) {
    try { await exec('/usr/bin/open', [htmlPath], { timeout: 5000 }); }
    catch { result.openError = '报告已保存，但自动打开失败，请打开 reportPath'; }
  }
  return result;
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log('皮肤检验：inspect-skin-macos.sh [--port 9341] [--open] [--report-root DIR]\n默认只读检查当前主窗口，保存本机报告与截图；退出 0=无硬失败/可能待复核，2=检查失败，1=工具错误。');
    else {
      const result = await runInspection(options);
      console.log(JSON.stringify(result, null, 2));
      if (result.failed && !options.console) process.exitCode = 2;
    }
  } catch (error) { console.error(`皮肤检验工具：${error.message}`); process.exitCode = 1; }
  finally { armOneShotExitFallback(); }
}
