export declare const deliveryService: {
    calculate(params: {
        businessLocationId: string;
        clientId: string;
        pricePerKm?: number | null;
    }): Promise<{
        distanceKm: number;
        pricePerKm: number;
        deliveryCost: number;
        source: "GOOGLE_ROUTES" | "COORDINATES_FALLBACK";
        businessLocationId: string;
        businessLocationName: string;
        clientId: string;
        clientName: string;
        originAddress: string;
        destinationAddress: string;
        deliveryAddressSnapshot: string;
    }>;
};
//# sourceMappingURL=delivery.service.d.ts.map