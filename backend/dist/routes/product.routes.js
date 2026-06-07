"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_1 = require("../controllers/product.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Movimientos
router.get("/movements", auth_1.authMiddleware, product_controller_1.productController.getMovements);
// Stock UNIT
router.post("/transfer", auth_1.authMiddleware, product_controller_1.productController.transferStock);
router.post("/add-stock", auth_1.authMiddleware, product_controller_1.productController.addStock);
// Stock KG
router.post("/:id/transfer-kg", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.transferStockKg);
router.post("/:id/add-stock-kg", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.addStockKg);
// SKU
router.get("/sku/:sku", auth_1.authMiddleware, product_controller_1.productController.getBySku);
// CRUD
router.get("/", auth_1.authMiddleware, product_controller_1.productController.getAll);
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.create);
// Producto compuesto: definir/actualizar componentes de una promo
router.put("/:id/components", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.updateComponents);
// Actualizar imagen
router.patch("/:id/image", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.updateImage);
// Dinámicas
router.get("/:id", auth_1.authMiddleware, product_controller_1.productController.getById);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.update);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), product_controller_1.productController.delete);
exports.default = router;
//# sourceMappingURL=product.routes.js.map