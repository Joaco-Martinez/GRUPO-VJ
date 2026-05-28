import prisma from "../prisma";
import {
  PaymentMethod,
  ReceiptType,
  SaleStatus,
  ProductType,
  SaleUnit,
  MovementType,
  Location,
  AccountMovementType,
} from "@prisma/client";
import { financeService } from "./finance.service";
import { generateInvoicePDF } from "../utils/pdfGenerator";
import { sendInvoiceEmail } from "../utils/mailer";
import alertService from "./alert.service";
import { productStatsService } from "./productStats.service";
import { generarTicketPedidoPDF } from "../utils/generarReciboPDF";

type CreateSaleInput = {
  userId?: string;
  clientId?: string;
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;
  gmailSend?: string;

  paymentMethod: PaymentMethod;

  payments?: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];

  receiptType: ReceiptType;
  status?: SaleStatus;

  items: {
    productId: string;
    quantity?: number;
    quantityKg?: number;
    price?: number;

    // Legacy: se mantiene por compatibilidad.
    boxContents?: {
      productId: string;
      quantity?: number;
      quantityKg?: number;
    }[];
  }[];
};

type ClientMini = {
  category: "Cliente" | "Mayorista";
} | null;

type ResolvedSaleItem = {
  productId: string;
  productName: string;
  productSku: string | null;
  productType: ProductType;
  saleUnit: SaleUnit;
  quantity: number;
  quantityKg: number | null;
  price: number;
  subtotal: number;

  components: {
    productId: string;
    quantity: number | null;
    quantityKg: number | null;
  }[];
};

