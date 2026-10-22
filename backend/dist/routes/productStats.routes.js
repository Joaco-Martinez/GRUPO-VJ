"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productStast_controller_1 = require("../controllers/productStast.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/top", auth_1.authMiddleware, productStast_controller_1.productStatsController.getTop);
router.get("/worst", auth_1.authMiddleware, productStast_controller_1.productStatsController.getWorst);
router.get("/top-range", auth_1.authMiddleware, productStast_controller_1.productStatsController.getTopRange);
router.get("/worst-range", auth_1.authMiddleware, productStast_controller_1.productStatsController.getWorstRange);
router.get("/best-month", auth_1.authMiddleware, productStast_controller_1.productStatsController.getBestMonth);
router.get("/worst-month", auth_1.authMiddleware, productStast_controller_1.productStatsController.getWorstMonth);
router.get("/totals", auth_1.authMiddleware, productStast_controller_1.productStatsController.getTotals);
router.get("/totals-range", auth_1.authMiddleware, productStast_controller_1.productStatsController.getTotalsRange);
exports.default = router;
//# sourceMappingURL=productStats.routes.js.map