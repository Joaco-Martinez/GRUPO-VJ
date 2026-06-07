"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transporter = void 0;
exports.sendInvoiceEmail = sendInvoiceEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
exports.transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});
async function sendInvoiceEmail(sale, pdfPath) {
    // prioridad: mail manual > mail del cliente
    const recipient = sale.gmailSend?.trim() ||
        sale.client?.email?.trim() ||
        null;
    if (!recipient) {
        console.log(`⚠️ No se envió email: la venta ${sale.id} no tiene destinatario`);
        return;
    }
    await exports.transporter.sendMail({
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
//# sourceMappingURL=mailer.js.map