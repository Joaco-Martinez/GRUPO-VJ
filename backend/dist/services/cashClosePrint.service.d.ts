type CashClosePrintBody = {
    date: string;
} | {
    from: string;
    to: string;
};
export declare function printCashClose(body: CashClosePrintBody): Promise<{
    ok: boolean;
    start: Date;
    end: Date;
    totalAmount: number;
    totalCount: number;
    byMethod: {
        methodCode: string;
        amount: number;
        count: number;
    }[];
}>;
export {};
//# sourceMappingURL=cashClosePrint.service.d.ts.map