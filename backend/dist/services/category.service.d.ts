export declare const categoryService: {
    getAll(options?: {
        includeInactive?: boolean;
    }): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    })[]>;
    getById(id: string): Promise<({
        _count: {
            products: number;
        };
        products: {
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
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    }) | null>;
    getBySlug(slug: string): Promise<({
        _count: {
            products: number;
        };
        products: {
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
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    }) | null>;
    create(data: {
        name: string;
        description?: string | null;
        isActive?: boolean;
    }): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    }) | {
        statusCode: number;
        message: string;
    }>;
    update(id: string, data: {
        name?: string;
        description?: string | null;
        isActive?: boolean;
    }): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    }) | {
        statusCode: number;
        message: string;
    }>;
    delete(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    } | {
        statusCode: number;
        message: string;
    }>;
    restore(id: string): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        description: string | null;
        slug: string;
    }) | {
        statusCode: number;
        message: string;
    }>;
};
//# sourceMappingURL=category.service.d.ts.map