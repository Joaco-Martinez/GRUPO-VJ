import axios from "axios";
import prisma from "../prisma";


function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatFechaTicket(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNombreCliente(client: any) {
  const nombre = client?.nombre?.trim() ?? "";
  const apellido = client?.apellido?.trim() ?? "";
  const fullName = `${nombre} ${apellido}`.trim();

  return fullName || "Consumidor Final";
}

function getMetodoPago(sale: any) {
  if (sale.payments && sale.payments.length > 0) {
    return sale.payments
      .map(
        (p: any) =>
          `${p.method}: ${Number(p.amount).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join(" | ");
  }

  return sale.paymentMethod || "EFECTIVO";
}

function buildTicketPayload(sale: any) {
  const subtotal = numberOrZero(sale.subtotal);
  const total = numberOrZero(sale.total);
  const discount = subtotal > total ? subtotal - total : 0;

  return {
    saleId: `TICKET-${String(sale.id).slice(0, 8).toUpperCase()}`,
    receiptType: "TICKET NO FISCAL",
    paymentMethod: getMetodoPago(sale),
    createdAt: formatFechaTicket(sale.createdAt ?? new Date()),

    business: {
      name: process.env.BUSINESS_NAME ?? "GRUPO VJ",
      subtitle: process.env.BUSINESS_SUBTITLE ?? "ComarPOS",
      cuit: process.env.BUSINESS_CUIT ?? "",
      address: process.env.BUSINESS_ADDRESS ?? "Dirección Grupo VJ",
      phone: process.env.BUSINESS_PHONE ?? "Teléfono Grupo VJ",
    },

    client: {
      name: getNombreCliente(sale.client),
      dni: sale.client?.dni ? String(sale.client.dni) : "",
      phone: sale.client?.telefono ? String(sale.client.telefono) : "",
    },

    items: sale.items.map((item: any) => {
      const quantity = numberOrZero(item.quantity);

      const quantityKg =
        item.quantityKg !== null && item.quantityKg !== undefined
          ? numberOrZero(item.quantityKg)
          : undefined;

      const price = numberOrZero(item.price);

      const subtotalItem =
        item.subtotal !== null && item.subtotal !== undefined
          ? numberOrZero(item.subtotal)
          : quantityKg !== undefined && quantityKg > 0
          ? quantityKg * price
          : quantity * price;

      return {
        name: item.product?.name ?? item.productNameSnapshot ?? "Producto",
        quantity,
        ...(quantityKg !== undefined ? { quantityKg } : {}),
        price,
        subtotal: subtotalItem,
      };
    }),

    subtotal,
    discount,
    total,

    footer: "Ticket no fiscal - Gracias por su compra",
  };
}

async function enviarTicketAlPOSLocal(payload: any) {
  const POS_LOCAL_URL = process.env.POS_LOCAL_URL;
  const POS_LOCAL_TOKEN = process.env.POS_LOCAL_TOKEN;

  if (!POS_LOCAL_URL) {
    throw new Error("POS_LOCAL_URL no está configurado");
  }

  const url = `${POS_LOCAL_URL.replace(/\/$/, "")}/print/ticket`;

  console.log("🖨️ Enviando ticket no fiscal al POS local:", url);
  console.log("📦 Payload ticket no fiscal:", JSON.stringify(payload, null, 2));

  const response = await axios.post(url, payload, {
    timeout: 60000,
    headers: {
      "Content-Type": "application/json",
      ...(POS_LOCAL_TOKEN ? { "x-pos-token": POS_LOCAL_TOKEN } : {}),
    },
  });

  return response.data;
}

export const ticketService = {
  async printSaleTicket(saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    const payload = buildTicketPayload(sale);

    const posResponse = await enviarTicketAlPOSLocal(payload);

    return {
      payload,
      posResponse,
    };
  },
};