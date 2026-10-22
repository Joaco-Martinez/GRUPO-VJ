import { Request, Response, NextFunction } from "express";
export declare const arcaConfigController: {
    list(_req: Request, res: Response, next: NextFunction): Promise<void>;
    get(_req: Request, res: Response, next: NextFunction): Promise<void>;
    upsert(req: Request, res: Response, next: NextFunction): Promise<void>;
    generateCsr(req: Request, res: Response, next: NextFunction): Promise<void>;
    downloadCsr(req: Request, res: Response, next: NextFunction): Promise<void>;
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    uploadCertificate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    uploadCertificates(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteCertificates(_req: Request, res: Response, next: NextFunction): Promise<void>;
    activate(req: Request, res: Response, next: NextFunction): Promise<void>;
    test(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    testWsaa(_req: Request, res: Response): Promise<void>;
    testWsfeDummy(_req: Request, res: Response): Promise<void>;
    remove(req: Request, res: Response, next: NextFunction): Promise<void>;
    listPointsOfSale(_req: Request, res: Response, next: NextFunction): Promise<void>;
    upsertPointOfSale(req: Request, res: Response, next: NextFunction): Promise<void>;
    deletePointOfSale(req: Request, res: Response, next: NextFunction): Promise<void>;
    listRemitoCais(_req: Request, res: Response, next: NextFunction): Promise<void>;
    upsertRemitoCai(req: Request, res: Response, next: NextFunction): Promise<void>;
    deleteRemitoCai(req: Request, res: Response, next: NextFunction): Promise<void>;
    listAuditLogs(_req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=arcaConfig.controller.d.ts.map