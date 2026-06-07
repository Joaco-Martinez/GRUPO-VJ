"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_controller_1 = require("../controllers/client.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.create);
router.get("/", auth_1.authMiddleware, client_controller_1.clientController.getAll);
router.get("/:id", auth_1.authMiddleware, client_controller_1.clientController.getOne);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.update);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.remove);
exports.default = router;
//# sourceMappingURL=client.routes.js.map