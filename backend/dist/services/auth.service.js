"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
function getCookieOptions() {
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        domain: isProd ? COOKIE_DOMAIN : undefined,
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
    };
}
function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        isActive: user.isActive,
        client: user.client ?? null,
    };
}
exports.authService = {
    async register(data) {
        const email = String(data.email || "").trim().toLowerCase();
        const password = String(data.password || "");
        const dni = String(data.dni || "").trim();
        const nombre = String(data.nombre || data.name || "").trim();
        const apellido = String(data.apellido || "").trim();
        if (!email)
            throw new Error("El email es obligatorio");
        if (!password || password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        if (!dni)
            throw new Error("El DNI/CUIT es obligatorio");
        if (!nombre)
            throw new Error("El nombre es obligatorio");
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            throw new Error("El email ya está registrado");
        const existingClientByDni = await prisma_1.default.client.findUnique({
            where: { dni },
        });
        if (existingClientByDni)
            throw new Error("Ya existe un cliente con ese DNI/CUIT");
        const existingClientByEmail = await prisma_1.default.client.findUnique({
            where: { gmail: email },
        });
        if (existingClientByEmail)
            throw new Error("Ya existe un cliente con ese email");
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name: apellido ? `${nombre} ${apellido}` : nombre,
                role: client_1.Role.CLIENTE,
                isActive: true,
                client: {
                    create: {
                        nombre,
                        apellido,
                        dni,
                        telefono: data.telefono ?? null,
                        gmail: email,
                        category: client_1.CategoryClient.Price,
                        currentBalance: 0,
                        creditLimit: null,
                        isAccountEnabled: false,
                    },
                },
            },
            include: {
                client: true,
            },
        });
        return sanitizeUser(user);
    },
    async login(email, password, res) {
        const cleanEmail = String(email || "").trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail },
            include: {
                client: true,
            },
        });
        if (!user)
            throw new Error("Credenciales inválidas");
        if (user.isActive === false) {
            throw new Error("Usuario deshabilitado");
        }
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid)
            throw new Error("Credenciales inválidas");
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        const cleanUser = sanitizeUser(user);
        res.cookie("token", token, getCookieOptions());
        res.cookie("user", JSON.stringify(cleanUser), {
            ...getCookieOptions(),
            httpOnly: false,
        });
        return {
            user: cleanUser,
        };
    },
    async logout(res) {
        res.clearCookie("token", {
            path: "/",
            domain: isProd ? COOKIE_DOMAIN : undefined,
        });
        res.clearCookie("user", {
            path: "/",
            domain: isProd ? COOKIE_DOMAIN : undefined,
        });
        return { message: "Logout exitoso" };
    },
    async me(req) {
        const token = req.cookies?.token;
        if (!token)
            throw new Error("No autenticado");
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = await prisma_1.default.user.findUnique({
                where: { id: payload.userId },
                include: {
                    client: true,
                },
            });
            if (!user)
                throw new Error("Usuario no encontrado");
            if (user.isActive === false) {
                throw new Error("Usuario deshabilitado");
            }
            return sanitizeUser(user);
        }
        catch {
            throw new Error("Token inválido");
        }
    },
    async getMe(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = await prisma_1.default.user.findUnique({
                where: { id: decoded.userId },
                include: {
                    client: true,
                },
            });
            if (!user)
                throw new Error("Usuario no encontrado");
            if (user.isActive === false) {
                throw new Error("Usuario deshabilitado");
            }
            return sanitizeUser(user);
        }
        catch {
            throw new Error("Token inválido");
        }
    },
    async deleteUser(id) {
        const existing = await prisma_1.default.user.findUnique({ where: { id } });
        if (!existing)
            throw new Error("Usuario no encontrado");
        return prisma_1.default.user.delete({ where: { id } });
    },
};
//# sourceMappingURL=auth.service.js.map