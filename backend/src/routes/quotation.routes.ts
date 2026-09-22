import { Router } from "express";
import { quotationController } from "../controllers/quotation.controller";
import { authMiddleware, requireAnyRole } from "../middleware/auth";

const router = Router();

const staff = requireAnyRole(["ADMIN", "EMPLEADO"]);

router.get("/", authMiddleware, staff, quotationController.getAll);
router.get("/:id/pdf", authMiddleware, staff, quotationController.pdf);
router.get("/:id", authMiddleware, staff, quotationController.getOne);
router.post("/", authMiddleware, staff, quotationController.create);
router.put("/:id", authMiddleware, staff, quotationController.update);
router.delete("/:id", authMiddleware, staff, quotationController.remove);

export default router;
