import { Product } from "@prisma/client";
type StockLocationLabel = "LOCAL" | "DEPÓSITO";
declare class AlertService {
    createAlert(productId: string, productName: string, stock: number, minStock: number, unit?: string, location?: StockLocationLabel): Promise<{
        id: string;
        createdAt: Date;
        productId: string;
        message: string;
        resolved: boolean;
    }>;
    checkProductStock(productId: string): Promise<{
        id: string;
        productId: string;
        message: string;
        createdAt: Date;
        resolved: boolean;
    }[]>;
    checkProductStockFromData(product: Product): Promise<{
        id: string;
        productId: string;
        message: string;
        createdAt: Date;
        resolved: boolean;
    }[]>;
    checkAllProductsStock(): Promise<{
        id: string;
        productId: string;
        message: string;
        createdAt: Date;
        resolved: boolean;
    }[]>;
    getAlerts(): Promise<({
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
        };
    } & {
        id: string;
        createdAt: Date;
        productId: string;
        message: string;
        resolved: boolean;
    })[]>;
    private sendEmailToStockAlertUser;
}
declare const _default: AlertService;
export default _default;
//# sourceMappingURL=alert.service.d.ts.map