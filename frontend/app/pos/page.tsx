/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type {
  BusinessLocation,
  CartItem,
  Client,
  DiscountType,
  PaymentMethod,
  Product,
  ProductCategory,
  ReceiptType,
  SalePayment,
} from "@/types";
import {
  categoryName,
  clientName,
  fmtMoney,
  normalizeArray,
  num,
  productPrice,
} from "@/lib/helpers";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

const methods: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "DEBITO",
  "CREDITO",
  "QR",
  "QR_MERCADOPAGO",
  "QR_NACION",
  "CUENTA_CORRIENTE",
];

type StockLocation = "LOCAL" | "DEPOSITO";
type DeliveryMode = "PICKUP" | "LOCAL_DELIVERY";
type ProductSortMode = "name-asc" | "name-desc" | "category-asc" | "category-desc";

type DeliveryCalculation = {
  distanceKm: number;
  pricePerKm: number;
  deliveryCost: number;
  source?: "GOOGLE_ROUTES" | "COORDINATES_FALLBACK";
  businessLocationId: string;
  businessLocationName: string;
  clientId: string;
  clientName: string;
  originAddress?: string;
  destinationAddress?: string;
  deliveryAddressSnapshot?: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const DELIVERY_SKU = "ENVIO-FLETE2";
const POS_SKU_SCANNER_ELEMENT_ID = "grupo-vj-pos-sku-scanner";

function stockLocationLabel(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "Minorista" : "Mayorista";
}

function stockLocationLabelLower(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "minorista" : "mayorista";
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compareText(a?: string | null, b?: string | null) {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function isDeliveryProduct(product?: Product | null) {
  if (!product) return false;
  return normalizeText(product.sku) === DELIVERY_SKU;
}

function getProductImageUrl(product?: Product | null) {
  if (!product) return null;
  const imageUrl = (product as Product & { imageUrl?: string | null }).imageUrl;
  return imageUrl?.trim() || null;
}

type ProductComponentForPOS = {
  id?: string;
  componentId?: string | null;
  quantity?: number | null;
  quantityKg?: number | null;
  component?: Product | null;
};

type ProductWithComponents = Product & {
  components?: ProductComponentForPOS[] | null;
};

function isCompositeProduct(product?: Product | null) {
  return product?.type === "COMPUESTO";
}

function getCompositeComponents(product?: Product | null) {
  return ((product as ProductWithComponents | null)?.components ?? []).filter(
    (component) => component?.component,
  );
}

function isStockControlledProduct(product?: Product | null) {
  if (!product) return false;
  if (isDeliveryProduct(product)) return false;
  if (product.isService) return false;
  return true;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.error ??
    fallback
  );
}

function productRawStockByLocation(product: Product, stockLocation: StockLocation) {
  if (product.saleUnit === "KG") {
    return stockLocation === "DEPOSITO"
      ? num(product.stockDepositoKg)
      : num(product.stockLocalKg);
  }

  return stockLocation === "DEPOSITO"
    ? num(product.stockDeposito)
    : num(product.stockLocal);
}

function getComponentNeededQty(componentRelation: ProductComponentForPOS) {
  const componentProduct = componentRelation.component;
  if (!componentProduct) return 0;

  if (componentProduct.saleUnit === "KG") {
    return num(
      componentRelation.quantityKg ?? undefined,
      componentRelation.quantity ?? undefined,
    );
  }

  return num(
    componentRelation.quantity ?? undefined,
    componentRelation.quantityKg ?? undefined,
  );
}

function productStockByLocation(product: Product, stockLocation: StockLocation) {
  if (isDeliveryProduct(product)) return 999999;
  if (product.isService) return 999999;

  if (isCompositeProduct(product)) {
    const components = getCompositeComponents(product);
    if (!components.length) return 0;

    const availableByComponent = components.map((componentRelation) => {
      const componentProduct = componentRelation.component;
      if (!componentProduct) return 0;

      const neededQty = getComponentNeededQty(componentRelation);
      if (neededQty <= 0) return 0;

      const componentStock = productRawStockByLocation(
        componentProduct,
        stockLocation,
      );

      return Math.floor(componentStock / neededQty);
    });

    return Math.max(0, Math.min(...availableByComponent));
  }

  return productRawStockByLocation(product, stockLocation);
}

function stockLabel(product: Product, stockLocation: StockLocation) {
  if (isDeliveryProduct(product)) return "envío / servicio";
  if (product.isService) return "servicio";

  if (isCompositeProduct(product)) {
    const availablePromos = productStockByLocation(product, stockLocation);
    return `${availablePromos} promo${availablePromos === 1 ? "" : "s"}`;
  }

  const stock = productStockByLocation(product, stockLocation);
  return product.saleUnit === "KG" ? `${stock} kg` : `${stock}`;
}

function getItemPrice(item: CartItem, selectedPriceType: CartItem["priceType"]) {
  return num(
    item.manualPrice,
    productPrice(item.product, item.priceType || selectedPriceType),
  );
}

function clientHasCoordinates(client?: Client | null) {
  return (
    client?.latitude !== null &&
    client?.latitude !== undefined &&
    client?.longitude !== null &&
    client?.longitude !== undefined
  );
}

function locationHasCoordinates(location?: BusinessLocation | null) {
  return (
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location?.longitude !== null &&
    location?.longitude !== undefined
  );
}

function buildClientAddress(client?: Client | null) {
  if (!client) return "";

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

function clientCategoryLabel(category?: string | null) {
  if (category === "Mayorista") return "Mayorista";
  return "Minorista";
}

function cartItemCounterLabel(item?: CartItem | null) {
  if (!item) return "";

  if (item.product.saleUnit === "KG") {
    const kg = num(item.quantityKg);
    return `${kg.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} kg`;
  }

  return String(item.quantity);
}

async function fetchPosData() {
  const [p, c, cl, bl] = await Promise.all([
    api.get("/products"),
    api.get("/categories"),
    api.get("/clients"),
    api.get("/business-locations"),
  ]);

  const products = normalizeArray<Product>(p.data).filter((x) => x.isActive !== false);
  const categories = normalizeArray<ProductCategory>(c.data);
  const clients = normalizeArray<Client>(cl.data);
  const businessLocations = normalizeArray<BusinessLocation>(bl.data);

  return { products, categories, clients, businessLocations };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortMode, setSortMode] = useState<ProductSortMode>("name-asc");
  const [clientId, setClientId] = useState("");
  const [stockLocation, setStockLocation] = useState<StockLocation>("LOCAL");

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("PICKUP");
  const [businessLocationId, setBusinessLocationId] = useState("");
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState("618");
  const [deliveryCalculation, setDeliveryCalculation] = useState<DeliveryCalculation | null>(null);
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);

  const [receiptType, setReceiptType] = useState<ReceiptType>("TICKET");
  const [discountType, setDiscountType] = useState<DiscountType | "">("");
  const [discountValue, setDiscountValue] = useState("");

  const [paymentMode, setPaymentMode] = useState<"single" | "multi">("single");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [payments, setPayments] = useState<SalePayment[]>([
    { method: "EFECTIVO", amount: 0 },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(36);
  const [mounted, setMounted] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  const [skuScannerOpen, setSkuScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerLoading, setScannerLoading] = useState(false);
  const scannerInstanceRef = useRef<any>(null);
  const scannerHandledRef = useRef(false);

  useEffect(() => {
    setMounted(true);

    const media = window.matchMedia("(max-width: 767px)");
    const syncMobileView = () => setIsMobileView(media.matches);

    syncMobileView();
    media.addEventListener("change", syncMobileView);

    return () => media.removeEventListener("change", syncMobileView);
  }, []);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchPosData();

      setProducts(data.products);
      setCategories(data.categories);
      setClients(data.clients);
      setBusinessLocations(data.businessLocations);

      const defaultLocation =
        data.businessLocations.find((x) => x.isDefault) ?? data.businessLocations[0];

      if (defaultLocation) {
        setBusinessLocationId((prev) => prev || defaultLocation.id);
      }

      if (showSuccess) toast.success("POS actualizado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos del POS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchPosData()
      .then((data) => {
        if (!alive) return;

        setProducts(data.products);
        setCategories(data.categories);
        setClients(data.clients);
        setBusinessLocations(data.businessLocations);

        const defaultLocation =
          data.businessLocations.find((x) => x.isDefault) ?? data.businessLocations[0];

        if (defaultLocation) setBusinessLocationId((prev) => prev || defaultLocation.id);
      })
      .catch((e) => {
        console.error(e);
        if (alive) toast.error("Error al cargar datos del POS");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const selectedBusinessLocation =
    businessLocations.find((location) => location.id === businessLocationId) ?? null;

  const deliveryProduct = useMemo(
    () => products.find((p) => isDeliveryProduct(p)),
    [products],
  );

  const priceType: CartItem["priceType"] =
    selectedClient?.category === "Mayorista" ? "wholesalePrice" : "price";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = products.filter((p) => {
      if (p.isService) return false;
      if (isDeliveryProduct(p)) return false;

      return (
        (!q ||
          p.name.toLowerCase().includes(q) ||
          String(p.sku ?? "").toLowerCase().includes(q)) &&
        (!categoryId || p.categoryId === categoryId)
      );
    });

    return [...result].sort((a, b) => {
      if (sortMode === "name-asc") return compareText(a.name, b.name);
      if (sortMode === "name-desc") return compareText(b.name, a.name);

      if (sortMode === "category-asc") {
        const byCategory = compareText(categoryName(a), categoryName(b));
        return byCategory || compareText(a.name, b.name);
      }

      if (sortMode === "category-desc") {
        const byCategory = compareText(categoryName(b), categoryName(a));
        return byCategory || compareText(a.name, b.name);
      }

      return 0;
    });
  }, [products, search, categoryId, sortMode]);

  useEffect(() => {
    setVisibleCount(36);
  }, [search, categoryId, sortMode, stockLocation]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const selectedCategoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "Todos";

  const cartUnits = cart.reduce((acc, item) => {
    if (item.product.saleUnit === "KG") return acc + 1;
    return acc + item.quantity;
  }, 0);

  const cartPreview = cart.slice(0, 3);

  const getCartStockRequirements = (items: CartItem[]) => {
    const requirements = new Map<string, { product: Product; required: number }>();

    const addRequirement = (product: Product, required: number) => {
      if (required <= 0) return;
      const current = requirements.get(product.id);
      requirements.set(product.id, {
        product,
        required: (current?.required ?? 0) + required,
      });
    };

    for (const item of items) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) continue;

      const itemQty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
      if (itemQty <= 0) continue;

      if (isCompositeProduct(item.product)) {
        const components = getCompositeComponents(item.product);

        for (const componentRelation of components) {
          const componentProduct = componentRelation.component;
          if (!componentProduct) continue;

          const neededPerPromo = getComponentNeededQty(componentRelation);
          addRequirement(componentProduct, neededPerPromo * itemQty);
        }

        continue;
      }

      addRequirement(item.product, itemQty);
    }

    return requirements;
  };

  const validateCartStockItems = (items: CartItem[]) => {
    const requirements = getCartStockRequirements(items);

    for (const requirement of requirements.values()) {
      const available = productRawStockByLocation(requirement.product, stockLocation);

      if (requirement.required > available) {
        toast.error(
          `Stock insuficiente para ${requirement.product.name} en ${stockLocationLabelLower(stockLocation)}. Disponible: ${available}${requirement.product.saleUnit === "KG" ? " kg" : ""}`,
        );
        return false;
      }
    }

    return true;
  };

  const buildCartWithProduct = (product: Product) => {
    const exists = cart.find((i) => i.product.id === product.id);

    if (exists) {
      return cart.map((i) => {
        if (i.product.id !== product.id) return i;
        if (product.saleUnit === "KG") return i;
        return { ...i, quantity: i.quantity + 1 };
      });
    }

    return [
      ...cart,
      {
        product,
        quantity: product.saleUnit === "KG" ? 0 : 1,
        quantityKg: product.saleUnit === "KG" ? 0.1 : undefined,
        priceType,
      },
    ];
  };

  const add = (product: Product) => {
    const stock = productStockByLocation(product, stockLocation);

    if (isStockControlledProduct(product) && stock <= 0) {
      toast.error(
        isCompositeProduct(product)
          ? `No se puede agregar la promo porque faltan componentes en ${stockLocationLabelLower(stockLocation)}`
          : stockLocation === "DEPOSITO"
            ? "Sin stock disponible en minorista"
            : "Sin stock disponible en mayorista",
      );
      return;
    }

    const nextCart = buildCartWithProduct(product);
    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  };

  const stopSkuScanner = async () => {
    const scanner = scannerInstanceRef.current;
    scannerHandledRef.current = false;
    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 2) await scanner.stop();
    } catch (e) {
      console.warn("No se pudo detener el scanner POS", e);
    }

    try {
      await scanner.clear?.();
    } catch {
      // html5-qrcode puede tirar error si el contenedor ya fue desmontado.
    }

    scannerInstanceRef.current = null;
  };

  const closeSkuScanner = async () => {
    await stopSkuScanner();
    setScannerError("");
    setScannerLoading(false);
    setSkuScannerOpen(false);
  };

  const openSkuScanner = () => {
    setScannerError("");
    setScannerLoading(true);
    scannerHandledRef.current = false;
    setSkuScannerOpen(true);
  };

  const handleScannedSku = async (rawSku: string) => {
    const sku = rawSku.trim();
    if (!sku || scannerHandledRef.current) return;

    scannerHandledRef.current = true;

    const product = products.find((p) => normalizeText(p.sku) === normalizeText(sku));

    if (!product) {
      scannerHandledRef.current = false;
      setScannerError(`No encontré ningún producto con SKU: ${sku}`);
      return;
    }

    if (product.isService || isDeliveryProduct(product)) {
      scannerHandledRef.current = false;
      setScannerError("Ese SKU pertenece a un servicio/envío y no se agrega desde el scanner.");
      return;
    }

    add(product);
    await closeSkuScanner();
  };

  useEffect(() => {
    if (!skuScannerOpen) return;

    let cancelled = false;

    const startScanner = async () => {
      setScannerLoading(true);
      setScannerError("");

      try {
        if (typeof window === "undefined") return;
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(POS_SKU_SCANNER_ELEMENT_ID);
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return {
                width: Math.max(220, Math.min(size, 340)),
                height: Math.max(120, Math.min(Math.floor(size * 0.55), 220)),
              };
            },
            aspectRatio: 1.777,
          },
          async (decodedText: string) => {
            await handleScannedSku(decodedText);
          },
          () => {
            // Ignoramos lecturas fallidas mientras sigue buscando.
          },
        );

        if (!cancelled) setScannerLoading(false);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setScannerLoading(false);
          setScannerError(
            e?.message?.includes("Permission")
              ? "No se pudo acceder a la cámara. Revisá los permisos del navegador."
              : "No se pudo iniciar la cámara. Probá con HTTPS, otro navegador o buscá el SKU manualmente.",
          );
        }
      }
    };

    const timeoutId = window.setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      void stopSkuScanner();
    };
  }, [skuScannerOpen, products, stockLocation, cart, priceType]);

  const setQty = (id: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (i.product.id !== id) return i;

      if (i.isDeliveryItem || isDeliveryProduct(i.product) || i.product.isService) {
        return { ...i, quantity: 1 };
      }

      return { ...i, quantity: Math.max(1, value) };
    });

    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  };

  const setKg = (id: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (i.product.id !== id) return i;
      return { ...i, quantityKg: Math.max(0.001, value) };
    });

    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  };

  const remove = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));

    if (deliveryProduct?.id === id) {
      setDeliveryCalculation(null);
      setDeliveryMode("PICKUP");
    }
  };

  const removeDeliveryFromCart = () => {
    if (!deliveryProduct) return;
    setCart((prev) => prev.filter((i) => i.product.id !== deliveryProduct.id));
    setDeliveryCalculation(null);
  };

  const applyDeliveryToCart = (calculation: DeliveryCalculation) => {
    if (!deliveryProduct) {
      toast.error(`No encontré el producto ${DELIVERY_SKU}. Creá primero el producto ENVÍO / FLETE.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === deliveryProduct.id);

      if (existing) {
        return prev.map((i) =>
          i.product.id === deliveryProduct.id
            ? {
                ...i,
                quantity: 1,
                quantityKg: undefined,
                manualPrice: calculation.deliveryCost,
                priceType: "price",
                isDeliveryItem: true,
              }
            : i,
        );
      }

      return [
        ...prev,
        {
          product: deliveryProduct,
          quantity: 1,
          quantityKg: undefined,
          priceType: "price",
          manualPrice: calculation.deliveryCost,
          isDeliveryItem: true,
        },
      ];
    });
  };

  const calculateDelivery = async () => {
    if (deliveryMode !== "LOCAL_DELIVERY") return;

    if (!clientId || !selectedClient) {
      toast.error("Seleccioná un cliente para calcular el envío");
      return;
    }

    if (!clientHasCoordinates(selectedClient)) {
      toast.error("El cliente seleccionado no tiene coordenadas cargadas");
      return;
    }

    if (!businessLocationId || !selectedBusinessLocation) {
      toast.error("Seleccioná la sucursal o ubicación de salida");
      return;
    }

    if (!locationHasCoordinates(selectedBusinessLocation)) {
      toast.error("La ubicación de salida no tiene coordenadas cargadas");
      return;
    }

    const pricePerKm = num(deliveryPricePerKm);
    if (pricePerKm <= 0) {
      toast.error("El precio por km debe ser mayor a 0");
      return;
    }

    setCalculatingDelivery(true);
    const toastId = toast.loading("Calculando envío...");

    try {
      const response = await api.post("/delivery/calculate", {
        businessLocationId,
        clientId,
        pricePerKm,
      });

      const calculation: DeliveryCalculation = {
        distanceKm: num(response.data.distanceKm),
        pricePerKm: num(response.data.pricePerKm),
        deliveryCost: num(response.data.deliveryCost),
        source: response.data.source,
        businessLocationId: response.data.businessLocationId,
        businessLocationName: response.data.businessLocationName,
        clientId: response.data.clientId,
        clientName: response.data.clientName,
        originAddress: response.data.originAddress,
        destinationAddress: response.data.destinationAddress,
        deliveryAddressSnapshot: response.data.deliveryAddressSnapshot,
      };

      setDeliveryCalculation(calculation);
      applyDeliveryToCart(calculation);
      toast.success(
        `Envío calculado: ${calculation.distanceKm} km · ${fmtMoney(calculation.deliveryCost)}`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo calcular el envío"), { id: toastId });
    } finally {
      setCalculatingDelivery(false);
    }
  };

  const productsSubtotal = cart.reduce((a, item) => {
    if (item.isDeliveryItem || isDeliveryProduct(item.product)) return a;
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    return a + getItemPrice(item, priceType) * qty;
  }, 0);

  const deliveryLineSubtotal = cart.reduce((a, item) => {
    if (!item.isDeliveryItem && !isDeliveryProduct(item.product)) return a;
    return a + num(item.manualPrice, getItemPrice(item, priceType));
  }, 0);

  const deliveryCostForTotal =
    deliveryMode === "LOCAL_DELIVERY"
      ? Math.max(num(deliveryCalculation?.deliveryCost), deliveryLineSubtotal)
      : 0;

  const subtotal = productsSubtotal;
  const discount =
    discountType === "PERCENTAGE"
      ? productsSubtotal * (num(discountValue) / 100)
      : discountType === "FIXED"
        ? num(discountValue)
        : 0;

  const total = Math.max(0, productsSubtotal - discount + deliveryCostForTotal);
  const paid =
    paymentMode === "multi"
      ? payments.filter((p) => p.method !== "CUENTA_CORRIENTE").reduce((a, p) => a + num(p.amount), 0)
      : paymentMethod === "CUENTA_CORRIENTE"
        ? 0
        : total;
  const debt = Math.max(0, total - paid);

  const validateCartStock = () => {
    for (const item of cart) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) continue;

      const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;

      if (qty <= 0) {
        toast.error(`Cantidad inválida para ${item.product.name}`);
        return false;
      }

      if (isCompositeProduct(item.product) && !getCompositeComponents(item.product).length) {
        toast.error(`La promo ${item.product.name} no tiene componentes configurados`);
        return false;
      }
    }

    return validateCartStockItems(cart);
  };

  const validateSale = () => {
    if (!cart.length) {
      toast.error("Agregá productos al carrito");
      return false;
    }

    if (!validateCartStock()) return false;

    if ((paymentMethod === "CUENTA_CORRIENTE" || debt > 0) && !clientId) {
      toast.error("Para cuenta corriente o pago parcial tenés que seleccionar cliente");
      return false;
    }

    if (deliveryMode === "LOCAL_DELIVERY") {
      if (!clientId) {
        toast.error("Para envío tenés que seleccionar cliente");
        return false;
      }

      if (!businessLocationId) {
        toast.error("Seleccioná la sucursal o ubicación de salida");
        return false;
      }

      if (!deliveryCalculation) {
        toast.error("Calculá el envío antes de finalizar la venta");
        return false;
      }

      if (!deliveryProduct) {
        toast.error(`No encontré el producto ${DELIVERY_SKU}`);
        return false;
      }

      if (deliveryCostForTotal <= 0) {
        toast.error("El costo de envío debe ser mayor a 0");
        return false;
      }
    }

    return true;
  };

  const submitSale = async () => {
    if (!validateSale()) return;

    setSubmitting(true);
    const toastId = toast.loading("Registrando venta...");

    try {
      const payload = {
        clientId: clientId || undefined,
        stockLocation,
        paymentMethod,
        receiptType,
        discountType: discountType || undefined,
        discountValue: discountType ? num(discountValue) : undefined,
        businessLocationId:
          deliveryMode === "LOCAL_DELIVERY" ? businessLocationId : businessLocationId || null,
        deliveryMethod: deliveryMode,
        deliveryStatus: deliveryMode === "LOCAL_DELIVERY" ? "PENDING" : "NONE",
        deliveryAddressSnapshot:
          deliveryMode === "LOCAL_DELIVERY"
            ? deliveryCalculation?.deliveryAddressSnapshot ||
              deliveryCalculation?.destinationAddress ||
              buildClientAddress(selectedClient)
            : null,
        deliveryDistanceKm: deliveryMode === "LOCAL_DELIVERY" ? deliveryCalculation?.distanceKm : null,
        deliveryPricePerKm: deliveryMode === "LOCAL_DELIVERY" ? num(deliveryPricePerKm) : null,
        deliveryCost: deliveryMode === "LOCAL_DELIVERY" ? deliveryCostForTotal : 0,
        items: [
          ...cart
            .filter((i) => !i.isDeliveryItem && !isDeliveryProduct(i.product))
            .map((i) => ({
              productId: i.product.id,
              quantity: i.product.saleUnit === "KG" ? undefined : i.quantity,
              quantityKg: i.product.saleUnit === "KG" ? num(i.quantityKg) : undefined,
              price: getItemPrice(i, priceType),
            })),
          ...(deliveryMode === "LOCAL_DELIVERY" && deliveryProduct && deliveryCostForTotal > 0
            ? [
                {
                  productId: deliveryProduct.id,
                  quantity: 1,
                  quantityKg: undefined,
                  price: deliveryCostForTotal,
                },
              ]
            : []),
        ],
        payments:
          paymentMode === "multi"
            ? payments
                .filter((p) => p.amount > 0 || p.method === "CUENTA_CORRIENTE")
                .map((p) => ({
                  method: p.method,
                  amount: p.method === "CUENTA_CORRIENTE" ? debt : num(p.amount),
                  reference: p.reference,
                  notes: p.notes,
                }))
            : undefined,
      };

      console.log("🧾 Payload venta POS:", payload);
      await api.post("/sales", payload);

      setCart([]);
      setPayments([{ method: "EFECTIVO", amount: 0 }]);
      setDeliveryMode("PICKUP");
      setDeliveryCalculation(null);

      toast.success("Venta registrada correctamente", { id: toastId });
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al registrar venta"), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitConfirm = () => {
    if (!validateSale()) return;

    setConfirmModal({
      title: "Finalizar venta",
      message: `¿Confirmás registrar esta venta por ${fmtMoney(total)}?${debt > 0 ? ` Quedará en cuenta corriente: ${fmtMoney(debt)}.` : ""}`,
      confirmText: "Finalizar venta",
      danger: false,
      onConfirm: submitSale,
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const addPayment = () => {
    setPayments((prev) => [...prev, { method: "TRANSFERENCIA", amount: 0 }]);
  };

  const renderProductCard = (product: Product, mobile = false) => {
    const stock = productStockByLocation(product, stockLocation);
    const withoutStock = isStockControlledProduct(product) && stock <= 0;
    const imageUrl = getProductImageUrl(product);
    const cartItem = cart.find((item) => item.product.id === product.id);
    const cartQty = cartItem?.product.saleUnit === "KG" ? num(cartItem.quantityKg) : (cartItem?.quantity ?? 0);
    const cartQtyLabel = cartItemCounterLabel(cartItem);

    return (
      <button
        key={product.id}
        type="button"
        className={mobile ? `pos-product ${withoutStock ? "disabled" : ""}` : "card pos-product-card"}
        onClick={() => add(product)}
        disabled={withoutStock}
      >
        <span className={mobile ? "pos-product-img" : "pos-product-image"}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Package size={mobile ? 24 : 28} />
          )}
          {cartQty > 0 && <span className="pos-added-pill">x{cartQtyLabel}</span>}
        </span>

        {mobile ? (
          <span className="pos-product-info">
            <span className="pos-product-top">
              <span className={product.type === "COMPUESTO" ? "promo" : ""}>
                {product.type === "COMPUESTO" ? "PROMO" : product.saleUnit}
              </span>
              <span className={withoutStock ? "danger" : ""}>
                {withoutStock ? "Sin stock" : stockLabel(product, stockLocation)}
              </span>
            </span>
            <strong>{product.name}</strong>
            <small>{product.sku ?? "SIN-SKU"}</small>
            <b>
              {fmtMoney(productPrice(product, priceType))}
              {product.saleUnit === "KG" ? "/kg" : ""}
            </b>
          </span>
        ) : (
          <>
            <div className="pos-product-meta">
              <span className={`badge ${product.type === "COMPUESTO" ? "badge-blue" : "badge-gray"}`}>
                {product.type === "COMPUESTO" ? "PROMO" : product.saleUnit}
              </span>
              <span className={withoutStock ? "danger" : "muted"}>
                {withoutStock ? "SIN STOCK" : stockLabel(product, stockLocation)}
              </span>
            </div>
            <b className="pos-product-title">{product.name}</b>
            <span className="muted small">{categoryName(product)} · {product.sku ?? "SIN-SKU"}</span>
            <strong className="price">
              {fmtMoney(productPrice(product, priceType))}
              {product.saleUnit === "KG" ? "/kg" : ""}
            </strong>
            {cartQty > 0 && (
              <span className="badge badge-blue pos-card-counter">
                En carrito: {cartQtyLabel}
              </span>
            )}
            <span className={withoutStock ? "danger small" : "muted small"}>
              Stock {stockLocationLabelLower(stockLocation)}: {stockLabel(product, stockLocation)}
            </span>
          </>
        )}
      </button>
    );
  };

  const renderCartItem = (item: CartItem, compact = false) => {
    const itemPrice = getItemPrice(item, priceType);
    const imageUrl = getProductImageUrl(item.product);
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    const lineTotal = itemPrice * qty;

    return (
      <article key={item.product.id} className={compact ? "pos-cart-item" : "pos-cart-row"}>
        <div className="pos-cart-item-img">
          {imageUrl ? (
            <img src={imageUrl} alt={item.product.name} loading="lazy" />
          ) : (
            <Package size={18} />
          )}
        </div>

        <div className="pos-cart-item-main">
          <div className="pos-cart-item-title">
            <strong>{item.product.name}{item.isDeliveryItem ? " 🚚" : ""}</strong>
            <button type="button" onClick={() => remove(item.product.id)}>
              <Trash2 size={14} />
            </button>
          </div>

          <div className="pos-cart-item-meta">
            <span>{fmtMoney(itemPrice)}{item.product.saleUnit === "KG" ? "/kg" : ""}</span>
            {isCompositeProduct(item.product) && <span>Promo: descuenta componentes</span>}
            {!isCompositeProduct(item.product) && !isStockControlledProduct(item.product) && (
              <span>{isDeliveryProduct(item.product) ? "Envío / servicio" : "Servicio sin stock"}</span>
            )}
          </div>

          <div className="pos-cart-item-actions">
            {item.product.saleUnit === "KG" && !item.isDeliveryItem && !isDeliveryProduct(item.product) && !item.product.isService ? (
              <label className="pos-kg-input">
                <span>Kg</span>
                <input
                  type="number"
                  step="0.001"
                  value={item.quantityKg ?? 0}
                  onChange={(e) => setKg(item.product.id, num(e.target.value))}
                />
              </label>
            ) : (
              <div className="pos-stepper">
                <button
                  type="button"
                  onClick={() => setQty(item.product.id, item.quantity - 1)}
                  disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                >
                  <Minus size={14} />
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQty(item.product.id, item.quantity + 1)}
                  disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            <b>{fmtMoney(item.isDeliveryItem ? itemPrice : lineTotal)}</b>
          </div>
        </div>
      </article>
    );
  };

  return (
    <AppLayout title="POS" subtitle="Ventas, promos, envíos, pagos parciales y cuenta corriente">
      <div className="pos-desktop-only">
        <div className="pos-root">
          <section>
            <div className="pos-toolbar">
              <div className="pos-search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o SKU..."
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm pos-scan-desktop-btn"
                onClick={openSkuScanner}
                title="Escanear SKU con cámara"
              >
                <ScanBarcode size={15} />
                Escanear
              </button>

              <select className="pos-filter" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="pos-filter pos-sort-filter"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
                title="Ordenar productos"
              >
                <option value="name-asc">Nombre A-Z</option>
                <option value="name-desc">Nombre Z-A</option>
                <option value="category-asc">Categoría A-Z</option>
                <option value="category-desc">Categoría Z-A</option>
              </select>

              <select
                className="pos-filter"
                value={stockLocation}
                onChange={(e) => setStockLocation(e.target.value as StockLocation)}
                title="Depósito desde donde se descuenta la mercadería"
              >
                <option value="LOCAL">Descontar de Mayorista</option>
                <option value="DEPOSITO">Descontar de Minorista</option>
              </select>

              <button className="btn btn-secondary btn-sm pos-refresh-btn" onClick={() => load(true)} disabled={loading}>
                <RefreshCcw size={14} />
                Actualizar
              </button>
            </div>

            <div className="pos-products-grid">
              {loading ? <div className="skeleton" style={{ height: 240 }} /> : filtered.map((p) => renderProductCard(p))}
            </div>
          </section>

          <aside className="card pos-cart">
            <div className="pos-cart-body">
              <div className="pos-cart-head">
                <ShoppingCart size={18} />
                <b>Carrito</b>
                <span>{cart.length} items</span>
              </div>

              <div className="badge badge-blue stock-badge"><Warehouse size={13} /> Descuenta de: {stockLocationLabel(stockLocation)}</div>

              <div className="form-group">
                <label className="form-label">Origen de stock</label>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setDeliveryCalculation(null);
                    if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                  }}
                >
                  <option value="">Consumidor final</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {clientName(c)} · {clientCategoryLabel(c.category)} · deuda {fmtMoney(c.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pos-delivery-box">
                <div className="box-title"><Truck size={16} /><b>Entrega</b></div>
                <div className="form-row pos-delivery-row">
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select
                      value={deliveryMode}
                      onChange={(e) => {
                        const next = e.target.value as DeliveryMode;
                        setDeliveryMode(next);
                        setDeliveryCalculation(null);
                        if (next === "PICKUP") removeDeliveryFromCart();
                      }}
                    >
                      <option value="PICKUP">Retiro en sucursal</option>
                      <option value="LOCAL_DELIVERY">Envío</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sale desde</label>
                    <select
                      value={businessLocationId}
                      onChange={(e) => {
                        setBusinessLocationId(e.target.value);
                        setDeliveryCalculation(null);
                        if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                      }}
                    >
                      <option value="">{businessLocations.length ? "Seleccionar" : "Sin ubicaciones cargadas"}</option>
                      {businessLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}{location.isDefault ? " · default" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {deliveryMode === "LOCAL_DELIVERY" && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Precio por km</label>
                      <input
                        type="number"
                        value={deliveryPricePerKm}
                        onChange={(e) => {
                          setDeliveryPricePerKm(e.target.value);
                          setDeliveryCalculation(null);
                          removeDeliveryFromCart();
                        }}
                        placeholder="Ej: 8000"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary full"
                      onClick={calculateDelivery}
                      disabled={calculatingDelivery || !clientId || !businessLocationId}
                    >
                      <Truck size={14} />
                      {calculatingDelivery ? "Calculando..." : "Calcular envío"}
                    </button>

                    {deliveryCalculation && (
                      <div className="pos-delivery-ok">
                        <b>Envío: {fmtMoney(deliveryCalculation.deliveryCost)}</b>
                        <span>{deliveryCalculation.distanceKm} km x {fmtMoney(deliveryCalculation.pricePerKm)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pos-cart-items">
                {cart.map((item) => renderCartItem(item))}
                {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Carrito vacío</b><span>Tocá productos o escaneá un SKU.</span></div>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Comprobante</label>
                  <select value={receiptType} onChange={(e) => setReceiptType(e.target.value as ReceiptType)}>
                    <option value="TICKET">Ticket</option>
                    <option value="FACTURA">Factura</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descuento</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | "")}>
                    <option value="">Sin descuento</option>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">$</option>
                  </select>
                </div>
              </div>

              {discountType && (
                <div className="form-group">
                  <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="Valor descuento" />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Modo de pago</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "single" | "multi")}>
                  <option value="single">Un método</option>
                  <option value="multi">Múltiples / parcial</option>
                </select>
              </div>

              {paymentMode === "single" ? (
                <div className="form-group">
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              ) : (
                <div className="pos-payments">
                  {payments.map((p, idx) => (
                    <div className="pos-payment-row" key={idx}>
                      <select
                        value={p.method}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) => i === idx ? { ...x, method: e.target.value as PaymentMethod } : x),
                          )
                        }
                      >
                        {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input
                        type="number"
                        value={p.method === "CUENTA_CORRIENTE" ? debt || "" : p.amount || ""}
                        disabled={p.method === "CUENTA_CORRIENTE"}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) => i === idx ? { ...x, amount: num(e.target.value) } : x),
                          )
                        }
                      />
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" onClick={addPayment}><Plus size={13} /> Agregar pago</button>
                </div>
              )}
            </div>

            <div className="pos-cart-footer desktop-footer">
              <div className="pos-totals">
                <div><span>Subtotal</span><b>{fmtMoney(subtotal)}</b></div>
                {deliveryMode === "LOCAL_DELIVERY" && deliveryCostForTotal > 0 && <div><span>Envío incluido</span><b>{fmtMoney(deliveryCostForTotal)}</b></div>}
                {discount > 0 && <div><span>Descuento</span><b>-{fmtMoney(discount)}</b></div>}
                <div className="total"><span>Total</span><b>{fmtMoney(total)}</b></div>
              </div>
              {debt > 0 && <div className="badge badge-yellow debt-badge">Queda en cuenta corriente: {fmtMoney(debt)}</div>}
              <button className="btn btn-primary full finish-btn" disabled={submitting || !cart.length} onClick={openSubmitConfirm}>
                <Check size={17} />
                {submitting ? "Registrando venta..." : `Finalizar venta · ${fmtMoney(total)}`}
              </button>
            </div>
          </aside>
        </div>
      </div>

      <div className="pos-mobile-only">
        <div className="pos-mobile-shell">
          <section className="pos-hero">
            <div>
              <p className="pos-kicker">Venta rápida</p>
              <p>{filtered.length} productos · {selectedCategoryName} · Stock {stockLocationLabelLower(stockLocation)}</p>
            </div>
            <button className="pos-icon-btn" type="button" onClick={() => load(true)} disabled={loading}>
              <RefreshCcw size={17} />
            </button>
          </section>

          <section className="pos-mobile-controls">
            <div className="pos-searchbox">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por producto o SKU..." autoComplete="off" />
              <button type="button" className="pos-search-scan-btn" onClick={openSkuScanner} aria-label="Escanear SKU">
                <ScanBarcode size={16} />
              </button>
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </div>

            <div className="pos-control-grid">
              <label>
                <span>Stock</span>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </label>
              <label>
                <span>Cliente</span>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setDeliveryCalculation(null);
                    if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                  }}
                >
                  <option value="">Consumidor final</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{clientName(client)} · {clientCategoryLabel(client.category)}</option>
                  ))}
                </select>
              </label>

              <label className="pos-sort-mobile-field">
                <span>Orden</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
                >
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                  <option value="category-asc">Categoría A-Z</option>
                  <option value="category-desc">Categoría Z-A</option>
                </select>
              </label>
            </div>

            <div className="pos-category-strip">
              <button type="button" className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>Todos</button>
              {categories.map((category) => (
                <button key={category.id} type="button" className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>
              ))}
            </div>
          </section>

          <section className="pos-product-section">
            {loading && <div className="pos-grid">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="pos-product-skeleton" />)}</div>}
            {!loading && !filtered.length && <div className="pos-empty"><Package size={34} /><b>No encontré productos</b><span>Probá otra búsqueda o sacá el filtro de categoría.</span></div>}
            {!loading && !!filtered.length && (
              <>
                <div className="pos-grid">{visibleProducts.map((product) => renderProductCard(product, true))}</div>
                {visibleProducts.length < filtered.length && (
                  <button type="button" className="pos-load-more" onClick={() => setVisibleCount((prev) => prev + 36)}>
                    Ver más productos · {filtered.length - visibleProducts.length} restantes
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {mounted && isMobileView && createPortal(
          <>
            <button type="button" className="pos-cart-fab" onClick={() => setCartOpen(true)}>
              <span className="pos-cart-fab-left"><ShoppingCart size={18} /><span><b>Carrito</b><small>{cart.length ? `${cartUnits} item${cartUnits === 1 ? "" : "s"}` : "Tocar para abrir"}</small></span></span>
              <span className="pos-cart-fab-right"><b>{fmtMoney(total)}</b><small>Finalizar</small></span>
            </button>

            {cartOpen && (
              <div className="pos-cart-layer">
                <div className="pos-cart-sheet" role="dialog" aria-modal="true" aria-label="Carrito">
                  <div className="pos-cart-handle" />
                  <header className="pos-cart-header">
                    <div><b>Carrito de venta</b><span>{cart.length} productos · {fmtMoney(total)}</span></div>
                    <button type="button" className="pos-icon-btn" onClick={() => setCartOpen(false)}><X size={18} /></button>
                  </header>

                  <div className="pos-cart-scroll">
                    <div className="pos-mini-summary">
                      <span><Warehouse size={14} />{stockLocationLabel(stockLocation)}</span>
                      {debt > 0 && <span className="warn">Deuda {fmtMoney(debt)}</span>}
                    </div>

                    <div className="pos-cart-products">
                      {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Carrito vacío</b><span>Tocá productos para agregarlos en segundos.</span></div>}
                      {cart.map((item) => renderCartItem(item, true))}
                    </div>

                    <section className="pos-sale-options">
                      <details>
                        <summary>Entrega / envío</summary>
                        <div className="pos-option-body">
                          <label>
                            <span>Tipo de entrega</span>
                            <select
                              value={deliveryMode}
                              onChange={(e) => {
                                const next = e.target.value as DeliveryMode;
                                setDeliveryMode(next);
                                setDeliveryCalculation(null);
                                if (next === "PICKUP") removeDeliveryFromCart();
                              }}
                            >
                              <option value="PICKUP">Retiro en sucursal</option>
                              <option value="LOCAL_DELIVERY">Envío local</option>
                            </select>
                          </label>
                          <label>
                            <span>Sale desde</span>
                            <select
                              value={businessLocationId}
                              onChange={(e) => {
                                setBusinessLocationId(e.target.value);
                                setDeliveryCalculation(null);
                                if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                              }}
                            >
                              <option value="">{businessLocations.length ? "Seleccionar" : "Sin ubicaciones"}</option>
                              {businessLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.isDefault ? " · default" : ""}</option>)}
                            </select>
                          </label>

                          {deliveryMode === "LOCAL_DELIVERY" && (
                            <>
                              <label>
                                <span>Precio por km</span>
                                <input
                                  type="number"
                                  value={deliveryPricePerKm}
                                  onChange={(e) => {
                                    setDeliveryPricePerKm(e.target.value);
                                    setDeliveryCalculation(null);
                                    removeDeliveryFromCart();
                                  }}
                                  placeholder="Ej: 8000"
                                />
                              </label>
                              {selectedClient && <small className={clientHasCoordinates(selectedClient) ? "pos-help" : "pos-help danger"}>{clientHasCoordinates(selectedClient) ? buildClientAddress(selectedClient) || "Cliente con coordenadas" : "Este cliente no tiene coordenadas cargadas"}</small>}
                              <button type="button" className="pos-secondary-action" onClick={calculateDelivery} disabled={calculatingDelivery || !clientId || !businessLocationId}>
                                <Truck size={15} />{calculatingDelivery ? "Calculando..." : "Calcular envío"}
                              </button>
                              {deliveryCalculation && <div className="pos-delivery-ok"><b>Envío: {fmtMoney(deliveryCalculation.deliveryCost)}</b><span>{deliveryCalculation.distanceKm} km x {fmtMoney(deliveryCalculation.pricePerKm)}</span></div>}
                            </>
                          )}
                        </div>
                      </details>

                      <details>
                        <summary>Comprobante, descuento y pago</summary>
                        <div className="pos-option-body">
                          <div className="pos-control-grid">
                            <label><span>Comprobante</span><select value={receiptType} onChange={(e) => setReceiptType(e.target.value as ReceiptType)}><option value="TICKET">Ticket</option><option value="FACTURA">Factura</option></select></label>
                            <label><span>Descuento</span><select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | "")}><option value="">Sin descuento</option><option value="PERCENTAGE">%</option><option value="FIXED">$</option></select></label>
                          </div>
                          {discountType && <label><span>Valor descuento</span><input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="Valor" /></label>}
                          <label><span>Modo de pago</span><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "single" | "multi")}><option value="single">Un método</option><option value="multi">Múltiples / parcial</option></select></label>
                          {paymentMode === "single" ? (
                            <label><span>Método</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                          ) : (
                            <div className="pos-payments">
                              {payments.map((payment, index) => (
                                <div key={index} className="pos-payment-line">
                                  <select value={payment.method} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, method: e.target.value as PaymentMethod } : current))}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
                                  <input type="number" value={payment.method === "CUENTA_CORRIENTE" ? debt || "" : payment.amount || ""} disabled={payment.method === "CUENTA_CORRIENTE"} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, amount: num(e.target.value) } : current))} />
                                </div>
                              ))}
                              <button type="button" className="pos-secondary-action" onClick={addPayment}><Plus size={14} />Agregar pago</button>
                            </div>
                          )}
                        </div>
                      </details>
                    </section>
                  </div>

                  <footer className="pos-cart-footer">
                    <div className="pos-totals">
                      <div><span>Subtotal</span><b>{fmtMoney(subtotal)}</b></div>
                      {deliveryMode === "LOCAL_DELIVERY" && deliveryCostForTotal > 0 && <div><span>Envío</span><b>{fmtMoney(deliveryCostForTotal)}</b></div>}
                      {discount > 0 && <div><span>Descuento</span><b>-{fmtMoney(discount)}</b></div>}
                      <div className="total"><span>Total</span><b>{fmtMoney(total)}</b></div>
                    </div>
                    <button type="button" className="pos-finish" disabled={submitting || !cart.length} onClick={openSubmitConfirm}>
                      <Check size={18} />{submitting ? "Registrando..." : `Finalizar · ${fmtMoney(total)}`}
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {!cartOpen && cart.length > 0 && (
              <div className="pos-cart-preview" onClick={() => setCartOpen(true)}>
                {cartPreview.map((item) => {
                  const imageUrl = getProductImageUrl(item.product);
                  return <span key={item.product.id}>{imageUrl ? <img src={imageUrl} alt={item.product.name} loading="lazy" /> : <Package size={13} />}</span>;
                })}
                {cart.length > cartPreview.length && <b>+{cart.length - cartPreview.length}</b>}
              </div>
            )}
          </>,
          document.body,
        )}
      </div>

      {skuScannerOpen && mounted && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay scanner-overlay">
            <div className="modal pos-scanner-modal">
              <div className="modal-header">
                <b>Escanear producto</b>
                <button className="btn btn-ghost btn-sm" onClick={closeSkuScanner}><X size={16} /></button>
              </div>
              <div className="modal-body pos-scanner-body">
                <div className="pos-scanner-info">
                  <ScanBarcode size={18} />
                  <div><b>Apuntá al código de barras o QR</b><small>Cuando lo detecte, agrega el producto directo al carrito.</small></div>
                </div>
                <div className="pos-scanner-frame">
                  <div id={POS_SKU_SCANNER_ELEMENT_ID} className="pos-scanner-reader" />
                  {scannerLoading && <div className="pos-scanner-loading"><span className="spinner" /><p>Iniciando cámara...</p></div>}
                </div>
                {scannerError ? <div className="pos-scanner-error"><AlertTriangle size={16} /><span>{scannerError}</span></div> : <p className="pos-scanner-note">Tip: acercá el código, evitá reflejos y usá buena luz.</p>}
              </div>
              <div className="modal-footer pos-confirm-footer"><button className="btn btn-secondary" onClick={closeSkuScanner}>Cancelar</button></div>
            </div>
          </div>,
          document.body,
        )}

      {confirmModal && mounted && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal pos-confirm-modal">
              <div className="modal-header">
                <b>{confirmModal.title}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => !confirmLoading && setConfirmModal(null)} disabled={confirmLoading}><X size={16} /></button>
              </div>
              <div className="modal-body">
                <div className="confirm-box">
                  <span className={confirmModal.danger ? "danger-icon" : "info-icon"}><AlertTriangle size={18} /></span>
                  <p>{confirmModal.message}</p>
                </div>
              </div>
              <div className="modal-footer pos-confirm-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading}>Cancelar</button>
                <button className={confirmModal.danger ? "btn btn-danger" : "btn btn-primary"} onClick={confirmAction} disabled={confirmLoading}>{confirmLoading ? <span className="spinner" /> : (confirmModal.confirmText ?? "Confirmar")}</button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx global>{`
        div[data-rht-toaster], div[data-rht-toaster] * { z-index: 2147483647 !important; }
        .modal-overlay { position: fixed; inset: 0; z-index: 2147483600 !important; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(0,0,0,.48); overflow-y: auto; }
        .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; max-height: calc(100dvh - 36px); overflow: hidden; display: flex; flex-direction: column; }
        .modal-header, .modal-footer { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .modal-footer { border-top: 1px solid var(--border); border-bottom: 0; }
        .modal-body { padding: 16px; overflow-y: auto; }
        .full { width: 100%; justify-content: center; }
        .muted { color: var(--text3); }
        .small { font-size: 11px; }
        .danger { color: var(--danger) !important; }

        .pos-root { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 18px; }
        .pos-toolbar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .pos-search { position: relative; flex: 1; min-width: 220px; }
        .pos-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text3); }
        .pos-search input { padding-left: 34px; width: 100%; }
        .pos-filter { width: 220px; }
        .pos-sort-filter { width: 185px; }
        .pos-scan-desktop-btn, .pos-refresh-btn { height: 42px; white-space: nowrap; }
        .pos-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
        .pos-product-card { min-height: 335px; padding: 12px; text-align: left; cursor: pointer; overflow: hidden; display: grid; gap: 8px; color: var(--text); }
        .pos-product-card:disabled { opacity: .55; cursor: not-allowed; }
        .pos-product-image { width: 100%; aspect-ratio: 1/1; border-radius: 14px; background: #fff; border: 1px solid var(--border); display: grid; place-items: center; overflow: hidden; padding: 8px; color: var(--text3); position: relative; }
        .pos-product-image img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-product-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; }
        .pos-product-title { min-height: 38px; font-size: 14px; line-height: 1.25; }
        .price { font-family: var(--mono); color: var(--accent); font-weight: 900; font-size: 15px; }
        .pos-card-counter { width: fit-content; font-size: 11px; }

        .pos-cart { padding: 0; align-self: start; position: sticky; top: 76px; max-height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden; }
        .pos-cart-body { padding: 16px; overflow: auto; flex: 1; }
        .pos-cart-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .pos-cart-head span { margin-left: auto; color: var(--text3); font-size: 12px; }
        .stock-badge { margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; width: fit-content; }
        .pos-delivery-box { margin: 14px 0; padding: 12px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface2); }
        .box-title { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; font-size: 13px; }
        .pos-delivery-ok { display: grid; gap: 3px; border: 1px solid rgba(34,197,94,.25); background: rgba(34,197,94,.08); color: var(--text2); border-radius: 14px; padding: 10px; font-size: 12px; margin-top: 10px; }
        .pos-delivery-ok b { color: var(--success); }
        .pos-cart-items { max-height: 260px; overflow: auto; margin-bottom: 12px; display: grid; gap: 8px; }
        .pos-cart-row, .pos-cart-item { display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 10px; padding: 9px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); }
        .pos-cart-row { border-radius: 12px; border-left: 0; border-right: 0; border-top: 0; background: transparent; }
        .pos-cart-item-img { width: 52px; height: 52px; border-radius: 14px; background: white; border: 1px solid var(--border); display: grid; place-items: center; padding: 5px; overflow: hidden; color: var(--text3); }
        .pos-cart-item-img img, .pos-cart-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-cart-item-main { min-width: 0; display: grid; gap: 6px; }
        .pos-cart-item-title { display: flex; justify-content: space-between; gap: 8px; }
        .pos-cart-item-title strong { font-size: 13px; line-height: 1.2; }
        .pos-cart-item-title button { width: 30px; height: 30px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); color: var(--danger); display: grid; place-items: center; flex-shrink: 0; }
        .pos-cart-item-meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--text3); font-size: 11px; }
        .pos-cart-item-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .pos-cart-item-actions > b { font-family: var(--mono); color: var(--accent); font-size: 13px; }
        .pos-stepper { display: inline-grid; grid-template-columns: 36px 36px 36px; align-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface2); }
        .pos-stepper button { height: 36px; border: 0; background: transparent; color: var(--text); display: grid; place-items: center; }
        .pos-stepper button:disabled { opacity: .35; }
        .pos-stepper span { text-align: center; font-weight: 900; font-family: var(--mono); }
        .pos-kg-input { display: grid; grid-template-columns: 30px 110px; align-items: center; gap: 7px; }
        .pos-kg-input input { height: 36px; border-radius: 12px; }
        .pos-payment-row, .pos-payment-line { display: grid; grid-template-columns: minmax(0,1fr) 120px; gap: 8px; margin-bottom: 8px; }
        .pos-cart-footer { border-top: 1px solid var(--border); background: var(--surface); padding: 11px 12px max(12px, env(safe-area-inset-bottom)); box-shadow: 0 -18px 44px rgba(0,0,0,.32); }
        .desktop-footer { padding: 16px; }
        .pos-totals { display: grid; gap: 4px; margin-bottom: 10px; }
        .pos-totals > div { display: flex; justify-content: space-between; gap: 10px; color: var(--text2); font-size: 13px; }
        .pos-totals .total { color: var(--text); font-size: 20px; font-weight: 900; padding-top: 4px; }
        .pos-totals .total b { color: var(--accent); font-family: var(--mono); }
        .debt-badge { margin-bottom: 10px; }
        .finish-btn { height: 48px; font-size: 15px; font-weight: 900; }

        .pos-mobile-only { display: none; }
        .pos-desktop-only { display: block; }
        .pos-mobile-shell { padding-bottom: 112px; }
        .pos-hero { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 24px; background: radial-gradient(circle at top left, rgba(59,130,246,.2), transparent 34%), var(--surface); margin-bottom: 12px; }
        .pos-kicker, .pos-hero p { margin: 0; color: var(--text3); font-size: 12px; font-weight: 800; }
        .pos-icon-btn { width: 42px; height: 42px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); display: inline-grid; place-items: center; flex-shrink: 0; }
        .pos-mobile-controls { position: sticky; top: 0; z-index: 15; padding: 10px 0 12px; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(18px); }
        .pos-searchbox { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 9px; height: 48px; padding: 0 12px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,.16); }
        .pos-searchbox input { border: 0; background: transparent; outline: none; width: 100%; height: 100%; color: var(--text); font-size: 16px; }
        .pos-searchbox button, .pos-search-scan-btn { border: 0; background: var(--surface2); color: var(--text2); border-radius: 999px; width: 30px; height: 30px; display: grid; place-items: center; }
        .pos-search-scan-btn { color: var(--accent) !important; }
        .pos-control-grid { display: grid; grid-template-columns: .82fr 1.18fr; gap: 8px; margin-top: 8px; }
        .pos-sort-mobile-field { grid-column: 1 / -1; }
        .pos-control-grid label, .pos-option-body label { display: grid; gap: 5px; min-width: 0; }
        .pos-control-grid span, .pos-option-body label > span { color: var(--text3); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .pos-control-grid select, .pos-option-body select, .pos-option-body input, .pos-payment-line input, .pos-payment-line select, .pos-kg-input input { min-width: 0; width: 100%; height: 42px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 0 10px; font-size: 14px; }
        .pos-category-strip { display: flex; gap: 8px; overflow-x: auto; padding: 9px 1px 2px; scrollbar-width: none; }
        .pos-category-strip::-webkit-scrollbar { display: none; }
        .pos-category-strip button { border: 1px solid var(--border); background: var(--surface); color: var(--text2); border-radius: 999px; padding: 9px 12px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .pos-category-strip button.active { background: var(--accent); border-color: var(--accent); color: white; }
        .pos-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
        .pos-product { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 18px; padding: 7px; text-align: left; min-width: 0; box-shadow: 0 10px 24px rgba(0,0,0,.12); display: grid; gap: 7px; position: relative; overflow: hidden; touch-action: manipulation; }
        .pos-product:active { transform: scale(.98); }
        .pos-product.disabled { opacity: .5; filter: grayscale(.3); }
        .pos-product-img { width: 100%; aspect-ratio: 1/1; border-radius: 14px; background: #fff; border: 1px solid var(--border); overflow: hidden; display: grid; place-items: center; padding: 4px; position: relative; color: var(--text3); }
        .pos-product-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-added-pill { position: absolute; top: 5px; right: 5px; min-width: 25px; height: 25px; border-radius: 999px; background: var(--accent); color: white; display: grid; place-items: center; font-size: 11px; font-weight: 900; box-shadow: 0 10px 24px rgba(0,0,0,.22); }
        .pos-product-info { display: grid; gap: 3px; min-width: 0; }
        .pos-product-top { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 9px; color: var(--text3); font-weight: 900; text-transform: uppercase; }
        .pos-product-top .promo { color: var(--accent); }
        .pos-product-top .danger { color: var(--danger); }
        .pos-product strong { font-size: 12px; line-height: 1.15; min-height: 28px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .pos-product small { color: var(--text3); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pos-product b { font-family: var(--mono); color: var(--accent); font-size: 12px; }
        .pos-load-more, .pos-secondary-action { width: 100%; min-height: 44px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 900; margin-top: 12px; }
        .pos-product-skeleton { min-height: 158px; border-radius: 18px; background: linear-gradient(90deg, var(--surface), var(--surface2), var(--surface)); animation: posPulse 1.2s infinite; }
        .pos-empty { min-height: 220px; border: 1px dashed var(--border); border-radius: 22px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--text3); text-align: center; padding: 20px; }
        .pos-empty b { color: var(--text); }
        .pos-empty.compact { min-height: 180px; }
        .pos-cart-fab { position: fixed; left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); bottom: max(10px, env(safe-area-inset-bottom)); z-index: 2147483000; min-height: 66px; border: 1px solid rgba(255,255,255,.14); border-radius: 22px; background: color-mix(in srgb, var(--surface) 92%, black 8%); color: var(--text); box-shadow: 0 18px 50px rgba(0,0,0,.45); display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; backdrop-filter: blur(18px); }
        .pos-cart-fab-left { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
        .pos-cart-fab-left > span, .pos-cart-fab-right { display: grid; gap: 1px; text-align: left; }
        .pos-cart-fab small, .pos-cart-header span, .pos-help { color: var(--text3); font-size: 11px; }
        .pos-cart-fab-right { text-align: right; }
        .pos-cart-fab-right b { color: var(--accent); font-family: var(--mono); }
        .pos-cart-layer { position: fixed; inset: 0; z-index: 2147483001; background: rgba(0,0,0,.48); display: flex; align-items: flex-end; }
        .pos-cart-sheet { width: 100%; max-height: 94dvh; background: var(--bg); border-radius: 26px 26px 0 0; border: 1px solid var(--border); box-shadow: 0 -24px 70px rgba(0,0,0,.5); display: grid; grid-template-rows: auto auto minmax(0,1fr) auto; overflow: hidden; }
        .pos-cart-handle { width: 54px; height: 5px; border-radius: 999px; background: var(--border); margin: 9px auto 4px; }
        .pos-cart-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 14px 12px; border-bottom: 1px solid var(--border); }
        .pos-cart-header > div { display: grid; gap: 2px; }
        .pos-cart-header b { font-size: 18px; }
        .pos-cart-scroll { overflow: auto; padding: 12px 12px 0; }
        .pos-mini-summary { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; font-size: 12px; font-weight: 900; }
        .pos-mini-summary span { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--text2); border-radius: 999px; padding: 7px 9px; }
        .pos-mini-summary .warn { color: var(--warn); }
        .pos-cart-products { display: grid; gap: 8px; }
        .pos-sale-options { display: grid; gap: 8px; margin-top: 12px; padding-bottom: 12px; }
        .pos-sale-options details { border: 1px solid var(--border); border-radius: 18px; background: var(--surface); overflow: hidden; }
        .pos-sale-options summary { padding: 13px; font-weight: 900; cursor: pointer; }
        .pos-option-body { display: grid; gap: 10px; padding: 0 13px 13px; }
        .pos-help.danger { color: var(--danger); }
        .pos-cart-preview { position: fixed; right: 18px; bottom: max(88px, calc(env(safe-area-inset-bottom) + 88px)); z-index: 2147482999; display: flex; align-items: center; gap: 0; cursor: pointer; }
        .pos-cart-preview span, .pos-cart-preview b { width: 32px; height: 32px; border-radius: 999px; border: 2px solid var(--bg); background: white; color: var(--text); display: grid; place-items: center; overflow: hidden; margin-left: -8px; box-shadow: 0 8px 22px rgba(0,0,0,.25); font-size: 11px; }
        .pos-finish { width: 100%; min-height: 52px; border: 0; border-radius: 18px; background: var(--accent); color: white; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 950; }
        .pos-finish:disabled { opacity: .45; }

        .pos-confirm-modal, .pos-scanner-modal { width: min(520px, calc(100vw - 24px)); max-width: calc(100vw - 24px); border-radius: 20px; }
        .pos-confirm-footer { display: grid; grid-template-columns: 1fr; gap: 9px; }
        .pos-confirm-footer button { width: 100%; justify-content: center; }
        .confirm-box { display: flex; gap: 12px; align-items: flex-start; }
        .confirm-box p { color: var(--text2); font-size: 13px; line-height: 1.55; margin: 0; }
        .info-icon, .danger-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--surface2); display: grid; place-items: center; flex-shrink: 0; color: var(--accent); }
        .danger-icon { background: rgba(239,68,68,.12); color: var(--danger); }
        .scanner-overlay { z-index: 2147483605 !important; }
        .pos-scanner-body { display: grid; gap: 12px; padding: 16px; }
        .pos-scanner-info { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--border); border-radius: 14px; background: var(--surface2); padding: 12px; }
        .pos-scanner-info b { display: block; color: var(--text); font-size: 13px; line-height: 1.2; margin-bottom: 4px; }
        .pos-scanner-info small { display: block; color: var(--text3); font-size: 12px; line-height: 1.35; }
        .pos-scanner-frame { position: relative; min-height: 300px; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: #000; }
        .pos-scanner-reader { width: 100%; min-height: 300px; }
        .pos-scanner-reader video { width: 100% !important; height: 300px !important; object-fit: cover !important; }
        .pos-scanner-loading { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 10px; background: rgba(0,0,0,.72); color: white; z-index: 2; }
        .pos-scanner-loading p { margin: 0; font-size: 12px; font-weight: 800; }
        .pos-scanner-error { display: flex; gap: 8px; align-items: flex-start; border: 1px solid rgba(239,68,68,.28); border-radius: 13px; background: rgba(239,68,68,.1); color: var(--danger); padding: 10px 12px; font-size: 12px; line-height: 1.35; font-weight: 800; }
        .pos-scanner-note { margin: 0; color: var(--text3); font-size: 12px; line-height: 1.4; }

        @keyframes posPulse { 0%,100% { opacity: .65; } 50% { opacity: 1; } }

        @media (max-width: 1100px) { .pos-root { grid-template-columns: minmax(0,1fr) 380px; gap: 14px; } .pos-products-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
        @media (max-width: 900px) { .pos-root { grid-template-columns: 1fr; } .pos-cart { position: static; top: auto; max-height: none; order: -1; border-radius: 18px; } .pos-cart-body { max-height: none; overflow: visible; } .pos-cart-items { max-height: 280px; } }

        @media (max-width: 767px) {
          .pos-desktop-only { display: none !important; }
          .pos-mobile-only { display: block !important; }
          .pos-mobile-shell { padding-bottom: 124px !important; }
          .pos-scanner-modal { width: 100vw; max-width: 100vw; border-radius: 22px 22px 0 0; align-self: flex-end; }
          .pos-scanner-frame, .pos-scanner-reader { min-height: 340px; }
          .pos-scanner-reader video { height: 340px !important; }
          .modal-overlay { align-items: flex-end; padding: 0; }
        }
        @media (min-width: 768px) { .pos-mobile-only { display: none !important; } .pos-desktop-only { display: block !important; } }
        @media (min-width: 700px) { .pos-mobile-shell { max-width: 1180px; margin: 0 auto; } .pos-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; } .pos-product { padding: 10px; } .pos-product strong { font-size: 13px; } .pos-product b { font-size: 14px; } .pos-cart-fab { left: 50%; right: auto; transform: translateX(-50%); width: min(520px, calc(100vw - 28px)); } .pos-cart-sheet { width: min(560px, 100vw); margin: 0 auto; } .pos-cart-layer { justify-content: center; } }
        @media (max-width: 390px) { .pos-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .pos-product { border-radius: 16px; } .pos-product strong { font-size: 11px; } .pos-product b { font-size: 11px; } }
      `}</style>
    </AppLayout>
  );
}
