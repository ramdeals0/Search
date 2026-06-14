import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = join(appRoot, ".next/standalone");
const staticSource = join(appRoot, ".next/static");
const staticTarget = join(standaloneRoot, ".next/static");
const publicSource = join(appRoot, "public");
const publicTarget = join(standaloneRoot, "public");

if (!existsSync(join(standaloneRoot, "server.js"))) {
  console.error("Missing .next/standalone/server.js. Run `next build` first.");
  process.exit(1);
}

if (existsSync(staticSource)) {
  mkdirSync(dirname(staticTarget), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

if (existsSync(publicSource)) {
  cpSync(publicSource, publicTarget, { recursive: true });
}

console.log("Prepared standalone output for production start.");
