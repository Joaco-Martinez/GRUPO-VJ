"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const dateAR_1 = require("../utils/dateAR");
function fmtKgAR(n) {
    return n.toLocaleString("es-AR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
}
function pushQty(map, productId, qty, product) {
    if (!productId || !qty)
        return;
    const curr = map.get(productId);
    if (curr) {
        curr.qty += qty;
        if (!curr.product && product)
            curr.product = product;
    }
    else {
        map.set(productId, {
            productId,
            product: product ?? null,
            qty,
        });
    }
}
const STOCK_LOCATION_LABELS = {
    [client_1.Location.LOCAL]: "Mayorista",
    [client_1.Location.DEPOSITO]: "Minorista",
};
function round2(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
function normalizeStockLocationScope(value) {
    const raw = String(value ?? "ALL").toUpperCase();
    if (raw === client_1.Location.LOCAL)
        return client_1.Location.LOCAL;
    if (raw === client_1.Location.DEPOSITO)
        return client_1.Location.DEPOSITO;
    return "ALL";
}
function createLocationSummary(label) {
    return {
        label,
        salesCount: 0,
        itemsCount: 0,
        total: 0,
        cost: 0,
        grossProfit: 0,
        margin: 0,
    };
}
function getItemQuantityForCost(item) {
    const quantityKg = Number(item.quantityKg || 0);
    if (quantityKg > 0)
        return quantityKg;
    const quantity = Number(item.quantity || 0);
    return quantity > 0 ? quantity : 1;
}
function getSaleItemCost(item) {
    return Number(item.purchasePriceSnapshot || 0) * getItemQuantityForCost(item);
}
function finishSummary(summary) {
    const total = round2(summary.total);
    const cost = round2(summary.cost);
    const grossProfit = round2(summary.grossProfit);
    return {
        ...summary,
        total,
        cost,
        grossProfit,
        margin: total > 0 ? round2((grossProfit / total) * 100) : 0,
    };
}
async function getProductsInRangeByStockLocation(from, to, limit = 5, order = "desc", stockLocation) {
    const scope = normalizeStockLocationScope(stockLocation);
    const saleWhere = {
        status: client_1.SaleStatus.COMPLETED,
    };
    if (scope !== "ALL") {
        saleWhere.stockLocation = scope;
    }
    if (from || to) {
        saleWhere.createdAt = {};
        if (from)
            saleWhere.createdAt.gte = (0, dateAR_1.startOfDayAR)(from);
        if (to)
            saleWhere.createdAt.lte = (0, dateAR_1.endOfDayAR)(to);
    }
    const items = await prisma_1.default.saleItem.findMany({
        where: {
            sale: saleWhere,
        },
        include: {
            product: true,
        },
    });
    const map = new Map();
    for (const item of items) {
        const quantity = Number(item.quantity || 0);
        const quantityKg = Number(item.quantityKg || 0);
        const totalQty = quantityKg > 0 ? quantityKg : quantity;
        const subtotal = Number(item.subtotal || 0);
        const profit = Number(item.profit || 0);
        if (!item.productId || totalQty <= 0)
            continue;
        const current = map.get(item.productId);
        if (current) {
            current.qty += quantity;
            current.qtyKg += quantityKg;
            current.totalQty += totalQty;
            current.revenue += subtotal;
            current.grossProfit += profit;
        }
        else {
            map.set(item.productId, {
                productId: item.productId,
                product: item.product,
                qty: quantity,
                qtyKg: quantityKg,
                totalQty,
                revenue: subtotal,
                grossProfit: profit,
            });
        }
    }
    return Array.from(map.values())
        .filter((row) => row.totalQty > 0)
        .sort((a, b) => order === "desc" ? b.totalQty - a.totalQty : a.totalQty - b.totalQty)
        .slice(0, limit)
        .map((row) => ({
        productId: row.productId,
        product: row.product,
        stockLocation: scope,
        totalSold: round2(row.totalQty),
        totalQuantity: round2(row.totalQty),
        totalQuantityKg: round2(row.qtyKg),
        totalRevenue: round2(row.revenue),
        grossProfit: round2(row.grossProfit),
        _sum: {
            quantity: round2(row.totalQty),
            quantityKg: round2(row.qtyKg),
            subtotal: round2(row.revenue),
            profit: round2(row.grossProfit),
        },
    }));
}
exports.financeService = {
    // --- CRUD ---
    async getAll() {
        return prisma_1.default.finance.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
    },
    async create(data) {
        return prisma_1.default.finance.create({
            data: {
                type: data.type,
                amount: data.amount,
                category: data.category,
                description: data.description,
                date: data.date ?? new Date(),
            },
        });
    },
    async registerIncomeFromSale(saleId) {
        const sale = await prisma_1.default.sale.findUnique({
            where: {
                id: saleId,
            },
            include: {
                payments: true,
                items: {
                    include: {
                        product: true,
                        boxContents: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
            },
        });
        if (!sale)
            throw new Error("Venta no encontrada");
        if (sale.status !== "COMPLETED")
            return null;
        const marker = `[sale:${sale.id}]`;
        const existing = await prisma_1.default.finance.findFirst({
            where: {
                type: "INGRESO",
                category: "VENTA",
                description: {
                    contains: marker,
                },
            },
        });
        const paidAmount = sale.payments?.length
            ? sale.payments
                .filter((payment) => payment.method !== "CUENTA_CORRIENTE")
                .reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
            : sale.paymentMethod === "CUENTA_CORRIENTE"
                ? 0
                : Number(sale.total || 0);
        const amount = Number(paidAmount.toFixed(2));
        // Si ya existía un ingreso de esta venta, lo sincronizamos.
        // Esto evita que quede mal si después cambian los pagos.
        if (existing) {
            if (amount <= 0) {
                return prisma_1.default.finance.delete({
                    where: {
                        id: existing.id,
                    },
                });
            }
            return prisma_1.default.finance.update({
                where: {
                    id: existing.id,
                },
                data: {
                    amount,
                    paymentMethod: sale.payments?.length
                        ? sale.payments[0].method
                        : sale.paymentMethod,
                    date: existing.date,
                },
            });
        }
        // Venta 100% cuenta corriente: no genera ingreso hasta que se cobre.
        if (amount <= 0)
            return null;
        const itemsDesc = sale.items.map((i) => {
            const saleUnit = i.product?.saleUnit;
            if (i.product) {
                if (saleUnit === "KG") {
                    const kg = i.quantityKg ?? 0;
                    return `${i.product.name} x${fmtKgAR(kg)} kg`;
                }
                return `${i.product.name} x${i.quantity}`;
            }
            if (i.boxContents && i.boxContents.length > 0) {
                const boxItems = i.boxContents
                    .map((b) => `${b.product.name} x${b.quantity ?? b.quantityKg ?? 0}`)
                    .join(", ");
                return `Caja (${boxItems}) x${i.quantity}`;
            }
            return "Item desconocido";
        });
        const description = `${marker} Venta de ${itemsDesc.join(", ")}`;
        return prisma_1.default.finance.create({
            data: {
                type: "INGRESO",
                amount,
                category: "VENTA",
                description,
                date: new Date(),
                paymentMethod: sale.payments?.length
                    ? sale.payments[0].method
                    : sale.paymentMethod,
            },
        });
    },
    async registerCreditNote(amount, description, userId) {
        return await prisma_1.default.finance.create({
            data: {
                description: description || "Nota de crédito",
                amount: -Math.abs(amount),
                type: "EGRESO",
                category: "Otro",
                date: new Date(),
            },
        });
    },
    // --- ESTADÍSTICAS ---
    async getIncomeByMonth(year, month) {
        const { start, end } = (0, dateAR_1.monthRangeAR)(year, month);
        return prisma_1.default.finance.aggregate({
            where: {
                type: "INGRESO",
                date: {
                    gte: start,
                    lte: end,
                },
            },
            _sum: {
                amount: true,
            },
        });
    },
    async getIncomeByYear(year) {
        const { start, end } = (0, dateAR_1.yearRangeAR)(year);
        return prisma_1.default.finance.aggregate({
            where: {
                type: "INGRESO",
                date: {
                    gte: start,
                    lte: end,
                },
            },
            _sum: {
                amount: true,
            },
        });
    },
    async getIncomeByWeek(year, month, day) {
        const { start, end } = (0, dateAR_1.weekRangeAR)(year, month, day);
        return prisma_1.default.finance.aggregate({
            where: {
                type: "INGRESO",
                date: {
                    gte: start,
                    lte: end,
                },
            },
            _sum: {
                amount: true,
            },
        });
    },
    async getTopProducts(limit = 5) {
        const saleWhere = {
            status: "COMPLETED",
        };
        const direct = await prisma_1.default.saleItem.findMany({
            where: {
                sale: saleWhere,
            },
            include: {
                product: true,
            },
        });
        const boxItems = await prisma_1.default.saleItem.findMany({
            where: {
                sale: saleWhere,
                boxContents: {
                    some: {},
                },
            },
            select: {
                quantity: true,
                boxContents: {
                    select: {
                        productId: true,
                        quantity: true,
                        product: true,
                    },
                },
            },
        });
        const usage = new Map();
        for (const it of direct) {
            const quantityKg = Number(it.quantityKg || 0);
            const quantity = quantityKg > 0 ? quantityKg : Number(it.quantity || 0);
            pushQty(usage, it.productId, quantity, it.product);
        }
        for (const it of boxItems) {
            for (const c of it.boxContents) {
                const componentQty = c.quantity ?? 0;
                if (componentQty > 0) {
                    pushQty(usage, c.productId, it.quantity * componentQty, c.product);
                }
            }
        }
        return Array.from(usage.values())
            .sort((a, b) => b.qty - a.qty)
            .slice(0, limit)
            .map((r) => ({
            productId: r.productId,
            _sum: {
                quantity: round2(r.qty),
            },
            product: r.product,
        }));
    },
    async getWorstProducts(limit = 5) {
        const grouped = await prisma_1.default.saleItem.groupBy({
            by: ["productId"],
            _sum: {
                quantity: true,
            },
            where: {
                sale: {
                    status: client_1.SaleStatus.COMPLETED,
                },
            },
            orderBy: {
                _sum: {
                    quantity: "asc",
                },
            },
            take: limit,
        });
        const products = await prisma_1.default.product.findMany({
            where: {
                id: {
                    in: grouped.map((g) => g.productId),
                },
            },
        });
        return grouped.map((g) => ({
            productId: g.productId,
            _sum: {
                quantity: g._sum.quantity ?? 0,
            },
            product: products.find((p) => p.id === g.productId) || null,
        }));
    },
    async getProductsRange(startDate, endDate, order) {
        const grouped = await prisma_1.default.saleItem.groupBy({
            by: ["productId"],
            _sum: {
                quantity: true,
            },
            where: {
                sale: {
                    status: client_1.SaleStatus.COMPLETED,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            },
            orderBy: {
                _sum: {
                    quantity: order,
                },
            },
            take: 1,
        });
        if (!grouped.length)
            return [];
        const product = await prisma_1.default.product.findUnique({
            where: {
                id: grouped[0].productId,
            },
        });
        return [
            {
                productId: grouped[0].productId,
                _sum: {
                    quantity: grouped[0]._sum.quantity ?? 0,
                },
                product,
            },
        ];
    },
    async getIncomeByCategory(from, to) {
        return prisma_1.default.finance.groupBy({
            by: ["category"],
            where: {
                type: "INGRESO",
                date: {
                    gte: (0, dateAR_1.startOfDayAR)(from),
                    lte: (0, dateAR_1.endOfDayAR)(to),
                },
            },
            _sum: {
                amount: true,
            },
        });
    },
    async getSalesByStockLocation(from, to) {
        const where = {
            status: {
                not: client_1.SaleStatus.CANCELLED,
            },
        };
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = (0, dateAR_1.startOfDayAR)(from);
            if (to)
                where.createdAt.lte = (0, dateAR_1.endOfDayAR)(to);
        }
        const sales = await prisma_1.default.sale.findMany({
            where,
            select: {
                id: true,
                total: true,
                grossProfit: true,
                stockLocation: true,
                items: {
                    select: {
                        quantity: true,
                        quantityKg: true,
                        purchasePriceSnapshot: true,
                    },
                },
            },
        });
        const local = createLocationSummary(STOCK_LOCATION_LABELS[client_1.Location.LOCAL]);
        const deposito = createLocationSummary(STOCK_LOCATION_LABELS[client_1.Location.DEPOSITO]);
        const all = createLocationSummary("Todo");
        const addSaleToSummary = (summary, sale) => {
            const total = Number(sale.total || 0);
            const cost = sale.items.reduce((acc, item) => {
                return acc + getSaleItemCost(item);
            }, 0);
            const grossProfit = typeof sale.grossProfit === "number"
                ? Number(sale.grossProfit || 0)
                : total - cost;
            summary.salesCount += 1;
            summary.itemsCount += sale.items.length;
            summary.total += total;
            summary.cost += cost;
            summary.grossProfit += grossProfit;
        };
        for (const sale of sales) {
            addSaleToSummary(all, sale);
            if (sale.stockLocation === client_1.Location.DEPOSITO) {
                addSaleToSummary(deposito, sale);
            }
            else {
                addSaleToSummary(local, sale);
            }
        }
        return {
            all: finishSummary(all),
            [client_1.Location.LOCAL]: finishSummary(local),
            [client_1.Location.DEPOSITO]: finishSummary(deposito),
        };
    },
    async getTopProductsInRange(from, to, limit = 5, stockLocation) {
        return getProductsInRangeByStockLocation(from, to, limit, "desc", stockLocation);
    },
    async getWorstProductsInRange(from, to, limit = 5, stockLocation) {
        return getProductsInRangeByStockLocation(from, to, limit, "asc", stockLocation);
    },
    // --- EXPORTACIÓN EXCEL ---
    async exportFinanceReport(from, to) {
        const finances = await prisma_1.default.finance.findMany({
            where: {
                date: {
                    gte: (0, dateAR_1.startOfDayAR)(from),
                    lte: (0, dateAR_1.endOfDayAR)(to),
                },
            },
        });
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet("Reporte Finanzas");
        sheet.addRow(["Fecha", "Tipo", "Categoría", "Descripción", "Monto"]);
        finances.forEach((f) => {
            sheet.addRow([
                (0, dateAR_1.formatDateAR)(f.date),
                f.type,
                f.category,
                f.description ?? "",
                f.amount,
            ]);
        });
        return await workbook.xlsx.writeBuffer();
    },
    // --- EXPORTACIÓN PDF ---
    async exportFinanceReportPDF(res, from, to) {
        const finances = await prisma_1.default.finance.findMany({
            where: {
                date: {
                    gte: (0, dateAR_1.startOfDayAR)(from),
                    lte: (0, dateAR_1.endOfDayAR)(to),
                },
            },
        });
        const doc = new pdfkit_1.default();
        res.setHeader("Content-Disposition", "attachment; filename=reporte.pdf");
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);
        doc.fontSize(18).text("Reporte Financiero", {
            align: "center",
        });
        doc.moveDown();
        finances.forEach((f) => {
            doc
                .fontSize(12)
                .text(`${(0, dateAR_1.formatDateAR)(f.date)} - ${f.type} - ${f.category} - $${f.amount} - ${f.description ?? ""}`);
        });
        doc.end();
    },
    async update(id, data) {
        const cleanData = {};
        if (data.type !== undefined)
            cleanData.type = data.type;
        if (data.amount !== undefined)
            cleanData.amount = data.amount;
        if (data.category !== undefined)
            cleanData.category = data.category;
        if (data.description !== undefined)
            cleanData.description = data.description;
        if (data.date !== undefined)
            cleanData.date = data.date;
        if (data.paymentMethod !== undefined) {
            cleanData.paymentMethod = data.paymentMethod;
        }
        return prisma_1.default.finance.update({
            where: {
                id,
            },
            data: cleanData,
        });
    },
    async remove(id) {
        return prisma_1.default.finance.delete({
            where: {
                id,
            },
        });
    },
};
//# sourceMappingURL=finance.service.js.map