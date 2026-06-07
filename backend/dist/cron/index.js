"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const afipRenovador_1 = require("./afipRenovador");
(async () => {
    console.log("🟡 Servicio de cron AFIP iniciado...");
    await (0, afipRenovador_1.iniciarRenovacionAutomatica)();
})();
//# sourceMappingURL=index.js.map