"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
function normalizeRole(value) {
    if (value === "ADMIN")
        return client_1.Role.ADMIN;
    if (value === "EMPLEADO")
        return client_1.Role.EMPLEADO;
    if (value === "CLIENTE")
        return client_1.Role.CLIENTE;
    throw new Error("Rol inválido");
}
function normalizeCategory(value) {
    if (value === "Mayorista")
        return client_1.CategoryClient.Mayorista;
    if (value === "Cliente")
        return client_1.CategoryClient.Cliente;
    return client_1.CategoryClient.Price;
}
function cleanEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email || null;
}
const userSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    client: true,
};
exports.userService = {
    async getAll() {
        return prisma_1.default.user.findMany({
            orderBy: { createdAt: "desc" },
            select: userSelect,
        });
    },
    async getById(id) {
        return prisma_1.default.user.findUnique({
            where: { id },
            select: userSelect,
        });
    },
    async create(data) {
        const email = cleanEmail(data.email);
        const password = String(data.password || "");
        const role = normalizeRole(String(data.role || ""));
        const name = String(data.name || "").trim();
        if (!email)
            throw new Error("El email es obligatorio");
        if (!name)
            throw new Error("El nombre es obligatorio");
        if (!password || password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const existing = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existing)
            throw new Error("Ya existe un usuario con ese email");
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        if (role !== client_1.Role.CLIENTE) {
            return prisma_1.default.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role,
                    isActive: data.isActive ?? true,
                },
                select: userSelect,
            });
        }
        const nombre = String(data.nombre || name.split(" ")[0] || name).trim();
        const apellido = String(data.apellido || name.split(" ").slice(1).join(" ") || "").trim();
        const dni = String(data.dni || "").trim();
        if (!dni) {
            throw new Error("Para crear un usuario cliente, el DNI/CUIT es obligatorio");
        }
        const existingClient = await prisma_1.default.client.findUnique({
            where: { dni },
        });
        if (existingClient) {
            throw new Error("Ya existe un cliente con ese DNI/CUIT");
        }
        return prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: client_1.Role.CLIENTE,
                isActive: data.isActive ?? true,
                client: {
                    create: {
                        nombre,
                        apellido,
                        dni,
                        telefono: data.telefono ?? null,
                        gmail: email,
                        category: normalizeCategory(data.category),
                        creditLimit: data.creditLimit ?? null,
                        isAccountEnabled: data.isAccountEnabled ?? false,
                    },
                },
            },
            select: userSelect,
        });
    },
    async update(id, data) {
        const cleanData = {};
        if (data.email !== undefined) {
            cleanData.email = cleanEmail(data.email);
        }
        if (data.name !== undefined) {
            cleanData.name = String(data.name).trim();
        }
        if (data.role !== undefined) {
            cleanData.role = normalizeRole(String(data.role));
        }
        if (data.isActive !== undefined) {
            cleanData.isActive = data.isActive;
        }
        if (data.password !== undefined && data.password !== "") {
            if (data.password.length < 6) {
                throw new Error("La contraseña debe tener al menos 6 caracteres");
            }
            cleanData.password = await bcryptjs_1.default.hash(data.password, 10);
        }
        return prisma_1.default.user.update({
            where: { id },
            data: cleanData,
            select: userSelect,
        });
    },
    async delete(id) {
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            include: { client: true },
        });
        if (!user)
            throw new Error("Usuario no encontrado");
        if (user.role === client_1.Role.ADMIN) {
            const adminCount = await prisma_1.default.user.count({
                where: {
                    role: client_1.Role.ADMIN,
                    isActive: true,
                },
            });
            if (adminCount <= 1) {
                throw new Error("No podés eliminar el último usuario ADMIN activo");
            }
        }
        return prisma_1.default.user.delete({
            where: { id },
        });
    },
};
//# sourceMappingURL=user.service.js.map