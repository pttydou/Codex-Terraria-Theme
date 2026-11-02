import assert from "node:assert/strict";
import { summarizeCompatibility } from "../scripts/injector.mjs";

const healthy = {
  installed: true, styleEnabled: true, skinVersion: "test",
  frontendCompatibility: {
    schema: 2, status: "compatible", updateRequired: false,
    safety: { mode: "normal" }, criticalMissing: [], diagnostics: {},
    adapters: {
      main: { required: true, status: "ready" },
      composer: { required: true, status: "ready" },
    },
  },
};
const cases = [
  ["healthy current page", () => {}, "none"],
  ["uninstalled skin", (s) => { s.installed = false; s.frontendCompatibility = null; }, "refresh-runtime"],
  ["old watcher payload", (s) => { s.skinVersion = "old"; }, "refresh-runtime"],
  ["old contract", (s) => { s.frontendCompatibility.schema = 1; }, "refresh-runtime"],
  ["startup still mounting", (s) => {
    s.frontendCompatibility.safety.mode = "confirming";
    s.frontendCompatibility.criticalMissing = ["main-surface"];
    s.frontendCompatibility.adapters.main.status = "missing";
  }, "wait-and-recheck"],
  ["persistent missing main", (s) => {
    s.frontendCompatibility.status = "incompatible";
    s.frontendCompatibility.safety.mode = "safe";
    s.frontendCompatibility.adapters.main.status = "missing";
  }, "update-adapter"],
  ["settings without a conversation composer", (s) => {
    s.frontendCompatibility.adapters.main = { required: false, status: "missing" };
    s.frontendCompatibility.adapters.composer = { required: false, status: "missing" };
  }, "none"],
  ["legacy composer still works", (s) => {
    s.frontendCompatibility.status = "adaptive";
    s.frontendCompatibility.adapters.composer.status = "fallback";
    s.frontendCompatibility.adapters.composer.selected = "legacy-fallback";
  }, "inspect-fallback"],
  ["disabled stylesheet", (s) => { s.styleEnabled = false; }, "inspect-runtime"],
  ["safe mode with stale healthy status", (s) => {
    s.frontendCompatibility.safety.mode = "safe";
  }, "inspect-runtime"],
];
for (const [name, change, expected] of cases) {
  const snapshot = structuredClone(healthy);
  change(snapshot);
  const before = structuredClone(snapshot);
  const result = summarizeCompatibility(snapshot, "test");
  assert.equal(result.recommendedAction, expected, name);
  assert.equal(result.scope, "current-renderer-structure", name);
  assert.deepEqual(snapshot, before, `${name}: reporting must remain read-only`);
}
console.log(`PASS: ${cases.length} compatibility report scenarios distinguish runtime, route and adapter failures.`);
