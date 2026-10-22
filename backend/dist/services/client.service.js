"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const mailer_1 = require("../utils/mailer");
const DEFAULT_CLIENT_PASSWORD = process.env.CLIENT_DEFAULT_PASSWORD || "GrupoVJ123";
function normalizeCategory(value) {
    if (value === "Mayorista")
        return client_1.CategoryClient.Mayorista;
    // Si llega "Cliente" desde algún frontend viejo, ahora lo tratamos como minorista.
    return client_1.CategoryClient.Price;
}
function cleanEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email || null;
}
function cleanString(value) {
    const text = String(value || "").trim();
    return text || null;
}
function buildAddressData(data) {
    const cleanData = {};
    if (data.addressStreet !== undefined) {
        cleanData.addressStreet = cleanString(data.addressStreet);
    }
    if (data.addressNumber !== undefined) {
        cleanData.addressNumber = cleanString(data.addressNumber);
    }
    if (data.addressFloor !== undefined) {
        cleanData.addressFloor = cleanString(data.addressFloor);
    }
    if (data.addressApartment !== undefined) {
        cleanData.addressApartment = cleanString(data.addressApartment);
    }
    if (data.addressCity !== undefined) {
        cleanData.addressCity = cleanString(data.addressCity);
    }
    if (data.addressProvince !== undefined) {
        cleanData.addressProvince = cleanString(data.addressProvince);
    }
    if (data.addressPostalCode !== undefined) {
        cleanData.addressPostalCode = cleanString(data.addressPostalCode);
    }
    if (data.addressNotes !== undefined) {
        cleanData.addressNotes = cleanString(data.addressNotes);
    }
    if (data.latitude !== undefined) {
        cleanData.latitude = data.latitude ?? null;
    }
    if (data.longitude !== undefined) {
        cleanData.longitude = data.longitude ?? null;
    }
    return cleanData;
}
const clientUserSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    mustChangePassword: true,
};
exports.clientService = {
    async createClient(data) {
        const nombre = String(data.nombre || "").trim();
        const apellido = String(data.apellido || "").trim();
        const dni = String(data.dni || "").trim();
        const gmail = cleanEmail(data.gmail);
        if (!nombre)
            throw new Error("El nombre es obligatorio");
        if (!apellido)
            throw new Error("El apellido es obligatorio");
        if (!dni)
            throw new Error("El DNI/CUIT es obligatorio");
        if (!gmail) {
            throw new Error("El email es obligatorio para crear la cuenta de acceso del cliente");
        }
        const category = normalizeCategory(data.category);
        const addressData = buildAddressData(data);
        return prisma_1.default.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({
                where: { email: gmail },
            });
            if (existingUser) {
                throw new Error("Ya existe un usuario con ese email");
            }
            const existingClientByDni = await tx.client.findUnique({
                where: { dni },
            });
            if (existingClientByDni) {
                throw new Error("Ya existe un cliente con ese DNI/CUIT");
            }
            const existingClientByEmail = await tx.client.findUnique({
                where: { gmail },
            });
            if (existingClientByEmail) {
                throw new Error("Ya existe un cliente con ese email");
            }
            const hashedPassword = await bcryptjs_1.default.hash(DEFAULT_CLIENT_PASSWORD, 10);
            const user = await tx.user.create({
                data: {
                    email: gmail,
                    password: hashedPassword,
                    name: `${nombre} ${apellido}`.trim(),
                    role: client_1.Role.CLIENTE,
                    isActive: true,
                    mustChangePassword: true,
                },
            });
            return tx.client.create({
                data: {
                    nombre,
                    apellido,
                    dni,
                    category,
                    telefono: data.telefono ?? null,
                    gmail,
                    creditLimit: data.creditLimit ?? null,
                    isAccountEnabled: data.isAccountEnabled ?? false,
                    userId: user.id,
                    ...addressData,
                },
                include: {
                    user: {
                        select: clientUserSelect,
                    },
                    _count: {
                        select: {
                            sales: true,
                            accountMovements: true,
                        },
                    },
                },
            });
        });
    },
    async registerStoreClient(data) {
        const nombre = String(data.nombre || "").trim();
        const apellido = String(data.apellido || "").trim();
        const dni = String(data.dni || "").trim();
        const gmail = cleanEmail(data.gmail);
        if (!nombre)
            throw new Error("El nombre es obligatorio");
        if (!apellido)
            throw new Error("El apellido es obligatorio");
        if (!dni)
            throw new Error("El DNI/CUIT es obligatorio");
        if (!gmail)
            throw new Error("El email es obligatorio");
        if (!data.password || data.password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const addressData = buildAddressData(data);
        return prisma_1.default.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({
                where: { email: gmail },
            });
            if (existingUser) {
                throw new Error("Ya existe un usuario con ese email");
            }
            const existingClientByDni = await tx.client.findUnique({
                where: { dni },
            });
            if (existingClientByDni) {
                throw new Error("Ya existe un cliente con ese DNI/CUIT");
            }
            const existingClientByEmail = await tx.client.findUnique({
                where: { gmail },
            });
            if (existingClientByEmail) {
                throw new Error("Ya existe un cliente con ese email");
            }
            const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
            const user = await tx.user.create({
                data: {
                    email: gmail,
                    password: hashedPassword,
                    name: `${nombre} ${apellido}`.trim(),
                    role: client_1.Role.CLIENTE,
                    isActive: true,
                    mustChangePassword: false,
                },
            });
            return tx.client.create({
                data: {
                    nombre,
                    apellido,
                    dni,
                    telefono: data.telefono ?? null,
                    gmail,
                    category: client_1.CategoryClient.Price,
                    creditLimit: null,
                    isAccountEnabled: false,
                    userId: user.id,
                    ...addressData,
                },
                include: {
                    user: {
                        select: clientUserSelect,
                    },
                    _count: {
                        select: {
                            sales: true,
                            accountMovements: true,
                        },
                    },
                },
            });
        });
    },
    async requestPasswordReset(emailValue) {
        const email = cleanEmail(emailValue);
        if (!email)
            return { ok: true };
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: {
                client: true,
            },
        });
        if (!user)
            return { ok: true };
        if (user.role !== client_1.Role.CLIENTE)
            return { ok: true };
        if (user.isActive === false)
            return { ok: true };
        const rawToken = crypto_1.default.randomBytes(32).toString("hex");
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: expires,
            },
        });
        await (0, mailer_1.sendPasswordResetEmail)({
            to: user.email,
            name: user.name,
            token: rawToken,
        });
        return { ok: true };
    },
    async resetPassword(tokenValue, passwordValue) {
        const token = String(tokenValue || "").trim();
        const password = String(passwordValue || "");
        if (!token) {
            throw new Error("El token es obligatorio");
        }
        if (!password || password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const user = await prisma_1.default.user.findFirst({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: {
                    gt: new Date(),
                },
                role: client_1.Role.CLIENTE,
                isActive: true,
            },
        });
        if (!user) {
            throw new Error("El enlace es inválido o ya venció");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                mustChangePassword: false,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
        return { ok: true };
    },
    async getClients(options) {
        const where = options?.includeInactive ? {} : { isActive: true };
        if (options?.light) {
            return prisma_1.default.client.findMany({
                where,
                orderBy: { createdAt: "desc" },
            });
        }
        return prisma_1.default.client.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: clientUserSelect,
                },
                _count: {
                    select: {
                        sales: true,
                        accountMovements: true,
                    },
                },
            },
        });
    },
    async getClientById(id) {
        return prisma_1.default.client.findUnique({
            where: { id },
            include: {
                user: {
                    select: clientUserSelect,
                },
                sales: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        payments: true,
                        businessLocation: true,
                        items: {
                            include: { product: true },
                        },
                    },
                },
                accountMovements: {
                    orderBy: { date: "desc" },
                    include: {
                        sale: {
                            select: {
                                id: true,
                                total: true,
                                status: true,
                                createdAt: true,
                            },
                        },
                    },
                },
            },
        });
    },
    async updateClient(id, data) {
        const existing = await prisma_1.default.client.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!existing)
            throw new Error("Cliente no encontrado");
        const cleanData = {};
        if (data.nombre !== undefined)
            cleanData.nombre = String(data.nombre).trim();
        if (data.apellido !== undefined)
            cleanData.apellido = String(data.apellido).trim();
        if (data.dni !== undefined)
            cleanData.dni = String(data.dni).trim();
        if (data.telefono !== undefined)
            cleanData.telefono = cleanString(data.telefono);
        if (data.gmail !== undefined)
            cleanData.gmail = cleanEmail(data.gmail);
        if (data.category !== undefined)
            cleanData.category = normalizeCategory(data.category);
        if (data.creditLimit !== undefined)
            cleanData.creditLimit = data.creditLimit;
        if (data.isAccountEnabled !== undefined)
            cleanData.isAccountEnabled = data.isAccountEnabled;
        Object.assign(cleanData, buildAddressData(data));
        return prisma_1.default.$transaction(async (tx) => {
            if (data.unlinkUser === true && existing.userId) {
                cleanData.userId = null;
            }
            if (data.createUser === true && !existing.userId) {
                const email = cleanEmail(data.gmail ?? existing.gmail);
                if (!email) {
                    throw new Error("Para crear login, el email es obligatorio");
                }
                const existingUser = await tx.user.findUnique({
                    where: { email },
                });
                if (existingUser) {
                    throw new Error("Ya existe un usuario con ese email");
                }
                const nombre = cleanData.nombre ?? existing.nombre;
                const apellido = cleanData.apellido ?? existing.apellido;
                const hashedPassword = await bcryptjs_1.default.hash(DEFAULT_CLIENT_PASSWORD, 10);
                const user = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name: `${nombre} ${apellido}`.trim(),
                        role: client_1.Role.CLIENTE,
                        isActive: true,
                        mustChangePassword: true,
                    },
                });
                cleanData.userId = user.id;
                cleanData.gmail = email;
            }
            if (existing.userId && cleanData.gmail) {
                const emailAlreadyUsed = await tx.user.findFirst({
                    where: {
                        email: cleanData.gmail,
                        id: { not: existing.userId },
                    },
                });
                if (emailAlreadyUsed) {
                    throw new Error("Ya existe un usuario con ese email");
                }
                await tx.user.update({
                    where: { id: existing.userId },
                    data: {
                        email: cleanData.gmail,
                        name: `${cleanData.nombre ?? existing.nombre} ${cleanData.apellido ?? existing.apellido}`.trim(),
                    },
                });
            }
            const userId = cleanData.userId ?? existing.userId;
            if (userId && (data.password || data.resetToDefaultPassword)) {
                const newPassword = data.resetToDefaultPassword
                    ? DEFAULT_CLIENT_PASSWORD
                    : String(data.password);
                if (!data.resetToDefaultPassword && newPassword.trim().length < 6) {
                    throw new Error("La contraseña debe tener al menos 6 caracteres");
                }
                const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        password: hashedPassword,
                        mustChangePassword: true,
                    },
                });
            }
            return tx.client.update({
                where: { id },
                data: cleanData,
                include: {
                    user: {
                        select: clientUserSelect,
                    },
                    _count: {
                        select: {
                            sales: true,
                            accountMovements: true,
                        },
                    },
                },
            });
        });
    },
    async deleteClient(id) {
        const client = await prisma_1.default.client.findUnique({
            where: { id },
            select: {
                id: true,
                currentBalance: true,
                userId: true,
                _count: {
                    select: {
                        sales: true,
                        accountMovements: true,
                    },
                },
            },
        });
        if (!client)
            throw new Error("Cliente no encontrado");
        if (client.currentBalance > 0) {
            throw new Error("No se puede eliminar un cliente con saldo deudor");
        }
        if (client._count.sales > 0 || client._count.accountMovements > 0) {
            throw new Error("No se puede eliminar un cliente con historial de ventas o cuenta corriente");
        }
        return prisma_1.default.client.delete({ where: { id } });
    },
    async deactivateClient(id) {
        const existing = await prisma_1.default.client.findUnique({
            where: { id },
            select: { id: true, userId: true, isActive: true },
        });
        if (!existing)
            throw new Error("Cliente no encontrado");
        if (!existing.isActive)
            throw new Error("El cliente ya está desactivado");
        return prisma_1.default.$transaction(async (tx) => {
            if (existing.userId) {
                // Se libera el email de login para que pueda reutilizarse en otro cliente/usuario.
                await tx.user.update({
                    where: { id: existing.userId },
                    data: {
                        isActive: false,
                        email: `baja-${existing.userId}@grupovj.local`,
                    },
                });
            }
            return tx.client.update({
                where: { id },
                data: {
                    isActive: false,
                    userId: null,
                    dni: null,
                    telefono: null,
                    gmail: null,
                    category: client_1.CategoryClient.Price,
                    creditLimit: null,
                    isAccountEnabled: false,
                    addressStreet: null,
                    addressNumber: null,
                    addressFloor: null,
                    addressApartment: null,
                    addressCity: null,
                    addressProvince: null,
                    addressPostalCode: null,
                    addressNotes: null,
                    latitude: null,
                    longitude: null,
                },
                include: {
                    user: {
                        select: clientUserSelect,
                    },
                    _count: {
                        select: {
                            sales: true,
                            accountMovements: true,
                        },
                    },
                },
            });
        });
    },
    async reactivateClient(id) {
        const existing = await prisma_1.default.client.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
        if (!existing)
            throw new Error("Cliente no encontrado");
        if (existing.isActive)
            throw new Error("El cliente ya está activo");
        return prisma_1.default.client.update({
            where: { id },
            data: { isActive: true },
            include: {
                user: {
                    select: clientUserSelect,
                },
                _count: {
                    select: {
                        sales: true,
                        accountMovements: true,
                    },
                },
            },
        });
    },
};
//# sourceMappingURL=client.service.js.map