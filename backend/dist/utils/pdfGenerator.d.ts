import { Sale, SaleItem, Product, User } from "@prisma/client";
type SaleWithRelations = Sale & {
    items: (SaleItem & {
        product: Product;
    })[];
    user?: User | null;
};
export declare function generateInvoicePDF(sale: SaleWithRelations): Promise<string>;
export {};
//# sourceMappingURL=pdfGenerator.d.ts.map