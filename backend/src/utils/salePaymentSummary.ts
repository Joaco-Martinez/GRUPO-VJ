import { isAccountPaymentLine } from "./accountPayment";

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  QR: "QR",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  QR_NACION: "QR Nación",
  QR_MERCADOPAGO: "QR Mercado Pago",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

export function getPaymentMethodLabel(method?: string | null) {
  if (!method) return "-";
  return PAYMENT_LABELS[method] || method;
}

type PaymentLike = {
  method: string;
  amount: unknown;
  notes?: string | null;
};

// Nombre legible de una línea de pago. Las líneas CUENTA_CORRIENTE marcadas
// son saldo a favor o abonos ya usados (cuentan como pagado); sin marca, es
// lo que el cliente quedó debiendo.
export function getPaymentLineLabel(payment: PaymentLike) {
  if (payment.method === "CUENTA_CORRIENTE") {
    if (isAccountPaymentLine(payment)) {
      return String(payment.notes).includes("Abono")
        ? "Abono cta. cte."
        : "Saldo a favor aplicado";
    }
    return "Queda en cta. cte.";
  }

  return getPaymentMethodLabel(payment.method);
}

// Saldo a favor del cliente usado para pagar esta venta (no incluye abonos).
export function getCreditApplied(sale: { payments?: PaymentLike[] | null }) {
  const amount = (sale.payments ?? [])
    .filter((p) => getPaymentLineLabel(p) === "Saldo a favor aplicado")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  return Math.round(amount * 100) / 100;
}

export function getPaymentLines(sale: {
  payments?: PaymentLike[] | null;
  paymentMethod?: string | null;
}) {
  const payments = sale.payments ?? [];

  if (payments.length === 0) {
    return [{ label: getPaymentMethodLabel(sale.paymentMethod), amount: null as number | null }];
  }

  return payments.map((p) => ({
    label: getPaymentLineLabel(p),
    amount: Number(p.amount) as number | null,
  }));
}

// Saldo del cliente: positivo = deuda, negativo = a favor.
export function getAccountBalanceText(balance: number) {
  const value = Math.round(Number(balance || 0) * 100) / 100;
  const amount = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  })
    .format(Math.abs(value))
    .replace(/\s/g, " ");

  if (value < 0) return `Saldo a favor restante: ${amount}`;
  if (value > 0) return `Saldo deudor en cta. cte.: ${amount}`;
  return "Saldo en cta. cte.: $ 0";
}

// Saldo de la cuenta después de esta venta: el último movimiento de cuenta
// de la venta; si la venta no tocó la cuenta, el saldo actual del cliente.
// Devuelve null si no corresponde mostrarlo (sin cliente, o sin cuenta y sin saldo).
export async function getClientBalanceAfterSale(
  db: any,
  sale: {
    id: string;
    client?: { currentBalance?: unknown; isAccountEnabled?: boolean | null } | null;
  }
) {
  if (!sale.client) return null;

  const movement = await db.accountMovement.findFirst({
    where: { saleId: sale.id },
    orderBy: { createdAt: "desc" },
    select: { newBalance: true },
  });

  const balance = Number(movement?.newBalance ?? sale.client.currentBalance ?? 0);

  if (!sale.client.isAccountEnabled && balance === 0) return null;

  return balance;
}
