"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("../prisma"));
const sale_service_1 = require("../services/sale.service");
async function main() {
    const limit = Number(process.env.EXPIRE_QUOTATIONS_LIMIT ?? 100);
    console.log("[expirePendingQuotations] Iniciando job...");
    console.log(`[expirePendingQuotations] Límite: ${limit}`);
    const result = await sale_service_1.saleService.expirePendingQuotations(limit);
    console.log("[expirePendingQuotations] Resultado:");
    console.log(JSON.stringify(result, null, 2));
}
main()
    .catch((error) => {
    console.error("[expirePendingQuotations] Error:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=expirePendingQuotations.js.map