export declare function obtenerUltimoComprobanteAFIP({ cuit, puntoVenta, tipoComprobante, }: {
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
}): Promise<number>;
export declare function emitirFacturaAFIP({ saleId, cuit, puntoVenta: _puntoVenta, tipoComprobante, tipoDoc, nroDoc, importe, condicionIVAReceptor, }: {
    saleId: string;
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
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
export declare function emitirNotaCreditoAFIP({ saleId, facturaOriginalId, motivo, importe, }: {
    saleId: string;
    facturaOriginalId: string;
    motivo?: string;
    importe: number;
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
/**
 * ✅ Obtiene el último comprobante autorizado desde AFIP (opcional)
 */
//# sourceMappingURL=wsfe.service.d.ts.map