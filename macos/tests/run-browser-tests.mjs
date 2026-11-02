import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { runCommand, commandPassed, writeJson } from '../scripts/checkup-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--report-dir')) {
  console.error('Usage: npm run test:browser -- [--report-dir DIR]'); process.exit(1);
}
const directory = args.length ? path.resolve(args[1]) : await fs.mkdtemp(path.join(os.tmpdir(), 'dream-skin-browser-'));
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
const report = { schema: 1, createdAt: new Date().toISOString(), scope: 'isolated-browser-fixtures', status: 'blocked', tests: [] };
try {
  const candidates = process.env.PLAYWRIGHT_MODULE ? [process.env.PLAYWRIGHT_MODULE] : [
    'playwright-core', 'playwright',
    '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright-core/index.mjs',
    '/Applications/Codex.app/Contents/Resources/cua_node/lib/node_modules/playwright-core/index.mjs',
  ];
  let moduleUrl;
  for (const candidate of candidates) {
    try {
      const url = candidate.startsWith('file:') ? candidate : pathToFileURL(
        candidate.startsWith('.') || path.isAbsolute(candidate) ? path.resolve(candidate) : require.resolve(candidate)).href;
      if ((await import(url)).chromium?.launch) { moduleUrl = url; break; }
    } catch { /* Try installed defaults; an explicit override has no fallback. */ }
  }
  if (!moduleUrl) throw new Error('未找到 Playwright；设置 PLAYWRIGHT_MODULE 为已安装 playwright-core 的入口。未执行浏览器测试。');
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  await fs.access(chrome, fs.constants.X_OK);
  report.playwrightModule = moduleUrl; report.chromePath = chrome;
  const tests = (await fs.readdir(path.join(root, 'tests'))).filter(f => f.endsWith('-browser.test.mjs')).sort();
  if (!tests.length) throw new Error('未发现浏览器测试；零测试不能通过。');
  report.discovered = tests;
  const env = { ...process.env, PLAYWRIGHT_MODULE: moduleUrl, CHROME_PATH: chrome };
  for (const key of ['INSPECTION_REPORT', 'REPORT_PREVIEW', 'BEFORE_CSS']) delete env[key];
  for (const name of tests) {
    console.log(`Browser: ${name}`);
    const result = await runCommand({ command: process.execPath, args: [path.join(root, 'tests', name)],
      cwd: root, env, directory, id: name, timeoutMs: 180000 });
    const { stdout, ...evidence } = result;
    report.tests.push({ name, status: commandPassed(result) ? 'pass' : 'fail', ...evidence });
    console.log(stdout?.trim() || `See ${result.stderrPath}`);
  }
  report.status = report.tests.every(t => t.status === 'pass') ? 'pass' : 'fail';
} catch (error) { report.error = error.message; report.status = report.tests.length ? 'fail' : 'blocked'; }
await writeJson(path.join(directory, 'browser-report.json'), report);
console.log(JSON.stringify({ status: report.status, executed: report.tests.length, reportPath: path.join(directory, 'browser-report.json') }));
if (report.status !== 'pass') process.exitCode = 1;
