"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitirFacturaCConsumidorFinal = emitirFacturaCConsumidorFinal;
exports.emitirFacturaCACliente = emitirFacturaCACliente;
const wsfe_base_service_1 = require("./wsfe-base.service");
async function emitirFacturaCConsumidorFinal({ saleId, cuit, importe, }) {
    return (0, wsfe_base_service_1.emitirFacturaAFIPBase)({
        saleId,
        cuit,
        tipoComprobante: 11,
        tipoDoc: 99,
        nroDoc: 0,
        importe,
        condicionIVAReceptor: 5,
    });
}
async function emitirFacturaCACliente({ saleId, cuit, tipoDoc, nroDoc, importe, condicionIVAReceptor = 5, }) {
    return (0, wsfe_base_service_1.emitirFacturaAFIPBase)({
        saleId,
        cuit,
        tipoComprobante: 11,
        tipoDoc,
        nroDoc,
        importe,
        condicionIVAReceptor,
    });
}
//# sourceMappingURL=wsfe-C.service.js.map