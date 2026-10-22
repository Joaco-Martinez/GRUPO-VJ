import { CategoryClient, PaymentMethod } from "@prisma/client";
type CatalogFilters = {
    userId?: string;
    categorySlug?: string;
    search?: string;
    limit?: number;
    page?: number;
};
type CheckoutItemInput = {
    productId: string;
    quantity?: number;
    quantityKg?: number;
};
type CheckoutInput = {
    userId: string;
    items: CheckoutItemInput[];
    paymentMethod?: PaymentMethod;
    customerNotes?: string;
};
type CustomerContext = {
    userId?: string;
    clientId?: string;
    category: CategoryClient;
    customerName?: string;
    dni?: string;
    phone?: string | null;
    email?: string | null;
};
export declare const catalogService: {
    getCustomerContext(userId?: string): Promise<CustomerContext>;
    getCategories(): Promise<{
        id: any;
        name: any;
        slug: any;
        description: any;
        productsCount: any;
    }[]>;
    getProducts(filters: CatalogFilters): Promise<{
        customer: {
            category: import("@prisma/client").$Enums.CategoryClient;
            isLoggedIn: boolean;
            clientId: string | null;
        };
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            totalPages: number;
        };
        products: {
            id: any;
            sku: any;
            name: any;
            description: any;
            type: any;
            saleUnit: any;
            imageUrl: any;
            category: {
                id: any;
                name: any;
                slug: any;
            } | null;
            price: number;
            priceList: "WHOLESALE" | "PUBLIC";
            publicPrice: number;
            clientPrice: number;
            wholesalePrice: number;
            currency: string;
            availableQuantity: number;
            availableKg: number;
            stockLabel: string;
            canSell: boolean;
            components: any;
            createdAt: any;
            updatedAt: any;
        }[];
    }>;
    validateCart(data: CheckoutInput): Promise<{
        ok: boolean;
        customer: {
            category: import("@prisma/client").$Enums.CategoryClient;
            clientId: string;
        };
        items: ({
            productId: string;
            name: string;
            saleUnit: null;
            requested: number;
            available: number;
            ok: boolean;
            message: string;
            stockLabel: string;
            product: null;
        } | {
            productId: any;
            name: any;
            saleUnit: any;
            requested: number;
            available: number;
            ok: boolean;
            message: string;
            stockLabel: string;
            product: {
                id: any;
                sku: any;
                name: any;
                description: any;
                type: any;
                saleUnit: any;
                imageUrl: any;
                category: {
                    id: any;
                    name: any;
                    slug: any;
                } | null;
                price: number;
                priceList: "WHOLESALE" | "PUBLIC";
                publicPrice: number;
                clientPrice: number;
                wholesalePrice: number;
                currency: string;
                availableQuantity: number;
                availableKg: number;
                stockLabel: string;
                canSell: boolean;
                components: any;
                createdAt: any;
                updatedAt: any;
            };
        })[];
    }>;
    checkoutWhatsapp(data: CheckoutInput): Promise<{
        saleId: any;
        status: any;
        total: any;
        whatsappMessage: string;
        whatsappUrl: string | null;
        missingWhatsappConfig: boolean;
        whatsappApi: {
            sent: boolean;
            provider: "WHATSAPP_CLOUD_API";
            messageId?: string;
            error?: string;
            missingConfig?: boolean;
        };
        sale: any;
    }>;
};
export {};
//# sourceMappingURL=catalog.service.d.ts.map