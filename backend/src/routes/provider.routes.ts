import { Router } from "express";
import { providerController } from "../controllers/provider.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, providerController.getAll);
router.get("/:id", authMiddleware, providerController.getOne);
router.post("/", authMiddleware, requireRole("ADMIN"), providerController.create);
router.put("/:id", authMiddleware, requireRole("ADMIN"), providerController.update);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), providerController.remove);
router.patch("/:id/deactivate", authMiddleware, requireRole("ADMIN"), providerController.deactivate);
router.patch("/:id/activate", authMiddleware, requireRole("ADMIN"), providerController.activate);

export default router;
