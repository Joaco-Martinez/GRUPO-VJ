"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseController = void 0;
const purchase_service_1 = require("../services/purchase.service");
const params_1 = require("../utils/params");
exports.purchaseController = {
    async getAll(_req, res, next) {
        try {
            res.json(await purchase_service_1.purchaseService.getAll());
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            res.json(await purchase_service_1.purchaseService.getById(id));
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const userId = req.user?.id;
            const purchase = await purchase_service_1.purchaseService.create(req.body, userId);
            res.status(201).json(purchase);
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const userId = req.user?.id;
            const purchase = await purchase_service_1.purchaseService.update(id, req.body, userId);
            res.json(purchase);
        }
        catch (err) {
            next(err);
        }
    },
    async updateProvider(req, res, next) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const purchase = await purchase_service_1.purchaseService.updateProvider(id, req.body);
            res.json(purchase);
        }
        catch (err) {
            next(err);
        }
    },
    async cancel(req, res, next) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const userId = req.user?.id;
            const purchase = await purchase_service_1.purchaseService.cancel(id, userId);
            res.json(purchase);
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=purchase.controller.js.map