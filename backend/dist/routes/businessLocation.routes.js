"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessLocation_controller_1 = require("../controllers/businessLocation.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), businessLocation_controller_1.businessLocationController.create);
router.get("/", auth_1.authMiddleware, businessLocation_controller_1.businessLocationController.getAll);
router.get("/:id", auth_1.authMiddleware, businessLocation_controller_1.businessLocationController.getOne);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), businessLocation_controller_1.businessLocationController.update);
router.patch("/:id/default", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), businessLocation_controller_1.businessLocationController.setDefault);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), businessLocation_controller_1.businessLocationController.remove);
exports.default = router;
//# sourceMappingURL=businessLocation.routes.js.map