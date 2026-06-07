type Product = {
    name: string;
    quantity: number;
    price: number;
};
export declare function generarNotaCreditoAfipPDF({ tipoComprobante, puntoVenta, numero, saleId, fechaEmision, nombreCliente, domicilioCliente, total, metodoPago, cae, caeVto, cuit, razonSocial, direccion, qrBase64, products, }: {
    tipoComprobante: number;
    puntoVenta: number;
    numero: number;
    saleId: string;
    fechaEmision: Date;
    nombreCliente?: string;
    domicilioCliente?: string;
    total: number;
    metodoPago?: string;
    cae: string;
    caeVto: Date;
    cuit: string;
    razonSocial?: string;
    direccion?: string;
    qrBase64?: string | null;
    products?: Product[];
}): Promise<void>;
export {};
//# sourceMappingURL=generarNotaCreditoAfipPDF.d.ts.map