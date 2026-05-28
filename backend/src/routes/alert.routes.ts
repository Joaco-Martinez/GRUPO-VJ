import { Router } from "express";
import { getAlerts } from "../controllers/alert.controller";

const router = Router();

router.get("/", getAlerts);

export default router;
