"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const simpleCache_1 = require("../utils/simpleCache");
const CATEGORIES_LIST_CACHE_TTL_MS = 30000;
const CATEGORIES_LIST_CACHE_PREFIX = "categories:list:";
function invalidateCategoriesCache() {
    (0, simpleCache_1.invalidateCache)("catalog:categories");
    (0, simpleCache_1.invalidateCache)(CATEGORIES_LIST_CACHE_PREFIX);
}
function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
async function generateUniqueSlug(name, currentId) {
    const baseSlug = slugify(name);
    if (!baseSlug) {
        throw new Error("No se pudo generar un slug válido para la categoría");
    }
    let slug = baseSlug;
    let counter = 2;
    while (true) {
        const existing = await prisma_1.default.productCategory.findUnique({
            where: { slug },
            select: { id: true },
        });
        if (!existing || existing.id === currentId) {
            return slug;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
}
exports.categoryService = {
    async getAll(options) {
        const cacheKey = `${CATEGORIES_LIST_CACHE_PREFIX}${options?.includeInactive ? "all" : "active"}`;
        return (0, simpleCache_1.cached)(cacheKey, CATEGORIES_LIST_CACHE_TTL_MS, () => prisma_1.default.productCategory.findMany({
            where: options?.includeInactive ? {} : { isActive: true },
            include: {
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        }));
    },
    async getById(id) {
        return prisma_1.default.productCategory.findUnique({
            where: { id },
            include: {
                products: {
                    where: {
                        isActive: true,
                    },
                    orderBy: {
                        name: "asc",
                    },
                },
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
    },
    async getBySlug(slug) {
        return prisma_1.default.productCategory.findUnique({
            where: { slug },
            include: {
                products: {
                    where: {
                        isActive: true,
                    },
                    orderBy: {
                        name: "asc",
                    },
                },
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
    },
    async create(data) {
        if (!data.name || !data.name.trim()) {
            return {
                statusCode: 400,
                message: "El nombre de la categoría es requerido",
            };
        }
        const name = data.name.trim();
        const slug = await generateUniqueSlug(name);
        try {
            const created = await prisma_1.default.productCategory.create({
                data: {
                    name,
                    slug,
                    description: data.description?.trim() || null,
                    isActive: data.isActive ?? true,
                },
                include: {
                    _count: {
                        select: {
                            products: true,
                        },
                    },
                },
            });
            invalidateCategoriesCache();
            return created;
        }
        catch (err) {
            if (err?.code === "P2002") {
                return {
                    statusCode: 409,
                    message: "Ya existe una categoría con ese nombre o slug",
                };
            }
            throw err;
        }
    },
    async update(id, data) {
        const existing = await prisma_1.default.productCategory.findUnique({
            where: { id },
        });
        if (!existing) {
            return {
                statusCode: 404,
                message: "Categoría no encontrada",
            };
        }
        const prismaData = {};
        if (data.name !== undefined) {
            if (!data.name.trim()) {
                return {
                    statusCode: 400,
                    message: "El nombre de la categoría no puede estar vacío",
                };
            }
            prismaData.name = data.name.trim();
            prismaData.slug = await generateUniqueSlug(data.name.trim(), id);
        }
        if (data.description !== undefined) {
            prismaData.description = data.description?.trim() || null;
        }
        if (data.isActive !== undefined) {
            prismaData.isActive = data.isActive;
        }
        try {
            const updated = await prisma_1.default.productCategory.update({
                where: { id },
                data: prismaData,
                include: {
                    _count: {
                        select: {
                            products: true,
                        },
                    },
                },
            });
            invalidateCategoriesCache();
            return updated;
        }
        catch (err) {
            if (err?.code === "P2002") {
                return {
                    statusCode: 409,
                    message: "Ya existe una categoría con ese nombre o slug",
                };
            }
            throw err;
        }
    },
    async delete(id) {
        const existing = await prisma_1.default.productCategory.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
        if (!existing) {
            return {
                statusCode: 404,
                message: "Categoría no encontrada",
            };
        }
        invalidateCategoriesCache();
        if (existing._count.products > 0) {
            return prisma_1.default.productCategory.update({
                where: { id },
                data: {
                    isActive: false,
                },
                include: {
                    _count: {
                        select: {
                            products: true,
                        },
                    },
                },
            });
        }
        return prisma_1.default.productCategory.delete({
            where: { id },
        });
    },
    async restore(id) {
        const existing = await prisma_1.default.productCategory.findUnique({
            where: { id },
        });
        if (!existing) {
            return {
                statusCode: 404,
                message: "Categoría no encontrada",
            };
        }
        const restored = await prisma_1.default.productCategory.update({
            where: { id },
            data: {
                isActive: true,
            },
            include: {
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
        invalidateCategoriesCache();
        return restored;
    },
};
//# sourceMappingURL=category.service.js.map