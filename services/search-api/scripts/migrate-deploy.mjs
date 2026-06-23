import { spawnSync } from "node:child_process";

const ROLLED_BACK_MIGRATIONS = [
  "20260610120000_tier1_tier2_search_platform",
  "20260610140000_tier3_tier4_platform",
];

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

for (const migration of ROLLED_BACK_MIGRATIONS) {
  run("npx", ["prisma", "migrate", "resolve", "--rolled-back", migration], {
    allowFailure: true,
  });
}

run("npx", ["prisma", "migrate", "deploy"]);
