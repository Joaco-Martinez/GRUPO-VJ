"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../prisma"));
const nodemailer_1 = __importDefault(require("nodemailer"));
class AlertService {
    async createAlert(productId, productName, stock, minStock, unit = "unidades") {
        const message = `El producto "${productName}" tiene bajo stock (${stock} ${unit}, mínimo ${minStock}).`;
        const existing = await prisma_1.default.alert.findFirst({
            where: {
                productId,
                resolved: false,
                message,
            },
        });
        if (existing)
            return existing;
        const alert = await prisma_1.default.alert.create({
            data: { productId, message },
        });
        try {
            await this.sendEmailToAllUsers(productName, stock, minStock, unit);
        }
        catch (error) {
            console.error("Error enviando alerta por email:", error);
        }
        return alert;
    }
    async getAlerts() {
        return prisma_1.default.alert.findMany({
            orderBy: { createdAt: "desc" },
            include: { product: true },
        });
    }
    async sendEmailToAllUsers(productName, stock, minStock, unit) {
        const users = await prisma_1.default.user.findMany({ select: { email: true } });
        if (users.length === 0)
            return;
        if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS)
            return;
        const transporter = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        });
        const emails = users.map((u) => u.email).join(",");
        const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #111; color: #D4AF37;">
        <h2 style="color: #D4AF37; text-align: center;">⚠️ Alerta de Bajo Stock</h2>
        <div style="background: #1c1c1c; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <p style="font-size: 16px; margin: 0; color: #fff;">
            El producto <strong style="color: #D4AF37;">"${productName}"</strong> tiene bajo stock.
          </p>
          <p style="font-size: 18px; margin: 10px 0; text-align: center; color: #fff;">
            📦 <strong>${stock}</strong> ${unit} disponibles
            <span style="color: #aaa;">(mínimo ${minStock})</span>
          </p>
        </div>
      </div>
    `;
        await transporter.sendMail({
            from: `"ERP" <${process.env.GMAIL_USER}>`,
            to: emails,
            subject: "⚠️ Alerta de bajo stock",
            html,
        });
    }
}
exports.default = new AlertService();
//# sourceMappingURL=alert.service.js.map