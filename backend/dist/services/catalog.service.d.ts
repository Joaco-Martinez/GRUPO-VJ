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
        id: string;
        name: string;
        slug: string;
        description: string | null;
        productsCount: number;
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
            priceList: "PUBLIC" | "CLIENT" | "WHOLESALE";
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
    checkoutWhatsapp(data: CheckoutInput): Promise<{
        saleId: any;
        status: any;
        total: any;
        whatsappMessage: string;
        whatsappUrl: string | null;
        missingWhatsappConfig: boolean;
        sale: any;
    }>;
};
export {};
//# sourceMappingURL=catalog.service.d.ts.map