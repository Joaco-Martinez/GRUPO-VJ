"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../config/timezone");
// src/scripts/renovarTokenAfip.ts
require("dotenv/config");
const prisma_1 = __importDefault(require("../prisma"));
const wsaa_service_1 = require("../afip/wsaa.service");
async function main() {
    console.log("🔑 Iniciando renovación de token AFIP desde Railway Cron...");
    await (0, wsaa_service_1.generarTokenAFIP)();
    console.log("✅ Token AFIP renovado correctamente.");
    await prisma_1.default.$disconnect();
    process.exit(0);
}
main().catch(async (error) => {
    console.error("❌ Error renovando token AFIP desde Railway Cron:", error);
    await prisma_1.default.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=afipRenovador.js.map