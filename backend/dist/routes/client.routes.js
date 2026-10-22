"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_controller_1 = require("../controllers/client.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Registro público desde /tienda
router.post("/tienda/register", client_controller_1.clientController.registerFromStore);
// Reset público de contraseña desde /tienda
router.post("/tienda/forgot-password", client_controller_1.clientController.forgotPassword);
router.post("/tienda/reset-password", client_controller_1.clientController.resetPassword);
// Rutas internas ERP
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.create);
router.get("/", auth_1.authMiddleware, client_controller_1.clientController.getAll);
router.get("/:id", auth_1.authMiddleware, client_controller_1.clientController.getOne);
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.update);
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.remove);
router.patch("/:id/deactivate", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.deactivate);
router.patch("/:id/activate", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), client_controller_1.clientController.activate);
exports.default = router;
//# sourceMappingURL=client.routes.js.map