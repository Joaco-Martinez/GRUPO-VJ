"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const category_controller_1 = require("../controllers/category.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, category_controller_1.categoryController.getAll);
router.get("/slug/:slug", auth_1.authMiddleware, category_controller_1.categoryController.getBySlug);
router.get("/:id", auth_1.authMiddleware, category_controller_1.categoryController.getById);
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), category_controller_1.categoryController.create);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), category_controller_1.categoryController.update);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), category_controller_1.categoryController.delete);
router.patch("/:id/restore", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), category_controller_1.categoryController.restore);
exports.default = router;
//# sourceMappingURL=category.routes.js.map