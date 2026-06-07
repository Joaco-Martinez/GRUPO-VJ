"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const sale_service_1 = require("./sale.service");
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
function cleanLimit(limit) {
    if (!limit || !Number.isFinite(limit))
        return 60;
    return Math.min(Math.max(Math.trunc(limit), 1), 120);
}
function cleanPage(page) {
    if (!page || !Number.isFinite(page))
        return 1;
    return Math.max(Math.trunc(page), 1);
}
function normalizeSearch(search) {
    const value = String(search || "").trim();
    return value.length ? value : undefined;
}
function getProductStock(product) {
    if (product.type === client_1.ProductType.COMPUESTO) {
        if (!Array.isArray(product.components) || product.components.length === 0) {
            return {
                availableQuantity: 0,
                availableKg: 0,
                stockLabel: "Sin componentes configurados",
                canSell: false,
            };
        }
        const maxByComponents = product.components.map((component) => {
            const componentProduct = component.component;
            const unitQty = Number(component.quantity || 0);
            const kgQty = Number(component.quantityKg || 0);
            if (unitQty > 0) {
                return Math.floor(Number(componentProduct?.stockLocal || 0) / unitQty);
            }
            if (kgQty > 0) {
                return Math.floor(Number(componentProduct?.stockLocalKg || 0) / kgQty);
            }
            return 0;
        });
        const available = Math.max(0, Math.min(...maxByComponents));
        return {
            availableQuantity: available,
            availableKg: 0,
            stockLabel: `${available} disponibles`,
            canSell: available > 0,
        };
    }
    if (product.saleUnit === client_1.SaleUnit.KG) {
        const availableKg = Number(product.stockLocalKg || 0);
        return {
            availableQuantity: 0,
            availableKg,
            stockLabel: `${round2(availableKg)} kg disponibles`,
            canSell: availableKg > 0,
        };
    }
    const availableQuantity = Number(product.stockLocal || 0);
    return {
        availableQuantity,
        availableKg: 0,
        stockLabel: `${availableQuantity} disponibles`,
        canSell: availableQuantity > 0,
    };
}
function resolvePrice(product, category) {
    const isKg = product.saleUnit === client_1.SaleUnit.KG;
    const publicPrice = Number(isKg ? product.pricePerKg : product.price);
    const clientPriceRaw = isKg ? product.clientPricePerKg : product.clientPrice;
    const wholesalePriceRaw = isKg ? product.wholesalePricePerKg : product.wholesalePrice;
    const clientPrice = Number(clientPriceRaw ?? publicPrice);
    const wholesalePrice = Number(wholesalePriceRaw ?? publicPrice);
    let price = publicPrice;
    let priceList = "PUBLIC";
    if (category === client_1.CategoryClient.Cliente) {
        price = Number.isFinite(clientPrice) ? clientPrice : publicPrice;
        priceList = "CLIENT";
    }
    if (category === client_1.CategoryClient.Mayorista) {
        price = Number.isFinite(wholesalePrice) ? wholesalePrice : publicPrice;
        priceList = "WHOLESALE";
    }
    return {
        price: round2(Number.isFinite(price) ? price : 0),
        priceList,
        publicPrice: round2(Number.isFinite(publicPrice) ? publicPrice : 0),
        clientPrice: round2(Number.isFinite(clientPrice) ? clientPrice : publicPrice),
        wholesalePrice: round2(Number.isFinite(wholesalePrice) ? wholesalePrice : publicPrice),
        currency: "ARS",
    };
}
function mapProduct(product, customer) {
    const stock = getProductStock(product);
    const pricing = resolvePrice(product, customer.category);
    return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        type: product.type,
        saleUnit: product.saleUnit,
        imageUrl: product.imageUrl,
        category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
                slug: product.category.slug,
            }
            : null,
        price: pricing.price,
        priceList: pricing.priceList,
        publicPrice: pricing.publicPrice,
        clientPrice: pricing.clientPrice,
        wholesalePrice: pricing.wholesalePrice,
        currency: pricing.currency,
        availableQuantity: stock.availableQuantity,
        availableKg: stock.availableKg,
        stockLabel: stock.stockLabel,
        canSell: stock.canSell,
        components: product.type === client_1.ProductType.COMPUESTO
            ? product.components.map((component) => ({
                id: component.id,
                productId: component.componentId,
                name: component.component?.name ?? "Componente",
                quantity: component.quantity,
                quantityKg: component.quantityKg,
                saleUnit: component.component?.saleUnit,
            }))
            : [],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}
