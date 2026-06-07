"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const catalog_controller_1 = require("../controllers/catalog.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/categories", catalog_controller_1.catalogController.getCategories);
router.get("/products", auth_1.optionalAuthMiddleware, catalog_controller_1.catalogController.getProducts);
router.post("/checkout-whatsapp", auth_1.authMiddleware, (0, auth_1.requireRole)("CLIENTE"), catalog_controller_1.catalogController.checkoutWhatsapp);
exports.default = router;
//# sourceMappingURL=catalog.routes.js.map