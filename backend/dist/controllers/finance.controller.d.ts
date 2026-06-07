import { Request, Response, NextFunction } from "express";
export declare const financeController: {
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    update(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    remove(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    registerCreditNote(req: Request, res: Response): Promise<void>;
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    getIncomeByMonth(req: Request, res: Response, next: NextFunction): Promise<void>;
    getIncomeByYear(req: Request, res: Response, next: NextFunction): Promise<void>;
    getIncomeByWeek(req: Request, res: Response, next: NextFunction): Promise<void>;
    getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    getWorstProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    getIncomeByCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
    getBestProductMonth(req: Request, res: Response, next: NextFunction): Promise<void>;
    getWorstProductMonth(req: Request, res: Response, next: NextFunction): Promise<void>;
    getTopProductsInRange(req: Request, res: Response, next: NextFunction): Promise<void>;
    exportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    exportPDF(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=finance.controller.d.ts.map