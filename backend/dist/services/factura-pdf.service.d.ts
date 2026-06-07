export declare function regenerarFacturaPDFService(saleId: string, uploadToCloudinary?: boolean): Promise<{
    filePath: string;
    cloudinaryUrl?: undefined;
} | {
    filePath: string;
    cloudinaryUrl: string;
}>;
export declare function obtenerTodasLasFacturasService(): Promise<{
    id: string;
    saleId: string | null;
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
    tipoDoc: number;
    nroDoc: number;
    numero: number;
    fechaEmision: Date;
    resultado: string;
    cae: string | null;
    caeVto: Date | null;
    total: number;
    neto: number;
    iva: number;
    condicionIVAReceptor: number;
    moneda: string;
    urlQR: string | null;
    qrBase64: string | null;
    createdAt: Date;
    updatedAt: Date;
    relatedInvoiceId: string | null;
    pdfUrl: string | null;
    client: {
        id: string;
        nombre: string;
        apellido: string;
        dni: string;
        telefono: string | null;
        gmail: string | null;
        category: import("@prisma/client").$Enums.CategoryClient;
    } | null;
}[]>;
export declare function obtenerFacturaPDFPathService(saleId: string): Promise<{
    filePath: string;
    fileName: string;
}>;
//# sourceMappingURL=factura-pdf.service.d.ts.map