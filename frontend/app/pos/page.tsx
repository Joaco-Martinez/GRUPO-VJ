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

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

function productStockByLocation(product: Product, stockLocation: StockLocation) {
  if (product.isService) return 999999;
  if (product.type === 'COMPUESTO') return 999999;

  if (product.saleUnit === 'KG') {
    return stockLocation === 'DEPOSITO'
      ? num(product.stockDepositoKg)
      : num(product.stockLocalKg);
  }

  return stockLocation === 'DEPOSITO'
    ? num(product.stockDeposito)
    : num(product.stockLocal);
}

function stockLabel(product: Product, stockLocation: StockLocation) {
  if (product.isService) return 'servicio';
  if (product.type === 'COMPUESTO') return 'por componentes';

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
    () =>
      products.find(
        (p) => p.sku === DELIVERY_SKU || p.name.toUpperCase().includes('ENVÍO')
      ),
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

      const q = search.toLowerCase();

      return (
        (!q ||
          p.name.toLowerCase().includes(q) ||
          String(p.sku ?? '').toLowerCase().includes(q)) &&
        (!categoryId || p.categoryId === categoryId)
      );
    });
  }, [products, search, categoryId]);

  const add = (product: Product) => {
    const stock = productStockByLocation(product, stockLocation);

    if (!product.isService && product.type !== 'COMPUESTO' && stock <= 0) {
      toast.error(
        stockLocation === 'DEPOSITO'
          ? 'Sin stock disponible en depósito'
          : 'Sin stock disponible en local'
      );
      return;
    }

    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);

      if (exists) {
        return prev.map((i) => {
          if (i.product.id !== product.id) return i;

          if (product.saleUnit === 'KG') return i;

          const nextQty = i.quantity + 1;

          if (!product.isService && product.type !== 'COMPUESTO' && nextQty > stock) {
            toast.error(
              stockLocation === 'DEPOSITO'
                ? 'No hay más stock disponible en depósito'
                : 'No hay más stock disponible en local'
            );

            return i;
          }

          return {
            ...i,
            quantity: nextQty,
          };
        });
      }

      return [
        ...prev,
        {
          product,
          quantity: product.saleUnit === 'KG' ? 0 : 1,
          quantityKg: product.saleUnit === 'KG' ? 0.1 : undefined,
          priceType,
        },
      ];
    });
  };

  const setQty = (id: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== id) return i;

        if (i.isDeliveryItem || i.product.isService) {
          return {
            ...i,
            quantity: 1,
          };
        }

        const stock = productStockByLocation(i.product, stockLocation);
        const nextQty = Math.max(1, value);

        if (i.product.type !== 'COMPUESTO' && nextQty > stock) {
          toast.error(
            stockLocation === 'DEPOSITO'
              ? 'No hay suficiente stock en depósito'
              : 'No hay suficiente stock en local'
          );

          return i;
        }

        return {
          ...i,
          quantity: nextQty,
        };
      })
    );
  };

  const setKg = (id: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== id) return i;

        const stock = productStockByLocation(i.product, stockLocation);
        const nextKg = Math.max(0.001, value);

        if (!i.product.isService && i.product.type !== 'COMPUESTO' && nextKg > stock) {
          toast.error(
            stockLocation === 'DEPOSITO'
              ? 'No hay suficiente stock KG en depósito'
              : 'No hay suficiente stock KG en local'
          );

          return i;
        }

        return {
          ...i,
          quantityKg: nextKg,
        };
      })
    );
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

  const subtotal = cart.reduce((a, item) => {
    const qty = item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

    return a + getItemPrice(item, priceType) * qty;
  }, 0);

  const discount =
    discountType === 'PERCENTAGE'
      ? subtotal * (num(discountValue) / 100)
      : discountType === 'FIXED'
        ? num(discountValue)
        : 0;

  const total = Math.max(0, subtotal - discount);

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
      if (item.product.isService) continue;
      if (item.product.type === 'COMPUESTO') continue;

      const stock = productStockByLocation(item.product, stockLocation);
      const qty = item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

      if (qty <= 0) {
        toast.error(`Cantidad inválida para ${item.product.name}`);
        return false;
      }

      if (qty > stock) {
        toast.error(
          `Stock insuficiente para ${item.product.name} en ${
            stockLocation === 'DEPOSITO' ? 'depósito' : 'local'
          }. Disponible: ${stock}${item.product.saleUnit === 'KG' ? ' kg' : ''}`
        );

        return false;
      }
    }

    return true;
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

      const hasDeliveryItem = cart.some((item) => item.product.id === deliveryProduct.id);

      if (!hasDeliveryItem) {
        toast.error('El envío no está agregado al carrito');
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
        deliveryCost: deliveryMode === 'LOCAL_DELIVERY' ? deliveryCalculation?.deliveryCost ?? 0 : 0,

        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.product.saleUnit === 'KG' ? undefined : i.quantity,
          quantityKg: i.product.saleUnit === 'KG' ? num(i.quantityKg) : undefined,
          price:
            i.isDeliveryItem && deliveryMode === 'LOCAL_DELIVERY'
              ? num(deliveryCalculation?.deliveryCost)
              : getItemPrice(i, priceType),
        })),

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
                const withoutStock = !p.isService && p.type !== 'COMPUESTO' && stock <= 0;

                return (
                  <button
                    key={p.id}
                    className="card pos-product-card"
                    onClick={() => add(p)}
                    disabled={withoutStock}
                    style={{
                      padding: 14,
                      textAlign: 'left',
                      opacity: withoutStock ? 0.55 : 1,
                      cursor: withoutStock ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'var(--surface2)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Package size={16} />
                      </span>

                      <span className={`badge ${p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-gray'}`}>
                        {p.type === 'COMPUESTO' ? 'PROMO' : p.saleUnit}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, marginTop: 12 }}>{p.name}</div>

                    <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                      {categoryName(p)} · {p.sku ?? 'SIN-SKU'}
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        color: 'var(--accent)',
                        fontWeight: 900,
                        marginTop: 8,
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

                return (
                  <div key={item.product.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <b style={{ fontSize: 13 }}>
                          {item.product.name}
                          {item.isDeliveryItem ? ' 🚚' : ''}
                        </b>

                        <div style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', fontSize: 11 }}>
                          {fmtMoney(itemPrice)}
                          {item.product.saleUnit === 'KG' ? '/kg' : ''}
                        </div>

                        {!item.product.isService && (
                          <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                            Stock {stockLocation === 'DEPOSITO' ? 'depósito' : 'local'}:{' '}
                            {stockLabel(item.product, stockLocation)}
                          </div>
                        )}

                        {item.product.isService && (
                          <div style={{ color: 'var(--accent)', fontSize: 11 }}>
                            Servicio sin descuento de stock
                          </div>
                        )}
                      </div>

                      <button className="btn btn-ghost btn-sm" onClick={() => remove(item.product.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {item.product.saleUnit === 'KG' ? (
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
                          disabled={item.isDeliveryItem || item.product.isService}
                        >
                          <Minus size={12} />
                        </button>

                        <span style={{ fontFamily: 'var(--mono)', minWidth: 32, textAlign: 'center' }}>
                          {item.quantity}
                        </span>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setQty(item.product.id, item.quantity + 1)}
                          disabled={item.isDeliveryItem || item.product.isService}
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

            {deliveryCalculation && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)', marginBottom: 5 }}>
                <span>Envío incluido</span>
                <span>{fmtMoney(deliveryCalculation.deliveryCost)}</span>
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
          }

          .pos-product-card > div:first-child {
            align-items: flex-start;
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