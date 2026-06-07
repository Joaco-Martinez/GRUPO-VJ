"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const afipRetry_worker_1 = require("./cron/afipRetry.worker");
console.log("🚀 Worker AFIP iniciado");
setInterval(async () => {
    try {
        await (0, afipRetry_worker_1.processAfipPendingInvoices)();
    }
    catch (err) {
        console.error("❌ Error en worker AFIP:", err?.message);
    }
}, 60 * 1000); // cada 1 minuto
//# sourceMappingURL=worker.js.map