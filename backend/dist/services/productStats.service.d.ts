import { SaleUnit } from "@prisma/client";
type SaleItemStatInput = {
    productId: string;
    quantity?: number;
    quantityKg?: number;
};
type ProductLite = {
    id: string;
    name: string;
    saleUnit: SaleUnit;
};
type GroupedRow = {
    productId: string;
    _sum: {
        quantity: number | null;
        quantityKg: number | null;
    };
};
type ReportProductStat = {
    productId: string;
    name: string;
    saleUnit: SaleUnit;
    unitsSold: number;
    kgSold: number;
    totalSold: number;
    totalSoldLabel: string;
    totalRevenue: number;
    grossRevenue: number;
    collectedRevenue: number;
    pendingRevenue: number;
    rankValue: number;
    product: ProductLite | null;
};
export declare const productStatsService: {
    createStatsFromSale(items: SaleItemStatInput[]): Promise<void>;
    attachProducts(grouped: GroupedRow[]): Promise<{
        productId: string;
        product: ProductLite | null;
        saleUnit: import("@prisma/client").$Enums.SaleUnit;
        rankValue: number;
        unitsSold: number;
        kgSold: number;
    }[]>;
    groupAll(where?: any): Promise<(import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.ProductStatsGroupByOutputType, "productId"[]> & {
        _sum: {
            quantity: number | null;
            quantityKg: number | null;
        };
    })[]>;
    buildProductReport(params?: {
        startDate?: Date;
        endDate?: Date;
        unit?: "UNIT" | "KG";
    }): Promise<ReportProductStat[]>;
    getTopProducts(limit: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat[]>;
    getWorstProducts(limit: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat[]>;
    getTopProductsByRange(startDate: Date, endDate: Date, limit: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat[]>;
    getWorstProductsByRange(startDate: Date, endDate: Date, limit: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat[]>;
    getBestProductByMonth(year: number, month: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat>;
    getWorstProductByMonth(year: number, month: number, unit?: "UNIT" | "KG"): Promise<ReportProductStat>;
    getTotals(unit?: "UNIT" | "KG"): Promise<{
        totalRevenue: number;
        grossRevenue: number;
        collectedRevenue: number;
        pendingRevenue: number;
        totalSales: number;
        totalItems: number;
        totalUnits: number;
        totalKg: number;
        productsCount: number;
        topProducts: ReportProductStat[];
    }>;
    getTotalsByRange(startDate: Date, endDate: Date, unit?: "UNIT" | "KG"): Promise<{
        totalRevenue: number;
        grossRevenue: number;
        collectedRevenue: number;
        pendingRevenue: number;
        totalSales: number;
        totalItems: number;
        totalUnits: number;
        totalKg: number;
        productsCount: number;
        topProducts: ReportProductStat[];
    }>;
};
export {};
//# sourceMappingURL=productStats.service.d.ts.map