import { openSync } from "node:fs";
import { spawn } from "node:child_process";

const [nodePath, injectorPath, port, themeDir, outputPath, errorPath] = process.argv.slice(2);
if (![nodePath, injectorPath, port, themeDir, outputPath, errorPath].every(Boolean)) {
  throw new Error("Usage: spawn-detached-injector.mjs <node> <injector> <port> <theme-dir> <output> <error>");
}

const output = openSync(outputPath, "a", 0o600);
const errors = openSync(errorPath, "a", 0o600);
const child = spawn(
  nodePath,
  [injectorPath, "--watch", "--port", port, "--theme-dir", themeDir],
  {
    detached: true,
    stdio: ["ignore", output, errors],
    windowsHide: true,
  },
);
child.unref();
process.stdout.write(`${child.pid}\n`);
