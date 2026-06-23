import { spawnSync } from "node:child_process";

const FAILED_MIGRATION = "20260610120000_tier1_tier2_search_platform";

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result.status ?? 0;
}

// Recover from a previously failed tier1 migration (P3009) then apply pending migrations.
run("npx", ["prisma", "migrate", "resolve", "--rolled-back", FAILED_MIGRATION], {
  allowFailure: true,
});

run("npx", ["prisma", "migrate", "deploy"]);
