export declare const ticketService: {
    printSaleTicket(saleId: string): Promise<{
        payload: {
            saleId: string;
            receiptType: string;
            paymentMethod: any;
            createdAt: string;
            business: {
                name: string;
                subtitle: string;
                cuit: string;
                address: string;
                phone: string;
            };
            client: {
                name: string;
                dni: string;
                phone: string;
            };
            items: any;
            subtotal: number;
            discount: number;
            total: number;
            footer: string;
        };
        posResponse: any;
    }>;
};
//# sourceMappingURL=ticket.service.d.ts.map