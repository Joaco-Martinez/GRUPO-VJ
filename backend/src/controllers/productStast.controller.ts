import { Request, Response } from "express";
import { productStatsService } from "../services/productStats.service";

function parseUnit(unit: any): "UNIT" | "KG" | undefined {
  if (!unit) return undefined;
  const u = String(unit).toUpperCase();
  return u === "UNIT" || u === "KG" ? (u as any) : undefined;
}

export const productStatsController = {
  async getTop(req: Request, res: Response) {
    try {
      const { limit = 5, unit } = req.query;
      const stats = await productStatsService.getTopProducts(Number(limit), parseUnit(unit));
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Error al obtener productos más vendidos" });
    }
  },

  async getWorst(req: Request, res: Response) {
    try {
      const { limit = 5, unit } = req.query;
      const stats = await productStatsService.getWorstProducts(Number(limit), parseUnit(unit));
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Error al obtener productos menos vendidos" });
    }
  },

  async getTopRange(req: Request, res: Response) {
    try {
      const { start, end, limit = 5, unit } = req.query;
      if (!start || !end) return res.status(400).json({ error: "Faltan fechas" });

      const stats = await productStatsService.getTopProductsByRange(
        new Date(start as string),
        new Date(end as string),
        Number(limit),
        parseUnit(unit)
      );

      res.json(stats);
    } catch {
      res.status(500).json({ error: "Error al obtener productos en rango" });
    }
  },

  async getBestMonth(req: Request, res: Response) {
    try {
      const { year, month, unit } = req.query;
      if (!year || !month) return res.status(400).json({ error: "Faltan parámetros (year, month)" });

      const stat = await productStatsService.getBestProductByMonth(
        Number(year),
        Number(month),
        parseUnit(unit)
      );

      res.json(stat);
    } catch {
      res.status(500).json({ error: "Error al obtener producto top del mes" });
    }
  },

  async getWorstMonth(req: Request, res: Response) {
    try {
      const { year, month, unit } = req.query;
      if (!year || !month) return res.status(400).json({ error: "Faltan parámetros (year, month)" });

      const stat = await productStatsService.getWorstProductByMonth(
        Number(year),
        Number(month),
        parseUnit(unit)
      );

      res.json(stat);
    } catch {
      res.status(500).json({ error: "Error al obtener producto peor del mes" });
    }
  },

  // ✅ NUEVO: totales globales
  async getTotals(req: Request, res: Response) {
    try {
      const { limit = 50, unit } = req.query;
      const data = await productStatsService.getTotals(Number(limit), parseUnit(unit));
      res.json(data);
    } catch {
      res.status(500).json({ error: "Error al obtener totales de productos" });
    }
  },

  // ✅ NUEVO: totales por rango
  async getTotalsRange(req: Request, res: Response) {
    try {
      const { start, end, limit = 50, unit } = req.query;
      if (!start || !end) return res.status(400).json({ error: "Faltan fechas" });

      const data = await productStatsService.getTotalsByRange(
        new Date(start as string),
        new Date(end as string),
        Number(limit),
        parseUnit(unit)
      );

      res.json(data);
    } catch {
      res.status(500).json({ error: "Error al obtener totales por rango" });
    }
  },
};
