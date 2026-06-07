type EmitirFacturaBaseParams = {
    saleId: string;
    cuit?: string;
    tipoComprobante: number;
    tipoDoc: number;
    nroDoc: number;
    importe: number;
    condicionIVAReceptor?: number;
    concepto?: 1 | 2 | 3;
    puntoVenta?: number;
};
export declare function obtenerUltimoComprobanteAFIPBase({ cuit, puntoVenta, tipoComprobante, }: {
    cuit?: string;
    puntoVenta?: number;
    tipoComprobante: number;
}): Promise<number>;
export declare function emitirFacturaAFIPBase({ saleId, cuit, tipoComprobante, tipoDoc, nroDoc, importe, condicionIVAReceptor, concepto, puntoVenta, }: EmitirFacturaBaseParams): Promise<{
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
export {};
//# sourceMappingURL=wsfe-base.service.d.ts.map