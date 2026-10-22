"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const fs_1 = __importDefault(require("fs"));
const alert_service_1 = __importDefault(require("./alert.service"));
const simpleCache_1 = require("../utils/simpleCache");
const PRODUCTS_LIST_CACHE_TTL_MS = 10000;
const PRODUCTS_LIST_CACHE_PREFIX = "products:list:";
function normalizeSku(raw) {
    return raw.trim().replace(/['"]/g, "").replace(/\s+/g, "");
}
function toNumberOrNull(v) {
    if (v === undefined || v === null || v === "")
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function toNumberOrZero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function isValidPositiveNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
}
function isTrue(value) {
    return value === true || value === "true";
}
function safeDeleteLocalFile(path) {
    if (path && fs_1.default.existsSync(path)) {
        fs_1.default.unlinkSync(path);
    }
}
const STOCK_MOVEMENT_VISUAL_META = {
    INGRESS: {
        group: "INGRESS",
        label: "Ingreso de stock",
        color: "green",
        hex: "#16a34a",
        description: "Stock que entra al sistema o vuelve por una cancelación",
    },
    EGRESS: {
        group: "EGRESS",
        label: "Salida de stock",
        color: "red",
        hex: "#dc2626",
        description: "Stock que sale por venta o ajuste negativo",
    },
    TRANSFER: {
        group: "TRANSFER",
        label: "Movimiento entre depósitos",
        color: "blue",
        hex: "#2563eb",
        description: "Stock movido entre Mayorista y Minorista",
    },
};
const stockMovementInclude = {
    product: {
        include: {
            category: true,
        },
    },
    user: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
};
function cleanString(value) {
    const v = String(value ?? "").trim();
    return v.length ? v : undefined;
}
function normalizePositiveInteger(value, fallback, max = 100) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return Math.min(Math.floor(n), max);
}
function getStockMovementVisualMeta(movement) {
    if (movement.type === client_1.MovementType.TRANSFER) {
        return STOCK_MOVEMENT_VISUAL_META.TRANSFER;
    }
    if (movement.type === client_1.MovementType.INGRESS ||
        movement.type === client_1.MovementType.SALE_CANCEL) {
        return STOCK_MOVEMENT_VISUAL_META.INGRESS;
    }
    if (movement.type === client_1.MovementType.SALE) {
        return STOCK_MOVEMENT_VISUAL_META.EGRESS;
    }
    // Fallback para ADJUSTMENT u otros movimientos viejos:
    // si tiene origen y no destino, salió; si tiene destino y no origen, entró.
    if (movement.from && !movement.to)
        return STOCK_MOVEMENT_VISUAL_META.EGRESS;
    if (!movement.from && movement.to)
        return STOCK_MOVEMENT_VISUAL_META.INGRESS;
    if (movement.from && movement.to)
        return STOCK_MOVEMENT_VISUAL_META.TRANSFER;
    return STOCK_MOVEMENT_VISUAL_META.EGRESS;
}
function getMovementTypeWhere(movement) {
    if (!movement || movement === "ALL")
        return undefined;
    if (movement === "TRANSFER") {
        return {
            OR: [
                { type: client_1.MovementType.TRANSFER },
                {
                    AND: [{ from: { not: null } }, { to: { not: null } }],
                },
            ],
        };
    }
    if (movement === "INGRESS") {
        return {
            OR: [
                { type: client_1.MovementType.INGRESS },
                { type: client_1.MovementType.SALE_CANCEL },
                {
                    AND: [{ from: null }, { to: { not: null } }],
                },
            ],
        };
    }
    return {
        OR: [
            { type: client_1.MovementType.SALE },
            {
                AND: [{ from: { not: null } }, { to: null }],
            },
        ],
    };
}
function buildStockMovementWhere(filters) {
    const and = [];
    if (filters?.productId)
        and.push({ productId: filters.productId });
    if (filters?.userId)
        and.push({ userId: filters.userId });
    if (filters?.origin === "CLIENT")
        and.push({ isClientMovement: true });
    if (filters?.origin === "INTERNAL")
        and.push({ isClientMovement: false });
    const createdAt = {};
    if (filters?.fromDate)
        createdAt.gte = filters.fromDate;
    if (filters?.toDate)
        createdAt.lte = filters.toDate;
    if (Object.keys(createdAt).length > 0)
        and.push({ createdAt });
    const movementWhere = getMovementTypeWhere(filters?.movement);
    if (movementWhere)
        and.push(movementWhere);
    const search = cleanString(filters?.search);
    if (search) {
        and.push({
            OR: [
                { reason: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
                {
                    product: {
                        is: {
                            OR: [
                                { name: { contains: search, mode: "insensitive" } },
                                { sku: { contains: search, mode: "insensitive" } },
                                {
                                    category: {
                                        is: {
                                            name: { contains: search, mode: "insensitive" },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    user: {
                        is: {
                            OR: [
                                { name: { contains: search, mode: "insensitive" } },
                                { email: { contains: search, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ],
        });
    }
    return and.length ? { AND: and } : {};
}
function formatStockMovementForView(movement) {
    const meta = getStockMovementVisualMeta({
        type: movement.type,
        from: movement.from,
        to: movement.to,
    });
    const quantity = movement.quantity ?? null;
    const quantityKg = movement.quantityKg ?? null;
    return {
        ...movement,
        movementGroup: meta.group,
        movementLabel: meta.label,
        movementColor: meta.color,
        movementHex: meta.hex,
        movementDescription: meta.description,
        quantityLabel: quantityKg !== null && quantityKg !== undefined
            ? `${quantityKg} kg`
            : quantity !== null && quantity !== undefined
                ? String(quantity)
                : "—",
    };
}
function normalizeComponents(data) {
    if (Array.isArray(data.components))
        return data.components;
    if (Array.isArray(data.boxContents)) {
        return data.boxContents.map((item) => ({
            componentId: item.productId,
            quantity: item.quantity,
            quantityKg: item.quantityKg,
        }));
    }
    return [];
}
async function validateCategory(categoryId) {
    if (!categoryId)
        return;
    const category = await prisma_1.default.productCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, isActive: true },
    });
    if (!category) {
        throw new Error("La categoría seleccionada no existe");
    }
    if (!category.isActive) {
        throw new Error("La categoría seleccionada está inactiva");
    }
}
async function validateComponents(compositeId, components) {
    const normalized = components.map((c) => {
        const componentId = c.componentId ?? c.productId;
        return {
            componentId,
            quantity: toNumberOrNull(c.quantity),
            quantityKg: toNumberOrNull(c.quantityKg),
        };
    });
    const seen = new Set();
    for (const c of normalized) {
        if (!c.componentId) {
            throw new Error("Cada componente debe tener componentId");
        }
        if (compositeId && c.componentId === compositeId) {
            throw new Error("Un producto no puede ser componente de sí mismo");
        }
        if (seen.has(c.componentId)) {
            throw new Error("No podés repetir el mismo componente dentro de una promo");
        }
        seen.add(c.componentId);
        const hasUnitQty = c.quantity !== null && c.quantity > 0;
        const hasKgQty = c.quantityKg !== null && c.quantityKg > 0;
        if (!hasUnitQty && !hasKgQty) {
            throw new Error("Cada componente debe tener quantity o quantityKg mayor a 0");
        }
        const componentProduct = await prisma_1.default.product.findUnique({
            where: { id: c.componentId },
            select: {
                id: true,
                name: true,
                type: true,
                saleUnit: true,
                isActive: true,
            },
        });
        if (!componentProduct) {
            throw new Error(`Componente ${c.componentId} no encontrado`);
        }
        if (!componentProduct.isActive) {
            throw new Error(`El componente "${componentProduct.name}" está inactivo`);
        }
        if (componentProduct.type === client_1.ProductType.COMPUESTO) {
            throw new Error(`El componente "${componentProduct.name}" es COMPUESTO. Por ahora no se permiten promos dentro de promos`);
        }
        if (componentProduct.saleUnit === client_1.SaleUnit.UNIT && hasKgQty) {
            throw new Error(`El componente "${componentProduct.name}" se vende por unidad, no por KG`);
        }
        if (componentProduct.saleUnit === client_1.SaleUnit.KG && hasUnitQty) {
            throw new Error(`El componente "${componentProduct.name}" se vende por KG, no por unidad`);
        }
    }
    return normalized;
}
function validatePricesBySaleUnit(data) {
    if (isTrue(data.isService)) {
        return;
    }
    const saleUnit = data.saleUnit ?? client_1.SaleUnit.UNIT;
    const type = data.type ?? client_1.ProductType.SIMPLE;
    if (saleUnit === client_1.SaleUnit.KG) {
        const pricePerKg = toNumberOrNull(data.pricePerKg);
        const clientPricePerKg = toNumberOrNull(data.clientPricePerKg);
        const wholesalePricePerKg = toNumberOrNull(data.wholesalePricePerKg);
        if (pricePerKg === null) {
            throw new Error("Si saleUnit es KG, pricePerKg es requerido");
        }
        if (clientPricePerKg === null) {
            throw new Error("Si saleUnit es KG, clientPricePerKg es requerido");
        }
        if (wholesalePricePerKg === null) {
            throw new Error("Si saleUnit es KG, wholesalePricePerKg es requerido");
        }
        if (!isValidPositiveNumber(pricePerKg)) {
            throw new Error("Si saleUnit es KG, pricePerKg debe ser mayor a 0");
        }
        if (!isValidPositiveNumber(clientPricePerKg)) {
            throw new Error("Si saleUnit es KG, clientPricePerKg debe ser mayor a 0");
        }
        if (!isValidPositiveNumber(wholesalePricePerKg)) {
            throw new Error("Si saleUnit es KG, wholesalePricePerKg debe ser mayor a 0");
        }
    }
    if (saleUnit === client_1.SaleUnit.UNIT) {
        const price = toNumberOrNull(data.price);
        const clientPrice = toNumberOrNull(data.clientPrice);
        const wholesalePrice = toNumberOrNull(data.wholesalePrice);
        if (price === null) {
            throw new Error("Si saleUnit es UNIT, price es requerido");
        }
        if (clientPrice === null) {
            throw new Error("Si saleUnit es UNIT, clientPrice es requerido");
        }
        if (wholesalePrice === null) {
            throw new Error("Si saleUnit es UNIT, wholesalePrice es requerido");
        }
        if (!isValidPositiveNumber(price)) {
            throw new Error("Si saleUnit es UNIT, price debe ser mayor a 0");
        }
        if (!isValidPositiveNumber(clientPrice)) {
            throw new Error("Si saleUnit es UNIT, clientPrice debe ser mayor a 0");
        }
        if (!isValidPositiveNumber(wholesalePrice)) {
            throw new Error("Si saleUnit es UNIT, wholesalePrice debe ser mayor a 0");
        }
    }
    if (type === client_1.ProductType.COMPUESTO && saleUnit === client_1.SaleUnit.KG) {
        throw new Error("Por ahora los productos COMPUESTOS deben venderse por UNIT");
    }
}
const productInclude = {
    category: true,
    components: {
        include: {
            component: {
                include: {
                    category: true,
                },
            },
        },
    },
};
async function fetchProducts(options) {
    const page = Number(options?.page);
    const limit = Number(options?.limit);
    const hasPagination = Number.isFinite(page) && Number.isFinite(limit) && page > 0 && limit > 0;
    const search = options?.search?.trim();
    const categoryId = options?.categoryId?.trim();
    const sort = options?.sort ?? "default";
    const where = {
        isActive: true,
    };
    if (search) {
        where.OR = [
            {
                name: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                sku: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                description: {
                    contains: search,
                    mode: "insensitive",
                },
            },
        ];
    }
    if (categoryId) {
        where.categoryId = categoryId;
    }
    let orderBy = {
        createdAt: "desc",
    };
    if (sort === "name-asc") {
        orderBy = {
            name: "asc",
        };
    }
    if (sort === "name-desc") {
        orderBy = {
            name: "desc",
        };
    }
    if (sort === "category-asc") {
        orderBy = [
            {
                category: {
                    name: "asc",
                },
            },
            {
                name: "asc",
            },
        ];
    }
    if (sort === "category-desc") {
        orderBy = [
            {
                category: {
                    name: "desc",
                },
            },
            {
                name: "asc",
            },
        ];
    }
    if (!hasPagination) {
        return prisma_1.default.product.findMany({
            where,
            include: productInclude,
            orderBy,
        });
    }
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
        prisma_1.default.product.findMany({
            where,
            include: productInclude,
            orderBy,
            skip,
            take: safeLimit,
        }),
        prisma_1.default.product.count({
            where,
        }),
    ]);
    return {
        data,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
}
exports.productService = {
    async getAll(options) {
        const cacheKey = `${PRODUCTS_LIST_CACHE_PREFIX}${JSON.stringify(options ?? {})}`;
        return (0, simpleCache_1.cached)(cacheKey, PRODUCTS_LIST_CACHE_TTL_MS, () => fetchProducts(options));
    },
    async getBySku(rawSku) {
        const sku = normalizeSku(rawSku);
        return prisma_1.default.product.findUnique({
            where: { sku },
            include: productInclude,
        });
    },
    async getById(id) {
        return prisma_1.default.product.findUnique({
            where: { id },
            include: productInclude,
        });
    },
    async create(data) {
        if (!data.name || !data.name.trim()) {
            return {
                statusCode: 400,
                message: "El nombre del producto es requerido",
            };
        }
        if (!data.sku || !data.sku.trim()) {
            return { statusCode: 400, message: "El SKU es requerido" };
        }
        const sku = normalizeSku(data.sku);
        if (!sku) {
            return { statusCode: 400, message: "El SKU no puede quedar vacío" };
        }
        const type = data.type ?? client_1.ProductType.SIMPLE;
        const saleUnit = data.saleUnit ?? client_1.SaleUnit.UNIT;
        let imageUrl;
        let imageId;
        try {
            const existingBySku = await prisma_1.default.product.findUnique({
                where: { sku },
                select: { id: true, sku: true, isActive: true },
            });
            if (existingBySku) {
                if (existingBySku.isActive) {
                    safeDeleteLocalFile(data.file?.path);
                    return {
                        statusCode: 409,
                        message: "Ya existe un producto con ese SKU",
                    };
                }
                // El producto inactivo (eliminado) sigue ocupando el SKU por la
                // constraint unique de la DB. Se lo renombra para liberar el SKU
                // original y poder crear el producto nuevo.
                await prisma_1.default.product.update({
                    where: { id: existingBySku.id },
                    data: {
                        sku: `${existingBySku.sku}-DEL-${existingBySku.id.slice(0, 8)}`,
                    },
                });
            }
            await validateCategory(data.categoryId);
            validatePricesBySaleUnit({
                ...data,
                type,
                saleUnit,
            });
            const rawComponents = normalizeComponents(data);
            if (type === client_1.ProductType.COMPUESTO && rawComponents.length === 0) {
                safeDeleteLocalFile(data.file?.path);
                return {
                    statusCode: 400,
                    message: "Un producto COMPUESTO debe tener al menos un componente",
                };
            }
            if (type === client_1.ProductType.SIMPLE && rawComponents.length > 0) {
                safeDeleteLocalFile(data.file?.path);
                return {
                    statusCode: 400,
                    message: "Un producto SIMPLE no puede tener componentes",
                };
            }
            const components = await validateComponents(null, rawComponents);
            if (data.file) {
                const result = await cloudinary_1.default.uploader.upload(data.file.path, {
                    folder: "grupo-vj/products",
                    resource_type: "image",
                });
                imageUrl = result.secure_url;
                imageId = result.public_id;
                safeDeleteLocalFile(data.file.path);
            }
            const base = {
                name: data.name.trim(),
                description: data.description?.trim() || null,
                type,
                categoryId: data.categoryId || null,
                saleUnit,
                sku,
                isService: isTrue(data.isService),
                isVisibleToPublic: data.isVisibleToPublic === undefined
                    ? true
                    : isTrue(data.isVisibleToPublic),
                minStock: toNumberOrNull(data.minStock),
                minStockDeposito: toNumberOrNull(data.minStockDeposito),
                minStockKg: toNumberOrNull(data.minStockKg),
                minStockDepositoKg: toNumberOrNull(data.minStockDepositoKg),
                purchasePrice: toNumberOrZero(data.purchasePrice),
                imageUrl,
                imageId,
            };
            const unitData = saleUnit === client_1.SaleUnit.UNIT
                ? {
                    price: toNumberOrZero(data.price),
                    clientPrice: toNumberOrZero(data.clientPrice),
                    wholesalePrice: toNumberOrZero(data.wholesalePrice),
                    stockLocal: toNumberOrZero(data.stockLocal),
                    stockDeposito: toNumberOrZero(data.stockDeposito),
                    pricePerKg: null,
                    clientPricePerKg: null,
                    wholesalePricePerKg: null,
                    stockLocalKg: 0,
                    stockDepositoKg: 0,
                }
                : {
                    pricePerKg: toNumberOrZero(data.pricePerKg),
                    clientPricePerKg: toNumberOrZero(data.clientPricePerKg),
                    wholesalePricePerKg: toNumberOrZero(data.wholesalePricePerKg),
                    stockLocalKg: toNumberOrZero(data.stockLocalKg),
                    stockDepositoKg: toNumberOrZero(data.stockDepositoKg),
                    price: 0,
                    clientPrice: 0,
                    wholesalePrice: 0,
                    stockLocal: 0,
                    stockDeposito: 0,
                };
            const created = await prisma_1.default.product.create({
                data: {
                    ...base,
                    ...unitData,
                    ...(type === client_1.ProductType.COMPUESTO
                        ? {
                            components: {
                                create: components.map((component) => ({
                                    componentId: component.componentId,
                                    quantity: component.quantity,
                                    quantityKg: component.quantityKg,
                                })),
                            },
                        }
                        : {}),
                },
                include: productInclude,
            });
            await alert_service_1.default.checkProductStock(created.id);
            (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
            return created;
        }
        catch (err) {
            safeDeleteLocalFile(data.file?.path);
            if (imageId) {
                await cloudinary_1.default.uploader.destroy(imageId).catch(() => undefined);
            }
            if (err?.code === "P2002" && err?.meta?.target?.includes("sku")) {
                return {
                    statusCode: 409,
                    message: "Ya existe un producto con ese SKU",
                };
            }
            return {
                statusCode: 400,
                message: err?.message ?? "Error al crear producto",
            };
        }
    },
    async updateImage(productId, file) {
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            safeDeleteLocalFile(file?.path);
            throw new Error("Producto no encontrado");
        }
        let newImageId;
        try {
            const result = await cloudinary_1.default.uploader.upload(file.path, {
                folder: "grupo-vj/products",
                resource_type: "image",
            });
            newImageId = result.public_id;
            safeDeleteLocalFile(file.path);
            if (product.imageId) {
                await cloudinary_1.default.uploader
                    .destroy(product.imageId)
                    .catch(() => undefined);
            }
            return prisma_1.default.product.update({
                where: { id: productId },
                data: {
                    imageUrl: result.secure_url,
                    imageId: result.public_id,
                },
                include: productInclude,
            });
        }
        catch (err) {
            safeDeleteLocalFile(file?.path);
            if (newImageId) {
                await cloudinary_1.default.uploader.destroy(newImageId).catch(() => undefined);
            }
            throw err;
        }
    },
    async update(id, data) {
        const existing = await prisma_1.default.product.findUnique({
            where: { id },
            include: {
                components: true,
            },
        });
        if (!existing) {
            throw new Error("Producto no encontrado");
        }
        if (data.sku !== undefined) {
            const normalized = normalizeSku(String(data.sku));
            if (!normalized)
                throw new Error("El SKU no puede quedar vacío");
            data.sku = normalized;
        }
        if (data.categoryId !== undefined &&
            data.categoryId !== null &&
            data.categoryId !== "") {
            await validateCategory(data.categoryId);
        }
        const nextType = data.type ?? existing.type;
        const nextSaleUnit = data.saleUnit ?? existing.saleUnit;
        if (nextType === client_1.ProductType.COMPUESTO && nextSaleUnit === client_1.SaleUnit.KG) {
            throw new Error("Por ahora los productos COMPUESTOS deben venderse por UNIT");
        }
        const prismaData = {};
        const setIfDefined = (key, value) => {
            if (value !== undefined)
                prismaData[key] = value;
        };
        setIfDefined("name", data.name !== undefined ? String(data.name).trim() : undefined);
        setIfDefined("description", data.description !== undefined
            ? String(data.description).trim() || null
            : undefined);
        setIfDefined("type", data.type);
        setIfDefined("categoryId", data.categoryId === "" ? null : data.categoryId);
        setIfDefined("sku", data.sku);
        setIfDefined("imageUrl", data.imageUrl);
        setIfDefined("imageId", data.imageId);
        setIfDefined("isActive", data.isActive);
        setIfDefined("isService", data.isService !== undefined ? isTrue(data.isService) : undefined);
        setIfDefined("isVisibleToPublic", data.isVisibleToPublic !== undefined
            ? isTrue(data.isVisibleToPublic)
            : undefined);
        setIfDefined("saleUnit", data.saleUnit);
        setIfDefined("price", data.price !== undefined ? Number(data.price) : undefined);
        setIfDefined("clientPrice", data.clientPrice !== undefined ? Number(data.clientPrice) : undefined);
        setIfDefined("wholesalePrice", data.wholesalePrice !== undefined
            ? Number(data.wholesalePrice)
            : undefined);
        setIfDefined("purchasePrice", data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined);
        setIfDefined("stockLocal", data.stockLocal !== undefined ? Number(data.stockLocal) : undefined);
        setIfDefined("stockDeposito", data.stockDeposito !== undefined ? Number(data.stockDeposito) : undefined);
        setIfDefined("minStock", data.minStock !== undefined ? Number(data.minStock) : undefined);
        setIfDefined("minStockDeposito", data.minStockDeposito !== undefined
            ? Number(data.minStockDeposito)
            : undefined);
        setIfDefined("pricePerKg", data.pricePerKg !== undefined ? Number(data.pricePerKg) : undefined);
        setIfDefined("clientPricePerKg", data.clientPricePerKg !== undefined
            ? Number(data.clientPricePerKg)
            : undefined);
        setIfDefined("wholesalePricePerKg", data.wholesalePricePerKg !== undefined
            ? Number(data.wholesalePricePerKg)
            : undefined);
        setIfDefined("stockLocalKg", data.stockLocalKg !== undefined ? Number(data.stockLocalKg) : undefined);
        setIfDefined("stockDepositoKg", data.stockDepositoKg !== undefined
            ? Number(data.stockDepositoKg)
            : undefined);
        setIfDefined("minStockKg", data.minStockKg !== undefined ? Number(data.minStockKg) : undefined);
        setIfDefined("minStockDepositoKg", data.minStockDepositoKg !== undefined
            ? Number(data.minStockDepositoKg)
            : undefined);
        if (data.saleUnit === client_1.SaleUnit.UNIT) {
            prismaData.pricePerKg = null;
            prismaData.clientPricePerKg = null;
            prismaData.wholesalePricePerKg = null;
            prismaData.stockLocalKg = 0;
            prismaData.stockDepositoKg = 0;
        }
        if (data.saleUnit === client_1.SaleUnit.KG) {
            prismaData.price = 0;
            prismaData.clientPrice = 0;
            prismaData.wholesalePrice = 0;
            prismaData.stockLocal = 0;
            prismaData.stockDeposito = 0;
        }
        try {
            const updated = await prisma_1.default.product.update({
                where: { id },
                data: prismaData,
                include: productInclude,
            });
            await alert_service_1.default.checkProductStock(updated.id);
            (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
            return updated;
        }
        catch (err) {
            if (err?.code === "P2002" && err?.meta?.target?.includes("sku")) {
                throw new Error("Ya existe un producto con ese SKU");
            }
            throw err;
        }
    },
    async updateComponents(productId, components) {
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                type: true,
                name: true,
                saleUnit: true,
            },
        });
        if (!product)
            throw new Error("Producto no encontrado");
        if (product.type !== client_1.ProductType.COMPUESTO) {
            throw new Error(`El producto "${product.name}" no es de tipo COMPUESTO`);
        }
        const normalizedComponents = await validateComponents(productId, components);
        await prisma_1.default.$transaction([
            prisma_1.default.productComponent.deleteMany({
                where: { compositeId: productId },
            }),
            prisma_1.default.productComponent.createMany({
                data: normalizedComponents.map((component) => ({
                    compositeId: productId,
                    componentId: component.componentId,
                    quantity: component.quantity,
                    quantityKg: component.quantityKg,
                })),
            }),
        ]);
        return prisma_1.default.product.findUnique({
            where: { id: productId },
            include: productInclude,
        });
    },
    async delete(id) {
        const deleted = await prisma_1.default.product.update({
            where: { id },
            data: { isActive: false },
        });
        (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
        return deleted;
    },
    async transferStock(productId, from, quantity, userId) {
        if (!userId)
            throw new Error("Falta userId en la operación de transferencia");
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("Cantidad inválida");
        }
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product)
            throw new Error("Producto no encontrado");
        if (product.saleUnit !== client_1.SaleUnit.UNIT) {
            throw new Error("Este producto no se maneja por unidades");
        }
        if (product.type === client_1.ProductType.COMPUESTO) {
            throw new Error("No se transfiere stock directo de productos compuestos. Transferí sus componentes");
        }
        const to = from === client_1.Location.DEPOSITO ? client_1.Location.LOCAL : client_1.Location.DEPOSITO;
        if (from === client_1.Location.DEPOSITO && product.stockDeposito < qty) {
            throw new Error("Stock insuficiente en depósito");
        }
        if (from === client_1.Location.LOCAL && product.stockLocal < qty) {
            throw new Error("Stock insuficiente en local");
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const productUpdated = await tx.product.update({
                where: { id: productId },
                data: from === client_1.Location.DEPOSITO
                    ? {
                        stockDeposito: { decrement: qty },
                        stockLocal: { increment: qty },
                    }
                    : {
                        stockLocal: { decrement: qty },
                        stockDeposito: { increment: qty },
                    },
            });
            await tx.stockMovement.create({
                data: {
                    type: client_1.MovementType.TRANSFER,
                    from,
                    to,
                    quantity: qty,
                    product: { connect: { id: productId } },
                    user: { connect: { id: userId } },
                },
            });
            return productUpdated;
        });
        await alert_service_1.default.checkProductStock(updated.id);
        (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
        return updated;
    },
    async transferStockKg(productId, from, quantityKg, userId) {
        if (!userId)
            throw new Error("Falta userId en la operación de transferencia");
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product)
            throw new Error("Producto no encontrado");
        if (product.saleUnit !== client_1.SaleUnit.KG) {
            throw new Error("Este producto no es por KG");
        }
        if (product.type === client_1.ProductType.COMPUESTO) {
            throw new Error("No se transfiere stock directo de productos compuestos. Transferí sus componentes");
        }
        const qty = Number(quantityKg);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("Cantidad KG inválida");
        }
        const to = from === client_1.Location.DEPOSITO ? client_1.Location.LOCAL : client_1.Location.DEPOSITO;
        if (from === client_1.Location.DEPOSITO && (product.stockDepositoKg ?? 0) < qty) {
            throw new Error("Stock insuficiente en depósito KG");
        }
        if (from === client_1.Location.LOCAL && (product.stockLocalKg ?? 0) < qty) {
            throw new Error("Stock insuficiente en local KG");
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const productUpdated = await tx.product.update({
                where: { id: productId },
                data: from === client_1.Location.DEPOSITO
                    ? {
                        stockDepositoKg: { decrement: qty },
                        stockLocalKg: { increment: qty },
                    }
                    : {
                        stockLocalKg: { decrement: qty },
                        stockDepositoKg: { increment: qty },
                    },
            });
            await tx.stockMovement.create({
                data: {
                    type: client_1.MovementType.TRANSFER,
                    from,
                    to,
                    quantityKg: qty,
                    product: { connect: { id: productId } },
                    user: { connect: { id: userId } },
                },
            });
            return productUpdated;
        });
        await alert_service_1.default.checkProductStock(updated.id);
        (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
        return updated;
    },
    async addStockKg(productId, to, quantityKg, userId) {
        if (!userId)
            throw new Error("Falta userId en la operación de ingreso");
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product)
            throw new Error("Producto no encontrado");
        if (product.saleUnit !== client_1.SaleUnit.KG) {
            throw new Error("Este producto no es por KG");
        }
        if (product.type === client_1.ProductType.COMPUESTO) {
            throw new Error("No se agrega stock directo a productos compuestos. Agregá stock a sus componentes");
        }
        const qty = Number(quantityKg);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("Cantidad KG inválida");
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const productUpdated = await tx.product.update({
                where: { id: productId },
                data: {
                    stockLocalKg: to === client_1.Location.LOCAL ? { increment: qty } : undefined,
                    stockDepositoKg: to === client_1.Location.DEPOSITO ? { increment: qty } : undefined,
                },
            });
            await tx.stockMovement.create({
                data: {
                    productId,
                    userId,
                    type: client_1.MovementType.INGRESS,
                    from: null,
                    to,
                    quantityKg: qty,
                },
            });
            return productUpdated;
        });
        await alert_service_1.default.checkProductStock(updated.id);
        (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
        return updated;
    },
    async addStock(productId, to, quantity, userId) {
        if (!userId)
            throw new Error("Falta userId en la operación de ingreso");
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("Cantidad inválida");
        }
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product)
            throw new Error("Producto no encontrado");
        if (product.saleUnit !== client_1.SaleUnit.UNIT) {
            throw new Error("Este producto no se maneja por unidades");
        }
        if (product.type === client_1.ProductType.COMPUESTO) {
            throw new Error("No se agrega stock directo a productos compuestos. Agregá stock a sus componentes");
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const productUpdated = await tx.product.update({
                where: { id: productId },
                data: {
                    stockLocal: to === client_1.Location.LOCAL ? { increment: qty } : undefined,
                    stockDeposito: to === client_1.Location.DEPOSITO ? { increment: qty } : undefined,
                },
            });
            await tx.stockMovement.create({
                data: {
                    productId,
                    userId,
                    type: client_1.MovementType.INGRESS,
                    from: null,
                    to,
                    quantity: qty,
                },
            });
            return productUpdated;
        });
        await alert_service_1.default.checkProductStock(updated.id);
        (0, simpleCache_1.invalidateCache)(PRODUCTS_LIST_CACHE_PREFIX);
        return updated;
    },
    async getMovements(filters) {
        const where = buildStockMovementWhere(filters);
        const hasPagination = filters?.page !== undefined || filters?.limit !== undefined;
        if (!hasPagination) {
            const movements = await prisma_1.default.stockMovement.findMany({
                where,
                include: stockMovementInclude,
                orderBy: {
                    createdAt: "desc",
                },
                take: 250,
            });
            return movements.map(formatStockMovementForView);
        }
        const page = normalizePositiveInteger(filters?.page, 1, 100000);
        const limit = normalizePositiveInteger(filters?.limit, 20, 100);
        const skip = (page - 1) * limit;
        const [items, total] = await prisma_1.default.$transaction([
            prisma_1.default.stockMovement.findMany({
                where,
                include: stockMovementInclude,
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
            prisma_1.default.stockMovement.count({ where }),
        ]);
        return {
            data: items.map(formatStockMovementForView),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    },
    async searchMovements(filters) {
        return this.getMovements({
            ...filters,
            page: filters?.page ?? 1,
            limit: filters?.limit ?? 20,
        });
    },
    async getMovementsOverview(filters) {
        const limit = normalizePositiveInteger(filters?.limit, 5, 30);
        const baseFilters = {
            productId: filters?.productId,
            userId: filters?.userId,
            fromDate: filters?.fromDate,
            toDate: filters?.toDate,
            search: filters?.search,
            origin: filters?.origin,
        };
        const ingressWhere = buildStockMovementWhere({
            ...baseFilters,
            movement: "INGRESS",
        });
        const egressWhere = buildStockMovementWhere({
            ...baseFilters,
            movement: "EGRESS",
        });
        const transferWhere = buildStockMovementWhere({
            ...baseFilters,
            movement: "TRANSFER",
        });
        const [ingressItems, egressItems, transferItems, ingressTotal, egressTotal, transferTotal,] = await prisma_1.default.$transaction([
            prisma_1.default.stockMovement.findMany({
                where: ingressWhere,
                include: stockMovementInclude,
                orderBy: { createdAt: "desc" },
                take: limit,
            }),
            prisma_1.default.stockMovement.findMany({
                where: egressWhere,
                include: stockMovementInclude,
                orderBy: { createdAt: "desc" },
                take: limit,
            }),
            prisma_1.default.stockMovement.findMany({
                where: transferWhere,
                include: stockMovementInclude,
                orderBy: { createdAt: "desc" },
                take: limit,
            }),
            prisma_1.default.stockMovement.count({ where: ingressWhere }),
            prisma_1.default.stockMovement.count({ where: egressWhere }),
            prisma_1.default.stockMovement.count({ where: transferWhere }),
        ]);
        return {
            limit,
            summary: {
                ingress: {
                    ...STOCK_MOVEMENT_VISUAL_META.INGRESS,
                    total: ingressTotal,
                },
                egress: {
                    ...STOCK_MOVEMENT_VISUAL_META.EGRESS,
                    total: egressTotal,
                },
                transfer: {
                    ...STOCK_MOVEMENT_VISUAL_META.TRANSFER,
                    total: transferTotal,
                },
            },
            ingress: {
                ...STOCK_MOVEMENT_VISUAL_META.INGRESS,
                total: ingressTotal,
                items: ingressItems.map(formatStockMovementForView),
            },
            egress: {
                ...STOCK_MOVEMENT_VISUAL_META.EGRESS,
                total: egressTotal,
                items: egressItems.map(formatStockMovementForView),
            },
            transfer: {
                ...STOCK_MOVEMENT_VISUAL_META.TRANSFER,
                total: transferTotal,
                items: transferItems.map(formatStockMovementForView),
            },
        };
    },
};
//# sourceMappingURL=product.service.js.map