import { AccountMovementType, PaymentMethod } from "@prisma/client";
export declare const accountService: {
    getClientAccount(clientId: string): Promise<{
        client: {
            id: string;
            nombre: string;
            apellido: string;
            dni: string;
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
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        client: {
            id: string;
            nombre: string;
            apellido: string;
            dni: string;
            telefono: string | null;
            gmail: string | null;
            currentBalance: number;
        };
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
        dni: string;
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
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            addressStreet: string | null;
            addressNumber: string | null;
            addressFloor: string | null;
            addressApartment: string | null;
            addressCity: string | null;
            addressProvince: string | null;
            addressPostalCode: string | null;
            addressNotes: string | null;
            latitude: number | null;
            longitude: number | null;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
        };
        sale: {
            id: string;
            userId: string | null;
            clientId: string | null;
            businessLocationId: string | null;
            gmailSend: string | null;
            deliveryPricePerKm: number | null;
            subtotal: number;
            total: number;
            grossProfit: number;
            quotationExpiresAt: Date | null;
            quotationExpiredAt: Date | null;
            quotationPdfUrl: string | null;
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
            stockLocation: import("@prisma/client").$Enums.Location;
            deliveryMethod: import("@prisma/client").$Enums.DeliveryMethod;
            deliveryStatus: import("@prisma/client").$Enums.DeliveryStatus;
            deliveryAddressSnapshot: string | null;
            deliveryDistanceKm: number | null;
            deliveryCost: number;
            transportName: string | null;
            transportCuit: string | null;
            packagesCount: number | null;
            declaredValue: number | null;
            isAccountSale: boolean;
            accountDebtAmount: number;
            createdAt: Date;
            updatedAt: Date;
            pdfUrl: string | null;
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
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            addressStreet: string | null;
            addressNumber: string | null;
            addressFloor: string | null;
            addressApartment: string | null;
            addressCity: string | null;
            addressProvince: string | null;
            addressPostalCode: string | null;
            addressNotes: string | null;
            latitude: number | null;
            longitude: number | null;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
        };
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
        user: {
            id: string;
            name: string;
            email: string;
        } | null;
        client: {
            id: string;
            userId: string | null;
            createdAt: Date;
            updatedAt: Date;
            nombre: string;
            apellido: string;
            dni: string;
            telefono: string | null;
            gmail: string | null;
            category: import("@prisma/client").$Enums.CategoryClient;
            addressStreet: string | null;
            addressNumber: string | null;
            addressFloor: string | null;
            addressApartment: string | null;
            addressCity: string | null;
            addressProvince: string | null;
            addressPostalCode: string | null;
            addressNotes: string | null;
            latitude: number | null;
            longitude: number | null;
            currentBalance: number;
            creditLimit: number | null;
            isAccountEnabled: boolean;
        };
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
        dni: string;
        telefono: string | null;
        gmail: string | null;
        currentBalance: number;
        creditLimit: number | null;
        isAccountEnabled: boolean;
    }>;
};
//# sourceMappingURL=account.service.d.ts.map