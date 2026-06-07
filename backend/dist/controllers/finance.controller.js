"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeController = void 0;
const finance_service_1 = require("../services/finance.service");
const date_fns_1 = require("date-fns");
const params_1 = require("../utils/params");
exports.financeController = {
    async getAll(req, res, next) {
        try {
            res.json(await finance_service_1.financeService.getAll());
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res) {
        try {
            const { id } = req.params;
            // Si te mandan date string desde el front, lo parseamos
            const body = { ...req.body };
            if (body.date && typeof body.date === "string") {
                body.date = (0, date_fns_1.parseISO)(body.date);
            }
            const updated = await finance_service_1.financeService.update((0, params_1.getParamAsString)(id, "id"), body);
            res.json(updated);
        }
        catch (error) {
            // Prisma: registro no encontrado => P2025
            if (error?.code === "P2025") {
                return res.status(404).json({ error: "Registro financiero no encontrado" });
            }
            res.status(500).json({ error: error.message });
        }
    },
    async remove(req, res) {
        try {
            const { id } = req.params;
            const deleted = await finance_service_1.financeService.remove((0, params_1.getParamAsString)(id, "id"));
            res.json({ ok: true, deleted });
        }
        catch (error) {
            if (error?.code === "P2025") {
                return res.status(404).json({ error: "Registro financiero no encontrado" });
            }
            res.status(500).json({ error: error.message });
        }
    },
    async registerCreditNote(req, res) {
        try {
            const { amount, description = "Nota de crédito" } = req.body;
            const userId = req.user?.id || "unknown";
            const financeEntry = await finance_service_1.financeService.registerCreditNote(amount, description, userId);
            res.json(financeEntry);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async create(req, res, next) {
        try {
            res.status(201).json(await finance_service_1.financeService.create(req.body));
        }
        catch (err) {
            next(err);
        }
    },
    async getIncomeByMonth(req, res, next) {
        try {
            const { year, month } = req.query;
            res.json(await finance_service_1.financeService.getIncomeByMonth(Number(year), Number(month)));
        }
        catch (err) {
            next(err);
        }
    },
    async getIncomeByYear(req, res, next) {
        try {
            const { year } = req.query;
            res.json(await finance_service_1.financeService.getIncomeByYear(Number(year)));
        }
        catch (err) {
            next(err);
        }
    },
    async getIncomeByWeek(req, res, next) {
        try {
            const { year, month, day } = req.query;
            res.json(await finance_service_1.financeService.getIncomeByWeek(Number(year), Number(month), Number(day)));
        }
        catch (err) {
            next(err);
        }
    },
    async getTopProducts(req, res, next) {
        try {
            const { limit } = req.query;
            res.json(await finance_service_1.financeService.getTopProducts(Number(limit) || 5));
        }
        catch (err) {
            next(err);
        }
    },
    async getWorstProducts(req, res, next) {
        try {
            const { limit } = req.query;
            res.json(await finance_service_1.financeService.getWorstProducts(Number(limit) || 5));
        }
        catch (err) {
            next(err);
        }
    },
    async getIncomeByCategory(req, res, next) {
        try {
            const { from, to } = req.query;
            const fromDate = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(from));
            const toDate = (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(to));
            res.json(await finance_service_1.financeService.getIncomeByCategory(fromDate, toDate));
        }
        catch (err) {
            next(err);
        }
    },
    async getBestProductMonth(req, res, next) {
        try {
            const { month, year } = req.query;
            const startDate = (0, date_fns_1.startOfDay)(new Date(Number(year), Number(month) - 1, 1));
            const endDate = (0, date_fns_1.endOfDay)(new Date(Number(year), Number(month), 0));
            const product = await finance_service_1.financeService.getProductsRange(startDate, endDate, "desc");
            res.json(product[0] ?? null);
        }
        catch (err) {
            next(err);
        }
    },
    async getWorstProductMonth(req, res, next) {
        try {
            const { month, year } = req.query;
            const startDate = (0, date_fns_1.startOfDay)(new Date(Number(year), Number(month) - 1, 1));
            const endDate = (0, date_fns_1.endOfDay)(new Date(Number(year), Number(month), 0));
            const product = await finance_service_1.financeService.getProductsRange(startDate, endDate, "asc");
            res.json(product[0] ?? null);
        }
        catch (err) {
            next(err);
        }
    },
    async getTopProductsInRange(req, res, next) {
        try {
            const { from, to, limit } = req.query;
            const fromDate = from ? (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(from)) : undefined;
            const toDate = to ? (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(to)) : undefined;
            res.json(await finance_service_1.financeService.getTopProductsInRange(fromDate, toDate, Number(limit) || 5));
        }
        catch (err) {
            next(err);
        }
    },
    async exportExcel(req, res, next) {
        try {
            const { from, to } = req.query;
            const fromDate = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(from));
            const toDate = (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(to));
            const buffer = await finance_service_1.financeService.exportFinanceReport(fromDate, toDate);
            res.setHeader("Content-Disposition", "attachment; filename=reporte.xlsx");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.send(buffer);
        }
        catch (err) {
            next(err);
        }
    },
    async exportPDF(req, res, next) {
        try {
            const { from, to } = req.query;
            const fromDate = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(from));
            const toDate = (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(to));
            await finance_service_1.financeService.exportFinanceReportPDF(res, fromDate, toDate);
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=finance.controller.js.map