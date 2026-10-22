type DeliveryRouteSource = "ROUTING_SERVICE" | "COORDINATES_FALLBACK";
export declare const deliveryService: {
    calculate(params: {
        businessLocationId: string;
        clientId: string;
        pricePerKm?: number | null;
    }): Promise<{
        distanceKm: number;
        straightDistanceKm: number;
        durationMinutes: number | null;
        pricePerKm: number;
        deliveryCost: number;
        source: DeliveryRouteSource;
        routeStrategy: "DEFAULT_ROUTE" | "LONGEST_ALTERNATIVE" | "FALLBACK";
        routeIndex: number | null;
        alternativesCount: number | null;
        options: ({
            key: "SHORT";
            label: string;
            distanceKm: number;
            durationMinutes: number | null;
            deliveryCost: number;
        } | {
            key: "CALCULATED";
            label: string;
            distanceKm: number;
            durationMinutes: number | null;
            deliveryCost: number;
        } | {
            key: "LONG";
            label: string;
            distanceKm: number;
            durationMinutes: number | null;
            deliveryCost: number;
        })[];
        average: {
            key: "AVERAGE";
            label: string;
            distanceKm: number;
            durationMinutes: null;
            deliveryCost: number;
        };
        businessLocationId: string;
        businessLocationName: string;
        clientId: string;
        clientName: string;
        originAddress: string;
        destinationAddress: string;
        deliveryAddressSnapshot: string;
    }>;
};
export {};
//# sourceMappingURL=delivery.service.d.ts.map