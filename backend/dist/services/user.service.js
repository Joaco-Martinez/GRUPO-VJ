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
    // Compatibilidad: si algo viejo manda "Cliente", ahora lo tratamos como minorista.
    if (value === "Cliente")
        return client_1.CategoryClient.Price;
    return client_1.CategoryClient.Price;
}
function cleanEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email || null;
}
function parseDateParam(value) {
    if (!value)
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
function buildDateWhere(fromDate, toDate) {
    const dateWhere = {};
    if (fromDate)
        dateWhere.gte = fromDate;
    if (toDate)
        dateWhere.lte = toDate;
    return Object.keys(dateWhere).length ? dateWhere : undefined;
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function n(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}
function isCancelled(status) {
    const value = String(status ?? '').toUpperCase();
    return value === 'CANCELLED' || value === 'CANCELED' || value === 'CANCELADA';
}
function saleTotal(sale) {
    const directTotal = n(sale?.total);
    if (directTotal > 0)
        return directTotal;
    return (sale?.items ?? []).reduce((acc, item) => {
        const qty = n(item?.quantityKg) > 0 ? n(item?.quantityKg) : n(item?.quantity) || 1;
        return acc + (n(item?.subtotal) || n(item?.price) * qty);
    }, 0);
}
function purchaseTotal(purchase) {
    const directTotal = n(purchase?.total ?? purchase?.amount ?? purchase?.subtotal);
    if (directTotal > 0)
        return directTotal;
    return (purchase?.items ?? purchase?.purchaseItems ?? []).reduce((acc, item) => {
        const qty = n(item?.quantityKg) > 0 ? n(item?.quantityKg) : n(item?.quantity) || 1;
        const cost = n(item?.costPrice ?? item?.purchasePrice ?? item?.price);
        return acc + (n(item?.subtotal) || cost * qty);
    }, 0);
}
function buildProductSummaryFromSales(sales) {
    const map = new Map();
    for (const sale of sales) {
        if (isCancelled(sale?.status))
            continue;
        for (const item of sale?.items ?? []) {
            const product = item?.product;
            const key = String(item?.productId || product?.id || item?.productNameSnapshot || product?.name || 'sin-producto');
            const quantity = n(item?.quantity);
            const quantityKg = n(item?.quantityKg);
            const subtotal = n(item?.subtotal) || n(item?.price) * (quantityKg > 0 ? quantityKg : quantity || 1);
            const current = map.get(key) ?? {
                key,
                productId: item?.productId ?? product?.id ?? null,
                name: item?.productNameSnapshot || product?.name || 'Producto',
                sku: item?.productSkuSnapshot || product?.sku || null,
                category: product?.category?.name ?? null,
                quantity: 0,
                quantityKg: 0,
                subtotal: 0,
                operations: 0,
            };
            current.quantity += quantity;
            current.quantityKg += quantityKg;
            current.subtotal += subtotal;
            current.operations += 1;
            map.set(key, current);
        }
    }
    return Array.from(map.values())
        .map((item) => ({ ...item, subtotal: round2(item.subtotal) }))
        .sort((a, b) => b.subtotal - a.subtotal);
}
function buildProductSummaryFromPurchases(purchases) {
    const map = new Map();
    for (const purchase of purchases) {
        if (isCancelled(purchase?.status))
            continue;
        for (const item of purchase?.items ?? purchase?.purchaseItems ?? []) {
            const product = item?.product;
            const key = String(item?.productId || product?.id || item?.productNameSnapshot || product?.name || 'sin-producto');
            const quantity = n(item?.quantity);
            const quantityKg = n(item?.quantityKg);
            const cost = n(item?.costPrice ?? item?.purchasePrice ?? item?.price);
            const subtotal = n(item?.subtotal) || cost * (quantityKg > 0 ? quantityKg : quantity || 1);
            const current = map.get(key) ?? {
                key,
                productId: item?.productId ?? product?.id ?? null,
                name: item?.productNameSnapshot || product?.name || 'Producto',
                sku: item?.productSkuSnapshot || product?.sku || null,
                category: product?.category?.name ?? null,
                quantity: 0,
                quantityKg: 0,
                subtotal: 0,
                operations: 0,
            };
            current.quantity += quantity;
            current.quantityKg += quantityKg;
            current.subtotal += subtotal;
            current.operations += 1;
            map.set(key, current);
        }
    }
    return Array.from(map.values())
        .map((item) => ({ ...item, subtotal: round2(item.subtotal) }))
        .sort((a, b) => b.subtotal - a.subtotal);
}
async function safeFindMany(modelName, args) {
    const model = prisma_1.default[modelName];
    if (!model?.findMany)
        return [];
    try {
        return await model.findMany(args);
    }
    catch {
        return [];
    }
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
    defaultStockLocation: true,
    defaultPriceCategory: true,
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
    async getActivityById(id, params = {}) {
        const fromDate = parseDateParam(params.fromDate);
        const toDate = parseDateParam(params.toDate);
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            select: userSelect,
        });
        if (!user)
            return null;
        const saleCreatedAt = buildDateWhere(fromDate, toDate);
        const movementCreatedAt = buildDateWhere(fromDate, toDate);
        const remitoCreatedAt = buildDateWhere(fromDate, toDate);
        const accountDate = buildDateWhere(fromDate, toDate);
        const [sales, stockMovements, accountMovements, remitos, arcaAuditLogs, purchases] = await Promise.all([
            prisma_1.default.sale.findMany({
                where: {
                    userId: id,
                    ...(saleCreatedAt && { createdAt: saleCreatedAt }),
                },
                include: {
                    client: true,
                    businessLocation: true,
                    payments: true,
                    invoice: true,
                    invoiceAfip: {
                        include: {
                            creditNotes: true,
                        },
                    },
                    remitos: {
                        include: {
                            items: {
                                include: { product: true },
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                    accountMovements: {
                        orderBy: { createdAt: 'desc' },
                    },
                    items: {
                        include: {
                            product: {
                                include: {
                                    category: true,
                                },
                            },
                            boxContents: {
                                include: {
                                    product: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.stockMovement.findMany({
                where: {
                    userId: id,
                    ...(movementCreatedAt && { createdAt: movementCreatedAt }),
                },
                include: {
                    product: {
                        include: {
                            category: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.accountMovement.findMany({
                where: {
                    userId: id,
                    ...(accountDate && { date: accountDate }),
                },
                include: {
                    client: true,
                    sale: {
                        include: {
                            client: true,
                        },
                    },
                },
                orderBy: { date: 'desc' },
            }),
            prisma_1.default.remito.findMany({
                where: {
                    userId: id,
                    ...(remitoCreatedAt && { createdAt: remitoCreatedAt }),
                },
                include: {
                    client: true,
                    sale: true,
                    businessLocation: true,
                    items: {
                        include: { product: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            safeFindMany('arcaAuditLog', {
                where: {
                    userId: id,
                    ...(movementCreatedAt && { createdAt: movementCreatedAt }),
                },
                orderBy: { createdAt: 'desc' },
            }),
            safeFindMany('purchase', {
                where: {
                    userId: id,
                    ...(saleCreatedAt && { createdAt: saleCreatedAt }),
                },
                include: {
                    user: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                    items: {
                        include: {
                            product: {
                                include: { category: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const validSales = sales.filter((sale) => !isCancelled(sale.status));
        const validPurchases = purchases.filter((purchase) => !isCancelled(purchase.status));
        const completedSales = sales.filter((sale) => String(sale.status ?? '').toUpperCase() === 'COMPLETED');
        const pendingSales = sales.filter((sale) => String(sale.status ?? '').toUpperCase() === 'PENDING');
        const cancelledSales = sales.filter((sale) => isCancelled(sale.status));
        const totalSold = validSales.reduce((acc, sale) => acc + saleTotal(sale), 0);
        const totalPurchased = validPurchases.reduce((acc, purchase) => acc + purchaseTotal(purchase), 0);
        const totalDebtGenerated = validSales.reduce((acc, sale) => acc + n(sale.accountDebtAmount), 0);
        const totalAccountPayments = accountMovements
            .filter((movement) => String(movement.type ?? '').toUpperCase() === 'ABONO')
            .reduce((acc, movement) => acc + n(movement.amount), 0);
        const paymentBreakdown = validSales.reduce((acc, sale) => {
            const payments = sale.payments?.length
                ? sale.payments
                : [{ method: sale.paymentMethod, amount: saleTotal(sale) }];
            for (const payment of payments) {
                const method = String(payment.method || 'SIN_METODO');
                acc[method] = round2((acc[method] ?? 0) + n(payment.amount));
            }
            return acc;
        }, {});
        const stockBreakdown = stockMovements.reduce((acc, movement) => {
            const type = String(movement.type || 'MOVIMIENTO');
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
        }, {});
        return {
            user,
            filters: {
                fromDate: fromDate?.toISOString() ?? null,
                toDate: toDate?.toISOString() ?? null,
            },
            summary: {
                salesCount: sales.length,
                validSalesCount: validSales.length,
                completedSalesCount: completedSales.length,
                pendingSalesCount: pendingSales.length,
                cancelledSalesCount: cancelledSales.length,
                purchasesCount: purchases.length,
                stockMovementsCount: stockMovements.length,
                remitosCount: remitos.length,
                accountMovementsCount: accountMovements.length,
                arcaAuditLogsCount: arcaAuditLogs.length,
                totalSold: round2(totalSold),
                totalPurchased: round2(totalPurchased),
                totalDebtGenerated: round2(totalDebtGenerated),
                totalAccountPayments: round2(totalAccountPayments),
                averageTicket: validSales.length ? round2(totalSold / validSales.length) : 0,
                paymentBreakdown,
                stockBreakdown,
            },
            productsSold: buildProductSummaryFromSales(sales),
            productsPurchased: buildProductSummaryFromPurchases(purchases),
            sales,
            purchases,
            stockMovements,
            accountMovements,
            remitos,
            arcaAuditLogs,
        };
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
    async updateOwnPreferences(id, data) {
        const cleanData = {};
        if (data.defaultStockLocation !== undefined) {
            if (data.defaultStockLocation !== null &&
                !["LOCAL", "DEPOSITO"].includes(data.defaultStockLocation)) {
                throw new Error("Depósito por defecto inválido. Usá LOCAL o DEPOSITO");
            }
            cleanData.defaultStockLocation = data.defaultStockLocation;
        }
        if (data.defaultPriceCategory !== undefined) {
            cleanData.defaultPriceCategory = data.defaultPriceCategory;
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