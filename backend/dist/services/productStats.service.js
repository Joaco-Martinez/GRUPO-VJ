"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productStatsService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function toDateOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
function n0(v) {
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
}
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
async function buildAccountDebtAllocationBySale(clientIds) {
    const result = new Map();
    if (!clientIds.length)
        return result;
    const accountSales = await prisma.sale.findMany({
        where: {
            clientId: {
                in: clientIds,
            },
            status: client_1.SaleStatus.COMPLETED,
            isAccountSale: true,
            accountDebtAmount: {
                gt: 0,
            },
        },
        select: {
            id: true,
            clientId: true,
            accountDebtAmount: true,
            createdAt: true,
        },
        orderBy: [
            {
                clientId: "asc",
            },
            {
                createdAt: "asc",
            },
        ],
    });
    const payments = await prisma.accountMovement.findMany({
        where: {
            clientId: {
                in: clientIds,
            },
            type: client_1.AccountMovementType.PAYMENT,
        },
        select: {
            clientId: true,
            amount: true,
            date: true,
            createdAt: true,
        },
        orderBy: [
            {
                clientId: "asc",
            },
            {
                date: "asc",
            },
        ],
    });
    for (const clientId of clientIds) {
        const clientSales = accountSales.filter((s) => s.clientId === clientId);
        const clientPayments = payments.filter((p) => p.clientId === clientId);
        const queue = [];
        const events = [];
        for (const sale of clientSales) {
            const amount = round2(n0(sale.accountDebtAmount));
            if (amount <= 0)
                continue;
            events.push({
                kind: "DEBT",
                date: sale.createdAt,
                saleId: sale.id,
                amount,
            });
            result.set(sale.id, {
                remainingDebt: amount,
                accountPaid: 0,
            });
        }
        for (const payment of clientPayments) {
            const amount = round2(n0(payment.amount));
            if (amount <= 0)
                continue;
            events.push({
                kind: "PAYMENT",
                date: payment.date ?? payment.createdAt,
                amount,
            });
        }
        events.sort((a, b) => {
            const diff = a.date.getTime() - b.date.getTime();
            if (diff !== 0)
                return diff;
            if (a.kind === "DEBT" && b.kind === "PAYMENT")
                return -1;
            if (a.kind === "PAYMENT" && b.kind === "DEBT")
                return 1;
            return 0;
        });
        for (const event of events) {
            if (event.kind === "DEBT") {
                if (!event.saleId)
                    continue;
                const row = {
                    saleId: event.saleId,
                    remainingDebt: round2(event.amount),
                    accountPaid: 0,
                };
                queue.push(row);
                result.set(event.saleId, {
                    remainingDebt: row.remainingDebt,
                    accountPaid: row.accountPaid,
                });
                continue;
            }
            let availablePayment = round2(event.amount);
            while (availablePayment > 0 && queue.length > 0) {
                const firstDebt = queue[0];
                const applied = round2(Math.min(firstDebt.remainingDebt, availablePayment));
                firstDebt.remainingDebt = round2(firstDebt.remainingDebt - applied);
                firstDebt.accountPaid = round2(firstDebt.accountPaid + applied);
                availablePayment = round2(availablePayment - applied);
                result.set(firstDebt.saleId, {
                    remainingDebt: firstDebt.remainingDebt,
                    accountPaid: firstDebt.accountPaid,
                });
                if (firstDebt.remainingDebt <= 0) {
                    queue.shift();
                }
            }
        }
    }
    return result;
}
exports.productStatsService = {
    async createStatsFromSale(items) {
        const dateOnly = toDateOnly(new Date());
        const products = await prisma.product.findMany({
            where: {
                id: {
                    in: items.map((i) => i.productId),
                },
            },
            select: {
                id: true,
                saleUnit: true,
            },
        });
        const unitMap = new Map(products.map((p) => [p.id, p.saleUnit]));
        for (const item of items) {
            const saleUnit = unitMap.get(item.productId);
            if (!saleUnit) {
                throw new Error(`Producto no encontrado: ${item.productId}`);
            }
            if (saleUnit === client_1.SaleUnit.KG) {
                const kg = n0(item.quantityKg);
                if (kg <= 0) {
                    throw new Error(`quantityKg inválida para producto KG: ${item.productId}`);
                }
                await prisma.productStats.create({
                    data: {
                        productId: item.productId,
                        quantity: 0,
                        quantityKg: kg,
                        date: dateOnly,
                    },
                });
            }
            else {
                const qty = n0(item.quantity);
                if (qty <= 0) {
                    throw new Error(`quantity inválida para producto UNIT: ${item.productId}`);
                }
                await prisma.productStats.create({
                    data: {
                        productId: item.productId,
                        quantity: qty,
                        quantityKg: 0,
                        date: dateOnly,
                    },
                });
            }
        }
    },
    async attachProducts(grouped) {
        if (!grouped.length)
            return [];
        const products = await prisma.product.findMany({
            where: {
                id: {
                    in: grouped.map((g) => g.productId),
                },
            },
            select: {
                id: true,
                name: true,
                saleUnit: true,
            },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        return grouped.map((g) => {
            const product = productMap.get(g.productId) || null;
            const unitsSold = n0(g._sum.quantity);
            const kgSold = n0(g._sum.quantityKg);
            const saleUnit = product?.saleUnit ?? client_1.SaleUnit.UNIT;
            const rankValue = saleUnit === client_1.SaleUnit.KG ? kgSold : unitsSold;
            return {
                productId: g.productId,
                product,
                saleUnit,
                rankValue,
                unitsSold,
                kgSold,
            };
        });
    },
    async groupAll(where) {
        return prisma.productStats.groupBy({
            by: ["productId"],
            where,
            _sum: {
                quantity: true,
                quantityKg: true,
            },
        });
    },
    async buildProductReport(params) {
        const where = {
            sale: {
                status: client_1.SaleStatus.COMPLETED,
            },
        };
        if (params?.startDate || params?.endDate) {
            where.sale.createdAt = {};
            if (params.startDate) {
                where.sale.createdAt.gte = startOfDay(params.startDate);
            }
            if (params.endDate) {
                where.sale.createdAt.lte = endOfDay(params.endDate);
            }
        }
        if (params?.unit) {
            where.product = {
                saleUnit: params.unit,
            };
        }
        const items = await prisma.saleItem.findMany({
            where,
            select: {
                id: true,
                saleId: true,
                productId: true,
                quantity: true,
                quantityKg: true,
                price: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        saleUnit: true,
                    },
                },
                sale: {
                    select: {
                        id: true,
                        clientId: true,
                        total: true,
                        createdAt: true,
                        status: true,
                        isAccountSale: true,
                        accountDebtAmount: true,
                        payments: {
                            select: {
                                method: true,
                                amount: true,
                            },
                        },
                    },
                },
            },
        });
        const clientIds = Array.from(new Set(items
            .map((item) => item.sale.clientId)
            .filter((id) => Boolean(id))));
        const accountDebtBySale = await buildAccountDebtAllocationBySale(clientIds);
        const map = new Map();
        for (const item of items) {
            const product = item.product;
            const sale = item.sale;
            const saleUnit = product.saleUnit;
            const unitsSold = saleUnit === client_1.SaleUnit.UNIT ? n0(item.quantity) : 0;
            const kgSold = saleUnit === client_1.SaleUnit.KG ? n0(item.quantityKg) : 0;
            const soldQty = saleUnit === client_1.SaleUnit.KG ? kgSold : unitsSold;
            const grossRevenue = round2(n0(item.price) * soldQty);
            const saleTotal = n0(sale.total);
            const directCollected = (sale.payments ?? [])
                .filter((payment) => payment.method !== "CUENTA_CORRIENTE")
                .reduce((acc, payment) => acc + n0(payment.amount), 0);
            const accountAllocation = accountDebtBySale.get(sale.id);
            const accountCollected = accountAllocation?.accountPaid ?? 0;
            const saleCollected = round2(directCollected + accountCollected);
            const collectedRatio = saleTotal > 0 ? Math.min(saleCollected / saleTotal, 1) : 0;
            const collectedRevenue = round2(grossRevenue * collectedRatio);
            const pendingRevenue = round2(Math.max(grossRevenue - collectedRevenue, 0));
            const current = map.get(item.productId);
            if (!current) {
                map.set(item.productId, {
                    productId: item.productId,
                    name: product.name,
                    saleUnit,
                    unitsSold,
                    kgSold,
                    totalSold: soldQty,
                    totalSoldLabel: saleUnit === client_1.SaleUnit.KG ? `${kgSold} kg` : `${unitsSold} u.`,
                    totalRevenue: grossRevenue,
                    grossRevenue,
                    collectedRevenue,
                    pendingRevenue,
                    rankValue: soldQty,
                    product,
                });
            }
            else {
                current.unitsSold = round2(current.unitsSold + unitsSold);
                current.kgSold = round2(current.kgSold + kgSold);
                current.totalSold = round2(current.totalSold + soldQty);
                current.totalRevenue = round2(current.totalRevenue + grossRevenue);
                current.grossRevenue = round2(current.grossRevenue + grossRevenue);
                current.collectedRevenue = round2(current.collectedRevenue + collectedRevenue);
                current.pendingRevenue = round2(current.pendingRevenue + pendingRevenue);
                current.rankValue = current.totalSold;
                current.totalSoldLabel =
                    current.saleUnit === client_1.SaleUnit.KG
                        ? `${current.kgSold} kg`
                        : `${current.unitsSold} u.`;
            }
        }
        return Array.from(map.values());
    },
    async getTopProducts(limit, unit) {
        const data = await this.buildProductReport({ unit });
        return data.sort((a, b) => b.rankValue - a.rankValue).slice(0, limit);
    },
    async getWorstProducts(limit, unit) {
        const data = await this.buildProductReport({ unit });
        return data
            .filter((p) => p.rankValue > 0)
            .sort((a, b) => a.rankValue - b.rankValue)
            .slice(0, limit);
    },
    async getTopProductsByRange(startDate, endDate, limit, unit) {
        const data = await this.buildProductReport({
            startDate,
            endDate,
            unit,
        });
        return data.sort((a, b) => b.rankValue - a.rankValue).slice(0, limit);
    },
    async getWorstProductsByRange(startDate, endDate, limit, unit) {
        const data = await this.buildProductReport({
            startDate,
            endDate,
            unit,
        });
        return data
            .filter((p) => p.rankValue > 0)
            .sort((a, b) => a.rankValue - b.rankValue)
            .slice(0, limit);
    },
    async getBestProductByMonth(year, month, unit) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const data = await this.buildProductReport({
            startDate,
            endDate,
            unit,
        });
        return data.sort((a, b) => b.rankValue - a.rankValue)[0] || null;
    },
    async getWorstProductByMonth(year, month, unit) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const data = await this.buildProductReport({
            startDate,
            endDate,
            unit,
        });
        return (data
            .filter((p) => p.rankValue > 0)
            .sort((a, b) => a.rankValue - b.rankValue)[0] || null);
    },
    async getTotals(unit) {
        const products = await this.buildProductReport({ unit });
        const salesWhere = {
            status: client_1.SaleStatus.COMPLETED,
        };
        const totalSales = await prisma.sale.count({
            where: salesWhere,
        });
        const totalRevenueAgg = await prisma.sale.aggregate({
            where: salesWhere,
            _sum: {
                total: true,
            },
        });
        const financeIncomeAgg = await prisma.finance.aggregate({
            where: {
                type: client_1.FinanceType.INGRESO,
                category: {
                    in: [client_1.CategoryFinance.VENTA, client_1.CategoryFinance.COBRANZA],
                },
            },
            _sum: {
                amount: true,
            },
        });
        const currentDebtAgg = await prisma.client.aggregate({
            _sum: {
                currentBalance: true,
            },
        });
        const grossRevenue = round2(n0(totalRevenueAgg._sum.total));
        const collectedRevenue = round2(n0(financeIncomeAgg._sum.amount));
        const pendingRevenue = round2(n0(currentDebtAgg._sum.currentBalance));
        const totalUnits = round2(products.reduce((acc, p) => acc + p.unitsSold, 0));
        const totalKg = round2(products.reduce((acc, p) => acc + p.kgSold, 0));
        const totalItems = round2(products.reduce((acc, p) => acc + p.totalSold, 0));
        return {
            totalRevenue: grossRevenue,
            grossRevenue,
            collectedRevenue,
            pendingRevenue,
            totalSales,
            totalItems,
            totalUnits,
            totalKg,
            productsCount: products.length,
            topProducts: products.sort((a, b) => b.rankValue - a.rankValue).slice(0, 10),
        };
    },
    async getTotalsByRange(startDate, endDate, unit) {
        const products = await this.buildProductReport({
            startDate,
            endDate,
            unit,
        });
        const salesWhere = {
            status: client_1.SaleStatus.COMPLETED,
            createdAt: {
                gte: startOfDay(startDate),
                lte: endOfDay(endDate),
            },
        };
        const totalSales = await prisma.sale.count({
            where: salesWhere,
        });
        const totalRevenueAgg = await prisma.sale.aggregate({
            where: salesWhere,
            _sum: {
                total: true,
            },
        });
        const financeIncomeAgg = await prisma.finance.aggregate({
            where: {
                type: client_1.FinanceType.INGRESO,
                category: {
                    in: [client_1.CategoryFinance.VENTA, client_1.CategoryFinance.COBRANZA],
                },
                date: {
                    gte: startOfDay(startDate),
                    lte: endOfDay(endDate),
                },
            },
            _sum: {
                amount: true,
            },
        });
        const grossRevenue = round2(n0(totalRevenueAgg._sum.total));
        const collectedRevenue = round2(n0(financeIncomeAgg._sum.amount));
        const pendingRevenue = round2(products.reduce((acc, p) => acc + n0(p.pendingRevenue), 0));
        const totalUnits = round2(products.reduce((acc, p) => acc + p.unitsSold, 0));
        const totalKg = round2(products.reduce((acc, p) => acc + p.kgSold, 0));
        const totalItems = round2(products.reduce((acc, p) => acc + p.totalSold, 0));
        return {
            totalRevenue: grossRevenue,
            grossRevenue,
            collectedRevenue,
            pendingRevenue,
            totalSales,
            totalItems,
            totalUnits,
            totalKg,
            productsCount: products.length,
            topProducts: products.sort((a, b) => b.rankValue - a.rankValue).slice(0, 10),
        };
    },
};
//# sourceMappingURL=productStats.service.js.map