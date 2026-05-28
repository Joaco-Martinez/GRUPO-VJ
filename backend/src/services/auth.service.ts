import prisma from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Response, Request } from "express";
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const authService = {
  // ✅ Obtener usuario desde token
  async getMe(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) throw new Error("Usuario no encontrado");

      return user;
    } catch {
      throw new Error("Token inválido");
    }
  },

  // ✅ Registro
  async register(
    email: string,
    password: string,
    name: string,
    role: "ADMIN" | "EMPLEADO"
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("El email ya está registrado");

    const hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: { email, password: hashedPassword, name, role },
    });
  },

  // ✅ Login: genera token + setea cookies
  async login(email: string, password: string, res: Response) {
    console.log(email, password);
    const user = await prisma.user.findUnique({ where: { email } });
    console.log(user);
    if (!user) throw new Error("Credenciales gmail");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Credenciales inválidas");

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 🔒 Cookie segura con el token

res.cookie("token", token, {
  httpOnly: true,
  secure: isProd,               // 🔥 Solo true en prod
  sameSite: isProd ? "none" : "lax", // 🔥 En localhost debe ser "lax"
  domain: isProd ? ".vonkonigerp.com.ar" : undefined, // 🔥 En localhost NO se usa domain
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

// Cookie con datos del usuario
res.cookie("user", JSON.stringify({
  id: user.id,
  email: user.email,
  role: user.role,
  name: user.name,
}), {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  domain: isProd ? ".vonkonigerp.com.ar" : undefined,
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

    return {
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    };
  },

  // ✅ Logout
  async logout(res: Response) {
    res.clearCookie("token", { path: "/" });
    res.clearCookie("user", { path: "/" });
    return { message: "Logout exitoso" };
  },

  // ✅ Endpoint /me → obtiene usuario desde cookie
  async me(req: Request) {
    const token = req.cookies?.token;
    if (!token) throw new Error("No autenticado");

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });

      if (!user) throw new Error("Usuario no encontrado");

      return user;
    } catch {
      throw new Error("Token inválido");
    }
  },

  // ✅ Eliminar usuario
  async deleteUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("Usuario no encontrado");

    return prisma.user.delete({ where: { id } });
  },
};
