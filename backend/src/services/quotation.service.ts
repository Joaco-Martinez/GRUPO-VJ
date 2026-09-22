import prisma from "../prisma";
import { generarCotizacionPDF } from "../utils/generarCotizacionPDF";

// Cotizaciones "sin stock": son documentos independientes de las ventas.
// Nunca reservan, descuentan ni validan stock.

const DEFAULT_VALID_DAYS = 7;

type PriceType = "price" | "wholesalePrice";

type QuotationItemInput = {
  productId?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity: number;
  price?: number | null;
};

type QuotationInput = {
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientDoc?: string | null;
  clientAddress?: string | null;
  priceType?: PriceType;
  discountType?: "PERCENTAGE" | "FIXED" | null;
  discountValue?: number | null;
  notes?: string | null;
  expiresAt?: string | null;
  items: QuotationItemInput[];
};

const quotationInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          imageUrl: true,
          saleUnit: true,
        },
      },
    },
  },
  client: true,
  user: { select: { id: true, name: true } },
};

function httpError(message: string, status = 400) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function cleanString(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function productPrice(
  product: {
    saleUnit: string;
    price: number;
    wholesalePrice: number;
    pricePerKg: number | null;
    wholesalePricePerKg: number | null;
    clientPricePerKg: number | null;
  },
  priceType: PriceType
) {
  if (product.saleUnit === "KG") {
    if (priceType === "wholesalePrice") {
      return product.wholesalePricePerKg ?? product.clientPricePerKg ?? product.pricePerKg ?? 0;
    }
    return product.pricePerKg ?? 0;
  }

  if (priceType === "wholesalePrice") return product.wholesalePrice ?? product.price;
  return product.price;
}

function clientAddressText(client: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
}) {
  const street = [client.addressStreet, client.addressNumber].filter(Boolean).join(" ");
  const unit = [
    client.addressFloor ? `Piso ${client.addressFloor}` : null,
    client.addressApartment ? `Depto ${client.addressApartment}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [street, unit, client.addressCity, client.addressProvince].filter(Boolean).join(", ") || null;
}

async function buildQuotationData(data: QuotationInput) {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw httpError("La cotización debe tener al menos un producto");
  }

  const priceType: PriceType = data.priceType === "wholesalePrice" ? "wholesalePrice" : "price";

  const productIds = data.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } } })
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = data.items.map((item, index) => {
    const quantity = toNumber(item.quantity);

    if (!(quantity > 0)) {
      throw httpError(`Cantidad inválida en el ítem ${index + 1}`);
    }

    const product = item.productId ? productMap.get(item.productId) : undefined;

    if (item.productId && !product) {
      throw httpError(`Producto no encontrado en el ítem ${index + 1}`);
    }

    const name = cleanString(item.name) ?? product?.name ?? null;

    if (!name) {
      throw httpError(`Falta el nombre del ítem ${index + 1}`);
    }

    const manualPrice = item.price === null || item.price === undefined ? NaN : toNumber(item.price);
    const price = Number.isFinite(manualPrice)
      ? manualPrice
      : product
        ? productPrice(product, priceType)
        : NaN;

    if (!Number.isFinite(price) || price < 0) {
      throw httpError(`Precio inválido en el ítem ${index + 1}`);
    }

    return {
      productId: product?.id ?? null,
      productNameSnapshot: name,
      productSkuSnapshot: cleanString(item.sku) ?? product?.sku ?? null,
      saleUnit: product?.saleUnit ?? "UNIT",
      quantity,
      price: round2(price),
      subtotal: round2(price * quantity),
    };
  });

  const subtotal = round2(items.reduce((acc, item) => acc + item.subtotal, 0));

  const discountValue =
    data.discountType && data.discountValue !== null && data.discountValue !== undefined
      ? toNumber(data.discountValue)
      : NaN;

  const hasDiscount = Number.isFinite(discountValue) && discountValue > 0;

  if (hasDiscount && data.discountType === "PERCENTAGE" && discountValue > 100) {
    throw httpError("El descuento porcentual no puede superar el 100%");
  }

  const discountAmount = !hasDiscount
    ? 0
    : data.discountType === "PERCENTAGE"
      ? (subtotal * discountValue) / 100
      : discountValue;

  const total = round2(Math.max(0, subtotal - discountAmount));

  let clientSnapshot = {
    clientName: cleanString(data.clientName),
    clientPhone: cleanString(data.clientPhone),
    clientDoc: cleanString(data.clientDoc),
    clientAddress: cleanString(data.clientAddress),
  };

  const clientId = cleanString(data.clientId);

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw httpError("Cliente no encontrado", 404);

    clientSnapshot = {
      clientName: clientSnapshot.clientName ?? (`${client.nombre} ${client.apellido}`.trim() || null),
      clientPhone: clientSnapshot.clientPhone ?? client.telefono ?? null,
      clientDoc: clientSnapshot.clientDoc ?? client.dni ?? null,
      clientAddress: clientSnapshot.clientAddress ?? clientAddressText(client),
    };
  }

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw httpError("Fecha de vencimiento inválida");
  }

  return {
    header: {
      clientId,
      ...clientSnapshot,
      priceType,
      subtotal,
      discountType: hasDiscount ? data.discountType ?? null : null,
      discountValue: hasDiscount ? discountValue : null,
      total,
      notes: cleanString(data.notes),
      expiresAt:
        expiresAt ?? new Date(Date.now() + DEFAULT_VALID_DAYS * 24 * 60 * 60 * 1000),
    },
    items,
  };
}

export const quotationService = {
  async getAll(options?: { search?: string }) {
    const search = options?.search?.trim();
    const numberSearch = search && /^\d+$/.test(search) ? Number(search) : null;

    return prisma.quotation.findMany({
      where: search
        ? {
            OR: [
              { clientName: { contains: search, mode: "insensitive" } },
              { clientPhone: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              ...(numberSearch !== null ? [{ number: numberSearch }] : []),
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: quotationInclude,
    });
  },

  async getById(id: string) {
    return prisma.quotation.findUnique({
      where: { id },
      include: quotationInclude,
    });
  },

  async create(data: QuotationInput, userId?: string | null) {
    const { header, items } = await buildQuotationData(data);

    return prisma.quotation.create({
      data: {
        ...header,
        userId: userId ?? null,
        items: { create: items },
      },
      include: quotationInclude,
    });
  },

  async update(id: string, data: QuotationInput) {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw httpError("Cotización no encontrada", 404);

    const { header, items } = await buildQuotationData(data);

    return prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      return tx.quotation.update({
        where: { id },
        data: {
          ...header,
          items: { create: items },
        },
        include: quotationInclude,
      });
    });
  },

  async remove(id: string) {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw httpError("Cotización no encontrada", 404);

    await prisma.quotation.delete({ where: { id } });
  },

  async generatePdf(id: string) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: quotationInclude,
    });

    if (!quotation) throw httpError("Cotización no encontrada", 404);

    const pdfBuffer = await generarCotizacionPDF({
      id: `N° ${quotation.number}`,
      subtotal: quotation.subtotal,
      total: quotation.total,
      discountType: quotation.discountType,
      discountValue: quotation.discountValue,
      createdAt: quotation.createdAt,
      quotationExpiresAt: quotation.expiresAt,
      deliveryAddressSnapshot: quotation.clientAddress,
      user: quotation.user,
      client: {
        nombre: quotation.clientName ?? "",
        apellido: "",
        dni: quotation.clientDoc,
        telefono: quotation.clientPhone,
        // El encabezado del PDF muestra la lista de precios usada.
        category: quotation.priceType === "wholesalePrice" ? "Mayorista" : "Price",
      },
      items: quotation.items.map((item) => ({
        quantity: item.quantity,
        quantityKg: item.saleUnit === "KG" ? item.quantity : null,
        price: item.price,
        subtotal: item.subtotal,
        productNameSnapshot: item.productNameSnapshot,
        productSkuSnapshot: item.productSkuSnapshot,
        product: {
          name: item.product?.name ?? item.productNameSnapshot,
          sku: item.product?.sku ?? item.productSkuSnapshot,
          imageUrl: item.product?.imageUrl ?? null,
          saleUnit: item.saleUnit,
        },
      })),
    });

    return {
      filename: `cotizacion-${quotation.number}.pdf`,
      buffer: pdfBuffer,
    };
  },
};
