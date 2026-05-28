import { Request, Response, NextFunction } from "express";
import { clientService } from "../services/client.service";

function toNumberOrNull(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value: any) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

export const clientController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientService.createClient({
        ...req.body,
        creditLimit: toNumberOrNull(req.body.creditLimit),
        isAccountEnabled: toBoolean(req.body.isAccountEnabled),
      });

      res.status(201).json({ ok: true, client });
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const clients = await clientService.getClients();
      res.json({ ok: true, clients });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const client = await clientService.getClientById(id);

      if (!client) {
        return res.status(404).json({ ok: false, message: "Cliente no encontrado" });
      }

      res.json({ ok: true, client });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = { ...req.body };

      if (body.creditLimit !== undefined) body.creditLimit = toNumberOrNull(body.creditLimit) ?? null;
      if (body.isAccountEnabled !== undefined) body.isAccountEnabled = toBoolean(body.isAccountEnabled);

      const client = await clientService.updateClient(id, body);
      res.json({ ok: true, client });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await clientService.deleteClient(id);
      res.json({ ok: true, message: "Cliente eliminado correctamente" });
    } catch (error) {
      next(error);
    }
  },
};
