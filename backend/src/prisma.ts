import { PrismaClient } from "@prisma/client";

function buildDatabaseUrl() {
  const raw = process.env.DATABASE_URL;

  if (!raw) return undefined;

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  // Prisma usa por default connection_limit = num_cpus*2+1, que en un
  // contenedor de 1 vCPU son apenas ~3 conexiones. Con varios requests en
  // paralelo (dashboard, POS, varios empleados a la vez) el pool se agota
  // y las queries quedan encoladas hasta el pool_timeout, generando
  // latencias de varios segundos aunque las queries en sí sean rápidas.
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set(
      "connection_limit",
      process.env.DATABASE_CONNECTION_LIMIT || "10",
    );
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set(
      "pool_timeout",
      process.env.DATABASE_POOL_TIMEOUT || "20",
    );
  }

  return url.toString();
}

const databaseUrl = buildDatabaseUrl();

const prisma = new PrismaClient(
  databaseUrl
    ? {
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      }
    : undefined,
);

export default prisma;
