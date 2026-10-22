import { AccountMovementType, PaymentMethod } from "@prisma/client";
export declare const accountService: {
    getClientAccount(clientId: string): Promise<{
        client: {
            id: string;
            nombre: string;
            apellido: string;
            dni: string | null;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
        };
        balance: number;
        movements: ({
            user: {
                id: string;
                name: string;
                email: string;
            } | null;
            sale: {
                id: string;
                total: number;
                status: import("@prisma/client").$Enums.SaleStatus;
                createdAt: Date;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.AccountMovementType;
            id: string;
            userId: string | null;
            clientId: string;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
            createdAt: Date;
            saleId: string | null;
            description: string | null;
            amount: number;
            date: Date;
            reference: string | null;
            previousBalance: number;
            newBalance: number;
        })[];
    }>;
    getMovements(filters?: {
        clientId?: string;
        type?: AccountMovementType;
        fromDate?: Date;
        toDate?: Date;
    }): Promise<({
        client: {
            id: string;
            nombre: string;
            apellido: string;
            dni: string | null;
            telefono: string | null;
            gmail: string | null;
            currentBalance: number;
        };
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        sale: {
            id: string;
            total: number;
            status: import("@prisma/client").$Enums.SaleStatus;
            createdAt: Date;
        } | null;
    } & {
        type: import("@prisma/client").$Enums.AccountMovementType;
        id: string;
        userId: string | null;
        clientId: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        saleId: string | null;
        description: string | null;
        amount: number;
        date: Date;
        reference: string | null;
        previousBalance: number;
        newBalance: number;
    })[]>;
    getDebtors(): Promise<{
        id: string;
        nombre: string;
        apellido: string;
        dni: string | null;
        telefono: string | null;
        gmail: string | null;
        category: import("@prisma/client").$Enums.CategoryClient;
        currentBalance: number;
        creditLimit: number | null;
        isAccountEnabled: boolean;
    }[]>;
    addDebt(data: {
        clientId: string;
        amount: number;
        saleId?: string | null;
        userId?: string | null;
        description?: string | null;
        reference?: string | null;
    }): Promise<{
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string | null;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            isActive: boolean;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
            addressApartment: string | null;
            addressCity: string | null;
            addressFloor: string | null;
            addressNotes: string | null;
            addressNumber: string | null;
            addressPostalCode: string | null;
            addressProvince: string | null;
            addressStreet: string | null;
            latitude: number | null;
            longitude: number | null;
        };
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        sale: {
            id: string;
            userId: string | null;
            clientId: string | null;
            gmailSend: string | null;
            subtotal: number;
            total: number;
            discountType: import("@prisma/client").$Enums.DiscountType | null;
            discountValue: number | null;
            isInvoiced: boolean;
            isNoteCredit: boolean;
            invoiceStatus: import("@prisma/client").$Enums.InvoiceStatus;
            afipLastError: string | null;
            nextRetryAt: Date | null;
            retryCount: number;
            afipPayloadJson: import("@prisma/client/runtime/library").JsonValue | null;
            paymentMethod: import("@prisma/client").$Enums.PaymentMethod;
            receiptType: import("@prisma/client").$Enums.ReceiptType;
            status: import("@prisma/client").$Enums.SaleStatus;
            isAccountSale: boolean;
            accountDebtAmount: number;
            isWebSale: boolean;
            createdAt: Date;
            updatedAt: Date;
            pdfUrl: string | null;
            stockLocation: import("@prisma/client").$Enums.Location;
            quotationExpiredAt: Date | null;
            quotationExpiresAt: Date | null;
            quotationPdfUrl: string | null;
            grossProfit: number;
            businessLocationId: string | null;
            declaredValue: number | null;
            deliveryAddressSnapshot: string | null;
            deliveryCost: number;
            deliveryDistanceKm: number | null;
            deliveryMethod: import("@prisma/client").$Enums.DeliveryMethod;
            deliveryStatus: import("@prisma/client").$Enums.DeliveryStatus;
            packagesCount: number | null;
            transportCuit: string | null;
            transportName: string | null;
            deliveryPricePerKm: number | null;
        } | null;
    } & {
        type: import("@prisma/client").$Enums.AccountMovementType;
        id: string;
        userId: string | null;
        clientId: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        saleId: string | null;
        description: string | null;
        amount: number;
        date: Date;
        reference: string | null;
        previousBalance: number;
        newBalance: number;
    }>;
    registerPayment(data: {
        clientId: string;
        amount: number;
        method: PaymentMethod;
        userId?: string | null;
        reference?: string | null;
        description?: string | null;
        createFinance?: boolean;
    }): Promise<{
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string | null;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            isActive: boolean;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
            addressApartment: string | null;
            addressCity: string | null;
            addressFloor: string | null;
            addressNotes: string | null;
            addressNumber: string | null;
            addressPostalCode: string | null;
            addressProvince: string | null;
            addressStreet: string | null;
            latitude: number | null;
            longitude: number | null;
        };
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
    } & {
        type: import("@prisma/client").$Enums.AccountMovementType;
        id: string;
        userId: string | null;
        clientId: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        saleId: string | null;
        description: string | null;
        amount: number;
        date: Date;
        reference: string | null;
        previousBalance: number;
        newBalance: number;
    }>;
    createAdjustment(data: {
        clientId: string;
        type: "POSITIVE" | "NEGATIVE";
        amount: number;
        userId?: string | null;
        reference?: string | null;
        description?: string | null;
    }): Promise<{
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string | null;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            isActive: boolean;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
            addressApartment: string | null;
            addressCity: string | null;
            addressFloor: string | null;
            addressNotes: string | null;
            addressNumber: string | null;
            addressPostalCode: string | null;
            addressProvince: string | null;
            addressStreet: string | null;
            latitude: number | null;
            longitude: number | null;
        };
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
    } & {
        type: import("@prisma/client").$Enums.AccountMovementType;
        id: string;
        userId: string | null;
        clientId: string;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        createdAt: Date;
        saleId: string | null;
        description: string | null;
        amount: number;
        date: Date;
        reference: string | null;
        previousBalance: number;
        newBalance: number;
    }>;
    updateClientAccountConfig(clientId: string, data: {
        creditLimit?: number | null;
        isAccountEnabled?: boolean;
    }): Promise<{
        id: string;
        nombre: string;
        apellido: string;
        dni: string | null;
        telefono: string | null;
        gmail: string | null;
        currentBalance: number;
        creditLimit: number | null;
        isAccountEnabled: boolean;
    }>;
};
//# sourceMappingURL=account.service.d.ts.map