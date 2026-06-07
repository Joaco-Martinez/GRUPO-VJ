"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productStatsController = void 0;
const productStats_service_1 = require("../services/productStats.service");
function parseUnit(unit) {
    if (!unit)
        return undefined;
    const u = String(unit).toUpperCase();
    if (u === "UNIT" || u === "KG") {
        return u;
    }
    return undefined;
}
function parseLimit(limit, fallback = 10) {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(n), 100);
}
function parseDateParam(value) {
    if (!value)
        return null;
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}
function getStartDateQuery(req) {
    const { start, from, startDate } = req.query;
    return start ?? from ?? startDate;
}
function getEndDateQuery(req) {
    const { end, to, endDate } = req.query;
    return end ?? to ?? endDate;
}
exports.productStatsController = {
    async getTop(req, res) {
        try {
            const { limit = 10, unit } = req.query;
            const stats = await productStats_service_1.productStatsService.getTopProducts(parseLimit(limit, 10), parseUnit(unit));
            res.json(stats);
        }
        catch (error) {
            console.error("Error getTop product-stats:", error);
            res.status(500).json({
                error: "Error al obtener productos más vendidos",
                detail: error?.message,
            });
        }
    },
    async getWorst(req, res) {
        try {
            const { limit = 10, unit } = req.query;
            const stats = await productStats_service_1.productStatsService.getWorstProducts(parseLimit(limit, 10), parseUnit(unit));
            res.json(stats);
        }
        catch (error) {
            console.error("Error getWorst product-stats:", error);
            res.status(500).json({
                error: "Error al obtener productos menos vendidos",
                detail: error?.message,
            });
        }
    },
    async getTopRange(req, res) {
        try {
            const { limit = 10, unit } = req.query;
            const startDate = parseDateParam(getStartDateQuery(req));
            const endDate = parseDateParam(getEndDateQuery(req));
            if (!startDate || !endDate) {
                return res.status(400).json({
                    error: "Faltan fechas",
                    detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
                });
            }
            const stats = await productStats_service_1.productStatsService.getTopProductsByRange(startDate, endDate, parseLimit(limit, 10), parseUnit(unit));
            res.json(stats);
        }
        catch (error) {
            console.error("Error getTopRange product-stats:", error);
            res.status(500).json({
                error: "Error al obtener productos en rango",
                detail: error?.message,
            });
        }
    },
    async getWorstRange(req, res) {
        try {
            const { limit = 10, unit } = req.query;
            const startDate = parseDateParam(getStartDateQuery(req));
            const endDate = parseDateParam(getEndDateQuery(req));
            if (!startDate || !endDate) {
                return res.status(400).json({
                    error: "Faltan fechas",
                    detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
                });
            }
            const stats = await productStats_service_1.productStatsService.getWorstProductsByRange(startDate, endDate, parseLimit(limit, 10), parseUnit(unit));
            res.json(stats);
        }
        catch (error) {
            console.error("Error getWorstRange product-stats:", error);
            res.status(500).json({
                error: "Error al obtener productos con menor venta en rango",
                detail: error?.message,
            });
        }
    },
    async getBestMonth(req, res) {
        try {
            const { year, month, unit } = req.query;
            if (!year || !month) {
                return res.status(400).json({
                    error: "Faltan parámetros",
                    detail: "Debés enviar year y month",
                });
            }
            const stat = await productStats_service_1.productStatsService.getBestProductByMonth(Number(year), Number(month), parseUnit(unit));
            res.json(stat);
        }
        catch (error) {
            console.error("Error getBestMonth product-stats:", error);
            res.status(500).json({
                error: "Error al obtener producto top del mes",
                detail: error?.message,
            });
        }
    },
    async getWorstMonth(req, res) {
        try {
            const { year, month, unit } = req.query;
            if (!year || !month) {
                return res.status(400).json({
                    error: "Faltan parámetros",
                    detail: "Debés enviar year y month",
                });
            }
            const stat = await productStats_service_1.productStatsService.getWorstProductByMonth(Number(year), Number(month), parseUnit(unit));
            res.json(stat);
        }
        catch (error) {
            console.error("Error getWorstMonth product-stats:", error);
            res.status(500).json({
                error: "Error al obtener producto peor del mes",
                detail: error?.message,
            });
        }
    },
    async getTotals(req, res) {
        try {
            const { unit } = req.query;
            const data = await productStats_service_1.productStatsService.getTotals(parseUnit(unit));
            res.json(data);
        }
        catch (error) {
            console.error("Error getTotals product-stats:", error);
            res.status(500).json({
                error: "Error al obtener totales de productos",
                detail: error?.message,
            });
        }
    },
    async getTotalsRange(req, res) {
        try {
            const { unit } = req.query;
            const startDate = parseDateParam(getStartDateQuery(req));
            const endDate = parseDateParam(getEndDateQuery(req));
            if (!startDate || !endDate) {
                return res.status(400).json({
                    error: "Faltan fechas",
                    detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
                });
            }
            const data = await productStats_service_1.productStatsService.getTotalsByRange(startDate, endDate, parseUnit(unit));
            res.json(data);
        }
        catch (error) {
            console.error("Error getTotalsRange product-stats:", error);
            res.status(500).json({
                error: "Error al obtener totales por rango",
                detail: error?.message,
            });
        }
    },
};
//# sourceMappingURL=productStast.controller.js.map