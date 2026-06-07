"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productController = void 0;
const product_service_1 = require("../services/product.service");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const params_1 = require("../utils/params");
const upload = (0, multer_1.default)({
    dest: "uploads/",
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error("Formato de imagen inválido. Usá JPG, PNG o WEBP."));
        }
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error("Extensión de imagen inválida. Usá JPG, PNG o WEBP."));
        }
        cb(null, true);
    },
});
const toNumberOrUndefined = (v) => v === undefined || v === null || v === "" ? undefined : Number(v);
function parseJsonArray(value) {
    if (!value)
        return undefined;
    if (Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
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
exports.productController = {
    async getAll(req, res, next) {
        try {
            const products = await product_service_1.productService.getAll();
            res.json(products);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const product = await product_service_1.productService.getById((0, params_1.getParamAsString)(req.params.id, "id"));
            if (!product) {
                return res.status(404).json({ message: "Producto no encontrado" });
            }
            res.json(product);
        }
        catch (err) {
            next(err);
        }
    },
    create: [
        upload.single("image"),
        async (req, res, next) => {
            try {
                const newProduct = await product_service_1.productService.create({
                    name: req.body.name,
                    description: req.body.description,
                    type: req.body.type,
                    isService: normalizeBoolean(req.body.isService),
                    categoryId: req.body.categoryId,
                    category: req.body.category,
                    price: req.body.price,
                    wholesalePrice: req.body.wholesalePrice,
                    clientPrice: req.body.clientPrice,
                    purchasePrice: req.body.purchasePrice,
                    saleUnit: req.body.saleUnit,
                    pricePerKg: req.body.pricePerKg,
                    clientPricePerKg: req.body.clientPricePerKg,
                    wholesalePricePerKg: req.body.wholesalePricePerKg,
                    sku: req.body.sku,
                    stockLocal: req.body.stockLocal,
                    stockDeposito: req.body.stockDeposito,
                    stockLocalKg: req.body.stockLocalKg,
                    stockDepositoKg: req.body.stockDepositoKg,
                    minStock: req.body.minStock,
                    minStockKg: req.body.minStockKg,
                    file: req.file,
                    components: parseJsonArray(req.body.components),
                    boxContents: parseJsonArray(req.body.boxContents),
                });
                if (newProduct?.statusCode) {
                    return res
                        .status(newProduct.statusCode)
                        .json({ message: newProduct.message });
                }
                res.status(201).json(newProduct);
            }
            catch (err) {
                next(err);
            }
        },
    ],
    async update(req, res, next) {
        try {
            const body = req.body ?? {};
            const cleanBody = {};
            if (body.name !== undefined)
                cleanBody.name = String(body.name);
            if (body.description !== undefined) {
                cleanBody.description = String(body.description);
            }
            if (body.type !== undefined)
                cleanBody.type = body.type;
            // Nueva categoría dinámica
            if (body.categoryId !== undefined)
                cleanBody.categoryId = body.categoryId;
            if (body.sku !== undefined)
                cleanBody.sku = String(body.sku);
            if (body.saleUnit !== undefined)
                cleanBody.saleUnit = body.saleUnit;
            if (body.imageUrl !== undefined)
                cleanBody.imageUrl = body.imageUrl;
            if (body.imageId !== undefined)
                cleanBody.imageId = body.imageId;
            if (body.isActive !== undefined) {
                cleanBody.isActive = normalizeBoolean(body.isActive);
            }
            if (body.isService !== undefined) {
                cleanBody.isService = normalizeBoolean(body.isService);
            }
            if (body.price !== undefined) {
                cleanBody.price = toNumberOrUndefined(body.price);
            }
            if (body.clientPrice !== undefined) {
                cleanBody.clientPrice = toNumberOrUndefined(body.clientPrice);
            }
            if (body.wholesalePrice !== undefined) {
                cleanBody.wholesalePrice = toNumberOrUndefined(body.wholesalePrice);
            }
            if (body.purchasePrice !== undefined) {
                cleanBody.purchasePrice = toNumberOrUndefined(body.purchasePrice);
            }
            if (body.pricePerKg !== undefined) {
                cleanBody.pricePerKg = toNumberOrUndefined(body.pricePerKg);
            }
            if (body.clientPricePerKg !== undefined) {
                cleanBody.clientPricePerKg = toNumberOrUndefined(body.clientPricePerKg);
            }
            if (body.wholesalePricePerKg !== undefined) {
                cleanBody.wholesalePricePerKg = toNumberOrUndefined(body.wholesalePricePerKg);
            }
            if (body.stockLocal !== undefined) {
                cleanBody.stockLocal = toNumberOrUndefined(body.stockLocal);
            }
            if (body.stockDeposito !== undefined) {
                cleanBody.stockDeposito = toNumberOrUndefined(body.stockDeposito);
            }
            if (body.minStock !== undefined) {
                cleanBody.minStock = toNumberOrUndefined(body.minStock);
            }
            if (body.stockLocalKg !== undefined) {
                cleanBody.stockLocalKg = toNumberOrUndefined(body.stockLocalKg);
            }
            if (body.stockDepositoKg !== undefined) {
                cleanBody.stockDepositoKg = toNumberOrUndefined(body.stockDepositoKg);
            }
            if (body.minStockKg !== undefined) {
                cleanBody.minStockKg = toNumberOrUndefined(body.minStockKg);
            }
            const updated = await product_service_1.productService.update((0, params_1.getParamAsString)(req.params.id, "id"), cleanBody);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await product_service_1.productService.delete((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({ message: "Producto eliminado" });
        }
        catch (err) {
            next(err);
        }
    },
    async transferStock(req, res, next) {
        try {
            const { productId, from, quantity } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            const updated = await product_service_1.productService.transferStock(productId, from, Number(quantity), userId);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async addStock(req, res, next) {
        try {
            const { productId, to, quantity } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            const updated = await product_service_1.productService.addStock(productId, to, Number(quantity), userId);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async transferStockKg(req, res, next) {
        try {
            const { id } = req.params;
            const { from, quantityKg } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            const updated = await product_service_1.productService.transferStockKg((0, params_1.getParamAsString)(id, "id"), from, Number(quantityKg), userId);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async addStockKg(req, res, next) {
        try {
            const { id } = req.params;
            const { to, quantityKg } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            const updated = await product_service_1.productService.addStockKg((0, params_1.getParamAsString)(id, "id"), to, Number(quantityKg), userId);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async updateComponents(req, res, next) {
        try {
            const { id } = req.params;
            const components = Array.isArray(req.body.components)
                ? req.body.components
                : parseJsonArray(req.body.components);
            if (!Array.isArray(components)) {
                return res.status(400).json({
                    message: "Se requiere un array 'components'",
                });
            }
            const result = await product_service_1.productService.updateComponents((0, params_1.getParamAsString)(id, "id"), components);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    },
    async getBySku(req, res) {
        try {
            const { sku } = req.params;
            if (!sku) {
                return res.status(400).json({ message: "SKU requerido" });
            }
            const product = await product_service_1.productService.getBySku((0, params_1.getParamAsString)(sku, "sku"));
            if (!product) {
                return res.status(404).json({ message: "Producto no encontrado" });
            }
            return res.status(200).json(product);
        }
        catch (error) {
            console.error("Error getBySku:", error);
            return res.status(500).json({
                message: "Error interno del servidor",
            });
        }
    },
    async getMovements(req, res, next) {
        try {
            const movements = await product_service_1.productService.getMovements({
                productId: req.query.productId,
                userId: req.query.userId,
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
    updateImage: [
        upload.single("image"),
        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        message: "Debe enviar una imagen.",
                    });
                }
                const updatedProduct = await product_service_1.productService.updateImage((0, params_1.getParamAsString)(req.params.id, "id"), req.file);
                res.json({
                    message: "Imagen actualizada correctamente",
                    content: updatedProduct,
                });
            }
            catch (err) {
                next(err);
            }
        },
    ],
};
//# sourceMappingURL=product.controller.js.map