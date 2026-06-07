"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountController = void 0;
const account_service_1 = require("../services/account.service");
const params_1 = require("../utils/params");
function toNumber(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function toBoolean(value) {
    if (value === undefined)
        return undefined;
    if (typeof value === "boolean")
        return value;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    return Boolean(value);
}
exports.accountController = {
    async getClientAccount(req, res, next) {
        try {
            const { clientId } = req.params;
            const result = await account_service_1.accountService.getClientAccount((0, params_1.getParamAsString)(clientId, "clientId"));
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    },
    async getMovements(req, res, next) {
        try {
            const type = req.query.type;
            const movements = await account_service_1.accountService.getMovements({
                clientId: req.query.clientId,
                type,
                fromDate: req.query.fromDate
                    ? new Date(req.query.fromDate)
                    : undefined,
                toDate: req.query.toDate
                    ? new Date(req.query.toDate)
                    : undefined,
            });
            res.json(movements);
        }
        catch (err) {
            next(err);
        }
    },
    async getDebtors(req, res, next) {
        try {
            const debtors = await account_service_1.accountService.getDebtors();
            res.json(debtors);
        }
        catch (err) {
            next(err);
        }
    },
    async registerPayment(req, res, next) {
        try {
            const { clientId } = req.params;
            const userId = req.user?.id;
            const amount = toNumber(req.body.amount);
            if (!amount) {
                return res.status(400).json({
                    message: "amount es requerido y debe ser mayor a 0",
                });
            }
            if (!req.body.method) {
                return res.status(400).json({
                    message: "method es requerido",
                });
            }
            const result = await account_service_1.accountService.registerPayment({
                clientId: (0, params_1.getParamAsString)(req.params.clientId, "clientId"),
                amount,
                method: req.body.method,
                userId,
                reference: req.body.reference ?? null,
                description: req.body.description ?? null,
            });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    },
    async createAdjustment(req, res, next) {
        try {
            const { clientId } = req.params;
            const userId = req.user?.id;
            const amount = toNumber(req.body.amount);
            if (!amount) {
                return res.status(400).json({
                    message: "amount es requerido y debe ser mayor a 0",
                });
            }
            if (!["POSITIVE", "NEGATIVE"].includes(req.body.type)) {
                return res.status(400).json({
                    message: "type debe ser POSITIVE o NEGATIVE",
                });
            }
            const result = await account_service_1.accountService.createAdjustment({
                clientId: (0, params_1.getParamAsString)(req.params.clientId, "clientId"),
                type: req.body.type,
                amount,
                userId,
                reference: req.body.reference ?? null,
                description: req.body.description ?? null,
            });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    },
    async updateClientAccountConfig(req, res, next) {
        try {
            const { clientId } = req.params;
            const result = await account_service_1.accountService.updateClientAccountConfig((0, params_1.getParamAsString)(clientId, "clientId"), {
                creditLimit: req.body.creditLimit === null
                    ? null
                    : toNumber(req.body.creditLimit),
                isAccountEnabled: toBoolean(req.body.isAccountEnabled),
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=account.controller.js.map