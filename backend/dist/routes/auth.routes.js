"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/register", auth_controller_1.authController.register);
router.post("/login", auth_controller_1.authController.login);
router.post("/logout", auth_controller_1.authController.logout);
router.get("/me", auth_controller_1.authController.me);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), auth_controller_1.authController.deleteUser);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map