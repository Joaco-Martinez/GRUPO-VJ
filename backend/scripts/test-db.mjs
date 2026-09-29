// Levanta un PostgreSQL local para testeos (no hace falta instalar Postgres).
//
//   npm run testdb        -> deja la base corriendo en localhost:5433 (Ctrl+C para cortar)
//
// Los datos quedan en backend/.testdb/ (ignorado por git). Borrá esa carpeta
// para empezar de cero.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(here, "../.testdb");
const PORT = 5433;
const DB_NAME = "vonkonig_test";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

const isNew = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));

if (isNew) {
  await pg.initialise();
}

await pg.start();

if (isNew) {
  await pg.createDatabase(DB_NAME);
}

console.log("");
console.log(`🐘 Postgres de testeo corriendo en localhost:${PORT}`);
console.log(`   DATABASE_URL="postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}"`);
console.log("   Ctrl+C para detenerlo.");
console.log("");

let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Mantener vivo el proceso.
setInterval(() => {}, 1 << 30);
