"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_controller_1.userController.getAll);
router.get("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_controller_1.userController.getById);
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_controller_1.userController.create);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_controller_1.userController.update);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_controller_1.userController.delete);
exports.default = router;
//# sourceMappingURL=user.routes.js.map