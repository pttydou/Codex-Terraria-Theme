import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const common = fileURLToPath(new URL('../scripts/common-macos.sh', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-manual-'));
try {
  const stub = path.join(temporary, 'injector.mjs');
  await fs.writeFile(stub, `
    console.log(JSON.stringify({ targets: [{ result: { pass: process.env.STUB_STATUS === '0' } }] }));
    if (process.env.STUB_ERROR) console.error(process.env.STUB_ERROR);
    process.exitCode = Number(process.env.STUB_STATUS);
  `);
  for (const [status, error] of [[0, ''], [2, ''], [1, 'Renderer connection closed']]) {
    const state = path.join(temporary, `state ${status}`);
    const result = spawnSync('/bin/bash', ['-c', `
      . "$1"
      STATE_ROOT="$2"
      START_ERROR_LOG="$STATE_ROOT/start-error.log"
      NODE="$3"
      INJECTOR="$4"
      THEME_DIR="$STATE_ROOT/theme with spaces"
      apply_skin_once 9341 8000
      printf 'applied' > "$STATE_ROOT/state-written"
    `, 'test', common, state, process.execPath, stub], {
      encoding: 'utf8', env: { ...process.env, STUB_STATUS: String(status), STUB_ERROR: error },
    });
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stdout, '', 'Bridge stdout must remain compatible');
    const reports = path.join(state, 'reports', 'apply');
    const entries = await fs.readdir(reports);
    assert.equal(entries.length, 1);
    const report = path.join(reports, entries[0]);
    assert.equal((await fs.readFile(path.join(report, 'exit-code.txt'), 'utf8')).trim(), String(status));
    assert.equal(JSON.parse(await fs.readFile(path.join(report, 'result.json'), 'utf8')).targets[0].result.pass, status === 0);
    assert.equal((await fs.readFile(path.join(report, 'stderr.log'), 'utf8')).trim(), error);
    if (status === 0) {
      assert.equal(result.stderr, '');
      assert.equal(await fs.readFile(path.join(state, 'state-written'), 'utf8'), 'applied');
    } else {
      assert.ok(result.stderr.includes(report), 'Silent verification failures must show the current report path');
      assert.ok(result.stderr.includes(error), 'Keep the concrete injector error');
      assert.ok((await fs.readFile(path.join(state, 'start-error.log'), 'utf8')).includes(report));
      await assert.rejects(fs.stat(path.join(state, 'state-written')), { code: 'ENOENT' });
    }
  }
  console.log('PASS: manual apply retains success, silent verify failure and connection failure evidence; failures cannot write active state.');
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
