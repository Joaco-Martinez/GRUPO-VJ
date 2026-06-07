import { Request, Response, NextFunction } from "express";
export declare const saleController: {
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPending(req: Request, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    generarCotizacion(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    create(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updatePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updatePayments(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    generarNotaPedido(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=sale.controller.d.ts.map