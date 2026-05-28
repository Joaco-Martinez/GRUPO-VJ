import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  authController.deleteUser
);

export default router;