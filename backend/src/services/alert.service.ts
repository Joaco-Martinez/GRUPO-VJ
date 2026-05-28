import prisma from "../prisma";
import nodemailer from "nodemailer";

class AlertService {
  async createAlert(productId: string, productName: string, stock: number, minStock: number, unit = "unidades") {
    const message = `El producto "${productName}" tiene bajo stock (${stock} ${unit}, mínimo ${minStock}).`;

    const existing = await prisma.alert.findFirst({
      where: {
        productId,
        resolved: false,
        message,
      },
    });

    if (existing) return existing;

    const alert = await prisma.alert.create({
      data: { productId, message },
    });

    try {
      await this.sendEmailToAllUsers(productName, stock, minStock, unit);
    } catch (error) {
      console.error("Error enviando alerta por email:", error);
    }

    return alert;
  }

  async getAlerts() {
    return prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
  }

  private async sendEmailToAllUsers(productName: string, stock: number, minStock: number, unit: string) {
    const users = await prisma.user.findMany({ select: { email: true } });
    if (users.length === 0) return;
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;

    const transporter = nodemailer.createTransport({
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

export default new AlertService();
