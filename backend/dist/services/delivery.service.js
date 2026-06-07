"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const DEFAULT_PRICE_PER_KM = Number(process.env.DELIVERY_PRICE_PER_KM ?? 8000);
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
function toRad(value) {
    return (value * Math.PI) / 180;
}
function haversineKm(params) {
    const earthRadiusKm = 6371;
    const dLat = toRad(params.destinationLat - params.originLat);
    const dLng = toRad(params.destinationLng - params.originLng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(params.originLat)) *
            Math.cos(toRad(params.destinationLat)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
}
function buildClientAddress(client) {
    const street = [client.addressStreet, client.addressNumber].filter(Boolean).join(" ");
    const floor = [
        client.addressFloor ? `Piso ${client.addressFloor}` : "",
        client.addressApartment ? `Dto ${client.addressApartment}` : "",
    ]
        .filter(Boolean)
        .join(" ");
    const city = [client.addressCity, client.addressProvince, client.addressPostalCode]
        .filter(Boolean)
        .join(", ");
    return [street, floor, city, client.addressNotes].filter(Boolean).join(" - ");
}
function buildLocationAddress(location) {
    const street = [location.addressStreet, location.addressNumber].filter(Boolean).join(" ");
    const city = [location.addressCity, location.addressProvince, location.addressPostalCode]
        .filter(Boolean)
        .join(", ");
    return [street, city, location.addressNotes].filter(Boolean).join(" - ");
}
async function getGoogleRouteDistanceKm(params) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey)
        return null;
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.distanceMeters",
        },
        body: JSON.stringify({
            origin: {
                location: {
                    latLng: {
                        latitude: params.originLat,
                        longitude: params.originLng,
                    },
                },
            },
            destination: {
                location: {
                    latLng: {
                        latitude: params.destinationLat,
                        longitude: params.destinationLng,
                    },
                },
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
        }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Google Routes API error:", response.status, text);
        return null;
    }
    const json = (await response.json());
    const distanceMeters = json.routes?.[0]?.distanceMeters;
    if (!distanceMeters || !Number.isFinite(distanceMeters)) {
        return null;
    }
    return distanceMeters / 1000;
}
exports.deliveryService = {
    async calculate(params) {
        const pricePerKm = Number(params.pricePerKm ?? DEFAULT_PRICE_PER_KM);
        if (!Number.isFinite(pricePerKm) || pricePerKm <= 0) {
            throw new Error("El precio por km debe ser mayor a 0");
        }
        const [location, client] = await Promise.all([
            prisma_1.default.businessLocation.findUnique({
                where: { id: params.businessLocationId },
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    addressStreet: true,
                    addressNumber: true,
                    addressCity: true,
                    addressProvince: true,
                    addressPostalCode: true,
                    addressNotes: true,
                    latitude: true,
                    longitude: true,
                },
            }),
            prisma_1.default.client.findUnique({
                where: { id: params.clientId },
                select: {
                    id: true,
                    nombre: true,
                    apellido: true,
                    addressStreet: true,
                    addressNumber: true,
                    addressFloor: true,
                    addressApartment: true,
                    addressCity: true,
                    addressProvince: true,
                    addressPostalCode: true,
                    addressNotes: true,
                    latitude: true,
                    longitude: true,
                },
            }),
        ]);
        if (!location) {
            throw new Error("Sucursal/depósito no encontrado");
        }
        if (!location.isActive) {
            throw new Error("La sucursal/depósito seleccionada está inactiva");
        }
        if (!client) {
            throw new Error("Cliente no encontrado");
        }
        if (location.latitude === null ||
            location.latitude === undefined ||
            location.longitude === null ||
            location.longitude === undefined) {
            throw new Error("La sucursal/depósito no tiene coordenadas cargadas");
        }
        if (client.latitude === null ||
            client.latitude === undefined ||
            client.longitude === null ||
            client.longitude === undefined) {
            throw new Error("El cliente no tiene coordenadas cargadas");
        }
        let source = "COORDINATES_FALLBACK";
        let distanceKm = await getGoogleRouteDistanceKm({
            originLat: location.latitude,
            originLng: location.longitude,
            destinationLat: client.latitude,
            destinationLng: client.longitude,
        });
        if (distanceKm !== null) {
            source = "GOOGLE_ROUTES";
        }
        else {
            distanceKm = haversineKm({
                originLat: location.latitude,
                originLng: location.longitude,
                destinationLat: client.latitude,
                destinationLng: client.longitude,
            });
        }
        const roundedDistanceKm = round2(distanceKm);
        const deliveryCost = round2(roundedDistanceKm * pricePerKm);
        const originAddress = buildLocationAddress(location);
        const destinationAddress = buildClientAddress(client);
        return {
            distanceKm: roundedDistanceKm,
            pricePerKm,
            deliveryCost,
            source,
            businessLocationId: location.id,
            businessLocationName: location.name,
            clientId: client.id,
            clientName: `${client.nombre} ${client.apellido}`.trim(),
            originAddress,
            destinationAddress,
            deliveryAddressSnapshot: destinationAddress,
        };
    },
};
//# sourceMappingURL=delivery.service.js.map