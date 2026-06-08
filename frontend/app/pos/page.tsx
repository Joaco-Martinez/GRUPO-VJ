'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
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
} from '@/types';
import {
  categoryName,
  clientName,
  fmtMoney,
  normalizeArray,
  num,
  productPrice,
} from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';

const methods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
  'CUENTA_CORRIENTE',
];

type StockLocation = 'LOCAL' | 'DEPOSITO';
type DeliveryMode = 'PICKUP' | 'LOCAL_DELIVERY';

type DeliveryCalculation = {
  distanceKm: number;
  pricePerKm: number;
  deliveryCost: number;
  source?: 'GOOGLE_ROUTES' | 'COORDINATES_FALLBACK';
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

const DELIVERY_SKU = 'ENVIO-FLETE2';

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
  return product?.type === 'COMPUESTO';
}

function getCompositeComponents(product?: Product | null) {
  return ((product as ProductWithComponents | null)?.components ?? []).filter(
    (component) => component?.component
  );
}

function isStockControlledProduct(product?: Product | null) {
  if (!product) return false;
  if (isDeliveryProduct(product)) return false;
  if (product.isService) return false;

  // Los COMPUESTO / PROMO también controlan stock,
  // pero el stock se calcula con sus componentes.
  return true;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

function productRawStockByLocation(product: Product, stockLocation: StockLocation) {
  if (product.saleUnit === 'KG') {
    return stockLocation === 'DEPOSITO'
      ? num(product.stockDepositoKg)
      : num(product.stockLocalKg);
  }

  return stockLocation === 'DEPOSITO'
    ? num(product.stockDeposito)
    : num(product.stockLocal);
}

function getComponentNeededQty(componentRelation: ProductComponentForPOS) {
  const componentProduct = componentRelation.component;

  if (!componentProduct) return 0;

  if (componentProduct.saleUnit === 'KG') {
    return num(componentRelation.quantityKg, componentRelation.quantity);
  }

  return num(componentRelation.quantity, componentRelation.quantityKg);
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

      const componentStock = productRawStockByLocation(componentProduct, stockLocation);

      return Math.floor(componentStock / neededQty);
    });

    return Math.max(0, Math.min(...availableByComponent));
  }

  return productRawStockByLocation(product, stockLocation);
}

function stockLabel(product: Product, stockLocation: StockLocation) {
  if (isDeliveryProduct(product)) return 'envío / servicio';
  if (product.isService) return 'servicio';

  if (isCompositeProduct(product)) {
    const availablePromos = productStockByLocation(product, stockLocation);

    return `${availablePromos} promo${availablePromos === 1 ? '' : 's'}`;
  }

  const stock = productStockByLocation(product, stockLocation);

  return product.saleUnit === 'KG' ? `${stock} kg` : `${stock}`;
}

