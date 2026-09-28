import prisma from "../prisma";

const DELIVERY_PRICE_PER_KM_KEY = "delivery.pricePerKm";
const DEFAULT_DELIVERY_PRICE_PER_KM = Number(process.env.DELIVERY_PRICE_PER_KM ?? 618);

export const settingsService = {
  async getDeliveryPricePerKm() {
    const setting = await prisma.appSetting.findUnique({
      where: { key: DELIVERY_PRICE_PER_KM_KEY },
    });

    const value = Number(setting?.value);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_DELIVERY_PRICE_PER_KM;
  },

  async getDeliverySettings() {
    return { pricePerKm: await this.getDeliveryPricePerKm() };
  },

  async updateDeliverySettings(params: { pricePerKm: unknown }) {
    const pricePerKm = Math.round(Number(params.pricePerKm));

    if (!Number.isFinite(pricePerKm) || pricePerKm <= 0) {
      throw new Error("El precio por km debe ser mayor a 0");
    }

    await prisma.appSetting.upsert({
      where: { key: DELIVERY_PRICE_PER_KM_KEY },
      create: { key: DELIVERY_PRICE_PER_KM_KEY, value: String(pricePerKm) },
      update: { value: String(pricePerKm) },
    });

    return { pricePerKm };
  },
};
