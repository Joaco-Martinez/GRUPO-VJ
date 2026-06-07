"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessLocationController = void 0;
const businessLocation_service_1 = require("../services/businessLocation.service");
const params_1 = require("../utils/params");
const client_1 = require("@prisma/client");
function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function toBoolean(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "boolean")
        return value;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    if (value === "1")
        return true;
    if (value === "0")
        return false;
    return undefined;
}
function normalizeBody(body) {
    const normalized = {
        ...body,
        latitude: toNumberOrNull(body.latitude),
        longitude: toNumberOrNull(body.longitude),
    };
    const isDefault = toBoolean(body.isDefault);
    const isActive = toBoolean(body.isActive);
    if (isDefault !== undefined)
        normalized.isDefault = isDefault;
    if (isActive !== undefined)
        normalized.isActive = isActive;
    return normalized;
}
function isBusinessLocationType(value) {
    return Object.values(client_1.BusinessLocationType).includes(value);
}
exports.businessLocationController = {
    async create(req, res, next) {
        try {
            const body = normalizeBody(req.body);
            if (body.type !== undefined && !isBusinessLocationType(body.type)) {
                return res.status(400).json({
                    ok: false,
                    message: "Tipo inválido. Usá BRANCH, WAREHOUSE o STORE",
                });
            }
            const location = await businessLocation_service_1.businessLocationService.create(body);
            res.status(201).json({
                ok: true,
                location,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getAll(req, res, next) {
        try {
            const onlyActive = req.query.onlyActive;
            const locations = await businessLocation_service_1.businessLocationService.getAll({
                onlyActive: onlyActive === undefined ? undefined : toBoolean(onlyActive),
            });
            res.json({
                ok: true,
                locations,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            const location = await businessLocation_service_1.businessLocationService.getById((0, params_1.getParamAsString)(req.params.id, "id"));
            if (!location) {
                return res.status(404).json({
                    ok: false,
                    message: "Sucursal/depósito no encontrado",
                });
            }
            res.json({
                ok: true,
                location,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async update(req, res, next) {
        try {
            const body = normalizeBody(req.body);
            if (body.type !== undefined && !isBusinessLocationType(body.type)) {
                return res.status(400).json({
                    ok: false,
                    message: "Tipo inválido. Usá BRANCH, WAREHOUSE o STORE",
                });
            }
            const location = await businessLocation_service_1.businessLocationService.update((0, params_1.getParamAsString)(req.params.id, "id"), body);
            res.json({
                ok: true,
                location,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            await businessLocation_service_1.businessLocationService.remove((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({
                ok: true,
                message: "Sucursal/depósito eliminado correctamente",
            });
        }
        catch (error) {
            next(error);
        }
    },
    async setDefault(req, res, next) {
        try {
            const location = await businessLocation_service_1.businessLocationService.setDefault((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({
                ok: true,
                location,
            });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=businessLocation.controller.js.map