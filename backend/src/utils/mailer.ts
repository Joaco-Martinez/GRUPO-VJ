import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function sendInvoiceEmail(sale: any, pdfPath: string) {
  // prioridad: mail manual > mail del cliente
  const recipient =
    sale.gmailSend?.trim() ||
    sale.client?.email?.trim() ||
    null;

  if (!recipient) {
    console.log(`⚠️ No se envió email: la venta ${sale.id} no tiene destinatario`);
    return;
  }

  await transporter.sendMail({
    from: `"Von König" <${process.env.GMAIL_USER}>`,
    to: recipient,
    subject: `Factura de compra #${sale.id}`,
    text: "Gracias por tu compra. Te adjuntamos la factura.",
    attachments: [
      {
        filename: `Factura-${sale.id}.pdf`,
        path: pdfPath,
      },
    ],
  });

  console.log(`📧 Factura enviada a ${recipient}`);
}