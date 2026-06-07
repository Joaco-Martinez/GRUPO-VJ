"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printCashCloseController = printCashCloseController;
const cashClosePrint_service_1 = require("../services/cashClosePrint.service");
async function printCashCloseController(req, res) {
    console.log("Iniciando impresión de cierre de caja...");
    try {
        const result = await (0, cashClosePrint_service_1.printCashClose)(req.body);
        console.log("PRINT BODY:", req.body);
        return res.status(200).json({
            message: "Cierre enviado a impresión",
            ...result,
        });
    }
    catch (err) {
        console.error("❌ Error print cash close:", err?.message || err);
        return res.status(400).json({
            message: err?.message || "Error al imprimir cierre de caja",
        });
    }
}
//# sourceMappingURL=cashClosePrint.controller.js.map