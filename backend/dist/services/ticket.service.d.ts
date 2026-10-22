export declare const ticketService: {
    printSaleTicket(saleId: string): Promise<{
        payload: {
            paymentMethod: any;
            createdAt: string;
            sellerName: any;
            userName: any;
            seller: {
                id: any;
                name: any;
                email: any;
            };
            user: {
                id: any;
                name: any;
                email: any;
            };
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
                addressStreet: string;
                addressNumber: string;
                addressFloor: string;
                addressApartment: string;
                city: string;
                province: string;
                postalCode: string;
                fullAddress: string;
            };
            shipping: {
                method: string;
                status: string;
                receiverName: string;
                receiverPhone: string;
                fullAddress: string;
                street: string;
                number: string;
                floor: string;
                apartment: string;
                city: string;
                province: string;
                postalCode: string;
                notes: string;
            } | undefined;
            delivery: {
                method: string;
                status: string;
                receiverName: string;
                receiverPhone: string;
                fullAddress: string;
                street: string;
                number: string;
                floor: string;
                apartment: string;
                city: string;
                province: string;
                postalCode: string;
                notes: string;
            } | undefined;
            items: any;
            subtotal: number;
            discount: number;
            total: number;
            footer: string;
            cae?: any;
            caeVto?: string | undefined;
            puntoVenta?: any;
            numeroComprobante?: any;
            tipoComprobante?: any;
            urlQR?: any;
            saleId: string;
            receiptType: string;
            fiscal: boolean;
        };
        posResponse: any;
    }>;
};
//# sourceMappingURL=ticket.service.d.ts.map