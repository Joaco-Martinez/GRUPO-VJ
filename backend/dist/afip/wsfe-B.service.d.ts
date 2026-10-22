export declare function emitirFacturaB({ saleId, cuit, tipoDoc, nroDoc, importe, condicionIVAReceptor, }: {
    saleId: string;
    cuit?: string;
    tipoDoc: number;
    nroDoc: number;
    importe: number;
    condicionIVAReceptor?: number;
}): Promise<{
    id: string;
    total: number;
    createdAt: Date;
    updatedAt: Date;
    saleId: string | null;
    relatedInvoiceId: string | null;
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
    tipoDoc: number;
    nroDoc: bigint;
    numero: number;
    fechaEmision: Date;
    resultado: string;
    cae: string | null;
    caeVto: Date | null;
    neto: number;
    iva: number;
    condicionIVAReceptor: number;
    moneda: string;
    urlQR: string | null;
    qrBase64: string | null;
}>;
//# sourceMappingURL=wsfe-B.service.d.ts.map