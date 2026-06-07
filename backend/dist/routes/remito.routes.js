"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const remito_controller_1 = require("../controllers/remito.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.post("/from-sale/:saleId", remito_controller_1.remitoController.createFromSale);
router.get("/", remito_controller_1.remitoController.getAll);
router.get("/:id/pdf", remito_controller_1.remitoController.downloadPdf);
router.get("/:id", remito_controller_1.remitoController.getById);
router.post("/:id/regenerate-pdf", remito_controller_1.remitoController.regeneratePdf);
router.patch("/:id/delivered", remito_controller_1.remitoController.markAsDelivered);
router.patch("/:id/cancel", remito_controller_1.remitoController.cancel);
exports.default = router;
//# sourceMappingURL=remito.routes.js.map