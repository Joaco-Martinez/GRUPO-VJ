"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogController = void 0;
const catalog_service_1 = require("../services/catalog.service");
function toNumber(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
exports.catalogController = {
    async getCategories(_req, res, next) {
        try {
            const categories = await catalog_service_1.catalogService.getCategories();
            res.json({
                ok: true,
                content: categories,
            });
        }
        catch (err) {
            next(err);
        }
    },
    async getProducts(req, res, next) {
        try {
            const user = req.user;
            const result = await catalog_service_1.catalogService.getProducts({
                userId: user?.id,
                categorySlug: typeof req.query.category === "string" ? req.query.category : undefined,
                search: typeof req.query.search === "string" ? req.query.search : undefined,
                limit: toNumber(req.query.limit),
                page: toNumber(req.query.page),
            });
            res.json({
                ok: true,
                content: result,
            });
        }
        catch (err) {
            next(err);
        }
    },
    async checkoutWhatsapp(req, res, next) {
        try {
            const user = req.user;
            const result = await catalog_service_1.catalogService.checkoutWhatsapp({
                userId: user?.id,
                items: Array.isArray(req.body.items)
                    ? req.body.items.map((item) => ({
                        productId: item.productId,
                        quantity: toNumber(item.quantity),
                        quantityKg: toNumber(item.quantityKg),
                    }))
                    : [],
                paymentMethod: req.body.paymentMethod,
                customerNotes: req.body.customerNotes,
            });
            res.status(201).json({
                ok: true,
                content: result,
            });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=catalog.controller.js.map