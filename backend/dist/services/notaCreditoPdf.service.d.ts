export declare function regenerarNotaCreditoPDFService(saleId: string, uploadToCloudinary?: boolean): Promise<{
    filePath: string;
    cloudinaryUrl?: undefined;
} | {
    filePath: string;
    cloudinaryUrl: string;
}>;
export declare function obtenerNotaCreditoPDFPathService(saleId: string): Promise<{
    filePath: string;
    fileName: string;
}>;
//# sourceMappingURL=notaCreditoPdf.service.d.ts.map