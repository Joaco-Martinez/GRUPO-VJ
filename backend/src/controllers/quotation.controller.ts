import { Request, Response, NextFunction } from "express";
import { quotationService } from "../services/quotation.service";
import { getParamAsString } from "../utils/params";

export const quotationController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const quotations = await quotationService.getAll({ search });

      res.json({
        ok: true,
        quotations,
      });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const quotation = await quotationService.getById(getParamAsString(req.params.id, "id"));

      if (!quotation) {
        return res.status(404).json({
          ok: false,
          message: "Cotización no encontrada",
        });
      }

      res.json({
        ok: true,
        quotation,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id ?? null;
      const quotation = await quotationService.create(req.body, userId);

      res.status(201).json({
        ok: true,
        quotation,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const quotation = await quotationService.update(
        getParamAsString(req.params.id, "id"),
        req.body
      );

      res.json({
        ok: true,
        quotation,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await quotationService.remove(getParamAsString(req.params.id, "id"));

      res.json({
        ok: true,
        message: "Cotización eliminada correctamente",
      });
    } catch (error) {
      next(error);
    }
  },

  async pdf(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quotationService.generatePdf(getParamAsString(req.params.id, "id"));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("Content-Length", result.buffer.length);

      return res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  },
};
