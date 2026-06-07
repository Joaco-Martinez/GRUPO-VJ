"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.iniciarRenovacionAutomatica = iniciarRenovacionAutomatica;
const node_cron_1 = __importDefault(require("node-cron"));
const wsaa_service_1 = require("./wsaa.service");
async function iniciarRenovacionAutomatica() {
    console.log("🚀 Iniciando servicio de renovación automática del token AFIP...");
    // 🔹 Ejecuta inmediatamente al iniciar el servidor
    try {
        console.log("🔑 Generando token inicial de AFIP...");
        await (0, wsaa_service_1.generarTokenAFIP)();
        console.log("✅ Token AFIP inicial generado correctamente.");
    }
    catch (err) {
        console.error("❌ Error al generar el token inicial:", err);
    }
    // 🔁 Luego programa la renovación cada 11 horas
    node_cron_1.default.schedule("0 */11 * * *", async () => {
        console.log("⏰ Renovación automática del token AFIP...");
        try {
            await (0, wsaa_service_1.generarTokenAFIP)();
            console.log("✅ Token AFIP renovado correctamente.");
        }
        catch (err) {
            console.error("❌ Error en renovación automática:", err);
        }
    });
}
//# sourceMappingURL=cron.service.js.map