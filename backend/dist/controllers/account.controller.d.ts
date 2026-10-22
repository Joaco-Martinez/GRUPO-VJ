import { Request, Response, NextFunction } from "express";
export declare const accountController: {
    getClientAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
    getMovements(req: Request, res: Response, next: NextFunction): Promise<void>;
    getDebtors(req: Request, res: Response, next: NextFunction): Promise<void>;
    registerPayment(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    createAdjustment(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateClientAccountConfig(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=account.controller.d.ts.map