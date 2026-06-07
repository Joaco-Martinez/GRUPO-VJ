"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notaCreditoPdf_controller_1 = require("../controllers/notaCreditoPdf.controller");
const router = (0, express_1.Router)();
router.get("/:saleId/descargar", notaCreditoPdf_controller_1.notaCreditoPdfController.descargar);
exports.default = router;
//# sourceMappingURL=notaCreditoPdf.routes.js.map