import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { classifyCompatibility, classifyInspection, exitFor } from '../scripts/checkup.mjs';
import { runCommand, commandPassed, parseOutput } from '../scripts/checkup-process.mjs';

const main = result => ({ url: 'app://-/index.html', result });
const auxiliary = { url: 'app://-/index.html?initialRoute=/chatgpt/quick-chat-prewarm', result: { recommendedAction: 'none' } };
assert.equal(classifyCompatibility({ targets: {} }).status, 'review');
assert.equal(classifyCompatibility({ targets: [auxiliary] }).status, 'review');
assert.equal(classifyCompatibility({ targets: [main({ recommendedAction: 'none' }), auxiliary] }).status, 'pass');
assert.equal(classifyCompatibility({ targets: [main({}), main({})] }).status, 'review');
assert.equal(classifyCompatibility({ targets: [main({ recommendedAction: 'update-adapter' })] }).status, 'fail');
assert.equal(classifyCompatibility({ targets: [main({ recommendedAction: 'wait-and-recheck' })] }).status, 'review');
assert.equal(classifyCompatibility({ targets: [main({ recommendedAction: 'future-action' })] }).status, 'review');
assert.equal(classifyInspection({ checks: [] }).status, 'review');
assert.equal(classifyInspection({ checks: [null] }).status, 'review');
assert.equal(classifyInspection({ checks: [{ status: 'unknown' }] }).status, 'review');
assert.equal(classifyInspection({ checks: [{ status: 'fail' }] }).status, 'fail');
assert.equal(exitFor([{ status: 'pass' }, { status: 'untested' }]), 2);
assert.equal(exitFor([{ status: 'review' }, { status: 'fail' }]), 1);
assert.equal(exitFor([{ status: 'pass' }]), 0);
assert.equal(exitFor([]), 2);

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dream-checkup-test-'));
try {
  const run = (id, code, timeoutMs=3000) => runCommand({ command: process.execPath, args: ['-e', code], directory, id, timeoutMs });
  const failure = await run('failure', 'console.log("preserved output");console.error("preserved error");process.exit(7)');
  assert.equal(commandPassed(failure), false);
  assert.match(await fs.readFile(failure.stderrPath, 'utf8'), /preserved error/);
  assert.match(failure.stdout, /preserved output/);
  const invalidJson = await run('invalid-json', 'console.log("not-json")');
  assert.equal(parseOutput(invalidJson), null);
  const timeout = await run('timeout', 'setInterval(()=>{},100)', 150);
  assert.equal(timeout.timedOut, true); assert.equal(commandPassed(timeout), false);
  const missing = await runCommand({ command: path.join(directory, 'missing'), directory, id: 'missing', timeoutMs: 150 });
  assert.equal(commandPassed(missing), false); assert.ok(missing.error);
  const success = await run('after-failure', 'console.log(JSON.stringify({ok:true}))');
  assert.equal(commandPassed(success), true); assert.deepEqual(parseOutput(success), {ok:true});
  assert.equal((await fs.stat(success.stdoutPath)).mode & 0o777, 0o600);
} finally { await fs.rm(directory, { recursive: true, force: true }); }
console.log('PASS: checkup rejects auxiliary/ambiguous targets and unknown results; preserves failure logs; handles missing tools/timeouts and continues independent checks.');
