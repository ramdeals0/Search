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

const env = {
  ...process.env,
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  PORT: process.env.PORT || "3000",
};

console.log(
  `Starting standalone server (${layout.serverPath}) on ${env.HOSTNAME}:${env.PORT}`,
);

const child = spawn(process.execPath, [layout.serverPath], {
  cwd: layout.standaloneRoot,
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
