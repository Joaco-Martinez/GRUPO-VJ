declare class AlertService {
    createAlert(productId: string, productName: string, stock: number, minStock: number, unit?: string): Promise<{
        id: string;
        createdAt: Date;
        productId: string;
        message: string;
        resolved: boolean;
    }>;
    getAlerts(): Promise<({
        product: {
            type: import("@prisma/client").$Enums.ProductType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            price: number;
            description: string | null;
            wholesalePrice: number;
            clientPrice: number;
            purchasePrice: number;
            minStock: number | null;
            stockLocal: number;
            stockDeposito: number;
            categoryId: string | null;
            imageUrl: string | null;
            imageId: string | null;
            isService: boolean;
            isActive: boolean;
            sku: string | null;
            saleUnit: import("@prisma/client").$Enums.SaleUnit;
            pricePerKg: number | null;
            wholesalePricePerKg: number | null;
            clientPricePerKg: number | null;
            stockLocalKg: number;
            stockDepositoKg: number;
            minStockKg: number | null;
        };
    } & {
        id: string;
        createdAt: Date;
        productId: string;
        message: string;
        resolved: boolean;
    })[]>;
    private sendEmailToAllUsers;
}
declare const _default: AlertService;
export default _default;
//# sourceMappingURL=alert.service.d.ts.map