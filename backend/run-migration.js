#!/usr/bin/env node
/**
 * One-time production migration runner.
 *
 * Applies any pending Prisma migrations (including
 * `20260904120000_add_providers`, which creates the "Provider" table and
 * adds the nullable "providerId" column + FK to "Purchase") to the database
 * pointed to by DATABASE_URL.
 *
 * This is a thin wrapper around `npx prisma migrate deploy` so it can be
 * invoked directly in the production container (e.g. via `node
 * run-migration.js` or a one-off Railway command) without needing to change
 * the container's entrypoint/start command.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node run-migration.js
 *
 * Exit code is 0 on success, non-zero on failure.
 */

const { spawnSync } = require("child_process");

function run() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "[run-migration] ERROR: DATABASE_URL environment variable is not set. " +
        "Aborting to avoid running against an unknown/default database."
    );
    process.exit(1);
  }

  console.log("[run-migration] Applying pending Prisma migrations...");
  console.log("[run-migration] Command: npx prisma migrate deploy");

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error("[run-migration] Failed to start prisma CLI:", result.error);
    process.exit(1);
  }

  const exitCode = result.status === null ? 1 : result.status;

  if (exitCode === 0) {
    console.log(
      "[run-migration] Migrations applied successfully. " +
        '"Provider" table and "Purchase.providerId" column are now in sync with prisma/schema.prisma.'
    );
  } else {
    console.error(
      `[run-migration] prisma migrate deploy exited with code ${exitCode}. ` +
        "Migration was NOT applied successfully. Check the output above for details."
    );
  }

  process.exit(exitCode);
}

run();
