import { Router } from "express";
import { settingsController } from "../controllers/settings.controller";
import { authMiddleware, requireAnyRole, requireRole } from "../middleware/auth";

const router = Router();

router.get("/delivery", authMiddleware, requireAnyRole(["ADMIN", "EMPLEADO"]), settingsController.getDelivery);
router.put("/delivery", authMiddleware, requireRole("ADMIN"), settingsController.updateDelivery);

export default router;
