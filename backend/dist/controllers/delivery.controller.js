"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryController = void 0;
const delivery_service_1 = require("../services/delivery.service");
function toNumber(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
exports.deliveryController = {
    async calculate(req, res, next) {
        try {
            const { businessLocationId, clientId } = req.body;
            if (!businessLocationId) {
                return res.status(400).json({
                    ok: false,
                    message: "businessLocationId es requerido",
                });
            }
            if (!clientId) {
                return res.status(400).json({
                    ok: false,
                    message: "clientId es requerido",
                });
            }
            const result = await delivery_service_1.deliveryService.calculate({
                businessLocationId,
                clientId,
                pricePerKm: toNumber(req.body.pricePerKm),
            });
            res.json({
                ok: true,
                ...result,
            });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=delivery.controller.js.map