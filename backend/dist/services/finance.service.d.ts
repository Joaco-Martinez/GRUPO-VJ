import { CategoryFinance, FinanceType, Location } from "@prisma/client";
import ExcelJS from "exceljs";
import { Response } from "express";
type StockLocationScope = Location | "ALL";
type SalesLocationSummary = {
    label: string;
    salesCount: number;
    itemsCount: number;
    total: number;
    cost: number;
    grossProfit: number;
    margin: number;
};
export declare const financeService: {
    getAll(): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    }[]>;
    create(data: {
        type: FinanceType;
        amount: number;
        category: CategoryFinance;
        description?: string;
        date?: Date;
    }): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    }>;
    registerIncomeFromSale(saleId: string): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    } | null>;
    registerCreditNote(amount: number, description: string, userId: string): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    }>;
    getIncomeByMonth(year: number, month: number): Promise<import("@prisma/client").Prisma.GetFinanceAggregateType<{
        where: {
            type: "INGRESO";
            date: {
                gte: Date;
                lte: Date;
            };
        };
        _sum: {
            amount: true;
        };
    }>>;
    getIncomeByYear(year: number): Promise<import("@prisma/client").Prisma.GetFinanceAggregateType<{
        where: {
            type: "INGRESO";
            date: {
                gte: Date;
                lte: Date;
            };
        };
        _sum: {
            amount: true;
        };
    }>>;
    getIncomeByWeek(year: number, month: number, day: number): Promise<import("@prisma/client").Prisma.GetFinanceAggregateType<{
        where: {
            type: "INGRESO";
            date: {
                gte: Date;
                lte: Date;
            };
        };
        _sum: {
            amount: true;
        };
    }>>;
    getTopProducts(limit?: number): Promise<{
        productId: string;
        _sum: {
            quantity: number;
        };
        product: any;
    }[]>;
    getWorstProducts(limit?: number): Promise<{
        productId: string;
        _sum: {
            quantity: number;
        };
        product: {
            type: import("@prisma/client").$Enums.ProductType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            price: number;
            description: string | null;
            wholesalePrice: number;
            clientPrice: number;
            minStock: number | null;
            stockLocal: number;
            stockDeposito: number;
            categoryId: string | null;
            imageUrl: string | null;
            imageId: string | null;
            isVisibleToPublic: boolean;
            sku: string | null;
            saleUnit: import("@prisma/client").$Enums.SaleUnit;
            pricePerKg: number | null;
            wholesalePricePerKg: number | null;
            clientPricePerKg: number | null;
            stockLocalKg: number;
            stockDepositoKg: number;
            minStockKg: number | null;
            purchasePrice: number;
            isService: boolean;
            minStockDeposito: number | null;
            minStockDepositoKg: number | null;
        } | null;
    }[]>;
    getProductsRange(startDate: Date, endDate: Date, order: "asc" | "desc"): Promise<{
        productId: string;
        _sum: {
            quantity: number;
        };
        product: {
            type: import("@prisma/client").$Enums.ProductType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            price: number;
            description: string | null;
            wholesalePrice: number;
            clientPrice: number;
            minStock: number | null;
            stockLocal: number;
            stockDeposito: number;
            categoryId: string | null;
            imageUrl: string | null;
            imageId: string | null;
            isVisibleToPublic: boolean;
            sku: string | null;
            saleUnit: import("@prisma/client").$Enums.SaleUnit;
            pricePerKg: number | null;
            wholesalePricePerKg: number | null;
            clientPricePerKg: number | null;
            stockLocalKg: number;
            stockDepositoKg: number;
            minStockKg: number | null;
            purchasePrice: number;
            isService: boolean;
            minStockDeposito: number | null;
            minStockDepositoKg: number | null;
        } | null;
    }[]>;
    getIncomeByCategory(from: Date, to: Date): Promise<(import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.FinanceGroupByOutputType, "category"[]> & {
        _sum: {
            amount: number | null;
        };
    })[]>;
    getSalesByStockLocation(from?: Date, to?: Date): Promise<{
        all: SalesLocationSummary;
        LOCAL: SalesLocationSummary;
        DEPOSITO: SalesLocationSummary;
    }>;
    getTopProductsInRange(from?: Date, to?: Date, limit?: number, stockLocation?: string | null): Promise<{
        productId: string;
        product: any;
        stockLocation: StockLocationScope;
        totalSold: number;
        totalQuantity: number;
        totalQuantityKg: number;
        totalRevenue: number;
        grossProfit: number;
        _sum: {
            quantity: number;
            quantityKg: number;
            subtotal: number;
            profit: number;
        };
    }[]>;
    getWorstProductsInRange(from?: Date, to?: Date, limit?: number, stockLocation?: string | null): Promise<{
        productId: string;
        product: any;
        stockLocation: StockLocationScope;
        totalSold: number;
        totalQuantity: number;
        totalQuantityKg: number;
        totalRevenue: number;
        grossProfit: number;
        _sum: {
            quantity: number;
            quantityKg: number;
            subtotal: number;
            profit: number;
        };
    }[]>;
    exportFinanceReport(from: Date, to: Date): Promise<ExcelJS.Buffer>;
    exportFinanceReportPDF(res: Response, from: Date, to: Date): Promise<void>;
    update(id: string, data: Partial<{
        type: FinanceType;
        amount: number;
        category: CategoryFinance;
        description?: string;
        date?: Date;
        paymentMethod?: string;
    }>): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    }>;
    remove(id: string): Promise<{
        type: import("@prisma/client").$Enums.FinanceType;
        id: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        updatedAt: Date;
        category: import("@prisma/client").$Enums.CategoryFinance;
        description: string | null;
        amount: number;
        date: Date;
    }>;
};
export {};
//# sourceMappingURL=finance.service.d.ts.map