type StockLine = {
  productId: string;
  quantity: number;
  quantityKg: number;
  reason: string;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNumberOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveQty(product: any, item: any) {
  if (product.saleUnit === SaleUnit.KG) {
    const q = Number(item.quantityKg);

    if (!Number.isFinite(q) || q <= 0) {
      throw new Error(`Cantidad KG inválida para ${product.name}`);
    }

    return {
      quantity: 0,
      quantityKg: q,
      qtyUsedForTotal: q,
    };
  }

  const q = Number(item.quantity);

  if (!Number.isFinite(q) || q <= 0) {
    throw new Error(`Cantidad UNIT inválida para ${product.name}`);
  }

  return {
    quantity: q,
    quantityKg: null as number | null,
    qtyUsedForTotal: q,
  };
}

function resolveUnitPrice(product: any, client: ClientMini) {
  const isKg = product.saleUnit === SaleUnit.KG;

  const publicPrice = isKg ? product.pricePerKg : product.price;
  const clientPrice = isKg ? product.clientPricePerKg : product.clientPrice;
  const wholesalePrice = isKg ? product.wholesalePricePerKg : product.wholesalePrice;

  const validate = (p: number, label: string) => {
    if (!Number.isFinite(p)) {
      throw new Error(
        `Falta precio ${label} (${isKg ? "KG" : "UNIT"}) en ${product.name}`
      );
    }

    return p;
  };

  if (!client) {
    return validate(Number(publicPrice), "público");
  }

  if (client.category === "Mayorista") {
    return validate(Number(wholesalePrice ?? clientPrice ?? publicPrice), "mayorista");
  }

  return validate(Number(clientPrice ?? publicPrice), "cliente");
}

function addStockLine(
  map: Map<string, StockLine>,
  line: StockLine
) {
  const existing = map.get(line.productId);

  if (!existing) {
    map.set(line.productId, {
      productId: line.productId,
      quantity: line.quantity,
      quantityKg: line.quantityKg,
      reason: line.reason,
    });

    return;
  }

  existing.quantity += line.quantity;
  existing.quantityKg += line.quantityKg;
}

function buildStockLines(items: ResolvedSaleItem[]) {
  const stockMap = new Map<string, StockLine>();

  for (const item of items) {
    const soldQty = item.saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : item.quantity;

    if (item.productType !== ProductType.COMPUESTO) {
      addStockLine(stockMap, {
        productId: item.productId,
        quantity: item.saleUnit === SaleUnit.UNIT ? item.quantity : 0,
        quantityKg: item.saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : 0,
        reason: `Venta de ${item.productName}`,
      });

      continue;
    }

    for (const component of item.components) {
      addStockLine(stockMap, {
        productId: component.productId,
        quantity: component.quantity ? component.quantity * soldQty : 0,
        quantityKg: component.quantityKg ? component.quantityKg * soldQty : 0,
        reason: `Componente de ${item.productName}`,
      });
    }
  }

  return Array.from(stockMap.values()).filter(
    (line) => line.quantity > 0 || line.quantityKg > 0
  );
}

async function validateStockAvailability(tx: any, stockLines: StockLine[]) {
  for (const line of stockLines) {
    const product = await tx.product.findUnique({
      where: { id: line.productId },
      select: {
        id: true,
        name: true,
        saleUnit: true,
        stockLocal: true,
        stockLocalKg: true,
      },
    });

    if (!product) {
      throw new Error("Producto no encontrado para validar stock");
    }

    if (line.quantity > 0 && product.stockLocal < line.quantity) {
      throw new Error(
        `Stock insuficiente para ${product.name}. Necesitás ${line.quantity}, disponible ${product.stockLocal}`
      );
    }

    if (line.quantityKg > 0 && product.stockLocalKg < line.quantityKg) {
      throw new Error(
        `Stock KG insuficiente para ${product.name}. Necesitás ${line.quantityKg}, disponible ${product.stockLocalKg}`
      );
    }
  }
}

async function discountStockLines(
  tx: any,
  stockLines: StockLine[],
  userId: string | undefined,
  saleId: string,
  pendingAlerts: Array<{
    productId: string;
    name: string;
    stockLocal: number;
    minStock: number;
  }>
) {
  for (const line of stockLines) {
    const data: any = {};

    if (line.quantity > 0) {
      data.stockLocal = { decrement: line.quantity };
    }

    if (line.quantityKg > 0) {
      data.stockLocalKg = { decrement: line.quantityKg };
    }

    const updatedProduct = await tx.product.update({
      where: { id: line.productId },
      data,
      select: {
        id: true,
        name: true,
        stockLocal: true,
        minStock: true,
      },
    });

    const movementData: any = {
      type: MovementType.SALE,
      from: Location.LOCAL,
      to: null,
      quantity: line.quantity > 0 ? line.quantity : null,
      quantityKg: line.quantityKg > 0 ? line.quantityKg : null,
      reason: line.reason,
      reference: saleId,
      product: {
        connect: {
          id: line.productId,
        },
      },
    };

    if (userId) {
      movementData.user = {
        connect: {
          id: userId,
        },
      };
    }

    await tx.stockMovement.create({
      data: movementData,
    });

    const minStock = updatedProduct.minStock ?? 0;

    if (line.quantity > 0 && updatedProduct.stockLocal <= minStock) {
      pendingAlerts.push({
        productId: updatedProduct.id,
        name: updatedProduct.name,
        stockLocal: updatedProduct.stockLocal,
        minStock,
      });
    }
  }
}

async function restoreStockLines(
  tx: any,
  stockLines: StockLine[],
  userId: string | undefined,
  saleId: string
) {
  for (const line of stockLines) {
    const data: any = {};

    if (line.quantity > 0) {
      data.stockLocal = {
        increment: line.quantity,
      };
    }

    if (line.quantityKg > 0) {
      data.stockLocalKg = {
        increment: line.quantityKg,
      };
    }

    await tx.product.update({
      where: {
        id: line.productId,
      },
      data,
    });

    const movementData: any = {
      type: MovementType.SALE_CANCEL,
      from: null,
      to: Location.LOCAL,
      quantity: line.quantity > 0 ? line.quantity : null,
      quantityKg: line.quantityKg > 0 ? line.quantityKg : null,
      reason: `Cancelación de venta`,
      reference: saleId,
      product: {
        connect: {
          id: line.productId,
        },
      },
    };

    if (userId) {
      movementData.user = {
        connect: {
          id: userId,
        },
      };
    }

    await tx.stockMovement.create({
      data: movementData,
    });
  }
}


type PaymentCalcResult = {
  hasPayments: boolean;
  totalPaid: number;
  debtAmount: number;
  isAccountSale: boolean;
  paymentsToPersist: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];
};

