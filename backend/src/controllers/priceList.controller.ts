import { Request, Response, NextFunction } from "express";
import { priceListService, PriceListType } from "../services/priceList.service";

function parseType(value: unknown): PriceListType {
  return value === "mayorista" ? "mayorista" : "minorista";
}

export const priceListController = {
  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const type = parseType(req.query.type);
      const buffer = await priceListService.exportExcel(type);

      const filename =
        type === "mayorista" ? "lista-precios-mayorista.xlsx" : "lista-precios-minorista.xlsx";

      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  async exportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const type = parseType(req.query.type);
      await priceListService.exportPDF(res, type);
    } catch (err) {
      next(err);
    }
  },
};
