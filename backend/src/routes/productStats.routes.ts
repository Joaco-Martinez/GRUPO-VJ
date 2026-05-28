import { Router } from "express";
import { productStatsController } from "../controllers/productStast.controller";

const router = Router();

router.get("/top", productStatsController.getTop);
router.get("/worst", productStatsController.getWorst);
router.get("/top-range", productStatsController.getTopRange);
router.get("/best-month", productStatsController.getBestMonth);
router.get("/worst-month", productStatsController.getWorstMonth);

// ✅ NUEVOS
router.get("/totals", productStatsController.getTotals);
router.get("/totals-range", productStatsController.getTotalsRange);

export default router;
