"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_child_process_1 = require("node:child_process");
const prisma = new client_1.PrismaClient();
/**
 * Reinicia el schema public completo y luego aplica migraciones de Prisma.
 * Funciona en Postgres.
 */
async function main() {
    console.log("🧨 RESET DB: arrancando...");
    // 1) Verificación mínima para evitar accidentes
    const dbUrl = process.env.DATABASE_URL || "";
    if (!dbUrl)
        throw new Error("Falta DATABASE_URL");
    // Tip: si querés bloquear producción, descomentá:
    // if (dbUrl.includes("railway") || dbUrl.includes("render") || dbUrl.includes("prod")) {
    //   throw new Error("Bloqueado: parece una base de producción.");
    // }
    console.log("🗑️  Borrando schema public...");
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE;`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public;`);
    // permisos típicos (opcional, pero recomendado)
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public;`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres;`);
    console.log("✅ Schema public recreado.");
    // 2) Aplicar migraciones (carga los nuevos schemas)
    console.log("📦 Aplicando migraciones Prisma (migrate deploy)...");
    (0, node_child_process_1.execSync)("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("✅ Migraciones aplicadas.");
    // 3) (Opcional) Seed si lo tenés
    // console.log("🌱 Corriendo seed...");
    // execSync("npx prisma db seed", { stdio: "inherit" });
    console.log("🎉 RESET DB: terminado.");
}
main()
    .catch((e) => {
    console.error("❌ Reset falló:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=reset.js.map