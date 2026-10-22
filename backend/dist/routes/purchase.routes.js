"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const purchase_controller_1 = require("../controllers/purchase.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, purchase_controller_1.purchaseController.getAll);
router.get("/:id", auth_1.authMiddleware, purchase_controller_1.purchaseController.getById);
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), purchase_controller_1.purchaseController.create);
router.patch("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), purchase_controller_1.purchaseController.update);
router.patch("/:id/provider", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), purchase_controller_1.purchaseController.updateProvider);
router.patch("/:id/cancel", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), purchase_controller_1.purchaseController.cancel);
exports.default = router;
//# sourceMappingURL=purchase.routes.js.map