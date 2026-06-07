"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketController = void 0;
const ticket_service_1 = require("../services/ticket.service");
exports.ticketController = {
    async printSaleTicket(req, res) {
        try {
            const { saleId } = req.params;
            if (!saleId || Array.isArray(saleId)) {
                return res.status(400).json({
                    ok: false,
                    error: "saleId es requerido",
                });
            }
            const result = await ticket_service_1.ticketService.printSaleTicket(saleId);
            return res.status(200).json({
                ok: true,
                message: "Ticket no fiscal enviado a impresión.",
                data: result,
            });
        }
        catch (err) {
            console.error("❌ Error imprimiendo ticket no fiscal:", err);
            return res.status(500).json({
                ok: false,
                error: err.message || "No se pudo imprimir el ticket.",
            });
        }
    },
};
//# sourceMappingURL=ticket.controller.js.map