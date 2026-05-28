import { PrismaClient, SaleUnit } from "@prisma/client";

const prisma = new PrismaClient();

type SaleItemStatInput = {
  productId: string;
  quantity?: number;   // UNIT
  quantityKg?: number; // KG
};

type ProductLite = { id: string; name: string; saleUnit: SaleUnit };

type GroupedRow = {
  productId: string;
  _sum: { quantity: number | null; quantityKg: number | null };
};

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function n0(v: number | null | undefined) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

export const productStatsService = {
  // ✅ Crear stats al completar una venta (100% compatible KG)
  async createStatsFromSale(items: SaleItemStatInput[]) {
    const dateOnly = toDateOnly(new Date());

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, saleUnit: true },
    });

    const unitMap = new Map(products.map((p) => [p.id, p.saleUnit]));

    for (const item of items) {
      const saleUnit = unitMap.get(item.productId);
      if (!saleUnit) throw new Error(`Producto no encontrado: ${item.productId}`);

      if (saleUnit === "KG") {
        const kg = n0(item.quantityKg);
        if (kg <= 0) throw new Error(`quantityKg inválida para producto KG: ${item.productId}`);

        await prisma.productStats.create({
          data: {
            productId: item.productId,
            quantity: 0,
            quantityKg: kg,
            date: dateOnly,
          },
        });
      } else {
        const qty = n0(item.quantity);
        if (qty <= 0) throw new Error(`quantity inválida para producto UNIT: ${item.productId}`);

        await prisma.productStats.create({
          data: {
            productId: item.productId,
            quantity: qty,
            quantityKg: 0,
            date: dateOnly,
          },
        });
      }
    }
  },

  // ✅ Merge eficiente + rankValue correcto (sin mezclar)
  async attachProducts(grouped: GroupedRow[]) {
    if (!grouped.length) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId) } },
      select: { id: true, name: true, saleUnit: true },
    });

    const productMap = new Map<string, ProductLite>(products.map((p) => [p.id, p]));

    return grouped.map((g) => {
      const product = productMap.get(g.productId) || null;

      const unitsSold = n0(g._sum.quantity);
      const kgSold = n0(g._sum.quantityKg);

      const saleUnit = product?.saleUnit ?? "UNIT";
      const rankValue = saleUnit === "KG" ? kgSold : unitsSold;

      return {
        productId: g.productId,
        product,
        saleUnit,
        rankValue,
        unitsSold,
        kgSold,
      };
    });
  },

  async groupAll(where?: any) {
    return prisma.productStats.groupBy({
      by: ["productId"],
      where,
      _sum: { quantity: true, quantityKg: true },
    });
  },

  // ✅ TOP por tipo
  async getTopProducts(limit: number, unit?: "UNIT" | "KG") {
    const grouped = await this.groupAll();
    const merged = await this.attachProducts(grouped as any);
    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered.sort((a, b) => b.rankValue - a.rankValue).slice(0, limit);
  },

  // ✅ WORST por tipo
  async getWorstProducts(limit: number, unit?: "UNIT" | "KG") {
    const grouped = await this.groupAll();
    const merged = await this.attachProducts(grouped as any);
    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered.sort((a, b) => a.rankValue - b.rankValue).slice(0, limit);
  },

  // ✅ TOP por rango
  async getTopProductsByRange(startDate: Date, endDate: Date, limit: number, unit?: "UNIT" | "KG") {
    const grouped = await this.groupAll({ date: { gte: startDate, lte: endDate } });
    const merged = await this.attachProducts(grouped as any);
    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered.sort((a, b) => b.rankValue - a.rankValue).slice(0, limit);
  },

  // ✅ BEST del mes
  async getBestProductByMonth(year: number, month: number, unit?: "UNIT" | "KG") {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const grouped = await this.groupAll({ date: { gte: startDate, lte: endDate } });
    const merged = await this.attachProducts(grouped as any);
    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered.sort((a, b) => b.rankValue - a.rankValue)[0] || null;
  },

  // ✅ WORST del mes
  async getWorstProductByMonth(year: number, month: number, unit?: "UNIT" | "KG") {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const grouped = await this.groupAll({ date: { gte: startDate, lte: endDate } });
    const merged = await this.attachProducts(grouped as any);
    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered.sort((a, b) => a.rankValue - b.rankValue)[0] || null;
  },

  // ✅ NUEVO: Totales globales (para la tabla del front)
  async getTotals(limit = 50, unit?: "UNIT" | "KG") {
    const grouped = await this.groupAll();
    const merged = await this.attachProducts(grouped as any);

    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered
      .sort((a, b) => b.rankValue - a.rankValue)
      .slice(0, limit)
      .map((r) => ({
        productId: r.productId,
        product: r.product,
        saleUnit: r.saleUnit,
        unitsSold: r.unitsSold,
        kgSold: r.kgSold,
        rankValue: r.rankValue,
      }));
  },

  // ✅ NUEVO: Totales por rango (si querés usarlo también)
  async getTotalsByRange(startDate: Date, endDate: Date, limit = 50, unit?: "UNIT" | "KG") {
    const grouped = await this.groupAll({ date: { gte: startDate, lte: endDate } });
    const merged = await this.attachProducts(grouped as any);

    const filtered = unit ? merged.filter((m) => m.saleUnit === unit) : merged;

    return filtered
      .sort((a, b) => b.rankValue - a.rankValue)
      .slice(0, limit)
      .map((r) => ({
        productId: r.productId,
        product: r.product,
        saleUnit: r.saleUnit,
        unitsSold: r.unitsSold,
        kgSold: r.kgSold,
        rankValue: r.rankValue,
      }));
  },
};
