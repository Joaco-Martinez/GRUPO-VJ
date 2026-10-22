"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function seedAdmin() {
    const password = await bcryptjs_1.default.hash("admin123", 10);
    const admin = await prisma.user.upsert({
        where: {
            email: "admin@grupovj.com",
        },
        update: {
            name: "Administrador",
            role: client_1.Role.ADMIN,
            password,
        },
        create: {
            email: "admin@grupovj.com",
            password,
            name: "Administrador",
            role: client_1.Role.ADMIN,
        },
    });
    return admin;
}
async function main() {
    console.log("🌱 Iniciando seed...");
    const admin = await seedAdmin();
    console.log("");
    console.log("✅ Seed finalizado correctamente");
    console.log("");
    console.log("🔐 Usuario admin creado/actualizado:");
    console.log(`ID: ${admin.id}`);
    console.log("Email: admin@grupovj.com");
    console.log("Password: admin123");
    console.log("");
}
main()
    .catch((error) => {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map