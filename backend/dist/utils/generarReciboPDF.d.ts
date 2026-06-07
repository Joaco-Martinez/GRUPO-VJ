type Product = {
    name: string;
    quantity: number;
    price: number;
};
export declare function generarTicketPedidoPDF({ saleId, products, total, metodoPago, nombreCliente, razonSocial, direccion, cuit, mensaje, }: {
    saleId: string;
    products: Product[];
    total: number;
    metodoPago?: string;
    nombreCliente?: string;
    razonSocial?: string;
    direccion?: string;
    cuit?: string;
    mensaje?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=generarReciboPDF.d.ts.map