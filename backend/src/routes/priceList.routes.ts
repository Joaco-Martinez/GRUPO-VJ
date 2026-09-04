import { Router } from "express";
import { priceListController } from "../controllers/priceList.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/export/excel", authMiddleware, priceListController.exportExcel);
router.get("/export/pdf", authMiddleware, priceListController.exportPDF);

export default router;