function calculatePaymentState(params: {
  total: number;
  paymentMethod: PaymentMethod;
  payments?: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];
}): PaymentCalcResult {
  const hasPayments = Array.isArray(params.payments) && params.payments.length > 0;

  if (!hasPayments) {
    const isAccountSale = params.paymentMethod === PaymentMethod.CUENTA_CORRIENTE;
    return {
      hasPayments: false,
      totalPaid: isAccountSale ? 0 : params.total,
      debtAmount: isAccountSale ? params.total : 0,
      isAccountSale,
      paymentsToPersist: [],
    };
  }

  let totalPaid = 0;
  const paymentsToPersist: PaymentCalcResult["paymentsToPersist"] = [];
  let hasAccountPaymentLine = false;

  for (const payment of params.payments!) {
    if (!payment.method) {
      throw new Error("Cada pago necesita method");
    }

    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Cada pago necesita amount > 0");
    }

    if (payment.method === PaymentMethod.CUENTA_CORRIENTE) {
      hasAccountPaymentLine = true;
      continue;
    }

    totalPaid += amount;
    paymentsToPersist.push({
      method: payment.method,
      amount,
      reference: payment.reference,
      notes: payment.notes,
    });
  }

  totalPaid = round2(totalPaid);
  const debtAmount = round2(params.total - totalPaid);

  if (debtAmount < 0) {
    throw new Error(
      `La suma de pagos (${totalPaid}) no puede superar el total (${params.total})`
    );
  }

  return {
    hasPayments: paymentsToPersist.length > 0,
    totalPaid,
    debtAmount,
    isAccountSale: debtAmount > 0 || hasAccountPaymentLine,
    paymentsToPersist,
  };
}

async function createAccountDebtMovement(tx: any, data: {
  clientId: string;
  saleId: string;
  userId?: string | null;
  amount: number;
  description?: string;
}) {
  const debtAmount = round2(data.amount);
  if (debtAmount <= 0) return null;

  const client = await tx.client.findUnique({
    where: { id: data.clientId },
    select: {
      id: true,
      currentBalance: true,
      isAccountEnabled: true,
      creditLimit: true,
    },
  });

  if (!client) throw new Error("Cliente no encontrado");
  if (!client.isAccountEnabled) {
    throw new Error("La cuenta corriente de este cliente está deshabilitada");
  }

  const previousBalance = round2(client.currentBalance);
  const newBalance = round2(previousBalance + debtAmount);

  if (
    client.creditLimit !== null &&
    client.creditLimit !== undefined &&
    client.creditLimit > 0 &&
    newBalance > client.creditLimit
  ) {
    throw new Error(
      `La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`
    );
  }

  await tx.client.update({
    where: { id: data.clientId },
    data: { currentBalance: newBalance },
  });

  return tx.accountMovement.create({
    data: {
      clientId: data.clientId,
      saleId: data.saleId,
      userId: data.userId ?? null,
      type: AccountMovementType.DEBT,
      amount: debtAmount,
      previousBalance,
      newBalance,
      paymentMethod: null,
      reference: data.saleId,
      description: data.description ?? "Deuda generada por venta en cuenta corriente",
    },
  });
}

async function reverseAccountDebtFromSale(tx: any, sale: any) {
  const debtAmount = round2(Number(sale.accountDebtAmount ?? 0));

  if (!sale.clientId || debtAmount <= 0) return null;

  const existingReverse = await tx.accountMovement.findFirst({
    where: {
      saleId: sale.id,
      type: AccountMovementType.CREDIT_NOTE,
    },
    select: { id: true },
  });

  if (existingReverse) return null;

  const client = await tx.client.findUnique({
    where: { id: sale.clientId },
    select: { id: true, currentBalance: true },
  });

  if (!client) throw new Error("Cliente no encontrado");

  const previousBalance = round2(client.currentBalance);
  const newBalance = round2(Math.max(previousBalance - debtAmount, 0));

  await tx.client.update({
    where: { id: sale.clientId },
    data: { currentBalance: newBalance },
  });

  await tx.sale.update({
    where: { id: sale.id },
    data: {
      accountDebtAmount: 0,
      isAccountSale: false,
    },
  });

  return tx.accountMovement.create({
    data: {
      clientId: sale.clientId,
      saleId: sale.id,
      userId: sale.userId ?? null,
      type: AccountMovementType.CREDIT_NOTE,
      amount: debtAmount,
      previousBalance,
      newBalance,
      paymentMethod: null,
      reference: sale.id,
      description: "Reversión de deuda por cancelación de venta",
    },
  });
}

