import { Request, Response, NextFunction } from "express";
export declare const businessLocationController: {
    create(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    getOne(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    update(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    remove(req: Request, res: Response, next: NextFunction): Promise<void>;
    setDefault(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=businessLocation.controller.d.ts.map