function normalizeWhatsappNumber(value) {
    return String(value || "").replace(/\D/g, "");
}
function buildWhatsappUrl(message) {
    const phone = normalizeWhatsappNumber(process.env.STORE_WHATSAPP_NUMBER ||
        process.env.WHATSAPP_PHONE ||
        process.env.BUSINESS_WHATSAPP_NUMBER ||
        process.env.BUSINESS_WHATSAPP);
    if (!phone) {
        return null;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
function formatMoney(value) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(value);
}
function buildWhatsappMessage(params) {
    const { sale, customer, customerNotes } = params;
    const lines = sale.items.map((item) => {
        const productName = item.product?.name || item.productNameSnapshot || "Producto";
        const saleUnit = item.product?.saleUnit || "UNIT";
        const qty = saleUnit === client_1.SaleUnit.KG ? `${round2(Number(item.quantityKg || 0))} kg` : `x${item.quantity}`;
        return `- ${productName} ${qty} — ${formatMoney(Number(item.subtotal || 0))}`;
    });
    const customerLines = [
        customer.customerName ? `Mi nombre: ${customer.customerName}` : null,
        customer.dni ? `DNI/CUIT: ${customer.dni}` : null,
        customer.phone ? `Teléfono: ${customer.phone}` : null,
        customer.email ? `Email: ${customer.email}` : null,
    ].filter(Boolean);
    return [
        "Hola! Quiero hacer este pedido:",
        "",
        `Pedido #${sale.id}`,
        ...lines,
        "",
        `Total: ${formatMoney(Number(sale.total || 0))}`,
        "",
        ...customerLines,
        customerNotes ? "" : null,
        customerNotes ? `Notas: ${customerNotes}` : null,
    ]
        .filter((line) => line !== null && line !== undefined)
        .join("\n");
}
exports.catalogService = {
    async getCustomerContext(userId) {
        if (!userId) {
            return {
                category: client_1.CategoryClient.Price,
            };
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                client: true,
            },
        });
        if (!user || user.isActive === false) {
            return {
                category: client_1.CategoryClient.Price,
            };
        }
        if (user.role !== client_1.Role.CLIENTE || !user.client) {
            return {
                userId: user.id,
                category: client_1.CategoryClient.Price,
                customerName: user.name,
                email: user.email,
            };
        }
        return {
            userId: user.id,
            clientId: user.client.id,
            category: user.client.category,
            customerName: [user.client.nombre, user.client.apellido].filter(Boolean).join(" ").trim() || user.name,
            dni: user.client.dni,
            phone: user.client.telefono,
            email: user.client.gmail || user.email,
        };
    },
    async getCategories() {
        const categories = await prisma_1.default.productCategory.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                name: "asc",
            },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                isActive: true,
                            },
                        },
                    },
                },
            },
        });
        return categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            productsCount: category._count.products,
        }));
    },
    async getProducts(filters) {
        const customer = await this.getCustomerContext(filters.userId);
        const limit = cleanLimit(filters.limit);
        const page = cleanPage(filters.page);
        const search = normalizeSearch(filters.search);
        const where = {
            isActive: true,
        };
        if (filters.categorySlug) {
            where.category = {
                slug: filters.categorySlug,
                isActive: true,
            };
        }
        if (search) {
            where.OR = [
                {
                    name: {
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
                {
                    sku: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }
        const [total, products] = await Promise.all([
            prisma_1.default.product.count({ where }),
            prisma_1.default.product.findMany({
                where,
                orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: true,
                    components: {
                        include: {
                            component: true,
                        },
                    },
                },
            }),
        ]);
        return {
            customer: {
                category: customer.category,
                isLoggedIn: !!customer.userId,
                clientId: customer.clientId ?? null,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            products: products.map((product) => mapProduct(product, customer)),
        };
    },
    async checkoutWhatsapp(data) {
        if (!data.userId) {
            throw new Error("Para finalizar el pedido tenés que iniciar sesión");
        }
        const customer = await this.getCustomerContext(data.userId);
        if (!customer.clientId) {
            throw new Error("Solo los usuarios cliente pueden finalizar pedidos desde la tienda");
        }
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error("El carrito está vacío");
        }
        const normalizedItems = data.items.map((item) => ({
            productId: String(item.productId || ""),
            quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
            quantityKg: item.quantityKg !== undefined ? Number(item.quantityKg) : undefined,
        }));
        for (const item of normalizedItems) {
            if (!item.productId) {
                throw new Error("Hay un producto inválido en el carrito");
            }
        }
        const saleResult = await sale_service_1.saleService.create({
            userId: data.userId,
            clientId: customer.clientId,
            paymentMethod: data.paymentMethod || client_1.PaymentMethod.TRANSFERENCIA,
            receiptType: client_1.ReceiptType.TICKET,
            status: client_1.SaleStatus.PENDING,
            items: normalizedItems,
        });
        const sale = saleResult.sale;
        const whatsappMessage = buildWhatsappMessage({
            sale,
            customer,
            customerNotes: data.customerNotes,
        });
        const whatsappUrl = buildWhatsappUrl(whatsappMessage);
        return {
            saleId: sale.id,
            status: sale.status,
            total: sale.total,
            whatsappMessage,
            whatsappUrl,
            missingWhatsappConfig: !whatsappUrl,
            sale,
        };
    },
};
//# sourceMappingURL=catalog.service.js.map