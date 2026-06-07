"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_controller_1 = require("../controllers/delivery.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/calculate", auth_1.authMiddleware, delivery_controller_1.deliveryController.calculate);
exports.default = router;
//# sourceMappingURL=delivery.routes.js.map