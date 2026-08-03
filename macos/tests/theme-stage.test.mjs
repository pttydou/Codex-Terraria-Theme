import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const macosRoot = path.resolve(here, "..");
const stageScript = path.join(macosRoot, "scripts", "stage-theme.mjs");
const fixtureAsset = path.join(macosRoot, "assets", "portal-hero.png");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dream-skin-stage-"));

function runStage(source, stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [stageScript, source, stage], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `stage-theme exited with ${code}`));
    });
  });
}

try {
  const source = path.join(tempRoot, "themes", "preset-race");
  const stage = path.join(tempRoot, "stage");
  await fs.mkdir(source, { recursive: true });
  await fs.mkdir(stage);
  await fs.copyFile(fixtureAsset, path.join(source, "background-a.png"));
  await fs.copyFile(fixtureAsset, path.join(source, "logo.png"));
  await fs.writeFile(
    path.join(source, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "preset-race",
      name: "A",
      image: "background-a.png",
      assets: { logo: "logo.png" },
    })}\n`,
  );

  const imageName = await runStage(source, stage);
  assert.equal(imageName, "background-a.png");
  const stagedConfig = JSON.parse(await fs.readFile(path.join(stage, "theme.json"), "utf8"));
  assert.equal(stagedConfig.image, "background-a.png");
  const stagedBeforeMutation = await fs.readFile(path.join(stage, "background-a.png"));
  const stagedLogoBeforeMutation = await fs.readFile(path.join(stage, "logo.png"));

  // A source edit after staging must not change the pair that is about to be
  // published. This is the regression for switch-theme's old copy-after-
  // validation TOCTOU window.
  await fs.copyFile(fixtureAsset, path.join(source, "background-b.png"));
  await fs.writeFile(
    path.join(source, "theme.json"),
    `${JSON.stringify({ schemaVersion: 1, id: "preset-race", name: "B", image: "background-b.png" })}\n`,
  );
  await fs.writeFile(path.join(source, "background-a.png"), Buffer.from("changed-after-stage"));
  await fs.writeFile(path.join(source, "logo.png"), Buffer.from("changed-logo-after-stage"));
  assert.deepEqual(await fs.readFile(path.join(stage, "background-a.png")), stagedBeforeMutation);
  assert.deepEqual(await fs.readFile(path.join(stage, "logo.png")), stagedLogoBeforeMutation);
  assert.equal(JSON.parse(await fs.readFile(path.join(stage, "theme.json"), "utf8")).name, "A");

  const outside = path.join(tempRoot, "outside.png");
  await fs.copyFile(fixtureAsset, outside);
  const traversal = path.join(tempRoot, "traversal");
  await fs.mkdir(traversal);
  await fs.writeFile(
    path.join(traversal, "theme.json"),
    `${JSON.stringify({ schemaVersion: 1, id: "bad", image: "../outside.png" })}\n`,
  );
  const traversalStage = path.join(tempRoot, "traversal-stage");
  await fs.mkdir(traversalStage);
  await assert.rejects(runStage(traversal, traversalStage), /inside its theme directory/);

  if (process.platform !== "win32") {
    const symlink = path.join(tempRoot, "symlink");
    await fs.mkdir(symlink);
    await fs.symlink(outside, path.join(symlink, "background.png"));
    await fs.writeFile(
      path.join(symlink, "theme.json"),
      `${JSON.stringify({ schemaVersion: 1, id: "bad-link", image: "background.png" })}\n`,
    );
    const symlinkStage = path.join(tempRoot, "symlink-stage");
    await fs.mkdir(symlinkStage);
    await assert.rejects(runStage(symlink, symlinkStage), /symbolic link/);
  }

  const badIconPool = path.join(tempRoot, "bad-icon-pool");
  const badIconPoolStage = path.join(tempRoot, "bad-icon-pool-stage");
  await fs.mkdir(badIconPool);
  await fs.mkdir(badIconPoolStage);
  await fs.copyFile(fixtureAsset, path.join(badIconPool, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(badIconPool, "logo.png"));
  await fs.writeFile(
    path.join(badIconPool, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-icon-pool",
      image: "background.png",
      assets: { logo: "logo.png" },
      cardIconPool: ["logo", "missing-a", "missing-b", "missing-c"],
    })}\n`,
  );
  await assert.rejects(
    runStage(badIconPool, badIconPoolStage),
    /cardIconPool must contain 4 to 16 unique asset keys/,
  );

  const badTorchKey = path.join(tempRoot, "bad-torch-key");
  const badTorchKeyStage = path.join(tempRoot, "bad-torch-key-stage");
  await fs.mkdir(badTorchKey);
  await fs.mkdir(badTorchKeyStage);
  await fs.copyFile(fixtureAsset, path.join(badTorchKey, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(badTorchKey, "torch.png"));
  await fs.writeFile(
    path.join(badTorchKey, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-torch-key",
      image: "background.png",
      assets: { torch: "torch.png" },
      torchKey: "missing",
    })}\n`,
  );
  await assert.rejects(
    runStage(badTorchKey, badTorchKeyStage),
    /torchKey must reference one local asset key/,
  );

  const badCompanionPool = path.join(tempRoot, "bad-companion-pool");
  const badCompanionPoolStage = path.join(tempRoot, "bad-companion-pool-stage");
  await fs.mkdir(badCompanionPool);
  await fs.mkdir(badCompanionPoolStage);
  await fs.copyFile(fixtureAsset, path.join(badCompanionPool, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(badCompanionPool, "companion.png"));
  await fs.writeFile(
    path.join(badCompanionPool, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-companion-pool",
      image: "background.png",
      assets: { companion: "companion.png" },
      companionPool: ["companion", "missing"],
    })}\n`,
  );
  await assert.rejects(
    runStage(badCompanionPool, badCompanionPoolStage),
    /companionPool must contain 1 to 64 unique asset keys/,
  );

  const badCompanionWeights = path.join(tempRoot, "bad-companion-weights");
  const badCompanionWeightsStage = path.join(tempRoot, "bad-companion-weights-stage");
  await fs.mkdir(badCompanionWeights);
  await fs.mkdir(badCompanionWeightsStage);
  await fs.copyFile(fixtureAsset, path.join(badCompanionWeights, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(badCompanionWeights, "companion.png"));
  await fs.writeFile(
    path.join(badCompanionWeights, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-companion-weights",
      image: "background.png",
      assets: { companion: "companion.png" },
      companionPool: ["companion"],
      companionWeights: { missing: 0 },
    })}\n`,
  );
  await assert.rejects(
    runStage(badCompanionWeights, badCompanionWeightsStage),
    /companionWeights must map companion keys to integer weights from 1 to 1000/,
  );

  const badEnvironmentPool = path.join(tempRoot, "bad-environment-pool");
  const badEnvironmentPoolStage = path.join(tempRoot, "bad-environment-pool-stage");
  await fs.mkdir(badEnvironmentPool);
  await fs.mkdir(badEnvironmentPoolStage);
  await fs.copyFile(fixtureAsset, path.join(badEnvironmentPool, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(badEnvironmentPool, "torch.png"));
  await fs.copyFile(fixtureAsset, path.join(badEnvironmentPool, "companion-a.png"));
  await fs.copyFile(fixtureAsset, path.join(badEnvironmentPool, "companion-b.png"));
  await fs.writeFile(
    path.join(badEnvironmentPool, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-environment-pool",
      image: "background.png",
      assets: {
        background: "background.png",
        torch: "torch.png",
        "companion-a": "companion-a.png",
        "companion-b": "companion-b.png",
      },
      environmentIntervalMs: 600000,
      environmentPool: [
        {
          variant: "forest",
          backgroundKey: "background",
          torchKey: "torch",
          companionPool: ["companion-a", "companion-b"],
          accentKeys: ["background", "torch", "companion-a"],
          cardIconPool: ["background", "torch", "companion-a", "companion-b"],
        },
        {
          variant: "ocean",
          backgroundKey: "missing",
          torchKey: "torch",
          companionPool: ["companion-a", "companion-b"],
          accentKeys: ["background", "torch", "companion-a"],
          cardIconPool: ["background", "torch", "companion-a", "companion-b"],
        },
      ],
    })}\n`,
  );
  await assert.rejects(
    runStage(badEnvironmentPool, badEnvironmentPoolStage),
    /backgrounds must reference local assets/,
  );

  const badEnvironmentAccents = path.join(tempRoot, "bad-environment-accents");
  const badEnvironmentAccentsStage = path.join(tempRoot, "bad-environment-accents-stage");
  await fs.mkdir(badEnvironmentAccents);
  await fs.mkdir(badEnvironmentAccentsStage);
  for (const name of ["background", "torch", "companion-a", "companion-b"]) {
    await fs.copyFile(fixtureAsset, path.join(badEnvironmentAccents, `${name}.png`));
  }
  await fs.writeFile(
    path.join(badEnvironmentAccents, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-environment-accents",
      image: "background.png",
      assets: Object.fromEntries(
        ["background", "torch", "companion-a", "companion-b"]
          .map((name) => [name, `${name}.png`]),
      ),
      environmentIntervalMs: 600000,
      environmentPool: ["forest", "ocean"].map((variant) => ({
        variant,
        backgroundKey: "background",
        torchKey: "torch",
        companionPool: ["companion-a", "companion-b"],
        accentKeys: ["background", "torch", "missing"],
        cardIconPool: ["background", "torch", "companion-a", "companion-b"],
      })),
    })}\n`,
  );
  await assert.rejects(
    runStage(badEnvironmentAccents, badEnvironmentAccentsStage),
    /accentKeys must contain exactly 3 local assets/,
  );

  const badEnvironmentWeights = path.join(tempRoot, "bad-environment-weights");
  const badEnvironmentWeightsStage = path.join(tempRoot, "bad-environment-weights-stage");
  await fs.mkdir(badEnvironmentWeights);
  await fs.mkdir(badEnvironmentWeightsStage);
  for (const name of ["background", "torch", "companion-a", "companion-b"]) {
    await fs.copyFile(fixtureAsset, path.join(badEnvironmentWeights, `${name}.png`));
  }
  await fs.writeFile(
    path.join(badEnvironmentWeights, "theme.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "bad-environment-weights",
      image: "background.png",
      assets: Object.fromEntries(
        ["background", "torch", "companion-a", "companion-b"]
          .map((name) => [name, `${name}.png`]),
      ),
      environmentIntervalMs: 600000,
      environmentPool: ["forest", "ocean"].map((variant) => ({
        variant,
        backgroundKey: "background",
        torchKey: "torch",
        companionPool: ["companion-a", "companion-b"],
        companionWeights: { "companion-a": 1.5 },
        accentKeys: ["background", "torch", "companion-a"],
        cardIconPool: ["background", "torch", "companion-a", "companion-b"],
      })),
    })}\n`,
  );
  await assert.rejects(
    runStage(badEnvironmentWeights, badEnvironmentWeightsStage),
    /environment companionWeights must map companion keys to integer weights from 1 to 1000/,
  );

  console.log("PASS: theme staging snapshots a matched, contained config/image/asset pack.");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
