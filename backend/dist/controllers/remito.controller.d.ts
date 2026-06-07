import { Request, Response } from "express";
export declare const remitoController: {
    createFromSale(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getAll(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getById(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    regeneratePdf(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    markAsDelivered(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    downloadPdf(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    cancel(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
};
//# sourceMappingURL=remito.controller.d.ts.map