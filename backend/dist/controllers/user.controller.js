"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const user_service_1 = require("../services/user.service");
const params_1 = require("../utils/params");
function toNumberOrNull(value) {
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
function safeJson(data) {
    return JSON.parse(JSON.stringify(data, (_key, value) => typeof value === "bigint" ? value.toString() : value));
}
exports.userController = {
    async updateOwnPreferences(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            const { defaultStockLocation, defaultPriceCategory } = req.body;
            const updated = await user_service_1.userService.updateOwnPreferences(userId, {
                defaultStockLocation: defaultStockLocation === undefined ? undefined : defaultStockLocation || null,
                defaultPriceCategory: defaultPriceCategory === undefined ? undefined : defaultPriceCategory || null,
            });
            res.json(safeJson(updated));
        }
        catch (err) {
            next(err);
        }
    },
    async getAll(_req, res, next) {
        try {
            const users = await user_service_1.userService.getAll();
            res.json(safeJson(users));
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const user = await user_service_1.userService.getById((0, params_1.getParamAsString)(req.params.id, "id"));
            if (!user) {
                return res.status(404).json({
                    message: "Usuario no encontrado",
                });
            }
            res.json(safeJson(user));
        }
        catch (err) {
            next(err);
        }
    },
    async getActivityById(req, res, next) {
        try {
            const activity = await user_service_1.userService.getActivityById((0, params_1.getParamAsString)(req.params.id, "id"), {
                fromDate: typeof req.query.fromDate === "string"
                    ? req.query.fromDate
                    : undefined,
                toDate: typeof req.query.toDate === "string"
                    ? req.query.toDate
                    : undefined,
            });
            if (!activity) {
                return res.status(404).json({
                    message: "Usuario no encontrado",
                });
            }
            res.json(safeJson(activity));
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const newUser = await user_service_1.userService.create({
                ...req.body,
                creditLimit: toNumberOrNull(req.body.creditLimit),
                isAccountEnabled: toBoolean(req.body.isAccountEnabled),
                isActive: toBoolean(req.body.isActive),
            });
            res.status(201).json(safeJson(newUser));
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const body = { ...req.body };
            if (body.isActive !== undefined) {
                body.isActive = toBoolean(body.isActive);
            }
            const updated = await user_service_1.userService.update((0, params_1.getParamAsString)(req.params.id, "id"), body);
            res.json(safeJson(updated));
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await user_service_1.userService.delete((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({
                message: "Usuario eliminado",
            });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=user.controller.js.map