export declare function nowUTC(): Date;
export declare function parseDateInputAR(value: Date | string | null | undefined): Date | undefined;
export declare function startOfDayAR(date: Date | string): Date;
export declare function endOfDayAR(date: Date | string): Date;
export declare function dayRangeAR(dateStr: string): {
    start: Date;
    end: Date;
};
export declare function rangeAR(from: string, to: string): {
    start: Date;
    end: Date;
};
export declare function optionalRangeAR(from?: string, to?: string): {
    start?: Date;
    end?: Date;
};
export declare function monthRangeAR(year: number, month: number): {
    start: Date;
    end: Date;
};
export declare function yearRangeAR(year: number): {
    start: Date;
    end: Date;
};
export declare function weekRangeAR(year: number, month: number, day: number): {
    start: Date;
    end: Date;
};
export declare function formatDateAR(date: Date | string | null | undefined): string;
export declare function formatTimeAR(date: Date | string | null | undefined): string;
export declare function formatDateTimeAR(date: Date | string | null | undefined): string;
export declare function afipDateAR(date?: Date | string): string;
//# sourceMappingURL=dateAR.d.ts.map