export const saleService = {
  async getAll() {
    return prisma.sale.findMany({
      include: {
        payments: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getPending() {
    return prisma.sale.findMany({
      where: {
        status: SaleStatus.PENDING,
      },
      include: {
        payments: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getById(id: string) {
    return prisma.sale.findUnique({
      where: {
        id,
      },
      include: {
        payments: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
        client: true,
      },
    });
  },

  async bulkUpdatePending(action: "COMPLETED" | "CANCELLED") {
    const pendingSales = await prisma.sale.findMany({
      where: {
        status: SaleStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    const updatedSales = [];

    for (const sale of pendingSales) {
      const updated = await this.updateStatus(sale.id, action as SaleStatus);
      updatedSales.push(updated);
    }

    return updatedSales;
  },

  async create(data: CreateSaleInput) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("La venta debe tener al menos un producto");
    }

    let client: ClientMini = null;

    if (data.clientId) {
      client = await prisma.client.findUnique({
        where: {
          id: data.clientId,
        },
        select: {
          category: true,
        },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }
    }

    const itemsWithPrices: ResolvedSaleItem[] = [];

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: {
          id: item.productId,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          type: true,
          saleUnit: true,

          price: true,
          pricePerKg: true,

          clientPrice: true,
          wholesalePrice: true,
          clientPricePerKg: true,
          wholesalePricePerKg: true,

          components: {
            select: {
              componentId: true,
              quantity: true,
              quantityKg: true,
            },
          },
        },
      });

      if (!product) {
        throw new Error("Producto no encontrado");
      }

      const { quantity, quantityKg, qtyUsedForTotal } = resolveQty(product, item);
      const unitPrice = resolveUnitPrice(product, client);
      const subtotal = round2(unitPrice * qtyUsedForTotal);

      let components: ResolvedSaleItem["components"] = [];

      if (product.type === ProductType.COMPUESTO) {
        if (!product.components.length) {
          throw new Error(`El producto compuesto "${product.name}" no tiene componentes`);
        }

        components = product.components.map((component) => ({
          productId: component.componentId,
          quantity: component.quantity ?? null,
          quantityKg: component.quantityKg ?? null,
        }));
      } else if (Array.isArray(item.boxContents) && item.boxContents.length > 0) {
        components = item.boxContents.map((component) => ({
          productId: component.productId,
          quantity:
            component.quantity !== undefined ? Number(component.quantity) : null,
          quantityKg:
            component.quantityKg !== undefined ? Number(component.quantityKg) : null,
        }));
      }

      itemsWithPrices.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productType: product.type,
        saleUnit: product.saleUnit,
        quantity,
        quantityKg,
        price: unitPrice,
        subtotal,
        components,
      });
    }

    const subtotal = round2(
      itemsWithPrices.reduce((acc, item) => acc + item.subtotal, 0)
    );

    let discountAmount = 0;

    if (data.discountType && typeof data.discountValue === "number") {
      discountAmount =
        data.discountType === "PERCENTAGE"
          ? subtotal * (data.discountValue / 100)
          : data.discountValue;
    }

    discountAmount = round2(discountAmount);

    const total = round2(subtotal - discountAmount);

    if (total < 0) {
      throw new Error("El total no puede ser negativo");
    }

    const paymentState = calculatePaymentState({
      total,
      paymentMethod: data.paymentMethod,
      payments: data.payments,
    });

    if (paymentState.isAccountSale && !data.clientId) {
      throw new Error("Para vender en cuenta corriente necesitás seleccionar un cliente");
    }

    const stockLines = buildStockLines(itemsWithPrices);

    const pendingAlerts: Array<{
      productId: string;
      name: string;
      stockLocal: number;
      minStock: number;
    }> = [];

    const result = await prisma.$transaction(
      async (tx) => {
        await validateStockAvailability(tx, stockLines);

        const sale = await tx.sale.create({
          data: {
            userId: data.userId,
            clientId: data.clientId ?? null,
            subtotal,
            total,
            gmailSend: data.gmailSend ?? null,
            discountType: data.discountType ?? null,
            discountValue: data.discountValue ?? null,
            paymentMethod: data.paymentMethod,
            receiptType: data.receiptType,
            status: data.status ?? SaleStatus.PENDING,
            isAccountSale: paymentState.isAccountSale,
            accountDebtAmount: paymentState.debtAmount,

            items: {
              create: itemsWithPrices.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                quantityKg: item.quantityKg,
                price: item.price,
                subtotal: item.subtotal,
                productNameSnapshot: item.productName,
                productSkuSnapshot: item.productSku,

                boxContents: item.components.length
                  ? {
                      create: item.components.map((component) => ({
                        productId: component.productId,
                        quantity: component.quantity,
                        quantityKg: component.quantityKg,
                      })),
                    }
                  : undefined,
              })),
            },

            payments: paymentState.hasPayments
              ? {
                  create: paymentState.paymentsToPersist.map((payment) => ({
                    method: payment.method,
                    amount: payment.amount,
                    reference: payment.reference ?? null,
                    notes: payment.notes ?? null,
                  })),
                }
              : undefined,
          },
          include: {
            payments: true,
            items: {
              include: {
                product: true,
                boxContents: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            user: true,
            client: true,
          },
        });

        await discountStockLines(
          tx,
          stockLines,
          data.userId,
          sale.id,
          pendingAlerts
        );

        if (paymentState.isAccountSale && paymentState.debtAmount > 0 && data.clientId) {
          await createAccountDebtMovement(tx, {
            clientId: data.clientId,
            saleId: sale.id,
            userId: data.userId ?? null,
            amount: paymentState.debtAmount,
          });
        }

        return sale;
      },
      {
        timeout: 20000,
        maxWait: 20000,
      }
    );

    for (const alert of pendingAlerts) {
      try {
        await alertService.createAlert(
          alert.productId,
          alert.name,
          alert.stockLocal,
          alert.minStock
        );
      } catch (error) {
        console.error("Error creando alerta de stock:", error);
      }
    }

    const pdfPath = await generateInvoicePDF(result);

    const invoice = await prisma.invoice.create({
      data: {
        saleId: result.id,
        pdfUrl: pdfPath,
      },
    });

    await sendInvoiceEmail(result, pdfPath);

    return {
      sale: result,
      invoice,
    };
  },

  async updateStatus(id: string, status: SaleStatus) {
    const sale = await prisma.sale.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          include: {
            product: true,
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status === status) {
      return prisma.sale.findUnique({
        where: {
          id,
        },
        include: {
          payments: true,
          items: {
            include: {
              product: true,
              boxContents: {
                include: {
                  product: true,
                },
              },
            },
          },
          user: true,
          client: true,
        },
      });
    }

    if (sale.status === SaleStatus.CANCELLED && status !== SaleStatus.CANCELLED) {
      throw new Error("No se puede cambiar el estado de una venta cancelada");
    }

    const restoredStockLines: StockLine[] = [];

    if (status === SaleStatus.CANCELLED) {
      const resolvedItems: ResolvedSaleItem[] = sale.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name ?? "Producto",
        productSku: item.product?.sku ?? null,
        productType: item.product?.type as ProductType,
        saleUnit: item.product?.saleUnit as SaleUnit,
        quantity: item.quantity,
        quantityKg: item.quantityKg ?? null,
        price: item.price,
        subtotal: (item as any).subtotal ?? item.price * (item.quantityKg ?? item.quantity),
        components:
          item.boxContents?.map((box) => ({
            productId: box.productId,
            quantity: box.quantity ?? null,
            quantityKg: (box as any).quantityKg ?? null,
          })) ?? [],
      }));

      restoredStockLines.push(...buildStockLines(resolvedItems));
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        if (status === SaleStatus.CANCELLED) {
          await restoreStockLines(
            tx,
            restoredStockLines,
            sale.userId ?? undefined,
            sale.id
          );

          await reverseAccountDebtFromSale(tx, sale);
        }

        return tx.sale.update({
          where: {
            id,
          },
          data: {
            status,
          },
          include: {
            payments: true,
            items: {
              include: {
                product: true,
                boxContents: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            user: true,
            client: true,
          },
        });
      },
      {
        timeout: 20000,
        maxWait: 20000,
      }
    );

    if (status === SaleStatus.COMPLETED) {
      await financeService.registerIncomeFromSale(id);

await productStatsService.createStatsFromSale(
  sale.items.map((item) => {
    const saleUnit = item.product?.saleUnit as SaleUnit;

    return {
      productId: item.productId,
      quantity: saleUnit === SaleUnit.KG ? 0 : item.quantity,
      quantityKg: saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : undefined,
    };
  })
);
    }

    return updated;
  },

  async generarNotaPedido(saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: {
        id: saleId,
      },
      include: {
        payments: true,
        items: {
          include: {
            product: true,
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
        client: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    const products = sale.items.map((item) => {
      const saleUnit = item.product?.saleUnit as SaleUnit;
      const qty = saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : item.quantity;

      return {
        name: item.product?.name ?? "Producto",
        quantity: qty,
        price: item.price,
      };
    });

    const metodoPago = sale.payments?.length ? "MIXTO" : sale.paymentMethod;

    await generarTicketPedidoPDF({
      saleId: sale.id,
      products,
      total: sale.total,
      metodoPago,
      nombreCliente: sale.client
        ? `${sale.client.nombre} ${sale.client.apellido}`
        : "A CONSUMIDOR FINAL",
    });

    return {
      ok: true,
    };
  },

  async updatePaymentMethod(id: string, method: PaymentMethod) {
    const sale = await prisma.sale.findUnique({
      where: {
        id,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    return prisma.sale.update({
      where: {
        id,
      },
      data: {
        paymentMethod: method,
      },
      include: {
        payments: true,
        items: true,
        user: true,
        client: true,
      },
    });
  },

  async updatePayments(
    id: string,
    payments: {
      method: PaymentMethod;
      amount: number;
      reference?: string;
      notes?: string;
    }[],
    setAsPrimary: boolean
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        payments: true,
        accountMovements: true,
      },
    });

    if (!sale) throw new Error("Venta no encontrada");
    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("No se pueden modificar pagos de una venta cancelada");
    }

    const paymentState = calculatePaymentState({
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      payments,
    });

    if (paymentState.isAccountSale && !sale.clientId) {
      throw new Error("Para dejar saldo en cuenta corriente la venta debe tener cliente");
    }

    const oldDebt = round2(Number(sale.accountDebtAmount ?? 0));
    const newDebt = round2(paymentState.debtAmount);
    const debtDelta = round2(newDebt - oldDebt);
    const primary = payments[0]?.method ?? sale.paymentMethod;

    return prisma.$transaction(async (tx) => {
      if (debtDelta !== 0 && sale.clientId) {
        const client = await tx.client.findUnique({
          where: { id: sale.clientId },
          select: {
            id: true,
            currentBalance: true,
            isAccountEnabled: true,
            creditLimit: true,
          },
        });

        if (!client) throw new Error("Cliente no encontrado");
        if (!client.isAccountEnabled && debtDelta > 0) {
          throw new Error("La cuenta corriente de este cliente está deshabilitada");
        }

        const previousBalance = round2(client.currentBalance);
        const newBalance = round2(Math.max(previousBalance + debtDelta, 0));

        if (
          debtDelta > 0 &&
          client.creditLimit !== null &&
          client.creditLimit !== undefined &&
          client.creditLimit > 0 &&
          newBalance > client.creditLimit
        ) {
          throw new Error(
            `La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`
          );
        }

        await tx.client.update({
          where: { id: sale.clientId },
          data: { currentBalance: newBalance },
        });

        await tx.accountMovement.create({
          data: {
            clientId: sale.clientId,
            saleId: sale.id,
            userId: sale.userId ?? null,
            type: debtDelta > 0
              ? AccountMovementType.ADJUSTMENT_POSITIVE
              : AccountMovementType.ADJUSTMENT_NEGATIVE,
            amount: Math.abs(debtDelta),
            previousBalance,
            newBalance,
            paymentMethod: null,
            reference: sale.id,
            description: debtDelta > 0
              ? "Aumento de deuda por actualización de pagos"
              : "Reducción de deuda por actualización de pagos",
          },
        });
      }

      return tx.sale.update({
        where: { id },
        data: {
          isAccountSale: paymentState.isAccountSale,
          accountDebtAmount: newDebt,
          payments: {
            deleteMany: {},
            create: paymentState.paymentsToPersist.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              reference: payment.reference ?? null,
              notes: payment.notes ?? null,
            })),
          },
          ...(setAsPrimary ? { paymentMethod: primary } : {}),
        },
        include: {
          payments: true,
          items: true,
          user: true,
          client: true,
          accountMovements: true,
        },
      });
    });
  },
};