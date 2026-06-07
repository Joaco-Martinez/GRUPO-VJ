"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sale_controller_1 = require("../controllers/sale.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, sale_controller_1.saleController.getAll);
router.get("/pending", auth_1.authMiddleware, sale_controller_1.saleController.getPending);
router.post("/pending/bulk-update", auth_1.authMiddleware, sale_controller_1.saleController.bulkUpdate);
router.post("/", auth_1.authMiddleware, sale_controller_1.saleController.create);
router.patch("/:id/status", auth_1.authMiddleware, sale_controller_1.saleController.updateStatus);
router.patch("/:id/payment", auth_1.authMiddleware, sale_controller_1.saleController.updatePaymentMethod);
router.patch("/:id/payments", auth_1.authMiddleware, sale_controller_1.saleController.updatePayments);
router.post("/:id/nota-pedido", auth_1.authMiddleware, sale_controller_1.saleController.generarNotaPedido);
router.get("/:id/cotizacion-pdf", auth_1.authMiddleware, sale_controller_1.saleController.generarCotizacion);
router.get("/:id", auth_1.authMiddleware, sale_controller_1.saleController.getById);
exports.default = router;
//# sourceMappingURL=sale.routes.js.map