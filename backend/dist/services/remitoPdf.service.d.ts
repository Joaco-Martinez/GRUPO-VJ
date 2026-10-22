export type RemitoPDFData = {
    remito: {
        pointOfSale: number;
        number: number;
        issueDate: Date | string;
        placeOfIssue?: string | null;
        cai?: string | null;
        caiExpiresAt?: Date | string | null;
        sellerName?: string | null;
        saleCondition?: string | null;
        transportName?: string | null;
        packages?: number | null;
        declaredValue?: number | null;
        copyLabel?: string | null;
    };
    business: {
        businessName: string;
        fantasyName?: string | null;
        cuit: string;
        ivaCondition: string;
        grossIncomeNumber?: string | null;
        activityStartDate?: Date | string | null;
        fiscalAddress?: string | null;
        businessAddress?: string | null;
        locality?: string | null;
        province?: string | null;
        phone?: string | null;
        email?: string | null;
        logoPath?: string | null;
    };
    client: {
        name?: string | null;
        address?: string | null;
        locality?: string | null;
        ivaCondition?: string | null;
        cuitOrDni?: string | null;
    };
    items: {
        code?: string | null;
        quantity: number;
        quantityKg?: number | null;
        description: string;
    }[];
};
export declare function generateRemitoPDFBuffer(data: RemitoPDFData): Promise<Buffer>;
//# sourceMappingURL=remitoPdf.service.d.ts.map