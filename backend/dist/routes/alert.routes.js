"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alert_controller_1 = require("../controllers/alert.controller");
const router = (0, express_1.Router)();
router.get("/", alert_controller_1.getAlerts);
exports.default = router;
//# sourceMappingURL=alert.routes.js.map