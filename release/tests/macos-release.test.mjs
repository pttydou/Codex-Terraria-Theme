import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const version = (await fs.readFile(path.join(root, 'macos/VERSION'), 'utf8')).trim();
const config = JSON.parse(await fs.readFile(path.join(root, 'release/release-config.json'), 'utf8'));
const tag = `v${version}`;
const commit = 'a'.repeat(40);

test('macOS versions and tag are validated without a Windows source tree', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'trskin-version-'));
  try {
    await fs.mkdir(path.join(temp, 'release'));
    await fs.mkdir(path.join(temp, 'macos'));
    for (const file of ['release/validate-release.mjs', 'release/release-config.json', 'macos/VERSION', 'macos/package.json']) {
      await fs.copyFile(path.join(root, file), path.join(temp, file));
    }
    const run = value => spawnSync(process.execPath, [path.join(temp, 'release/validate-release.mjs'), '--tag', value], { encoding: 'utf8' });
    assert.equal(run(tag).status, 0);
    assert.notEqual(run('v0.0.0').status, 0);
    await fs.writeFile(path.join(temp, 'macos/package.json'), JSON.stringify({ version: '0.0.0' }));
    assert.notEqual(run(tag).status, 0);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('macOS-only draft produces verifiable update metadata and rejects incomplete assets', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'trskin-metadata-'));
  try {
    const names = [`TRSkin-macOS-${version}.zip`, `TRSkin-macOS-Update-${version}.zip`, config.music.assetName];
    const release = {
      tag_name: tag, draft: true,
      assets: names.map((name, i) => ({ name, size: 100 + i, digest: `sha256:${i === 2 ? config.music.sha256 : 'b'.repeat(64)}` })),
    };
    const input = path.join(temp, 'release.json');
    const dist = path.join(temp, 'dist');
    const run = async metadata => {
      await fs.writeFile(input, JSON.stringify(metadata));
      return spawnSync(process.execPath, [path.join(root, 'release/generate-release-metadata.mjs'), input, dist, version, tag, commit], { encoding: 'utf8' });
    };
    const result = await run(release);
    assert.equal(result.status, 0, result.stderr);
    const bytes = await fs.readFile(path.join(dist, 'update-manifest.json'));
    const manifest = JSON.parse(bytes);
    assert.deepEqual(Object.keys(manifest.platforms), ['macos']);
    assert.equal(manifest.release.sourceCommit, commit);
    assert.equal(manifest.platforms.macos.version, version);
    assert.equal(manifest.platforms.macos.update.name, names[1]);
    assert.equal(manifest.music.sha256, config.music.sha256);
    const sums = await fs.readFile(path.join(dist, 'SHA256SUMS.txt'), 'utf8');
    assert.equal(sums.trim().split('\n').length, 4);
    assert.ok(sums.includes(`${createHash('sha256').update(bytes).digest('hex')}  update-manifest.json`));
    assert.ok(!sums.includes('Windows'));
    const notes = await fs.readFile(path.join(dist, 'RELEASE-NOTES.md'), 'utf8');
    assert.ok(notes.includes('/releases/tag/v2.7.10'));
    assert.ok(notes.includes(names[0]));
    assert.notEqual((await run({ ...release, assets: release.assets.slice(1) })).status, 0);
    assert.notEqual((await run({ ...release, draft: false })).status, 0);
    assert.notEqual((await run({ ...release, assets: release.assets.map(a => ({ ...a, digest: null })) })).status, 0);
    assert.notEqual((await run({ ...release, assets: release.assets.map(a => a.name === config.music.assetName ? { ...a, digest: `sha256:${'c'.repeat(64)}` } : a) })).status, 0);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
