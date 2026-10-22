import { Location, PaymentMethod } from "@prisma/client";
type PurchaseItemInput = {
    productId: string;
    quantity?: number | string;
    quantityKg?: number | string;
    unitCost?: number | string;
};
type CreatePurchaseInput = {
    providerName?: string;
    invoiceNumber?: string;
    description?: string;
    paymentMethod?: PaymentMethod;
    to?: Location;
    date?: string | Date;
    items: PurchaseItemInput[];
};
type UpdatePurchaseProviderInput = {
    providerName?: string | null;
};
type UpdatePurchaseInput = {
    providerName?: string | null;
    invoiceNumber?: string | null;
    description?: string | null;
    paymentMethod?: PaymentMethod;
    date?: string | Date;
    items: PurchaseItemInput[];
};
export declare const purchaseService: {
    getAll(): Promise<({
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        items: ({
            product: {
                id: string;
                name: string;
                sku: string | null;
                saleUnit: import("@prisma/client").$Enums.SaleUnit;
            };
        } & {
            id: string;
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    })[]>;
    getById(id: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        items: ({
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
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
        stockMovements: ({
            product: {
                id: string;
                name: string;
                sku: string | null;
                saleUnit: import("@prisma/client").$Enums.SaleUnit;
            };
        } & {
            type: import("@prisma/client").$Enums.MovementType;
            id: string;
            userId: string | null;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            reference: string | null;
            from: import("@prisma/client").$Enums.Location | null;
            to: import("@prisma/client").$Enums.Location | null;
            purchaseId: string | null;
            reason: string | null;
            isClientMovement: boolean;
        })[];
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    }>;
    create(data: CreatePurchaseInput, userId?: string): Promise<{
        items: ({
            product: {
                id: string;
                name: string;
                isActive: boolean;
                minStock: number | null;
                stockLocal: number;
                stockDeposito: number;
                sku: string | null;
                saleUnit: import("@prisma/client").$Enums.SaleUnit;
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
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
        stockMovements: {
            type: import("@prisma/client").$Enums.MovementType;
            id: string;
            userId: string | null;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            reference: string | null;
            from: import("@prisma/client").$Enums.Location | null;
            to: import("@prisma/client").$Enums.Location | null;
            purchaseId: string | null;
            reason: string | null;
            isClientMovement: boolean;
        }[];
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    }>;
    updateProvider(id: string, data: UpdatePurchaseProviderInput): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        items: ({
            product: {
                id: string;
                name: string;
                sku: string | null;
                saleUnit: import("@prisma/client").$Enums.SaleUnit;
            };
        } & {
            id: string;
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    }>;
    update(id: string, data: UpdatePurchaseInput, userId?: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        items: ({
            product: {
                id: string;
                name: string;
                isActive: boolean;
                minStock: number | null;
                stockLocal: number;
                stockDeposito: number;
                sku: string | null;
                saleUnit: import("@prisma/client").$Enums.SaleUnit;
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
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
        stockMovements: {
            type: import("@prisma/client").$Enums.MovementType;
            id: string;
            userId: string | null;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            reference: string | null;
            from: import("@prisma/client").$Enums.Location | null;
            to: import("@prisma/client").$Enums.Location | null;
            purchaseId: string | null;
            reason: string | null;
            isClientMovement: boolean;
        }[];
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    }>;
    cancel(id: string, userId?: string): Promise<{
        items: ({
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
            subtotal: number;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            productNameSnapshot: string | null;
            productSkuSnapshot: string | null;
            purchaseId: string;
            unitCost: number;
        })[];
        finance: {
            type: import("@prisma/client").$Enums.FinanceType;
            id: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            updatedAt: Date;
            category: import("@prisma/client").$Enums.CategoryFinance;
            description: string | null;
            amount: number;
            date: Date;
        } | null;
        stockMovements: {
            type: import("@prisma/client").$Enums.MovementType;
            id: string;
            userId: string | null;
            createdAt: Date;
            productId: string;
            quantity: number | null;
            quantityKg: number | null;
            reference: string | null;
            from: import("@prisma/client").$Enums.Location | null;
            to: import("@prisma/client").$Enums.Location | null;
            purchaseId: string | null;
            reason: string | null;
            isClientMovement: boolean;
        }[];
    } & {
        id: string;
        userId: string | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        date: Date;
        to: import("@prisma/client").$Enums.Location;
        providerName: string | null;
        invoiceNumber: string | null;
        totalAmount: number;
        financeId: string | null;
    }>;
};
export {};
//# sourceMappingURL=purchase.service.d.ts.map