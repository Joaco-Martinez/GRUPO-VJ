import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
} from "../middleware/auth";

const router = Router();

router.get("/categories", catalogController.getCategories);

router.get(
  "/products",
  optionalAuthMiddleware,
  catalogController.getProducts
);

router.post(
  "/validate-cart",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.validateCart
);

router.post(
  "/checkout-whatsapp",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.checkoutWhatsapp
);

router.get(
  "/orders",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.getOrders
);

router.get(
  "/orders/:id",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.getOrder
);

router.patch(
  "/orders/:id",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.updateOrder
);

export default router;