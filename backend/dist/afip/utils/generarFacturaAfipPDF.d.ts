type Product = {
    name: string;
    quantity: number;
    quantityKg?: number | null;
    price: number;
    subtotal?: number;
};
type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";
export declare function generarFacturaAfipPDF({ tipoComprobante, puntoVenta, saleId, numero, fechaEmision, nombreCliente, domicilioCliente, total, metodoPago, cae, caeVto, products, cuit, razonSocial, direccion, qrBase64, qrUrl, tipoCliente, documentoCliente, telefonoCliente, }: {
    tipoComprobante: number;
    puntoVenta: number;
    saleId: string;
    numero: number;
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
    qrUrl?: string | null;
    products?: Product[];
    tipoCliente?: TipoCliente;
    documentoCliente?: string | number;
    telefonoCliente?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=generarFacturaAfipPDF.d.ts.map