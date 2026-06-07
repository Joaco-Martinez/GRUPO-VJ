"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cbteCounterService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
exports.cbteCounterService = {
    async peekNext(ptoVta, cbteTipo) {
        const counter = await prisma_1.default.cbteCounter.findUnique({
            where: { ptoVta_cbteTipo: { ptoVta, cbteTipo } },
        });
        // Si no existe, el “último” es 0
        const last = counter?.lastNumber ?? 0;
        return last + 1;
    },
    async commitUsed(ptoVta, cbteTipo, usedNumber) {
        await prisma_1.default.cbteCounter.upsert({
            where: { ptoVta_cbteTipo: { ptoVta, cbteTipo } },
            create: { ptoVta, cbteTipo, lastNumber: usedNumber },
            update: { lastNumber: usedNumber },
        });
    },
};
//# sourceMappingURL=cbteCounter.service.js.map