import { Request, Response, NextFunction } from "express";
import { settingsService } from "../services/settings.service";

export const settingsController = {
  async getDelivery(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getDeliverySettings();
      return res.json({ ok: true, ...settings });
    } catch (error) {
      return next(error);
    }
  },

  async updateDelivery(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.updateDeliverySettings({
        pricePerKm: req.body?.pricePerKm,
      });
      return res.json({ ok: true, ...settings });
    } catch (error: any) {
      if (error?.message?.includes("precio por km")) {
        return res.status(400).json({ ok: false, message: error.message });
      }
      return next(error);
    }
  },
};
