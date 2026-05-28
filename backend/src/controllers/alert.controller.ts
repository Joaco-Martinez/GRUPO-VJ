import { Request, Response } from "express";
import alertService from "../services/alert.service";

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = await alertService.getAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener alertas" });
  }
};
