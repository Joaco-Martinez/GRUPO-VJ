export declare function generarQR({ fecha, // "YYYYMMDD"
cuit, // string o number
puntoVenta, // number
tipoComprobante, // number
numero, // number
total, // number
tipoDoc, // number
nroDoc, // number
cae, }: {
    fecha: string;
    cuit: string | number;
    puntoVenta: number;
    tipoComprobante: number;
    numero: number;
    total: number;
    tipoDoc: number;
    nroDoc: number;
    cae: string | number;
}): Promise<{
    urlQR: string;
    qrDataURL: string;
    payload: {
        ver: number;
        fecha: string;
        cuit: number;
        ptoVta: number;
        tipoCmp: number;
        nroCmp: number;
        importe: number;
        moneda: string;
        ctz: number;
        tipoDocRec: number;
        nroDocRec: number;
        tipoCodAut: string;
        codAut: number;
    };
}>;
//# sourceMappingURL=qrAfip.service.d.ts.map