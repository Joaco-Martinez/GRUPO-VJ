export declare function generarTokenAFIP(): Promise<{
    token: any;
    sign: any;
    expiration: Date;
    service: string;
}>;
export declare function getValidToken(): Promise<{
    token: string;
    sign: string;
    expiration: Date;
    service: string;
}>;
export declare const generarTokenARCA: typeof generarTokenAFIP;
//# sourceMappingURL=wsaa.service.d.ts.map