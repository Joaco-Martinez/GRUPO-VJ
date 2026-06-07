"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = void 0;
const alert_service_1 = __importDefault(require("../services/alert.service"));
const getAlerts = async (req, res) => {
    try {
        const alerts = await alert_service_1.default.getAlerts();
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: "Error al obtener alertas" });
    }
};
exports.getAlerts = getAlerts;
//# sourceMappingURL=alert.controller.js.map