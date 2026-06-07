type CotizacionPDFSale = {
    id: string;
    subtotal: number;
    total: number;
    discountType?: string | null;
    discountValue?: number | null;
    paymentMethod?: string | null;
    receiptType?: string | null;
    status?: string | null;
    stockLocation?: string | null;
    createdAt: Date;
    quotationExpiresAt?: Date | null;
    user?: {
        name?: string | null;
    } | null;
    client?: {
        nombre?: string | null;
        apellido?: string | null;
        dni?: string | null;
        telefono?: string | null;
        gmail?: string | null;
        address?: string | null;
        direccion?: string | null;
        category?: string | null;
    } | null;
    items: {
        quantity: number;
        quantityKg?: number | null;
        price: number;
        subtotal: number;
        productNameSnapshot?: string | null;
        productSkuSnapshot?: string | null;
        product?: {
            name?: string | null;
            sku?: string | null;
            imageUrl?: string | null;
            saleUnit?: string | null;
        } | null;
    }[];
};
export declare function generarCotizacionPDF(sale: CotizacionPDFSale): Promise<Buffer>;
export {};
//# sourceMappingURL=generarCotizacionPDF.d.ts.map