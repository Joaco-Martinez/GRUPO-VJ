import axios from "axios";
import prisma from "../prisma";
import {
  getAccountBalanceText,
  getCreditApplied,
  getClientBalanceAfterSale,
  getPaymentLines,
  getPaymentMethodLabel,
} from "../utils/salePaymentSummary";

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function stringOrEmpty(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
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
    return getPaymentLines(sale)
      .map(
        (line) =>
          `${line.label}: ${Number(line.amount).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join(" | ");
  }

  return getPaymentMethodLabel(sale.paymentMethod || "EFECTIVO");
}

function getSellerName(sale: any) {
  return (
    sale.user?.name ||
    sale.seller?.name ||
    sale.employee?.name ||
    sale.createdBy?.name ||
    sale.userName ||
    ""
  );
}

function getSellerEmail(sale: any) {
  return (
    sale.user?.email ||
    sale.seller?.email ||
    sale.employee?.email ||
    sale.createdBy?.email ||
    ""
  );
}

function getClientPhone(client: any) {
  return (
    client?.telefono ||
    client?.phone ||
    client?.celular ||
    client?.mobile ||
    ""
  );
}

function getShippingPayload(sale: any) {
  const client = sale.client || {};

  const addressStreet =
    client.addressStreet ||
    client.street ||
    client.calle ||
    sale.addressStreet ||
    "";

  const addressNumber =
    client.addressNumber ||
    client.number ||
    client.numero ||
    sale.addressNumber ||
    "";

  const addressFloor =
    client.addressFloor ||
    client.floor ||
    client.piso ||
    sale.addressFloor ||
    "";

  const addressApartment =
    client.addressApartment ||
    client.apartment ||
    client.depto ||
    sale.addressApartment ||
    "";

  const city =
    client.city ||
    client.locality ||
    client.localidad ||
    sale.city ||
    sale.locality ||
    "";

  const province =
    client.province ||
    client.state ||
    client.provincia ||
    sale.province ||
    sale.state ||
    "";

  const postalCode =
    client.postalCode ||
    client.zipCode ||
    client.cp ||
    sale.postalCode ||
    sale.zipCode ||
    "";

  const fullAddress =
    client.fullAddress ||
    client.address ||
    sale.fullAddress ||
    sale.address ||
    "";

  const method =
    sale.deliveryMethod ||
    sale.shippingMethod ||
    sale.delivery?.method ||
    sale.shipping?.method ||
    "";

  const status =
    sale.deliveryStatus ||
    sale.shippingStatus ||
    sale.delivery?.status ||
    sale.shipping?.status ||
    "";

  const notes =
    sale.deliveryNotes ||
    sale.shippingNotes ||
    sale.notes ||
    sale.delivery?.notes ||
    sale.shipping?.notes ||
    "";

  const receiverName =
    sale.receiverName ||
    sale.recipientName ||
    sale.delivery?.receiverName ||
    sale.shipping?.receiverName ||
    getNombreCliente(client);

  const receiverPhone =
    sale.receiverPhone ||
    sale.recipientPhone ||
    sale.delivery?.receiverPhone ||
    sale.shipping?.receiverPhone ||
    getClientPhone(client);

  const hasShippingData =
    method ||
    status ||
    fullAddress ||
    addressStreet ||
    addressNumber ||
    addressFloor ||
    addressApartment ||
    city ||
    province ||
    postalCode ||
    notes ||
    receiverName ||
    receiverPhone;

  if (!hasShippingData) return undefined;

  return {
    method: stringOrEmpty(method),
    status: stringOrEmpty(status),
    receiverName: stringOrEmpty(receiverName),
    receiverPhone: stringOrEmpty(receiverPhone),
    fullAddress: stringOrEmpty(fullAddress),
    street: stringOrEmpty(addressStreet),
    number: stringOrEmpty(addressNumber),
    floor: stringOrEmpty(addressFloor),
    apartment: stringOrEmpty(addressApartment),
    city: stringOrEmpty(city),
    province: stringOrEmpty(province),
    postalCode: stringOrEmpty(postalCode),
    notes: stringOrEmpty(notes),
  };
}

function getTipoComprobanteLabel(tipoComprobante: number) {
  switch (tipoComprobante) {
    case 1:
      return "FACTURA A";
    case 6:
      return "FACTURA B";
    case 11:
      return "FACTURA C";
    case 3:
      return "NOTA DE CRÉDITO A";
    case 8:
      return "NOTA DE CRÉDITO B";
    case 13:
      return "NOTA DE CRÉDITO C";
    default:
      return "COMPROBANTE FISCAL";
  }
}

function formatComprobanteNumero(puntoVenta: number, numero: number) {
  const pv = String(puntoVenta).padStart(4, "0");
  const nro = String(numero).padStart(8, "0");
  return `${pv}-${nro}`;
}

function formatMoneyTicket(value: number) {
  return `$ ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function buildTicketPayload(sale: any, accountBalance: number | null = null) {
  const subtotal = numberOrZero(sale.subtotal);
  const total = numberOrZero(sale.total);
  const discount = subtotal > total ? subtotal - total : 0;

  const sellerName = getSellerName(sale);
  const sellerEmail = getSellerEmail(sale);
  const shipping = getShippingPayload(sale);

  const invoiceAfip = sale.isInvoiced ? sale.invoiceAfip : null;

  const saleId = invoiceAfip
    ? formatComprobanteNumero(invoiceAfip.puntoVenta, invoiceAfip.numero)
    : `TICKET-${String(sale.id).slice(0, 8).toUpperCase()}`;

  const receiptType = invoiceAfip
    ? getTipoComprobanteLabel(invoiceAfip.tipoComprobante)
    : "TICKET NO FISCAL";

  const baseFooter = invoiceAfip
    ? `CAE: ${invoiceAfip.cae ?? "-"} | Vto. CAE: ${
        invoiceAfip.caeVto ? formatFechaTicket(invoiceAfip.caeVto) : "-"
      }`
    : "Ticket no fiscal - Gracias por su compra";

  // El saldo a favor usado y el saldo de cuenta van en el pie, que el POS
  // local siempre imprime.
  const creditApplied = getCreditApplied(sale);
  const creditAppliedText =
    creditApplied > 0
      ? `Descuento saldo a favor: -${formatMoneyTicket(creditApplied)} | A pagar: ${formatMoneyTicket(Math.max(total - creditApplied, 0))}`
      : "";
  const accountBalanceText =
    accountBalance !== null ? getAccountBalanceText(accountBalance) : "";

  const footer = [creditAppliedText, accountBalanceText, baseFooter]
    .filter(Boolean)
    .join(" | ");

  return {
    saleId,
    receiptType,
    fiscal: Boolean(invoiceAfip),
    ...(invoiceAfip
      ? {
          cae: invoiceAfip.cae ?? "",
          caeVto: invoiceAfip.caeVto
            ? formatFechaTicket(invoiceAfip.caeVto)
            : "",
          puntoVenta: invoiceAfip.puntoVenta,
          numeroComprobante: invoiceAfip.numero,
          tipoComprobante: invoiceAfip.tipoComprobante,
          urlQR: invoiceAfip.urlQR ?? "",
        }
      : {}),
    paymentMethod: getMetodoPago(sale),
    createdAt: formatFechaTicket(sale.createdAt ?? new Date()),

    sellerName,
    userName: sellerName,

    seller: {
      id: sale.user?.id || sale.userId || "",
      name: sellerName,
      email: sellerEmail,
    },

    user: {
      id: sale.user?.id || sale.userId || "",
      name: sellerName,
      email: sellerEmail,
    },

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
      phone: getClientPhone(sale.client) ? String(getClientPhone(sale.client)) : "",

      addressStreet: stringOrEmpty(sale.client?.addressStreet),
      addressNumber: stringOrEmpty(sale.client?.addressNumber),
      addressFloor: stringOrEmpty(sale.client?.addressFloor),
      addressApartment: stringOrEmpty(sale.client?.addressApartment),
      city: stringOrEmpty(sale.client?.city || sale.client?.locality),
      province: stringOrEmpty(sale.client?.province || sale.client?.state),
      postalCode: stringOrEmpty(sale.client?.postalCode || sale.client?.zipCode),
      fullAddress: stringOrEmpty(sale.client?.fullAddress || sale.client?.address),
    },

    shipping,

    delivery: shipping,

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

    ...(creditApplied > 0
      ? { creditApplied, amountToPay: Math.max(total - creditApplied, 0) }
      : {}),

    ...(accountBalance !== null
      ? { accountBalance, accountBalanceText }
      : {}),

    footer,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        invoiceAfip: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    const accountBalance = await getClientBalanceAfterSale(prisma, sale);
    const payload = buildTicketPayload(sale, accountBalance);

    const posResponse = await enviarTicketAlPOSLocal(payload);

    return {
      payload,
      posResponse,
    };
  },
};