import { spawn } from "node:child_process";
import { resolveStandaloneLayout, getAppRoot } from "./standalone-utils.mjs";

const appRoot = getAppRoot(import.meta.url);
const layout = resolveStandaloneLayout(appRoot);

if (!layout) {
  console.error(
    "Standalone server not found. Run `pnpm build` before `pnpm start`.",
  );
  process.exit(1);
}

const child = spawn(process.execPath, [layout.serverPath], {
  cwd: layout.standaloneRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
