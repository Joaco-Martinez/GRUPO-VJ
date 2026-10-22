import { Request, Response } from "express";
export declare const productStatsController: {
    getTop(req: Request, res: Response): Promise<void>;
    getWorst(req: Request, res: Response): Promise<void>;
    getTopRange(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWorstRange(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getBestMonth(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWorstMonth(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTotals(req: Request, res: Response): Promise<void>;
    getTotalsRange(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=productStast.controller.d.ts.map