// Marca que llevan (en `notes`) los pagos de venta generados por un abono
// cargado desde Cuentas Corrientes. Ese dinero ya entra a Finanzas como
// COBRANZA en el momento del abono, así que el ingreso por VENTA de la venta
// no lo tiene que volver a contar.
export const ACCOUNT_PAYMENT_MARKER = "[abono-cc]";

export function isAccountPaymentLine(payment: { notes?: string | null }) {
  return String(payment.notes ?? "").startsWith(ACCOUNT_PAYMENT_MARKER);
}
