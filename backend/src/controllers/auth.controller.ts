import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import jwt from "jsonwebtoken";
import prisma from "../prisma";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
export const authController = {
  
  
  
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, role } = req.body;
      const user = await authService.register(email, password, name, role);
      res.status(201).json({
        ok: true,
        content: { id: user.id, email: user.email, role: user.role, name: user.name },
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password, res);
      res.json({ ok: true, content: result });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(res);
      res.json({ ok: true, content: result });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response) {
    const token = req.cookies?.token;
    if (!token) {
      res.clearCookie("token"); // 🚨 si no hay token → borrar
      throw new Error("No autenticado");
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string };
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) {
        res.clearCookie("token"); // 🚨 si el user no existe → borrar
        throw new Error("Usuario no encontrado");
      }

      return { id: user.id, email: user.email, role: user.role, name: user.name };
    } catch {
      res.clearCookie("token"); // 🚨 si el token es inválido → borrar
      throw new Error("Token inválido");
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await authService.deleteUser(id);
      res.json({ ok: true, content: result });
    } catch (err) {
      next(err);
    }
  },
};
