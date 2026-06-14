import { cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function getAppRoot(importMetaUrl) {
  return join(dirname(fileURLToPath(importMetaUrl)), "..");
}

export function resolveStandaloneLayout(appRoot) {
  const appSlug = basename(appRoot);
  const candidates = [
    {
      standaloneRoot: join(appRoot, ".next/standalone"),
      serverPath: join(appRoot, ".next/standalone/server.js"),
      staticTarget: join(appRoot, ".next/standalone/.next/static"),
    },
    {
      standaloneRoot: join(appRoot, ".next/standalone/apps", appSlug),
      serverPath: join(appRoot, ".next/standalone/apps", appSlug, "server.js"),
      staticTarget: join(
        appRoot,
        ".next/standalone/apps",
        appSlug,
        ".next/static",
      ),
    },
  ];

  for (const layout of candidates) {
    if (existsSync(layout.serverPath)) {
      return layout;
    }
  }

  return null;
}

export function prepareStandaloneOutput(appRoot) {
  const layout = resolveStandaloneLayout(appRoot);
  if (!layout) {
    console.error(
      "Missing standalone server output. Expected .next/standalone/server.js or a monorepo nested server.js.",
    );
    process.exit(1);
  }

  const staticSource = join(appRoot, ".next/static");
  const publicSource = join(appRoot, "public");
  const publicTarget = join(layout.standaloneRoot, "public");

  if (existsSync(staticSource)) {
    mkdirSync(dirname(layout.staticTarget), { recursive: true });
    cpSync(staticSource, layout.staticTarget, { recursive: true });
  }

  if (existsSync(publicSource)) {
    cpSync(publicSource, publicTarget, { recursive: true });
  }

  console.log(`Prepared standalone output at ${layout.serverPath}`);
  return layout;
}
