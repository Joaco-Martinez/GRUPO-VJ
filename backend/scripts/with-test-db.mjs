// Corre un comando apuntando a la base local de testeo (scripts/test-db.mjs)
// en vez de la DATABASE_URL del .env. dotenv y Prisma no pisan variables que
// ya están en el entorno, así que esta tiene prioridad.
//
//   node scripts/with-test-db.mjs <comando> [args...]
import { spawn } from "node:child_process";

const TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/vonkonig_test";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Uso: node scripts/with-test-db.mjs <comando> [args...]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
});

child.on("exit", (code) => process.exit(code ?? 1));
