import prisma from "../prisma";

const DEFAULT_PRICE_PER_KM = Number(process.env.DELIVERY_PRICE_PER_KM ?? 8000);
const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/json";
const ORS_TIMEOUT_MS = Number(process.env.ORS_TIMEOUT_MS ?? 8000);
const DELIVERY_FALLBACK_MULTIPLIER = Number(process.env.DELIVERY_FALLBACK_MULTIPLIER ?? 1.4);

// OpenRouteService no tiene una opción directa de "ruta más larga".
// Entonces pedimos rutas alternativas y elegimos la de mayor distancia.
const ORS_USE_LONGEST_ALTERNATIVE =
  String(process.env.ORS_USE_LONGEST_ALTERNATIVE ?? "true").toLowerCase() !== "false";

type DeliveryRouteSource = "ROUTING_SERVICE" | "COORDINATES_FALLBACK";

type OrsRoutesResponse = {
  routes?: {
    summary?: {
      distance?: number;
      duration?: number;
    };
  }[];
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// El costo de envío se cobra siempre en pesos enteros (igual que el resto de
// los precios del sistema); si se redondeara a centavos, la distancia real
// (con decimales) filtra centavos al total de la venta que después no
// coinciden con lo que se muestra en pantalla (montos siempre en pesos enteros).
function roundMoney(n: number) {
  return Math.round(n);
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function isValidCoordinate(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function haversineKm(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const earthRadiusKm = 6371;

  const dLat = toRad(params.destinationLat - params.originLat);
  const dLng = toRad(params.destinationLng - params.originLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(params.originLat)) *
      Math.cos(toRad(params.destinationLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function buildClientAddress(client: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
}) {
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

function buildLocationAddress(location: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
}) {
  const street = [location.addressStreet, location.addressNumber].filter(Boolean).join(" ");

  const city = [location.addressCity, location.addressProvince, location.addressPostalCode]
    .filter(Boolean)
    .join(", ");

  return [street, city, location.addressNotes].filter(Boolean).join(" - ");
}

function selectOrsRoute(routes?: OrsRoutesResponse["routes"]) {
  const validRoutes = (routes ?? []).filter((route) => {
    const distanceMeters = Number(route.summary?.distance);
    return Number.isFinite(distanceMeters) && distanceMeters > 0;
  });

  if (!validRoutes.length) return null;

  if (!ORS_USE_LONGEST_ALTERNATIVE) {
    return {
      route: validRoutes[0],
      routeIndex: 0,
      alternativesCount: validRoutes.length,
      routeStrategy: "DEFAULT_ROUTE" as const,
      allRoutes: validRoutes,
    };
  }

  let longestRoute = validRoutes[0];
  let longestRouteIndex = 0;

  validRoutes.forEach((route, index) => {
    if (Number(route.summary?.distance) > Number(longestRoute.summary?.distance)) {
      longestRoute = route;
      longestRouteIndex = index;
    }
  });

  return {
    route: longestRoute,
    routeIndex: longestRouteIndex,
    alternativesCount: validRoutes.length,
    routeStrategy: "LONGEST_ALTERNATIVE" as const,
    allRoutes: validRoutes,
  };
}

async function getOrsRoute(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

  try {
    const response = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [params.originLng, params.originLat],
          [params.destinationLng, params.destinationLat],
        ],
        ...(ORS_USE_LONGEST_ALTERNATIVE
          ? {
              alternative_routes: {
                target_count: 3,
                weight_factor: 1.6,
                share_factor: 0.6,
              },
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("OpenRouteService API error:", response.status, text);
      return null;
    }

    const json = (await response.json()) as OrsRoutesResponse;
    const selectedRoute = selectOrsRoute(json.routes);

    if (!selectedRoute) return null;

    const distanceMeters = Number(selectedRoute.route.summary?.distance);

    if (!distanceMeters || !Number.isFinite(distanceMeters)) return null;

    const durationSeconds = Number(selectedRoute.route.summary?.duration);

    const alternatives = selectedRoute.allRoutes.map((route) => {
      const meters = Number(route.summary?.distance);
      const seconds = Number(route.summary?.duration);
      return {
        distanceKm: meters / 1000,
        durationMinutes: Number.isFinite(seconds) ? round2(seconds / 60) : null,
      };
    });

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: Number.isFinite(durationSeconds) ? round2(durationSeconds / 60) : null,
      routeIndex: selectedRoute.routeIndex,
      alternativesCount: selectedRoute.alternativesCount,
      routeStrategy: selectedRoute.routeStrategy,
      alternatives,
    };
  } catch (error) {
    console.error("OpenRouteService API request failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const deliveryService = {
  async calculate(params: {
    businessLocationId: string;
    clientId: string;
    pricePerKm?: number | null;
  }) {
    const pricePerKm = Number(params.pricePerKm ?? DEFAULT_PRICE_PER_KM);

    if (!Number.isFinite(pricePerKm) || pricePerKm <= 0) {
      throw new Error("El precio por km debe ser mayor a 0");
    }

    const [location, client] = await Promise.all([
      prisma.businessLocation.findUnique({
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
      prisma.client.findUnique({
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

    if (!location) throw new Error("Sucursal/depósito no encontrado");

    if (!location.isActive) {
      throw new Error("La sucursal/depósito seleccionada está inactiva");
    }

    if (!client) throw new Error("Cliente no encontrado");

    if (!isValidCoordinate(location.latitude, location.longitude)) {
      throw new Error("La sucursal/depósito no tiene coordenadas válidas cargadas");
    }

    if (!isValidCoordinate(client.latitude, client.longitude)) {
      throw new Error("El cliente no tiene coordenadas válidas cargadas");
    }

    const originLat = Number(location.latitude);
    const originLng = Number(location.longitude);
    const destinationLat = Number(client.latitude);
    const destinationLng = Number(client.longitude);

    const straightDistanceKm = haversineKm({
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    });

    let source: DeliveryRouteSource = "COORDINATES_FALLBACK";
    let durationMinutes: number | null = null;
    let routeIndex: number | null = null;
    let alternativesCount: number | null = null;
    let routeStrategy: "LONGEST_ALTERNATIVE" | "DEFAULT_ROUTE" | "FALLBACK" = "FALLBACK";

    const orsRoute = await getOrsRoute({
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    });

    let distanceKm: number;
    let shortDistanceKm: number;
    let longDistanceKm: number;
    let shortDurationMinutes: number | null = null;
    let longDurationMinutes: number | null = null;

    if (orsRoute) {
      source = "ROUTING_SERVICE";
      distanceKm = orsRoute.distanceKm;
      durationMinutes = orsRoute.durationMinutes;
      routeIndex = orsRoute.routeIndex;
      alternativesCount = orsRoute.alternativesCount;
      routeStrategy = orsRoute.routeStrategy;

      const alternatives = orsRoute.alternatives.length ? orsRoute.alternatives : [
        { distanceKm: orsRoute.distanceKm, durationMinutes: orsRoute.durationMinutes },
      ];

      const shortest = alternatives.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
      const longest = alternatives.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));

      shortDistanceKm = shortest.distanceKm;
      shortDurationMinutes = shortest.durationMinutes;
      longDistanceKm = longest.distanceKm;
      longDurationMinutes = longest.durationMinutes;
    } else {
      const multiplier =
        Number.isFinite(DELIVERY_FALLBACK_MULTIPLIER) && DELIVERY_FALLBACK_MULTIPLIER > 0
          ? DELIVERY_FALLBACK_MULTIPLIER
          : 1.4;

      distanceKm = straightDistanceKm * multiplier;
      shortDistanceKm = straightDistanceKm;
      longDistanceKm = distanceKm;
    }

    const roundedDistanceKm = round2(distanceKm);
    const deliveryCost = roundMoney(roundedDistanceKm * pricePerKm);

    const roundedShortKm = round2(shortDistanceKm);
    const roundedLongKm = round2(longDistanceKm);
    const averageKm = round2((roundedShortKm + roundedLongKm) / 2);

    const options = [
      {
        key: "SHORT" as const,
        label: "Ruta corta",
        distanceKm: roundedShortKm,
        durationMinutes: shortDurationMinutes,
        deliveryCost: roundMoney(roundedShortKm * pricePerKm),
      },
      {
        key: "CALCULATED" as const,
        label: "Ruta calculada",
        distanceKm: roundedDistanceKm,
        durationMinutes,
        deliveryCost,
      },
      {
        key: "LONG" as const,
        label: "Ruta larga",
        distanceKm: roundedLongKm,
        durationMinutes: longDurationMinutes,
        deliveryCost: roundMoney(roundedLongKm * pricePerKm),
      },
    ];

    const average = {
      key: "AVERAGE" as const,
      label: "Promedio",
      distanceKm: averageKm,
      durationMinutes: null,
      deliveryCost: roundMoney(averageKm * pricePerKm),
    };

    const originAddress = buildLocationAddress(location);
    const destinationAddress = buildClientAddress(client);

    return {
      distanceKm: roundedDistanceKm,
      straightDistanceKm: round2(straightDistanceKm),
      durationMinutes,
      pricePerKm,
      deliveryCost,
      source,

      // Info extra para saber qué hizo el backend.
      routeStrategy,
      routeIndex,
      alternativesCount,

      options,
      average,

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
