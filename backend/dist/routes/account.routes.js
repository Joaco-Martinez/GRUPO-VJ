"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const account_controller_1 = require("../controllers/account.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/movements", auth_1.authMiddleware, account_controller_1.accountController.getMovements);
router.get("/debtors", auth_1.authMiddleware, account_controller_1.accountController.getDebtors);
router.get("/clients/:clientId", auth_1.authMiddleware, account_controller_1.accountController.getClientAccount);
router.post("/clients/:clientId/payment", auth_1.authMiddleware, account_controller_1.accountController.registerPayment);
router.post("/clients/:clientId/adjustment", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), account_controller_1.accountController.createAdjustment);
router.patch("/clients/:clientId/config", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), account_controller_1.accountController.updateClientAccountConfig);
exports.default = router;
//# sourceMappingURL=account.routes.js.map