"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
function assertPositiveAmount(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("El monto debe ser mayor a 0");
    }
    return round2(value);
}
exports.accountService = {
    async getClientAccount(clientId) {
        const client = await prisma_1.default.client.findUnique({
            where: { id: clientId },
            include: {
                accountMovements: {
                    orderBy: {
                        date: "desc",
                    },
                    include: {
                        sale: {
                            select: {
                                id: true,
                                total: true,
                                status: true,
                                createdAt: true,
                            },
                        },
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
        if (!client) {
            throw new Error("Cliente no encontrado");
        }
        return {
            client: {
                id: client.id,
                nombre: client.nombre,
                apellido: client.apellido,
                dni: client.dni,
                telefono: client.telefono,
                gmail: client.gmail,
                category: client.category,
                currentBalance: client.currentBalance,
                creditLimit: client.creditLimit,
                isAccountEnabled: client.isAccountEnabled,
            },
            balance: client.currentBalance,
            movements: client.accountMovements,
        };
    },
    async getMovements(filters) {
        const date = {};
        if (filters?.fromDate)
            date.gte = filters.fromDate;
        if (filters?.toDate)
            date.lte = filters.toDate;
        return prisma_1.default.accountMovement.findMany({
            where: {
                clientId: filters?.clientId,
                type: filters?.type,
                ...(Object.keys(date).length > 0 ? { date } : {}),
            },
            include: {
                client: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        dni: true,
                        telefono: true,
                        gmail: true,
                        currentBalance: true,
                    },
                },
                sale: {
                    select: {
                        id: true,
                        total: true,
                        status: true,
                        createdAt: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                date: "desc",
            },
        });
    },
    async getDebtors() {
        return prisma_1.default.client.findMany({
            where: {
                currentBalance: {
                    gt: 0,
                },
            },
            orderBy: {
                currentBalance: "desc",
            },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                dni: true,
                telefono: true,
                gmail: true,
                category: true,
                currentBalance: true,
                creditLimit: true,
                isAccountEnabled: true,
            },
        });
    },
    async addDebt(data) {
        const amount = assertPositiveAmount(data.amount);
        return prisma_1.default.$transaction(async (tx) => {
            const client = await tx.client.findUnique({
                where: {
                    id: data.clientId,
                },
                select: {
                    id: true,
                    currentBalance: true,
                    isAccountEnabled: true,
                    creditLimit: true,
                },
            });
            if (!client) {
                throw new Error("Cliente no encontrado");
            }
            if (!client.isAccountEnabled) {
                throw new Error("La cuenta corriente de este cliente está deshabilitada");
            }
            const previousBalance = round2(client.currentBalance);
            const newBalance = round2(previousBalance + amount);
            if (client.creditLimit !== null &&
                client.creditLimit !== undefined &&
                client.creditLimit > 0 &&
                newBalance > client.creditLimit) {
                throw new Error(`La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`);
            }
            await tx.client.update({
                where: {
                    id: data.clientId,
                },
                data: {
                    currentBalance: newBalance,
                },
            });
            return tx.accountMovement.create({
                data: {
                    clientId: data.clientId,
                    saleId: data.saleId ?? null,
                    userId: data.userId ?? null,
                    type: client_1.AccountMovementType.DEBT,
                    amount,
                    previousBalance,
                    newBalance,
                    paymentMethod: null,
                    reference: data.reference ?? null,
                    description: data.description ?? "Deuda generada por venta",
                },
                include: {
                    client: true,
                    sale: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });
    },
    async registerPayment(data) {
        const amount = assertPositiveAmount(data.amount);
        if (data.method === client_1.PaymentMethod.CUENTA_CORRIENTE) {
            throw new Error("Un abono no puede pagarse con CUENTA_CORRIENTE");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const client = await tx.client.findUnique({
                where: {
                    id: data.clientId,
                },
                select: {
                    id: true,
                    currentBalance: true,
                },
            });
            if (!client) {
                throw new Error("Cliente no encontrado");
            }
            const previousBalance = round2(client.currentBalance);
            const newBalance = round2(Math.max(previousBalance - amount, 0));
            await tx.client.update({
                where: {
                    id: data.clientId,
                },
                data: {
                    currentBalance: newBalance,
                },
            });
            const movement = await tx.accountMovement.create({
                data: {
                    clientId: data.clientId,
                    userId: data.userId ?? null,
                    saleId: null,
                    type: client_1.AccountMovementType.PAYMENT,
                    amount,
                    previousBalance,
                    newBalance,
                    paymentMethod: data.method,
                    reference: data.reference ?? null,
                    description: data.description ?? "Abono de cuenta corriente",
                },
                include: {
                    client: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            if (data.createFinance !== false) {
                await tx.finance.create({
                    data: {
                        type: client_1.FinanceType.INGRESO,
                        amount,
                        category: client_1.CategoryFinance.COBRANZA,
                        paymentMethod: data.method,
                        description: data.description ??
                            `Abono cuenta corriente cliente ${movement.client.nombre} ${movement.client.apellido}`,
                        date: new Date(),
                    },
                });
            }
            return movement;
        });
    },
    async createAdjustment(data) {
        const amount = assertPositiveAmount(data.amount);
        return prisma_1.default.$transaction(async (tx) => {
            const client = await tx.client.findUnique({
                where: {
                    id: data.clientId,
                },
                select: {
                    id: true,
                    currentBalance: true,
                },
            });
            if (!client) {
                throw new Error("Cliente no encontrado");
            }
            const previousBalance = round2(client.currentBalance);
            const isPositive = data.type === "POSITIVE";
            const newBalance = isPositive
                ? round2(previousBalance + amount)
                : round2(Math.max(previousBalance - amount, 0));
            await tx.client.update({
                where: {
                    id: data.clientId,
                },
                data: {
                    currentBalance: newBalance,
                },
            });
            return tx.accountMovement.create({
                data: {
                    clientId: data.clientId,
                    userId: data.userId ?? null,
                    saleId: null,
                    type: isPositive
                        ? client_1.AccountMovementType.ADJUSTMENT_POSITIVE
                        : client_1.AccountMovementType.ADJUSTMENT_NEGATIVE,
                    amount,
                    previousBalance,
                    newBalance,
                    paymentMethod: null,
                    reference: data.reference ?? null,
                    description: data.description ??
                        (isPositive
                            ? "Ajuste positivo de cuenta corriente"
                            : "Ajuste negativo de cuenta corriente"),
                },
                include: {
                    client: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });
    },
    async updateClientAccountConfig(clientId, data) {
        const client = await prisma_1.default.client.findUnique({
            where: {
                id: clientId,
            },
        });
        if (!client) {
            throw new Error("Cliente no encontrado");
        }
        const updateData = {};
        if (data.creditLimit !== undefined) {
            updateData.creditLimit =
                data.creditLimit === null ? null : Number(data.creditLimit);
        }
        if (data.isAccountEnabled !== undefined) {
            updateData.isAccountEnabled = data.isAccountEnabled;
        }
        return prisma_1.default.client.update({
            where: {
                id: clientId,
            },
            data: updateData,
            select: {
                id: true,
                nombre: true,
                apellido: true,
                dni: true,
                telefono: true,
                gmail: true,
                currentBalance: true,
                creditLimit: true,
                isAccountEnabled: true,
            },
        });
    },
};
//# sourceMappingURL=account.service.js.map