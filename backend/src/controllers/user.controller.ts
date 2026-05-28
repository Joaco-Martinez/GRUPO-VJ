import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service";

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

export const userController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAll();
      res.json(users);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(req.params.id);

      if (!user) {
        return res.status(404).json({
          message: "Usuario no encontrado",
        });
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const newUser = await userService.create({
        ...req.body,
        creditLimit: toNumberOrNull(req.body.creditLimit),
        isAccountEnabled: toBoolean(req.body.isAccountEnabled),
        isActive: toBoolean(req.body.isActive),
      });

      res.status(201).json(newUser);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body };

      if (body.isActive !== undefined) {
        body.isActive = toBoolean(body.isActive);
      }

      const updated = await userService.update(req.params.id, body);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await userService.delete(req.params.id);

      res.json({
        message: "Usuario eliminado",
      });
    } catch (err) {
      next(err);
    }
  },
};