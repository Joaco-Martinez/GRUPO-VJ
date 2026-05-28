import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Middleware para validar que el usuario esté autenticado
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token; // 🔑 solo confiamos en la cookie "token"
  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    // 👇 depende de cómo hayas firmado el JWT en login
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    console.log("decoded",decoded);
    // Guardamos el user en la request
    (req as any).user = { id: decoded.userId, role: decoded.role };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

// Middleware extra para verificar roles
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== role) {
      return res.status(403).json({ message: "No autorizado" });
    }
    next();
  };
}
