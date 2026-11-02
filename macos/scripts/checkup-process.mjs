import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

// No shell, no UI actions. Keep full logs even on failure; kill only this
// command's process group on timeout (including its isolated browser).
export async function runCommand({ command, args = [], cwd, env = process.env, directory, id, timeoutMs = 180000 }) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stdoutPath = path.join(directory, `${id}.stdout.log`);
  const stderrPath = path.join(directory, `${id}.stderr.log`);
  const out = await fs.open(stdoutPath, 'wx', 0o600);
  const err = await fs.open(stderrPath, 'wx', 0o600);
  const started = Date.now();
  let timedOut = false, error = null, code = null, signal = null;
  try {
    await new Promise(resolve => {
      const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', out.fd, err.fd] });
      const timer = setTimeout(() => {
        timedOut = true;
        try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); }
        catch (e) { if (e.code !== 'ESRCH') error = e.message; }
      }, timeoutMs);
      child.once('error', e => { error = e.message; });
      child.once('close', (exitCode, exitSignal) => { clearTimeout(timer); code = exitCode; signal = exitSignal; resolve(); });
    });
  } finally { await out.close(); await err.close(); }
  // Structured command output is small; oversized output is never parsed as success.
  const stat = await fs.stat(stdoutPath);
  const stdout = stat.size <= 4 * 1024 * 1024 ? await fs.readFile(stdoutPath, 'utf8') : null;
  return { command: [command, ...args], code, signal, timedOut, error, durationMs: Date.now() - started,
    stdoutPath, stderrPath, stdout };
}

export function commandPassed(result) {
  return result.code === 0 && !result.timedOut && !result.error;
}

export function parseOutput(result) {
  try { return JSON.parse(result.stdout); } catch { return null; }
}

export async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
