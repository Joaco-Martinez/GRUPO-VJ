"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
function fmtKgAR(n) {
    return n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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
        map.set(productId, { productId, product: product ?? null, qty });
    }
}
exports.financeService = {
    // --- CRUD ---
    async getAll() {
        return prisma_1.default.finance.findMany({ orderBy: { createdAt: "desc" } });
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
            where: { id: saleId },
            include: {
                payments: true,
                items: {
                    include: {
                        product: true,
                        boxContents: { include: { product: true } },
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
                description: { contains: marker },
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
                    where: { id: existing.id },
                });
            }
            return prisma_1.default.finance.update({
                where: { id: existing.id },
                data: {
                    amount,
                    paymentMethod: sale.payments?.length ? sale.payments[0].method : sale.paymentMethod,
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
                paymentMethod: sale.payments?.length ? sale.payments[0].method : sale.paymentMethod,
            },
        });
    },
    async registerCreditNote(amount, description, userId) {
        return await prisma_1.default.finance.create({
            data: {
                description: description || "Nota de crédito",
                amount: -Math.abs(amount), // siempre negativo
                type: "EGRESO",
                category: "Otro", // 👈 IMPORTANTE: categoría obligatoria
                date: new Date(),
            },
        });
    },
    // --- ESTADÍSTICAS ---
    async getIncomeByMonth(year, month) {
        const start = (0, date_fns_1.startOfMonth)(new Date(year, month - 1));
        const end = (0, date_fns_1.endOfMonth)(new Date(year, month - 1));
        return prisma_1.default.finance.aggregate({
            where: { type: "INGRESO", date: { gte: start, lte: end } },
            _sum: { amount: true },
        });
    },
    async getIncomeByYear(year) {
        const start = (0, date_fns_1.startOfYear)(new Date(year, 0));
        const end = (0, date_fns_1.endOfYear)(new Date(year, 0));
        return prisma_1.default.finance.aggregate({
            where: { type: "INGRESO", date: { gte: start, lte: end } },
            _sum: { amount: true },
        });
    },
    async getIncomeByWeek(year, month, day) {
        const start = (0, date_fns_1.startOfWeek)(new Date(year, month - 1, day), {
            weekStartsOn: 1,
        });
        const end = (0, date_fns_1.endOfWeek)(new Date(year, month - 1, day), { weekStartsOn: 1 });
        return prisma_1.default.finance.aggregate({
            where: { type: "INGRESO", date: { gte: start, lte: end } },
            _sum: { amount: true },
        });
    },
    async getTopProducts(limit = 5) {
        const saleWhere = { status: "COMPLETED" };
        const direct = await prisma_1.default.saleItem.findMany({
            where: { sale: saleWhere, productId: { not: undefined } },
            include: { product: true },
        });
        const boxItems = await prisma_1.default.saleItem.findMany({
            where: { sale: saleWhere, boxContents: { some: {} } },
            select: {
                quantity: true,
                boxContents: {
                    select: { productId: true, quantity: true, product: true },
                },
            },
        });
        const usage = new Map();
        for (const it of direct) {
            pushQty(usage, it.productId, it.quantity, it.product);
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
            _sum: { quantity: r.qty },
            product: r.product,
        }));
    },
    async getWorstProducts(limit = 5) {
        const grouped = await prisma_1.default.saleItem.groupBy({
            by: ["productId"],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: "asc" } },
            take: limit,
        });
        const products = await prisma_1.default.product.findMany({
            where: { id: { in: grouped.map((g) => g.productId) } },
        });
        return grouped.map((g) => ({
            productId: g.productId,
            _sum: { quantity: g._sum.quantity ?? 0 },
            product: products.find((p) => p.id === g.productId) || null,
        }));
    },
    async getProductsRange(startDate, endDate, order) {
        const grouped = await prisma_1.default.saleItem.groupBy({
            by: ["productId"],
            _sum: { quantity: true },
            where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
            orderBy: { _sum: { quantity: order } },
            take: 1,
        });
        if (!grouped.length)
            return [];
        const product = await prisma_1.default.product.findUnique({
            where: { id: grouped[0].productId },
        });
        return [
            {
                productId: grouped[0].productId,
                _sum: { quantity: grouped[0]._sum.quantity ?? 0 },
                product,
            },
        ];
    },
    async getIncomeByCategory(from, to) {
        return prisma_1.default.finance.groupBy({
            by: ["category"],
            where: {
                type: "INGRESO",
                date: { gte: (0, date_fns_1.startOfDay)(from), lte: (0, date_fns_1.endOfDay)(to) },
            },
            _sum: { amount: true },
        });
    },
    async getTopProductsInRange(from, to, limit = 5) {
        const where = { sale: { status: "COMPLETED" } };
        if (from || to) {
            where.sale.createdAt = {};
            if (from)
                where.sale.createdAt.gte = (0, date_fns_1.startOfDay)(from);
            if (to)
                where.sale.createdAt.lte = (0, date_fns_1.endOfDay)(to);
        }
        const items = await prisma_1.default.saleItem.findMany({
            where,
            include: { product: true },
        });
        const map = new Map();
        for (const item of items) {
            const curr = map.get(item.productId);
            if (curr) {
                curr.qty += item.quantity;
            }
            else {
                map.set(item.productId, {
                    productId: item.productId,
                    product: item.product,
                    qty: item.quantity,
                });
            }
        }
        return Array.from(map.values())
            .sort((a, b) => b.qty - a.qty)
            .slice(0, limit)
            .map((r) => ({
            productId: r.productId,
            _sum: { quantity: r.qty },
            product: r.product,
        }));
    },
    // --- EXPORTACIÓN EXCEL ---
    async exportFinanceReport(from, to) {
        const finances = await prisma_1.default.finance.findMany({
            where: { date: { gte: (0, date_fns_1.startOfDay)(from), lte: (0, date_fns_1.endOfDay)(to) } },
        });
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet("Reporte Finanzas");
        sheet.addRow(["Fecha", "Tipo", "Categoría", "Descripción", "Monto"]);
        finances.forEach((f) => {
            sheet.addRow([
                f.date.toISOString().split("T")[0],
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
            where: { date: { gte: (0, date_fns_1.startOfDay)(from), lte: (0, date_fns_1.endOfDay)(to) } },
        });
        const doc = new pdfkit_1.default();
        res.setHeader("Content-Disposition", "attachment; filename=reporte.pdf");
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);
        doc.fontSize(18).text("Reporte Financiero", { align: "center" });
        doc.moveDown();
        finances.forEach((f) => {
            doc
                .fontSize(12)
                .text(`${f.date.toISOString().split("T")[0]} - ${f.type} - ${f.category} - $${f.amount} - ${f.description ?? ""}`);
        });
        doc.end();
    },
    async update(id, data) {
        // opcional: si querés evitar romper con undefined
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
        if (data.paymentMethod !== undefined)
            cleanData.paymentMethod = data.paymentMethod;
        return prisma_1.default.finance.update({
            where: { id },
            data: cleanData,
        });
    },
    async remove(id) {
        return prisma_1.default.finance.delete({
            where: { id },
        });
    },
};
//# sourceMappingURL=finance.service.js.map