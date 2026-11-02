import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  armOneShotExitFallback,
  attachMusicFiles,
  CODEX_PROBE_EXPRESSION,
  earlyFontBootstrapFor,
  earlyPayloadFor,
  isSkinHostUrl,
} from "../scripts/injector.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const injectorPath = path.resolve(here, "../scripts/injector.mjs");

assert.equal(
  typeof armOneShotExitFallback,
  "function",
  "One-shot injector modes must expose a bounded process-exit fallback.",
);
const source = await fs.readFile(injectorPath, "utf8");

function createFixture() {
  const observers = [];
  const timers = new Map();
  let nextTimer = 1;
  const markers = { shell: false, sidebar: false };
  const context = {
    URL,
    location: { href: 'app://-/index.html' },
    window: { installs: [] },
    document: {
      documentElement: {},
      body: {},
      readyState: "complete",
      querySelector(selector) {
        if (selector.includes("main")) return markers.shell ? {} : null;
        if (selector.includes("aside") || selector.includes("sidebar")) {
          return markers.sidebar ? {} : null;
        }
        return null;
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.connected = true;
        observers.push(this);
      }
      observe() {}
      disconnect() { this.connected = false; }
    },
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  return { context, markers, observers };
}

const guarded = createFixture();
vm.runInNewContext(earlyPayloadFor('window.installs.push("guarded")', "guarded"), guarded.context);
assert.deepEqual(guarded.context.window.installs, [], "Auxiliary app targets must remain untouched.");
guarded.markers.shell = true;
guarded.observers[0].callback([]);
assert.deepEqual(guarded.context.window.installs, [], "A main surface without the Codex sidebar is not sufficient.");

const generations = createFixture();
vm.runInNewContext(earlyPayloadFor('window.installs.push("old")', "old"), generations.context);
vm.runInNewContext(earlyPayloadFor('window.installs.push("new")', "new"), generations.context);
generations.markers.shell = true;
generations.markers.sidebar = true;
for (const observer of generations.observers) observer.callback([]);
assert.deepEqual(
  generations.context.window.installs,
  ["new"],
  "A stale early script must yield to the newest watcher generation.",
);
assert.equal(generations.context.window.__CODEX_DREAM_SKIN_EARLY_APPLIED__, "new");

const earlyStyles = new Map();
const earlyRoot = {
  setAttribute(name, value) { this[name] = value; },
};
const earlyStyleContext = {
  URL,
  window: {},
  location: { href: "app://-/index.html" },
  document: {
    title: "ChatGPT",
    documentElement: earlyRoot,
    head: { appendChild(node) { earlyStyles.set(node.id, node); } },
    getElementById(id) { return earlyStyles.get(id) || null; },
    createElement() {
      return {
        setAttribute() {},
        textContent: "",
        disabled: false,
      };
    },
  },
};
const earlyFontResult = vm.runInNewContext(
  earlyFontBootstrapFor("body { font-family: TestFont !important; }", "font-test"),
  earlyStyleContext,
);
assert.equal(earlyFontResult, true, "Codex renderer should accept the early font baseline");
assert.equal(earlyRoot["data-dream-early-skin"], "true");
assert.match(
  earlyStyles.get("codex-dream-skin-early-style")?.textContent || "",
  /TestFont/,
  "The early baseline should be applied before the full skin payload");

const renamedShell = {
  URL,
  document: {
    title: "Codex",
    body: {},
    readyState: "complete",
    querySelector(selector) {
      if (selector.includes('main, [role="main"]')) return {};
      if (selector.includes("textarea")) return {};
      return null;
    },
  },
  location: { href: "app://-/index.html" },
};
const renamedProbe = vm.runInNewContext(CODEX_PROBE_EXPRESSION, renamedShell);
assert.equal(
  renamedProbe.codex,
  true,
  "Renderer discovery must survive removal of Codex's legacy main-surface class.",
);

for (const href of ['app://-/index.html', 'app://-/index.html?initialRoute=%2Fquick-chat']) {
  assert.equal(isSkinHostUrl(href), true);
  assert.equal(vm.runInNewContext(CODEX_PROBE_EXPRESSION, {
    ...renamedShell, location: { href },
  }).codex, true, 'Conversation and Quick Chat hosts must retain discovery');
}
for (const href of ['https://example.com/index.html', 'app://other/index.html', 'not a URL']) {
  assert.equal(isSkinHostUrl(href), false);
}

// Codex 26.1021 adds a contenteditable to the native avatar overlay. Its
// main + editor must not be treated as a conversation or affect launch verify.
for (const href of [
  'app://-/index.html?initialRoute=%2Favatar-overlay',
  'app://-/detached-window.html?initialRoute=%2Fdetached-window',
]) {
  const auxiliary = { ...renamedShell, URL, location: { href } };
  assert.equal(vm.runInNewContext(CODEX_PROBE_EXPRESSION, auxiliary).codex, false,
    `Native auxiliary window must be excluded even with shell/editor: ${href}`);
  const fixture = createFixture();
  fixture.context.URL = URL;
  fixture.context.location = { href };
  fixture.markers.shell = true; fixture.markers.sidebar = true;
  vm.runInNewContext(earlyPayloadFor('window.installs.push("unexpected")', 'auxiliary'), fixture.context);
  assert.deepEqual(fixture.context.window.installs, [], 'Early hooks must also exclude auxiliary windows');
  const fontRoot = {};
  const fontContext = { ...earlyStyleContext, URL, location: { href },
    document: { ...earlyStyleContext.document, documentElement: fontRoot } };
  assert.equal(vm.runInNewContext(earlyFontBootstrapFor(), fontContext), false);
  assert.equal(fontRoot['data-dream-early-skin'], undefined);
}

const discoveryStart = source.indexOf("record.earlyScriptId = await registerEarly");
const probeStart = source.indexOf("const probe = await waitForCodexProbe", discoveryStart);
assert.ok(discoveryStart >= 0 && probeStart > discoveryStart, "Early registration must happen before full shell probing.");
assert.match(
  source,
  /finally\s*\{[\s\S]*Promise\.all\(\[\.\.\.sessions\.values\(\)\][\s\S]*removeEarly\(record\)/,
  "Watcher shutdown must unregister persistent Page scripts before closing CDP sessions.",
);
assert.match(
  source,
  /const earlyApplied = await session\.evaluate\([\s\S]*if \(!earlyApplied\) \{[\s\S]*applyToSession/,
  "The watcher must not run the full payload twice after a successful early install.",
);
assert.match(
  source,
  /if \(!hero\?\.visible\)\s*\{[\s\S]{0,120}\[data-feature="game-source"\]/,
  "Live verification must fall back to the current Codex home Hero when a leading banner slot is empty.",
);
assert.match(
  source,
  /visibleCards\.length === cardBoxes\.length[\s\S]{0,180}item\.y \+ item\.height <= composer\.y/,
  "Live verification must reject suggestion cards that are off-screen or covered by the composer.",
);

const musicCalls = [];
const musicSession = {
  async send(method, params) {
    musicCalls.push({ method, params });
    if (method === "DOM.getDocument") return { root: { nodeId: 7 } };
    if (method === "DOM.querySelector") return { nodeId: 9 };
    return {};
  },
  async evaluate(expression) {
    musicCalls.push({ method: "Runtime.evaluate", params: { expression } });
    return 2;
  },
};
assert.equal(await attachMusicFiles(musicSession, ["/safe/a.wav", "/safe/b.mp3"]), 2);
assert.deepEqual(musicCalls.slice(0, 3), [
  { method: "DOM.getDocument", params: { depth: 1 } },
  {
    method: "DOM.querySelector",
    params: { nodeId: 7, selector: "#codex-dream-skin-music-files" },
  },
  {
    method: "DOM.setFileInputFiles",
    params: { nodeId: 9, files: ["/safe/a.wav", "/safe/b.mp3"] },
  },
]);
assert.match(
  musicCalls[3].params.expression,
  /__CODEX_DREAM_SKIN_ATTACH_MUSIC__/,
  "The injector must notify the renderer after CDP supplies native File objects.",
);

console.log("PASS: early injection is shell-guarded, generation-safe, and removed on shutdown.");
