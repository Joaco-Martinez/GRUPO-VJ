"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const auth_service_1 = require("../services/auth.service");
const params_1 = require("../utils/params");
exports.authController = {
    async register(req, res, next) {
        try {
            const user = await auth_service_1.authService.register({
                email: req.body.email,
                password: req.body.password,
                nombre: req.body.nombre,
                apellido: req.body.apellido,
                name: req.body.name,
                dni: req.body.dni,
                telefono: req.body.telefono,
            });
            res.status(201).json({
                ok: true,
                content: user,
            });
        }
        catch (err) {
            next(err);
        }
    },
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.authService.login(email, password, res);
            res.json({
                ok: true,
                content: result,
            });
        }
        catch (err) {
            next(err);
        }
    },
    async logout(req, res, next) {
        try {
            const result = await auth_service_1.authService.logout(res);
            res.json({
                ok: true,
                content: result,
            });
        }
        catch (err) {
            next(err);
        }
    },
    async me(req, res, next) {
        try {
            const user = await auth_service_1.authService.me(req);
            res.json({
                ok: true,
                content: user,
            });
        }
        catch (err) {
            res.clearCookie("token", { path: "/" });
            res.clearCookie("user", { path: "/" });
            next(err);
        }
    },
    async deleteUser(req, res, next) {
        try {
            const { id } = req.params;
            const result = await auth_service_1.authService.deleteUser((0, params_1.getParamAsString)(id, "id"));
            res.json({
                ok: true,
                content: result,
            });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=auth.controller.js.map