function getItemPrice(item: CartItem, selectedPriceType: CartItem['priceType']) {
  return num(item.manualPrice, productPrice(item.product, item.priceType || selectedPriceType));
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
  if (!client) return '';

  const street = [client.addressStreet, client.addressNumber].filter(Boolean).join(' ');

  const floor = [
    client.addressFloor ? `Piso ${client.addressFloor}` : '',
    client.addressApartment ? `Dto ${client.addressApartment}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const city = [client.addressCity, client.addressProvince, client.addressPostalCode]
    .filter(Boolean)
    .join(', ');

  return [street, floor, city, client.addressNotes].filter(Boolean).join(' - ');
}

async function fetchPosData() {
  const [p, c, cl, bl] = await Promise.all([
    api.get('/products'),
    api.get('/categories'),
    api.get('/clients'),
    api.get('/business-locations'),
  ]);

  const products = normalizeArray<Product>(p.data).filter((x) => x.isActive !== false);
  const categories = normalizeArray<ProductCategory>(c.data);
  const clients = normalizeArray<Client>(cl.data);
  const businessLocations = normalizeArray<BusinessLocation>(bl.data);

  return {
    products,
    categories,
    clients,
    businessLocations,
  };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');

  const [stockLocation, setStockLocation] = useState<StockLocation>('LOCAL');

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('PICKUP');
  const [businessLocationId, setBusinessLocationId] = useState('');
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('8000');
  const [deliveryCalculation, setDeliveryCalculation] = useState<DeliveryCalculation | null>(null);
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);

  const [receiptType, setReceiptType] = useState<ReceiptType>('TICKET');
  const [discountType, setDiscountType] = useState<DiscountType | ''>('');
  const [discountValue, setDiscountValue] = useState('');

  const [paymentMode, setPaymentMode] = useState<'single' | 'multi'>('single');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [payments, setPayments] = useState<SalePayment[]>([{ method: 'EFECTIVO', amount: 0 }]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

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

      if (showSuccess) {
        toast.success('POS actualizado correctamente');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar datos del POS');
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

        if (defaultLocation) {
          setBusinessLocationId((prev) => prev || defaultLocation.id);
        }
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error('Error al cargar datos del POS');
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
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
    [products]
  );

  const priceType: CartItem['priceType'] =
    selectedClient?.category === 'Mayorista'
      ? 'wholesalePrice'
      : selectedClient
        ? 'clientPrice'
        : 'price';

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (p.isService) return false;
      if (isDeliveryProduct(p)) return false;

      const q = search.toLowerCase();

      return (
        (!q ||
          p.name.toLowerCase().includes(q) ||
          String(p.sku ?? '').toLowerCase().includes(q)) &&
        (!categoryId || p.categoryId === categoryId)
      );
    });
  }, [products, search, categoryId]);

  const getCartStockRequirements = (items: CartItem[]) => {
    const requirements = new Map<
      string,
      {
        product: Product;
        required: number;
      }
    >();

    const addRequirement = (product: Product, required: number) => {
      if (required <= 0) return;

      const current = requirements.get(product.id);

      requirements.set(product.id, {
        product,
        required: (current?.required ?? 0) + required,
      });
    };

    for (const item of items) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) {
        continue;
      }

      const itemQty = item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

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
          `Stock insuficiente para ${requirement.product.name} en ${
            stockLocation === 'DEPOSITO' ? 'depósito' : 'local'
          }. Disponible: ${available}${requirement.product.saleUnit === 'KG' ? ' kg' : ''}`
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

        if (product.saleUnit === 'KG') return i;

        return {
          ...i,
          quantity: i.quantity + 1,
        };
      });
    }

    return [
      ...cart,
      {
        product,
        quantity: product.saleUnit === 'KG' ? 0 : 1,
        quantityKg: product.saleUnit === 'KG' ? 0.1 : undefined,
        priceType,
      },
    ];
  };

  const add = (product: Product) => {
    const stock = productStockByLocation(product, stockLocation);

    if (isStockControlledProduct(product) && stock <= 0) {
      toast.error(
        isCompositeProduct(product)
          ? `No se puede agregar la promo porque faltan componentes en ${
              stockLocation === 'DEPOSITO' ? 'depósito' : 'local'
            }`
          : stockLocation === 'DEPOSITO'
            ? 'Sin stock disponible en depósito'
            : 'Sin stock disponible en local'
      );

      return;
    }

    const nextCart = buildCartWithProduct(product);

    if (!validateCartStockItems(nextCart)) return;

    setCart(nextCart);
  };

  const setQty = (id: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (i.product.id !== id) return i;

      if (i.isDeliveryItem || isDeliveryProduct(i.product) || i.product.isService) {
        return {
          ...i,
          quantity: 1,
        };
      }

      return {
        ...i,
        quantity: Math.max(1, value),
      };
    });

    if (!validateCartStockItems(nextCart)) return;

    setCart(nextCart);
  };

  const setKg = (id: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (i.product.id !== id) return i;

      return {
        ...i,
        quantityKg: Math.max(0.001, value),
      };
    });

    if (!validateCartStockItems(nextCart)) return;

    setCart(nextCart);
  };

  const remove = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));

    if (deliveryProduct?.id === id) {
      setDeliveryCalculation(null);
      setDeliveryMode('PICKUP');
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
                priceType: 'price',
                isDeliveryItem: true,
              }
            : i
        );
      }

      return [
        ...prev,
        {
          product: deliveryProduct,
          quantity: 1,
          quantityKg: undefined,
          priceType: 'price',
          manualPrice: calculation.deliveryCost,
          isDeliveryItem: true,
        },
      ];
    });
  };

  const calculateDelivery = async () => {
    if (deliveryMode !== 'LOCAL_DELIVERY') return;

    if (!clientId || !selectedClient) {
      toast.error('Seleccioná un cliente para calcular el envío');
      return;
    }

    if (!clientHasCoordinates(selectedClient)) {
      toast.error('El cliente seleccionado no tiene coordenadas cargadas');
      return;
    }

    if (!businessLocationId || !selectedBusinessLocation) {
      toast.error('Seleccioná la sucursal o depósito de salida');
      return;
    }

    if (!locationHasCoordinates(selectedBusinessLocation)) {
      toast.error('La ubicación de salida no tiene coordenadas cargadas');
      return;
    }

    const pricePerKm = num(deliveryPricePerKm);

    if (pricePerKm <= 0) {
      toast.error('El precio por km debe ser mayor a 0');
      return;
    }

    setCalculatingDelivery(true);

    const toastId = toast.loading('Calculando envío...');

    try {
      const response = await api.post('/delivery/calculate', {
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
        { id: toastId }
      );
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo calcular el envío'), { id: toastId });
    } finally {
      setCalculatingDelivery(false);
    }
  };

  const productsSubtotal = cart.reduce((a, item) => {
    if (item.isDeliveryItem || isDeliveryProduct(item.product)) return a;

    const qty = item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

    return a + getItemPrice(item, priceType) * qty;
  }, 0);

  const deliveryLineSubtotal = cart.reduce((a, item) => {
    if (!item.isDeliveryItem && !isDeliveryProduct(item.product)) return a;

    return a + num(item.manualPrice, getItemPrice(item, priceType));
  }, 0);

  const deliveryCostForTotal =
    deliveryMode === 'LOCAL_DELIVERY'
      ? Math.max(num(deliveryCalculation?.deliveryCost), deliveryLineSubtotal)
      : 0;

  const subtotal = productsSubtotal;

  const discount =
    discountType === 'PERCENTAGE'
      ? productsSubtotal * (num(discountValue) / 100)
      : discountType === 'FIXED'
        ? num(discountValue)
        : 0;

  const total = Math.max(0, productsSubtotal - discount + deliveryCostForTotal);

  const paid =
    paymentMode === 'multi'
      ? payments
          .filter((p) => p.method !== 'CUENTA_CORRIENTE')
          .reduce((a, p) => a + num(p.amount), 0)
      : paymentMethod === 'CUENTA_CORRIENTE'
        ? 0
        : total;

  const debt = Math.max(0, total - paid);

  const validateCartStock = () => {
    for (const item of cart) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) {
        continue;
      }

      const qty = item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

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
      toast.error('Agregá productos al carrito');
      return false;
    }

    if (!validateCartStock()) return false;

    if ((paymentMethod === 'CUENTA_CORRIENTE' || debt > 0) && !clientId) {
      toast.error('Para cuenta corriente o pago parcial tenés que seleccionar cliente');
      return false;
    }

    if (deliveryMode === 'LOCAL_DELIVERY') {
      if (!clientId) {
        toast.error('Para envío tenés que seleccionar cliente');
        return false;
      }

      if (!businessLocationId) {
        toast.error('Seleccioná la sucursal o depósito de salida');
        return false;
      }

      if (!deliveryCalculation) {
        toast.error('Calculá el envío antes de finalizar la venta');
        return false;
      }

      if (!deliveryProduct) {
        toast.error(`No encontré el producto ${DELIVERY_SKU}`);
        return false;
      }

      if (deliveryCostForTotal <= 0) {
        toast.error('El costo de envío debe ser mayor a 0');
        return false;
      }
    }

    return true;
  };

  const submitSale = async () => {
    if (!validateSale()) return;

    setSubmitting(true);

    const toastId = toast.loading('Registrando venta...');

    try {
      const payload = {
        clientId: clientId || undefined,
        stockLocation,
        paymentMethod,
        receiptType,
        discountType: discountType || undefined,
        discountValue: discountType ? num(discountValue) : undefined,

        businessLocationId:
          deliveryMode === 'LOCAL_DELIVERY' ? businessLocationId : businessLocationId || null,

        deliveryMethod: deliveryMode,
        deliveryStatus: deliveryMode === 'LOCAL_DELIVERY' ? 'PENDING' : 'NONE',
        deliveryAddressSnapshot:
          deliveryMode === 'LOCAL_DELIVERY'
            ? deliveryCalculation?.deliveryAddressSnapshot ||
              deliveryCalculation?.destinationAddress ||
              buildClientAddress(selectedClient)
            : null,
        deliveryDistanceKm:
          deliveryMode === 'LOCAL_DELIVERY' ? deliveryCalculation?.distanceKm : null,
        deliveryPricePerKm:
          deliveryMode === 'LOCAL_DELIVERY' ? num(deliveryPricePerKm) : null,
        deliveryCost: deliveryMode === 'LOCAL_DELIVERY' ? deliveryCostForTotal : 0,

        items: [
          ...cart
            .filter((i) => !i.isDeliveryItem && !isDeliveryProduct(i.product))
            .map((i) => ({
              productId: i.product.id,
              quantity: i.product.saleUnit === 'KG' ? undefined : i.quantity,
              quantityKg: i.product.saleUnit === 'KG' ? num(i.quantityKg) : undefined,
              price: getItemPrice(i, priceType),
            })),
          ...(deliveryMode === 'LOCAL_DELIVERY' && deliveryProduct && deliveryCostForTotal > 0
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
          paymentMode === 'multi'
            ? payments
                .filter((p) => p.amount > 0 || p.method === 'CUENTA_CORRIENTE')
                .map((p) => ({
                  method: p.method,
                  amount: p.method === 'CUENTA_CORRIENTE' ? debt : num(p.amount),
                  reference: p.reference,
                  notes: p.notes,
                }))
            : undefined,
      };

      console.log('🧾 Payload venta POS:', payload);

      await api.post('/sales', payload);

      setCart([]);
      setPayments([{ method: 'EFECTIVO', amount: 0 }]);
      setDeliveryMode('PICKUP');
      setDeliveryCalculation(null);

      toast.success('Venta registrada correctamente', { id: toastId });

      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al registrar venta'), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitConfirm = () => {
    if (!validateSale()) return;

    setConfirmModal({
      title: 'Finalizar venta',
      message: `¿Confirmás registrar esta venta por ${fmtMoney(total)}?${
        debt > 0 ? ` Quedará en cuenta corriente: ${fmtMoney(debt)}.` : ''
      }`,
      confirmText: 'Finalizar venta',
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
    setPayments((prev) => [...prev, { method: 'TRANSFERENCIA', amount: 0 }]);
  };

  return (
    <AppLayout title="POS" subtitle="Ventas, promos, envíos, pagos parciales y cuenta corriente">
      <div
        className="pos-root"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 420px',
          gap: 18,
        }}
      >
        <section>
          <div
            className="pos-toolbar"
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <div className="pos-search" style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text3)',
                }}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto o SKU..."
                style={{ paddingLeft: 34 }}
              />
            </div>

            <select
              className="pos-filter"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ width: 220 }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="pos-filter"
              value={stockLocation}
              onChange={(e) => setStockLocation(e.target.value as StockLocation)}
              style={{ width: 210 }}
              title="Depósito desde donde se descuenta la mercadería"
            >
              <option value="LOCAL">Descontar de Local</option>
              <option value="DEPOSITO">Descontar de Depósito</option>
            </select>

            <button className="btn btn-secondary btn-sm pos-refresh-btn" onClick={() => load(true)} disabled={loading}>
              <RefreshCcw size={14} />
              Actualizar
            </button>
          </div>

          <div
            className="pos-products-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: 12,
            }}
          >
            {loading ? (
              <div className="skeleton" style={{ height: 240 }} />
            ) : (
              filtered.map((p) => {
                const stock = productStockByLocation(p, stockLocation);
                const withoutStock = isStockControlledProduct(p) && stock <= 0;
                const imageUrl = getProductImageUrl(p);

                return (
                  <button
                    key={p.id}
                    className="card pos-product-card"
                    onClick={() => add(p)}
                    disabled={withoutStock}
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      opacity: withoutStock ? 0.55 : 1,
                      cursor: withoutStock ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="pos-product-image"
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 14,
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                        marginBottom: 10,
                        position: 'relative',
                        padding: 8,
                      }}
                    >
                      {!imageUrl && (
                        <Package
                          size={28}
                          style={{
                            color: 'var(--text3)',
                          }}
                        />
                      )}

                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={p.name}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className={`badge ${p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-gray'}`}>
                        {p.type === 'COMPUESTO' ? 'PROMO' : p.saleUnit}
                      </span>

                      <span
                        style={{
                          color: withoutStock ? 'var(--danger)' : 'var(--text3)',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {withoutStock ? 'SIN STOCK' : stockLabel(p, stockLocation)}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, marginTop: 10, minHeight: 38 }}>{p.name}</div>

                    <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                      {categoryName(p)} · {p.sku ?? 'SIN-SKU'}
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        color: 'var(--accent)',
                        fontWeight: 900,
                        marginTop: 8,
                        fontSize: 15,
                      }}
                    >
                      {fmtMoney(productPrice(p, priceType))}
                      {p.saleUnit === 'KG' ? '/kg' : ''}
                    </div>

                    <div
                      style={{
                        color: withoutStock ? 'var(--danger)' : 'var(--text2)',
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      Stock {stockLocation === 'DEPOSITO' ? 'depósito' : 'local'}:{' '}
                      {stockLabel(p, stockLocation)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside
          className="card pos-cart"
          style={{
            padding: 0,
            alignSelf: 'start',
            position: 'sticky',
            top: 76,
            maxHeight: 'calc(100vh - 96px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div className="pos-cart-body" style={{ padding: 16, overflow: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShoppingCart size={18} />
              <b>Carrito</b>

              <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 12 }}>
                {cart.length} items
              </span>
            </div>

            <div
              className="badge badge-blue"
              style={{
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              <Warehouse size={13} />
              Descuenta de: {stockLocation === 'DEPOSITO' ? 'Depósito' : 'Local'}
            </div>

            <div className="form-group">
              <label className="form-label">Depósito / origen de stock</label>
              <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                <option value="LOCAL">Local</option>
                <option value="DEPOSITO">Depósito</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cliente</label>

              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setDeliveryCalculation(null);

                  if (deliveryMode === 'LOCAL_DELIVERY') {
                    removeDeliveryFromCart();
                  }
                }}
              >
                <option value="">Consumidor final</option>

                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientName(c)} · {c.category} · deuda {fmtMoney(c.currentBalance)}
                  </option>
                ))}
              </select>

              {deliveryMode === 'LOCAL_DELIVERY' && selectedClient && (
                <div
                  style={{
                    color: clientHasCoordinates(selectedClient) ? 'var(--text3)' : 'var(--danger)',
                    fontSize: 11,
                    marginTop: 5,
                  }}
                >
                  {clientHasCoordinates(selectedClient)
                    ? `Destino: ${buildClientAddress(selectedClient) || 'Dirección cargada'}`
                    : 'Este cliente no tiene coordenadas para calcular envío'}
                </div>
              )}
            </div>

            <div
              style={{
                margin: '14px 0',
                padding: 12,
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <Truck size={16} />
                <b style={{ fontSize: 13 }}>Entrega</b>
              </div>

              <div className="form-row pos-delivery-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    value={deliveryMode}
                    onChange={(e) => {
                      const next = e.target.value as DeliveryMode;
                      setDeliveryMode(next);
                      setDeliveryCalculation(null);

                      if (next === 'PICKUP') {
                        removeDeliveryFromCart();
                      }
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

                      if (deliveryMode === 'LOCAL_DELIVERY') {
                        removeDeliveryFromCart();
                      }
                    }}
                  >
                    <option value="">
                      {businessLocations.length ? 'Seleccionar' : 'Sin ubicaciones cargadas'}
                    </option>

                    {businessLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                        {location.isDefault ? ' · default' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {deliveryMode === 'LOCAL_DELIVERY' && (
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
                    className="btn btn-secondary"
                    onClick={calculateDelivery}
                    disabled={calculatingDelivery || !clientId || !businessLocationId}
                    style={{ width: '100%', marginBottom: 10 }}
                  >
                    {calculatingDelivery ? (
                      <>
                        <RefreshCcw size={14} className="animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      <>
                        <Truck size={14} />
                        Calcular envío
                      </>
                    )}
                  </button>

                  {deliveryCalculation && (
                    <div
                      style={{
                        border: '1px solid rgba(34,197,94,0.25)',
                        background: 'rgba(34,197,94,0.08)',
                        borderRadius: 12,
                        padding: 10,
                        fontSize: 12,
                        color: 'var(--text2)',
                      }}
                    >
                      <div style={{ fontWeight: 900, color: 'var(--success)' }}>
                        Envío: {fmtMoney(deliveryCalculation.deliveryCost)}
                      </div>
                      <div>
                        {deliveryCalculation.distanceKm} km x {fmtMoney(deliveryCalculation.pricePerKm)}
                      </div>
                      <div style={{ color: 'var(--text3)', marginTop: 4 }}>
                        Origen: {deliveryCalculation.businessLocationName}
                      </div>
                      <div style={{ color: 'var(--text3)' }}>
                        Fuente:{' '}
                        {deliveryCalculation.source === 'GOOGLE_ROUTES'
                          ? 'Google Routes'
                          : 'Coordenadas'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pos-cart-items" style={{ maxHeight: 260, overflow: 'auto', marginBottom: 12 }}>
              {cart.map((item) => {
                const itemPrice = getItemPrice(item, priceType);
                const imageUrl = getProductImageUrl(item.product);

                return (
                  <div key={item.product.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 12,
                            background: '#ffffff',
                            border: '1px solid var(--border)',
                            display: 'grid',
                            placeItems: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            padding: 5,
                          }}
                        >
                          {!imageUrl && (
                            <Package
                              size={18}
                              style={{
                                color: 'var(--text3)',
                              }}
                            />
                          )}

                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={item.product.name}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <b style={{ fontSize: 13 }}>
                            {item.product.name}
                            {item.isDeliveryItem ? ' 🚚' : ''}
                          </b>

                          <div style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', fontSize: 11 }}>
                            {fmtMoney(itemPrice)}
                            {item.product.saleUnit === 'KG' ? '/kg' : ''}
                          </div>

                          {isStockControlledProduct(item.product) && (
                            <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                              Stock {stockLocation === 'DEPOSITO' ? 'depósito' : 'local'}:{' '}
                              {stockLabel(item.product, stockLocation)}
                            </div>
                          )}

                          {isCompositeProduct(item.product) && (
                            <div style={{ color: 'var(--accent)', fontSize: 11 }}>
                              Promo: descuenta stock de sus componentes
                            </div>
                          )}

                          {!isCompositeProduct(item.product) && !isStockControlledProduct(item.product) && (
                            <div style={{ color: 'var(--accent)', fontSize: 11 }}>
                              {isDeliveryProduct(item.product)
                                ? 'Envío / servicio sin descuento de stock'
                                : 'Servicio sin descuento de stock'}
                            </div>
                          )}
                        </div>
                      </div>

                      <button className="btn btn-ghost btn-sm" onClick={() => remove(item.product.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {item.product.saleUnit === 'KG' && !item.isDeliveryItem && !isDeliveryProduct(item.product) && !item.product.isService ? (
                      <input
                        style={{ marginTop: 8 }}
                        type="number"
                        step="0.001"
                        value={item.quantityKg ?? 0}
                        onChange={(e) => setKg(item.product.id, num(e.target.value))}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setQty(item.product.id, item.quantity - 1)}
                          disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                        >
                          <Minus size={12} />
                        </button>

                        <span style={{ fontFamily: 'var(--mono)', minWidth: 32, textAlign: 'center' }}>
                          {item.quantity}
                        </span>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setQty(item.product.id, item.quantity + 1)}
                          disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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

                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | '')}>
                  <option value="">Sin descuento</option>
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED">$</option>
                </select>
              </div>
            </div>

            {discountType && (
              <div className="form-group">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Valor descuento"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Modo de pago</label>

              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as 'single' | 'multi')}>
                <option value="single">Un método</option>
                <option value="multi">Múltiples / parcial</option>
              </select>
            </div>

            {paymentMode === 'single' ? (
              <div className="form-group">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                {payments.map((p, idx) => (
                  <div
                    className="pos-payment-row"
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <select
                      value={p.method}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, method: e.target.value as PaymentMethod } : x
                          )
                        )
                      }
                    >
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={p.method === 'CUENTA_CORRIENTE' ? debt || '' : p.amount || ''}
                      disabled={p.method === 'CUENTA_CORRIENTE'}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, amount: num(e.target.value) } : x
                          )
                        )
                      }
                    />
                  </div>
                ))}

                <button className="btn btn-secondary btn-sm" onClick={addPayment}>
                  <Plus size={13} /> Agregar pago
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: 16,
              background: 'var(--surface)',
              boxShadow: '0 -14px 40px rgba(0,0,0,0.22)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', marginBottom: 5 }}>
              <span>Subtotal</span>
              <span>{fmtMoney(subtotal)}</span>
            </div>

            {deliveryMode === 'LOCAL_DELIVERY' && deliveryCostForTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)', marginBottom: 5 }}>
                <span>Envío incluido</span>
                <span>{fmtMoney(deliveryCostForTotal)}</span>
              </div>
            )}

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warn)', marginBottom: 5 }}>
                <span>Descuento</span>
                <span>-{fmtMoney(discount)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 900,
                fontSize: 22,
                marginTop: 8,
                marginBottom: 10,
              }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmtMoney(total)}</span>
            </div>

            {debt > 0 && (
              <div className="badge badge-yellow" style={{ marginBottom: 10 }}>
                Queda en cuenta corriente: {fmtMoney(debt)}
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={submitting || !cart.length}
              onClick={openSubmitConfirm}
              style={{
                width: '100%',
                height: 48,
                fontSize: 15,
                fontWeight: 900,
              }}
            >
              <Check size={17} />
              {submitting ? 'Registrando venta...' : `Finalizar venta · ${fmtMoney(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal pos-confirm-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer pos-confirm-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}


      <style jsx>{`
        @media (max-width: 1100px) {
          .pos-root {
            grid-template-columns: minmax(0, 1fr) 380px !important;
            gap: 14px !important;
          }

          .pos-products-grid {
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .pos-root {
            grid-template-columns: 1fr !important;
          }

          .pos-cart {
            position: static !important;
            top: auto !important;
            max-height: none !important;
            order: -1;
            border-radius: 18px;
          }

          .pos-cart-body {
            max-height: none !important;
            overflow: visible !important;
          }

          .pos-cart-items {
            max-height: 280px !important;
          }
        }

        .pos-product-card {
          min-height: 335px;
        }

        .pos-product-image {
          height: auto !important;
          aspect-ratio: 1 / 1;
        }

        @media (max-width: 768px) {
          .pos-root {
            gap: 14px !important;
          }

          .pos-toolbar {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 12px !important;
          }

          .pos-search {
            min-width: 0 !important;
            width: 100%;
          }

          .pos-search input,
          .pos-filter,
          .pos-refresh-btn {
            width: 100% !important;
          }

          .pos-refresh-btn {
            justify-content: center;
            height: 42px;
          }

          .pos-products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .pos-product-card {
            padding: 12px !important;
            border-radius: 16px;
            min-width: 0;
            min-height: 330px;
          }

          .pos-product-card > div:first-child {
            align-items: flex-start;
          }

          .pos-product-image {
            height: auto !important;
            aspect-ratio: 1 / 1;
          }

          .pos-product-card b,
          .pos-product-card div {
            overflow-wrap: anywhere;
          }

          .pos-cart {
            border-radius: 18px;
            overflow: hidden;
          }

          .pos-cart-body {
            padding: 14px !important;
          }

          .pos-delivery-row {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .pos-cart-items {
            max-height: 240px !important;
            padding-right: 2px;
          }

          .pos-payment-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .pos-confirm-modal {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .pos-confirm-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .pos-confirm-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .pos-products-grid {
            grid-template-columns: 1fr !important;
          }

          .pos-product-card {
            padding: 12px !important;
            min-height: auto;
          }

          .pos-product-image {
            height: auto !important;
            aspect-ratio: 1 / 1;
          }

          .pos-cart-body {
            padding: 12px !important;
          }

          .pos-cart-items {
            max-height: 220px !important;
          }

          .pos-confirm-modal {
            border-radius: 16px;
          }
        }
      `}</style>

    </AppLayout>
  );
}