import { Request, Response, NextFunction } from "express";
import { providerService } from "../services/provider.service";
import { getParamAsString } from "../utils/params";

export const providerController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive =
        req.query.includeInactive === "true" || req.query.includeInactive === "1";

      const providers = await providerService.getAll({ includeInactive });

      res.json({
        ok: true,
        providers,
      });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const provider = await providerService.getById(getParamAsString(id, "id"));

      if (!provider) {
        return res.status(404).json({
          ok: false,
          message: "Proveedor no encontrado",
        });
      }

      res.json({
        ok: true,
        provider,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await providerService.create(req.body);

      res.status(201).json({
        ok: true,
        provider,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const provider = await providerService.update(getParamAsString(id, "id"), req.body);

      res.json({
        ok: true,
        provider,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await providerService.remove(getParamAsString(id, "id"));

      res.json({
        ok: true,
        message: "Proveedor eliminado correctamente",
      });
    } catch (error) {
      next(error);
    }
  },

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const provider = await providerService.deactivate(getParamAsString(id, "id"));

      res.json({
        ok: true,
        message: "Proveedor desactivado correctamente",
        provider,
      });
    } catch (error) {
      next(error);
    }
  },

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const provider = await providerService.activate(getParamAsString(id, "id"));

      res.json({
        ok: true,
        message: "Proveedor reactivado correctamente",
        provider,
      });
    } catch (error) {
      next(error);
    }
  },
};
