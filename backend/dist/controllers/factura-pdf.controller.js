"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerarFacturaPDFController = regenerarFacturaPDFController;
exports.obtenerTodasLasFacturasController = obtenerTodasLasFacturasController;
exports.descargarFacturaPDFController = descargarFacturaPDFController;
const factura_pdf_service_1 = require("../services/factura-pdf.service");
const params_1 = require("../utils/params");
async function regenerarFacturaPDFController(req, res) {
    try {
        const { saleId } = req.params;
        const uploadToCloudinary = req.query.cloudinary === "true";
        const result = await (0, factura_pdf_service_1.regenerarFacturaPDFService)((0, params_1.getParamAsString)(saleId, "saleId"), uploadToCloudinary);
        return res.status(200).json({
            ok: true,
            message: "Factura PDF regenerada correctamente",
            content: result,
        });
    }
    catch (error) {
        console.error("❌ Error regenerando factura PDF:", error);
        return res.status(400).json({
            ok: false,
            message: error.message || "No se pudo regenerar la factura PDF",
        });
    }
}
async function obtenerTodasLasFacturasController(req, res) {
    try {
        const facturas = await (0, factura_pdf_service_1.obtenerTodasLasFacturasService)();
        return res.status(200).json({
            ok: true,
            content: facturas,
        });
    }
    catch (error) {
        console.error("❌ Error obteniendo facturas:", error);
        return res.status(500).json({
            ok: false,
            message: error.message || "No se pudieron obtener las facturas",
        });
    }
}
async function descargarFacturaPDFController(req, res) {
    try {
        const { saleId } = req.params;
        const { filePath, fileName } = await (0, factura_pdf_service_1.obtenerFacturaPDFPathService)((0, params_1.getParamAsString)(saleId, "saleId"));
        return res.download(filePath, fileName, (err) => {
            if (err) {
                console.error("❌ Error al descargar PDF:", err);
                if (!res.headersSent) {
                    res.status(500).json({
                        ok: false,
                        message: "Error al descargar el PDF",
                    });
                }
            }
        });
    }
    catch (error) {
        console.error("❌ Error obteniendo factura PDF:", error);
        return res.status(400).json({
            ok: false,
            message: error.message || "No se pudo descargar la factura PDF",
        });
    }
}
//# sourceMappingURL=factura-pdf.controller.js.map