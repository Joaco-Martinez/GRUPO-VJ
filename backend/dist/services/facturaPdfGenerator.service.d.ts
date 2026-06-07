export type Product = {
    name: string;
    quantity: number;
    quantityKg?: number | null;
    price: number;
    subtotal?: number;
};
export type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";
export type FacturaPDFData = {
    factura: {
        cuit: string;
        puntoVenta: number;
        tipoComprobante: number;
        tipoDoc: number;
        nroDoc: number;
        numero: number;
        fechaEmision: Date;
        resultado: string;
        cae: string;
        caeVto: Date;
        total: number;
        neto: number;
        iva: number;
        condicionIVAReceptor: number;
        moneda: string;
        urlQR?: string;
        saleId: string;
    };
    empresa?: {
        name?: string;
        subtitle?: string;
        cuit?: string;
        address?: string;
        phone?: string;
        ivaCondition?: string;
    };
    cliente: {
        nombre: string;
        apellido?: string;
        dni: string;
        telefono?: string;
        gmail?: string;
        category?: TipoCliente;
    };
    products: Product[];
    logoPath?: string;
};
export declare function generarFacturaPDF(data: FacturaPDFData, uploadToCloudinary?: boolean): Promise<{
    filePath: string;
    cloudinaryUrl?: undefined;
} | {
    filePath: string;
    cloudinaryUrl: string;
}>;
//# sourceMappingURL=facturaPdfGenerator.service.d.ts.map