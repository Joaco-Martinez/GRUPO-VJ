"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitirFacturaB = emitirFacturaB;
const wsfe_base_service_1 = require("./wsfe-base.service");
async function emitirFacturaB({ saleId, cuit, tipoDoc, nroDoc, importe, condicionIVAReceptor = 5, }) {
    return (0, wsfe_base_service_1.emitirFacturaAFIPBase)({
        saleId,
        cuit,
        tipoComprobante: 6,
        tipoDoc,
        nroDoc,
        importe,
        condicionIVAReceptor,
    });
}
//# sourceMappingURL=wsfe-B.service.js.map