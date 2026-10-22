"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryController = void 0;
const category_service_1 = require("../services/category.service");
const params_1 = require("../utils/params");
function normalizeBoolean(value) {
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
function sendServiceResponse(res, result, defaultStatus = 200) {
    if (result?.statusCode) {
        return res.status(result.statusCode).json({
            message: result.message,
        });
    }
    return res.status(defaultStatus).json(result);
}
exports.categoryController = {
    async getAll(req, res, next) {
        try {
            const includeInactive = req.query.includeInactive === "true" || req.query.all === "true";
            const categories = await category_service_1.categoryService.getAll({
                includeInactive,
            });
            res.json(categories);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const category = await category_service_1.categoryService.getById((0, params_1.getParamAsString)(req.params.id, "id"));
            if (!category) {
                return res.status(404).json({
                    message: "Categoría no encontrada",
                });
            }
            res.json(category);
        }
        catch (err) {
            next(err);
        }
    },
    async getBySlug(req, res, next) {
        try {
            const category = await category_service_1.categoryService.getBySlug((0, params_1.getParamAsString)(req.params.slug, "slug"));
            if (!category) {
                return res.status(404).json({
                    message: "Categoría no encontrada",
                });
            }
            res.json(category);
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const result = await category_service_1.categoryService.create({
                name: req.body.name,
                description: req.body.description,
                isActive: normalizeBoolean(req.body.isActive),
            });
            return sendServiceResponse(res, result, 201);
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const result = await category_service_1.categoryService.update((0, params_1.getParamAsString)(req.params.id, "id"), {
                name: req.body.name,
                description: req.body.description,
                isActive: normalizeBoolean(req.body.isActive),
            });
            return sendServiceResponse(res, result);
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            const result = await category_service_1.categoryService.delete((0, params_1.getParamAsString)(req.params.id, "id"));
            return sendServiceResponse(res, result);
        }
        catch (err) {
            next(err);
        }
    },
    async restore(req, res, next) {
        try {
            const result = await category_service_1.categoryService.restore((0, params_1.getParamAsString)(req.params.id, "id"));
            return sendServiceResponse(res, result);
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=category.controller.js.map