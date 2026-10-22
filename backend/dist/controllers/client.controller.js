"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientController = void 0;
const client_service_1 = require("../services/client.service");
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
function normalizeClientBody(body) {
    const clean = { ...body };
    clean.creditLimit = toNumberOrNull(body.creditLimit);
    clean.isAccountEnabled = toBoolean(body.isAccountEnabled);
    clean.createUser = toBoolean(body.createUser);
    clean.unlinkUser = toBoolean(body.unlinkUser);
    clean.latitude = toNumberOrNull(body.latitude);
    clean.longitude = toNumberOrNull(body.longitude);
    return clean;
}
exports.clientController = {
    async create(req, res, next) {
        try {
            const client = await client_service_1.clientService.createClient(normalizeClientBody(req.body));
            res.status(201).json({
                ok: true,
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getAll(req, res, next) {
        try {
            const light = req.query.light === "true" || req.query.light === "1";
            const includeInactive = req.query.includeInactive === "true" || req.query.includeInactive === "1";
            const clients = await client_service_1.clientService.getClients({ light, includeInactive });
            res.json({
                ok: true,
                clients,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            await client_service_1.clientService.requestPasswordReset(email);
            res.json({
                ok: true,
                message: "Si el email está registrado, te enviamos un enlace para restablecer la contraseña",
            });
        }
        catch (error) {
            next(error);
        }
    },
    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            await client_service_1.clientService.resetPassword(token, password);
            res.json({
                ok: true,
                message: "Contraseña actualizada correctamente",
            });
        }
        catch (error) {
            next(error);
        }
    },
    async registerFromStore(req, res, next) {
        try {
            const client = await client_service_1.clientService.registerStoreClient({
                ...req.body,
                latitude: toNumberOrNull(req.body.latitude) ?? null,
                longitude: toNumberOrNull(req.body.longitude) ?? null,
            });
            res.status(201).json({
                ok: true,
                message: "Cuenta creada correctamente",
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            const { id } = req.params;
            const client = await client_service_1.clientService.getClientById((0, params_1.getParamAsString)(id, "id"));
            if (!client) {
                return res.status(404).json({
                    ok: false,
                    message: "Cliente no encontrado",
                });
            }
            res.json({
                ok: true,
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const body = normalizeClientBody(req.body);
            if (body.creditLimit !== undefined) {
                body.creditLimit = body.creditLimit ?? null;
            }
            const client = await client_service_1.clientService.updateClient((0, params_1.getParamAsString)(id, "id"), body);
            res.json({
                ok: true,
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            const { id } = req.params;
            await client_service_1.clientService.deleteClient((0, params_1.getParamAsString)(id, "id"));
            res.json({
                ok: true,
                message: "Cliente eliminado correctamente",
            });
        }
        catch (error) {
            next(error);
        }
    },
    async deactivate(req, res, next) {
        try {
            const { id } = req.params;
            const client = await client_service_1.clientService.deactivateClient((0, params_1.getParamAsString)(id, "id"));
            res.json({
                ok: true,
                message: "Cliente desactivado correctamente",
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
    async activate(req, res, next) {
        try {
            const { id } = req.params;
            const client = await client_service_1.clientService.reactivateClient((0, params_1.getParamAsString)(id, "id"));
            res.json({
                ok: true,
                message: "Cliente reactivado correctamente",
                client,
            });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=client.controller.js.map