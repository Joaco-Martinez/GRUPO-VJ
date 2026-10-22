"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const factura_pdf_controller_1 = require("../controllers/factura-pdf.controller");
const router = (0, express_1.Router)();
router.get("/all", factura_pdf_controller_1.obtenerTodasLasFacturasController);
router.post("/:saleId/regenerar", factura_pdf_controller_1.regenerarFacturaPDFController);
router.get("/:saleId/descargar", factura_pdf_controller_1.descargarFacturaPDFController);
exports.default = router;
//# sourceMappingURL=factura-pdf.routes.js.map