import prisma from "../prisma";
import {
  CategoryClient,
  DeliveryStatus,
  PaymentMethod,
  ProductType,
  ReceiptType,
  Role,
  SaleItemPriceType,
  SaleStatus,
  SaleUnit,
  Location,
} from "@prisma/client";
import { isDeliverySku, saleService } from "./sale.service";
import { whatsappService } from "./whatsapp.service";
import { cached } from "../utils/simpleCache";

type CatalogFilters = {
  userId?: string;
  categorySlug?: string;
  search?: string;
  limit?: number;
  page?: number;
};

type CheckoutItemInput = {
  productId: string;
  quantity?: number;
  quantityKg?: number;
};

type CheckoutInput = {
  userId: string;
  items: CheckoutItemInput[];
  paymentMethod?: PaymentMethod;
  customerNotes?: string;
};

type UpdateOrderInput = {
  userId: string;
  saleId: string;
  items: CheckoutItemInput[];
};

type CustomerContext = {
  userId?: string;
  clientId?: string;
  category: CategoryClient;
  customerName?: string;
  dni?: string;
  phone?: string | null;
  email?: string | null;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function cleanLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 60;
  return Math.min(Math.max(Math.trunc(limit), 1), 120);
}

function cleanPage(page?: number) {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function normalizeSearch(search?: string) {
  const value = String(search || "").trim();
  return value.length ? value : undefined;
}

function normalizeCategory(value?: string | null): CategoryClient {
  if (value === CategoryClient.Mayorista || value === "Mayorista") {
    return CategoryClient.Mayorista;
  }

  // Compatibilidad: Cliente/Price/Minorista se tratan como minorista.
  return CategoryClient.Price;
}

function getStockLocationByCategory(category: CategoryClient): Location {
  return category === CategoryClient.Mayorista
    ? Location.LOCAL
    : Location.DEPOSITO;
}

function getLocationLabelByCategory(category: CategoryClient) {
  return category === CategoryClient.Mayorista
    ? "local mayorista"
    : "depósito minorista";
}

function getUnitStockByLocation(product: any, location: Location) {
  return Number(
    location === Location.LOCAL
      ? product.stockLocal || 0
      : product.stockDeposito || 0,
  );
}

function getKgStockByLocation(product: any, location: Location) {
  return Number(
    location === Location.LOCAL
      ? product.stockLocalKg || 0
      : product.stockDepositoKg || 0,
  );
}

function getProductStock(product: any, category: CategoryClient) {
  const stockLocation = getStockLocationByCategory(category);
  const locationLabel = getLocationLabelByCategory(category);

  if (product.type === ProductType.COMPUESTO) {
    if (!Array.isArray(product.components) || product.components.length === 0) {
      return {
        availableQuantity: 0,
        availableKg: 0,
        stockLabel: "Sin componentes configurados",
        canSell: false,
      };
    }

    const maxByComponents = product.components.map((component: any) => {
      const componentProduct = component.component;
      const unitQty = Number(component.quantity || 0);
      const kgQty = Number(component.quantityKg || 0);

      if (!componentProduct) return 0;

      if (unitQty > 0) {
        return Math.floor(
          getUnitStockByLocation(componentProduct, stockLocation) / unitQty,
        );
      }

      if (kgQty > 0) {
        return Math.floor(
          getKgStockByLocation(componentProduct, stockLocation) / kgQty,
        );
      }

      return 0;
    });

    const available = Math.max(0, Math.min(...maxByComponents));
    const isKg = product.saleUnit === SaleUnit.KG;

    return {
      availableQuantity: isKg ? 0 : available,
      availableKg: isKg ? available : 0,
      stockLabel:
        available > 0
          ? `${isKg ? round2(available) + " kg" : available} disponibles en ${locationLabel}`
          : `Sin stock en ${locationLabel}`,
      canSell: available > 0,
    };
  }

  if (product.saleUnit === SaleUnit.KG) {
    const availableKg = getKgStockByLocation(product, stockLocation);

    return {
      availableQuantity: 0,
      availableKg,
      stockLabel:
        availableKg > 0
          ? `${round2(availableKg)} kg disponibles en ${locationLabel}`
          : `Sin stock en ${locationLabel}`,
      canSell: availableKg > 0,
    };
  }

  const availableQuantity = getUnitStockByLocation(product, stockLocation);

  return {
    availableQuantity,
    availableKg: 0,
    stockLabel:
      availableQuantity > 0
        ? `${availableQuantity} disponibles en ${locationLabel}`
        : `Sin stock en ${locationLabel}`,
    canSell: availableQuantity > 0,
  };
}

function getRequestedQuantityForProduct(product: any, item: CheckoutItemInput) {
  if (product.saleUnit === SaleUnit.KG) {
    return Number(item.quantityKg ?? item.quantity ?? 0);
  }

  return Number(item.quantity ?? item.quantityKg ?? 0);
}

function getAvailableQuantityForProduct(
  product: any,
  stock: ReturnType<typeof getProductStock>,
) {
  if (product.saleUnit === SaleUnit.KG) {
    return Number(stock.availableKg || 0);
  }

  return Number(stock.availableQuantity || 0);
}

function formatStockAmountForProduct(product: any, value: number) {
  if (product.saleUnit === SaleUnit.KG) {
    return `${round2(value)} kg`;
  }

  const units = Math.trunc(value);
  return `${units} unidad${units === 1 ? "" : "es"}`;
}

function resolvePrice(product: any, category: CategoryClient) {
  const isKg = product.saleUnit === SaleUnit.KG;

  const publicPriceRaw = isKg ? product.pricePerKg : product.price;
  const wholesalePriceRaw = isKg
    ? product.wholesalePricePerKg
    : product.wholesalePrice;

  const publicPrice = Number(publicPriceRaw);
  const safePublicPrice = Number.isFinite(publicPrice) ? publicPrice : 0;

  const wholesalePrice = Number(wholesalePriceRaw ?? safePublicPrice);
  const safeWholesalePrice = Number.isFinite(wholesalePrice)
    ? wholesalePrice
    : safePublicPrice;

  let price = safePublicPrice;
  let priceList: "PUBLIC" | "WHOLESALE" = "PUBLIC";

  if (category === CategoryClient.Mayorista) {
    price = safeWholesalePrice;
    priceList = "WHOLESALE";
  }

  return {
    price: round2(Number.isFinite(price) ? price : 0),
    priceList,
    publicPrice: round2(safePublicPrice),
    clientPrice: round2(safePublicPrice),
    wholesalePrice: round2(safeWholesalePrice),
    currency: "ARS",
  };
}

function mapProduct(product: any, customer: CustomerContext) {
  const stock = getProductStock(product, customer.category);
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
    components:
      product.type === ProductType.COMPUESTO
        ? product.components.map((component: any) => ({
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

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

const CLIENT_EDITABLE_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.NONE,
  DeliveryStatus.PENDING,
];

// Motivo por el que el cliente NO puede editar su pedido desde la tienda
// (null = se puede editar).
function getOrderEditBlockReason(sale: any): string | null {
  if (sale.status !== SaleStatus.PENDING) {
    return "Solo se pueden modificar pedidos pendientes.";
  }

  if (!sale.isWebSale) {
    return "Este pedido fue cargado por el local. Para modificarlo contactanos.";
  }

  if (sale.isInvoiced || sale.invoiceStatus === "INVOICED" || sale.invoiceAfip) {
    return "El pedido ya fue facturado. Para modificarlo contactanos.";
  }

  if (!CLIENT_EDITABLE_DELIVERY_STATUSES.includes(sale.deliveryStatus)) {
    return "El pedido ya se está preparando o enviando. Para modificarlo contactanos.";
  }

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    return "El pedido ya tiene pagos registrados. Para modificarlo contactanos.";
  }

  return null;
}

function isOrderDeliveryItem(item: any) {
  return isDeliverySku(item.productSkuSnapshot ?? item.product?.sku);
}

function getSaleItemQuantity(item: any) {
  if (item.product?.saleUnit === SaleUnit.KG) {
    return Number(item.quantityKg ?? item.quantity ?? 0);
  }

  return Number(item.quantity ?? 0);
}

// Cantidad de cada producto que ya tiene reservada este pedido. Como la
// venta pendiente ya descontó ese stock, al editar el cliente puede usarlo
// además del stock disponible.
function getReservedByProduct(sale: any, customer: CustomerContext) {
  const reserved = new Map<string, number>();

  if (sale.stockLocation !== getStockLocationByCategory(customer.category)) {
    return reserved;
  }

  for (const item of sale.items ?? []) {
    if (isOrderDeliveryItem(item)) continue;

    reserved.set(
      item.productId,
      round2((reserved.get(item.productId) ?? 0) + getSaleItemQuantity(item)),
    );
  }

  return reserved;
}

function mapProductForOrder(
  product: any,
  customer: CustomerContext,
  reservedQty: number,
) {
  const mapped = mapProduct(product, customer);

  if (reservedQty <= 0) return mapped;

  const isKg = product.saleUnit === SaleUnit.KG;
  const availableQuantity = isKg
    ? mapped.availableQuantity
    : round2(Number(mapped.availableQuantity || 0) + reservedQty);
  const availableKg = isKg
    ? round2(Number(mapped.availableKg || 0) + reservedQty)
    : mapped.availableKg;
  const available = isKg ? availableKg : availableQuantity;

  return {
    ...mapped,
    availableQuantity,
    availableKg,
    canSell: available > 0,
    stockLabel: `${isKg ? `${available} kg` : available} disponibles para este pedido`,
  };
}

const ORDER_INCLUDE = {
  payments: true,
  invoiceAfip: true,
  items: {
    include: {
      product: {
        include: {
          category: true,
          components: { include: { component: true } },
        },
      },
    },
  },
} as const;

function buildWhatsappUrl(message: string) {
  const phone = whatsappService.normalizePhone(
    process.env.STORE_WHATSAPP_NUMBER ||
      process.env.WHATSAPP_PHONE ||
      process.env.BUSINESS_WHATSAPP_NUMBER ||
      process.env.BUSINESS_WHATSAPP,
  );

  if (!phone) return null;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildWhatsappMessage(params: {
  sale: any;
  customer: CustomerContext;
  customerNotes?: string;
}) {
  const { sale, customer, customerNotes } = params;

  const lines = sale.items.map((item: any) => {
    const productName =
      item.product?.name || item.productNameSnapshot || "Producto";
    const saleUnit = item.product?.saleUnit || "UNIT";
    const qty =
      saleUnit === SaleUnit.KG
        ? `${round2(Number(item.quantityKg || 0))} kg`
        : `x${item.quantity}`;

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

const CATALOG_PRODUCTS_CACHE_TTL_MS = 10_000;
const CATALOG_CATEGORIES_CACHE_TTL_MS = 60_000;

export const catalogService = {
  async getCustomerContext(userId?: string): Promise<CustomerContext> {
    if (!userId) {
      return { category: CategoryClient.Price };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user || user.isActive === false) {
      return { category: CategoryClient.Price };
    }

    if (user.role !== Role.CLIENTE || !user.client) {
      return {
        userId: user.id,
        category: CategoryClient.Price,
        customerName: user.name,
        email: user.email,
      };
    }

    return {
      userId: user.id,
      clientId: user.client.id,
      category: normalizeCategory(user.client.category),
      customerName:
        [user.client.nombre, user.client.apellido]
          .filter(Boolean)
          .join(" ")
          .trim() || user.name,
      dni: user.client.dni ?? undefined,
      phone: user.client.telefono,
      email: user.client.gmail || user.email,
    };
  },

  async getCategories() {
    const categories = await cached(
      "catalog:categories",
      CATALOG_CATEGORIES_CACHE_TTL_MS,
      () =>
        prisma.productCategory.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                products: { where: { isActive: true, isVisibleToPublic: true } },
              },
            },
          },
        })
    );

    return categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      productsCount: category._count.products,
    }));
  },

  async getProducts(filters: CatalogFilters) {
    const customer = await this.getCustomerContext(filters.userId);
    const limit = cleanLimit(filters.limit);
    const page = cleanPage(filters.page);
    const search = normalizeSearch(filters.search);

    const where: any = { isActive: true, isVisibleToPublic: true };

    if (filters.categorySlug) {
      where.category = {
        slug: filters.categorySlug,
        isActive: true,
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    const products: any[] = await cached(
      `catalog:products:${JSON.stringify(where)}`,
      CATALOG_PRODUCTS_CACHE_TTL_MS,
      () =>
        prisma.product.findMany({
          where,
          orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
          include: {
            category: true,
            components: { include: { component: true } },
          },
        })
    );

    const mappedProducts = products
      .map((product: any) => mapProduct(product, customer))
      .sort((a, b) => {
        if (a.canSell !== b.canSell) return a.canSell ? -1 : 1;

        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "es-AR",
          {
            numeric: true,
            sensitivity: "base",
          },
        );
      });

    const total = mappedProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const paginatedProducts = mappedProducts.slice(
      (safePage - 1) * limit,
      safePage * limit,
    );

    return {
      customer: {
        category: customer.category,
        isLoggedIn: !!customer.userId,
        clientId: customer.clientId ?? null,
      },
      pagination: {
        page: safePage,
        limit,
        total,
        pages: totalPages,
        totalPages,
      },
      products: paginatedProducts,
    };
  },

  async validateCart(data: CheckoutInput) {
    if (!data.userId) {
      throw new Error("Para validar el carrito tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(data.userId);

    if (!customer.clientId) {
      throw new Error(
        "Solo los usuarios cliente pueden validar carritos desde la tienda",
      );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return {
        ok: true,
        customer: {
          category: customer.category,
          clientId: customer.clientId ?? null,
        },
        items: [],
      };
    }

    const normalizedItems = data.items.map((item) => ({
      productId: String(item.productId || ""),
      quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
      quantityKg:
        item.quantityKg !== undefined ? Number(item.quantityKg) : undefined,
    }));

    for (const item of normalizedItems) {
      if (!item.productId) {
        throw new Error("Hay un producto inválido en el carrito");
      }
    }

    const productIds = [
      ...new Set(normalizedItems.map((item) => item.productId)),
    ];

    const products: any[] = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        isActive: true,
      },
      include: {
        category: true,
        components: {
          include: {
            component: true,
          },
        },
      },
    });

    const productMap = new Map<string, any>(
      products.map((product: any) => [product.id, product]),
    );

    const validatedItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        return {
          productId: item.productId,
          name: "Producto no disponible",
          saleUnit: null,
          requested: 0,
          available: 0,
          ok: false,
          message: "Este producto ya no está disponible en la tienda.",
          stockLabel: "Producto no disponible",
          product: null,
        };
      }

      const stock = getProductStock(product, customer.category);
      const pricing = resolvePrice(product, customer.category);
      const requested = getRequestedQuantityForProduct(product, item);
      const available = getAvailableQuantityForProduct(product, stock);

      let ok = true;
      let message = "";

      if (!Number.isFinite(requested) || requested <= 0) {
        ok = false;
        message = `La cantidad de ${product.name} no es válida.`;
      } else if (pricing.price <= 0) {
        ok = false;
        message = `${product.name} no tiene precio configurado para tu lista.`;
      } else if (!stock.canSell || available <= 0) {
        ok = false;
        message = `${product.name} no tiene stock disponible en ${getLocationLabelByCategory(
          customer.category,
        )}.`;
      } else if (requested > available) {
        ok = false;
        message = `De ${product.name} solo hay ${formatStockAmountForProduct(
          product,
          available,
        )} disponible${available === 1 && product.saleUnit !== SaleUnit.KG ? "" : "s"}.`;
      }

      return {
        productId: product.id,
        name: product.name,
        saleUnit: product.saleUnit,
        requested: round2(requested),
        available: round2(available),
        ok,
        message,
        stockLabel: stock.stockLabel,
        product: mapProduct(product, customer),
      };
    });

    return {
      ok: validatedItems.every((item) => item.ok),
      customer: {
        category: customer.category,
        clientId: customer.clientId ?? null,
      },
      items: validatedItems,
    };
  },

  async checkoutWhatsapp(data: CheckoutInput) {
    if (!data.userId) {
      throw new Error("Para finalizar el pedido tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(data.userId);

    if (!customer.clientId) {
      throw new Error(
        "Solo los usuarios cliente pueden finalizar pedidos desde la tienda",
      );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("El carrito está vacío");
    }

    const normalizedItems = data.items.map((item) => ({
      productId: String(item.productId || ""),
      quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
      quantityKg:
        item.quantityKg !== undefined ? Number(item.quantityKg) : undefined,
    }));

    for (const item of normalizedItems) {
      if (!item.productId) {
        throw new Error("Hay un producto inválido en el carrito");
      }
    }

    const cartValidation = await this.validateCart({
      userId: data.userId,
      items: normalizedItems,
    });

    if (!cartValidation.ok) {
      const firstInvalidItem = cartValidation.items.find((item) => !item.ok);

      throw new Error(
        firstInvalidItem?.message ||
          "Hay productos sin stock suficiente en el carrito",
      );
    }

    // Mayorista descuenta LOCAL. Minorista/Price descuenta DEPÓSITO.
    const stockLocation = getStockLocationByCategory(customer.category);

    const saleResult = await saleService.create({
      userId: data.userId,
      clientId: customer.clientId,
      paymentMethod: data.paymentMethod || PaymentMethod.TRANSFERENCIA,
      receiptType: ReceiptType.TICKET,
      status: SaleStatus.PENDING,
      stockLocation,
      isWebSale: true,
      items: normalizedItems,
    });

    const sale = (saleResult as any).sale;

    const whatsappMessage = buildWhatsappMessage({
      sale,
      customer,
      customerNotes: data.customerNotes,
    });

    const whatsappUrl = buildWhatsappUrl(whatsappMessage);

    const whatsappApi = await whatsappService.sendTextMessage({
      to: customer.phone || "",
      message: whatsappMessage,
    });

    return {
      saleId: sale.id,
      status: sale.status,
      total: sale.total,
      whatsappMessage,
      whatsappUrl,
      missingWhatsappConfig: Boolean(whatsappApi.missingConfig) && !whatsappUrl,
      whatsappApi,
      sale,
    };
  },
  async findClientOrder(userId: string, saleId: string) {
    if (!userId) {
      throw httpError(401, "Tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(userId);

    if (!customer.clientId) {
      throw httpError(403, "Solo los usuarios cliente pueden ver sus pedidos");
    }

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, clientId: customer.clientId },
      include: ORDER_INCLUDE,
    });

    if (!sale) {
      throw httpError(404, "Pedido no encontrado");
    }

    return { customer, sale };
  },

  async getOrders(userId: string) {
    if (!userId) {
      throw httpError(401, "Tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(userId);

    if (!customer.clientId) return [];

    const sales = await prisma.sale.findMany({
      where: { clientId: customer.clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        payments: true,
        invoiceAfip: true,
        items: {
          include: { product: { select: { name: true, sku: true, saleUnit: true } } },
        },
      },
    });

    return sales.map((sale: any) => ({
      id: sale.id,
      createdAt: sale.createdAt,
      total: sale.total,
      status: sale.status,
      deliveryStatus: sale.deliveryStatus,
      paymentMethod: sale.paymentMethod,
      receiptType: sale.receiptType,
      clientId: sale.clientId,
      editable: !getOrderEditBlockReason(sale),
      items: sale.items.map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        quantityKg: item.quantityKg,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          name: item.productNameSnapshot ?? item.product?.name,
          saleUnit: item.product?.saleUnit,
        },
      })),
    }));
  },

  async getOrder(userId: string, saleId: string) {
    const { customer, sale } = await this.findClientOrder(userId, saleId);
    const reserved = getReservedByProduct(sale, customer);
    const blockReason = getOrderEditBlockReason(sale);

    return {
      id: sale.id,
      status: sale.status,
      createdAt: sale.createdAt,
      subtotal: sale.subtotal,
      total: sale.total,
      editable: !blockReason,
      blockReason,
      items: sale.items
        .filter((item: any) => !isOrderDeliveryItem(item))
        .map((item: any) => ({
          id: item.id,
          productId: item.productId,
          name: item.productNameSnapshot ?? item.product?.name ?? "Producto",
          saleUnit: item.product?.saleUnit ?? SaleUnit.UNIT,
          quantity: getSaleItemQuantity(item),
          price: item.price,
          subtotal: item.subtotal,
          product: item.product
            ? mapProductForOrder(
                item.product,
                customer,
                reserved.get(item.productId) ?? 0,
              )
            : null,
        })),
      extras: sale.items
        .filter((item: any) => isOrderDeliveryItem(item))
        .map((item: any) => ({
          id: item.id,
          name: item.productNameSnapshot ?? item.product?.name ?? "Envío",
          subtotal: item.subtotal,
        })),
    };
  },

  async updateOrder(data: UpdateOrderInput) {
    const { customer, sale } = await this.findClientOrder(
      data.userId,
      data.saleId,
    );

    const blockReason = getOrderEditBlockReason(sale);

    if (blockReason) {
      throw httpError(400, blockReason);
    }

    // Unificamos productos repetidos y descartamos cantidades en cero.
    const requestedByProduct = new Map<string, number>();

    for (const item of Array.isArray(data.items) ? data.items : []) {
      const productId = String(item.productId || "");
      const qty = Number(item.quantityKg ?? item.quantity ?? 0);

      if (!productId) {
        throw httpError(400, "Hay un producto inválido en el pedido");
      }

      if (!Number.isFinite(qty) || qty < 0) {
        throw httpError(400, "Hay una cantidad inválida en el pedido");
      }

      requestedByProduct.set(
        productId,
        round2((requestedByProduct.get(productId) ?? 0) + qty),
      );
    }

    for (const [productId, qty] of [...requestedByProduct]) {
      if (qty <= 0) requestedByProduct.delete(productId);
    }

    if (requestedByProduct.size === 0) {
      throw httpError(
        400,
        "El pedido tiene que tener al menos un producto. Si querés cancelarlo, contactanos.",
      );
    }

    const existingByProduct = new Map<string, any>(
      sale.items
        .filter((item: any) => !isOrderDeliveryItem(item))
        .map((item: any) => [item.productId, item]),
    );

    const products: any[] = await prisma.product.findMany({
      where: { id: { in: [...requestedByProduct.keys()] } },
      include: {
        category: true,
        components: { include: { component: true } },
      },
    });

    const productMap = new Map<string, any>(
      products.map((product: any) => [product.id, product]),
    );

    const reserved = getReservedByProduct(sale, customer);
    const saleItems: any[] = [];

    for (const [productId, qty] of requestedByProduct) {
      const product = productMap.get(productId);
      const existing = existingByProduct.get(productId);

      // Productos nuevos: tienen que estar publicados en la tienda.
      // Los que ya estaban en el pedido se pueden mantener aunque se hayan ocultado.
      if (
        !product ||
        (!existing && (!product.isActive || !product.isVisibleToPublic)) ||
        isDeliverySku(product.sku)
      ) {
        throw httpError(400, "Uno de los productos ya no está disponible en la tienda.");
      }

      const isKg = product.saleUnit === SaleUnit.KG;

      if (!isKg && !Number.isInteger(qty)) {
        throw httpError(400, `La cantidad de ${product.name} tiene que ser un número entero.`);
      }

      if (!existing && resolvePrice(product, customer.category).price <= 0) {
        throw httpError(400, `${product.name} no tiene precio configurado para tu lista.`);
      }

      const stock = getProductStock(product, customer.category);
      const available = round2(
        getAvailableQuantityForProduct(product, stock) +
          (reserved.get(productId) ?? 0),
      );

      if (qty > available) {
        throw httpError(
          400,
          available > 0
            ? `De ${product.name} solo hay ${formatStockAmountForProduct(product, available)} disponible${available === 1 && !isKg ? "" : "s"}.`
            : `${product.name} no tiene stock disponible.`,
        );
      }

      const saleItem: any = {
        productId,
        ...(isKg ? { quantityKg: qty } : { quantity: qty }),
      };

      // Si el local le puso un precio manual a un producto, lo respetamos.
      if (existing?.priceType === SaleItemPriceType.MANUAL) {
        saleItem.priceType = SaleItemPriceType.MANUAL;
        saleItem.price = existing.price;
      }

      saleItems.push(saleItem);
    }

    // El envío no lo edita el cliente: se conserva tal cual.
    for (const item of sale.items.filter((i: any) => isOrderDeliveryItem(i))) {
      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        priceType: SaleItemPriceType.MANUAL,
      });
    }

    // updateItems vuelve a validar el stock dentro de la transacción y sólo
    // mueve la diferencia contra lo que el pedido ya tenía descontado.
    await saleService.updateItems(sale.id, {
      userId: data.userId,
      items: saleItems,
      payments: [],
    });

    return this.getOrder(data.userId, sale.id);
  },
};
