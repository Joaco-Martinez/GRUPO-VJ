import { Router } from "express";
import { clientController } from "../controllers/client.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.post("/", authMiddleware, requireRole("ADMIN"), clientController.create);
router.get("/", authMiddleware, clientController.getAll);
router.get("/:id", authMiddleware, clientController.getOne);
router.put("/:id", authMiddleware, requireRole("ADMIN"), clientController.update);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), clientController.remove);

export default router;