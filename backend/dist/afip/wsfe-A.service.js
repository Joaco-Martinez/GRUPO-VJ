"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitirFacturaA = emitirFacturaA;
const wsfe_base_service_1 = require("./wsfe-base.service");
async function emitirFacturaA({ saleId, cuit, nroDoc, importe, condicionIVAReceptor = 1, }) {
    return (0, wsfe_base_service_1.emitirFacturaAFIPBase)({
        saleId,
        cuit,
        tipoComprobante: 1,
        tipoDoc: 80,
        nroDoc,
        importe,
        condicionIVAReceptor,
    });
}
//# sourceMappingURL=wsfe-A.service.js.map