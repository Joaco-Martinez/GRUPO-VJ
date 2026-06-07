import { Request, Response, NextFunction } from "express";
export declare const productController: {
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    create: (import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>))[];
    update(req: Request, res: Response, next: NextFunction): Promise<void>;
    delete(req: Request, res: Response, next: NextFunction): Promise<void>;
    transferStock(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    addStock(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    transferStockKg(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    addStockKg(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateComponents(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getBySku(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getMovements(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateImage: (import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>))[];
};
//# sourceMappingURL=product.controller.d.ts.map