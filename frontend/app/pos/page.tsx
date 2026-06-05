'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type {
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
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
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

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

function productStockByLocation(product: Product, stockLocation: StockLocation) {
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
  if (product.type === 'COMPUESTO') return 'por componentes';

  const stock = productStockByLocation(product, stockLocation);

  return product.saleUnit === 'KG' ? `${stock} kg` : `${stock}`;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');

  const [stockLocation, setStockLocation] = useState<StockLocation>('LOCAL');

  const [receiptType, setReceiptType] = useState<ReceiptType>('TICKET');
  const [discountType, setDiscountType] = useState<DiscountType | ''>('');
  const [discountValue, setDiscountValue] = useState('');

  const [paymentMode, setPaymentMode] = useState<'single' | 'multi'>('single');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [payments, setPayments] = useState<SalePayment[]>([
    { method: 'EFECTIVO', amount: 0 },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = async () => {
    setLoading(true);

    try {
      const [p, c, cl] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
        api.get('/clients'),
      ]);

      setProducts(normalizeArray<Product>(p.data).filter((x) => x.isActive !== false));
      setCategories(normalizeArray<ProductCategory>(c.data));
      setClients(normalizeArray<Client>(cl.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar datos del POS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const priceType: CartItem['priceType'] =
    selectedClient?.category === 'Mayorista'
      ? 'wholesalePrice'
      : selectedClient
        ? 'clientPrice'
        : 'price';

  const filtered = useMemo(() => {
    return products.filter((p) => {
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

    if (product.type !== 'COMPUESTO' && stock <= 0) {
      showToast(
        'error',
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

          if (product.type !== 'COMPUESTO' && nextQty > stock) {
            showToast(
              'error',
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

        const stock = productStockByLocation(i.product, stockLocation);
        const nextQty = Math.max(1, value);

        if (i.product.type !== 'COMPUESTO' && nextQty > stock) {
          showToast(
            'error',
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

        if (i.product.type !== 'COMPUESTO' && nextKg > stock) {
          showToast(
            'error',
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
  };

  const subtotal = cart.reduce((a, item) => {
    const qty =
      item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

    return a + productPrice(item.product, priceType) * qty;
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
      if (item.product.type === 'COMPUESTO') continue;

      const stock = productStockByLocation(item.product, stockLocation);
      const qty =
        item.product.saleUnit === 'KG' ? num(item.quantityKg) : item.quantity;

      if (qty <= 0) {
        showToast('error', `Cantidad inválida para ${item.product.name}`);
        return false;
      }

      if (qty > stock) {
        showToast(
          'error',
          `Stock insuficiente para ${item.product.name} en ${
            stockLocation === 'DEPOSITO' ? 'depósito' : 'local'
          }. Disponible: ${stock}${item.product.saleUnit === 'KG' ? ' kg' : ''}`
        );

        return false;
      }
    }

    return true;
  };

  const submit = async () => {
    if (!cart.length) {
      showToast('error', 'Agregá productos al carrito');
      return;
    }

    if (!validateCartStock()) return;

    if ((paymentMethod === 'CUENTA_CORRIENTE' || debt > 0) && !clientId) {
      showToast(
        'error',
        'Para cuenta corriente o pago parcial tenés que seleccionar cliente'
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        clientId: clientId || undefined,
        stockLocation,
        paymentMethod,
        receiptType,
        discountType: discountType || undefined,
        discountValue: discountType ? num(discountValue) : undefined,

        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.product.saleUnit === 'KG' ? undefined : i.quantity,
          quantityKg:
            i.product.saleUnit === 'KG' ? num(i.quantityKg) : undefined,
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

      showToast('success', 'Venta registrada correctamente');

      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al registrar venta'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addPayment = () => {
    setPayments((prev) => [...prev, { method: 'TRANSFERENCIA', amount: 0 }]);
  };

  return (
    <AppLayout
      title="POS"
      subtitle="Ventas, promos, pagos parciales y cuenta corriente"
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            minWidth: 280,
            maxWidth: 420,
            borderRadius: 14,
            border:
              toast.type === 'success'
                ? '1px solid rgba(34,197,94,0.35)'
                : '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(15,23,42,0.96)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: 1 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 1 }} />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
              {toast.type === 'success' ? 'Listo' : 'Atención'}
            </div>

            <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>
              {toast.message}
            </div>
          </div>

          <button
            onClick={() => setToast(null)}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 400px',
          gap: 18,
        }}
      >
        <section>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
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
              value={stockLocation}
              onChange={(e) => setStockLocation(e.target.value as StockLocation)}
              style={{ width: 210 }}
              title="Depósito desde donde se descuenta la mercadería"
            >
              <option value="LOCAL">Descontar de Local</option>
              <option value="DEPOSITO">Descontar de Depósito</option>
            </select>
          </div>

          <div
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
                const withoutStock = p.type !== 'COMPUESTO' && stock <= 0;

                return (
                  <button
                    key={p.id}
                    className="card"
                    onClick={() => add(p)}
                    disabled={withoutStock}
                    style={{
                      padding: 14,
                      textAlign: 'left',
                      opacity: withoutStock ? 0.55 : 1,
                      cursor: withoutStock ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
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

                      <span
                        className={`badge ${
                          p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-gray'
                        }`}
                      >
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
          className="card"
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
          <div
            style={{
              padding: 16,
              overflow: 'auto',
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <ShoppingCart size={18} />
              <b>Carrito</b>

              <span
                style={{
                  marginLeft: 'auto',
                  color: 'var(--text3)',
                  fontSize: 12,
                }}
              >
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
              <select
                value={stockLocation}
                onChange={(e) => setStockLocation(e.target.value as StockLocation)}
              >
                <option value="LOCAL">Local</option>
                <option value="DEPOSITO">Depósito</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cliente</label>

              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Consumidor final</option>

                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientName(c)} · {c.category} · deuda{' '}
                    {fmtMoney(c.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ maxHeight: 260, overflow: 'auto', marginBottom: 12 }}>
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    padding: '10px 0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 13 }}>{item.product.name}</b>

                      <div
                        style={{
                          fontFamily: 'var(--mono)',
                          color: 'var(--text3)',
                          fontSize: 11,
                        }}
                      >
                        {fmtMoney(productPrice(item.product, priceType))}
                        {item.product.saleUnit === 'KG' ? '/kg' : ''}
                      </div>

                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                        Stock {stockLocation === 'DEPOSITO' ? 'depósito' : 'local'}:{' '}
                        {stockLabel(item.product, stockLocation)}
                      </div>
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(item.product.id)}
                    >
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
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 8,
                        alignItems: 'center',
                      }}
                    >
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQty(item.product.id, item.quantity - 1)}
                      >
                        <Minus size={12} />
                      </button>

                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          minWidth: 32,
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </span>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQty(item.product.id, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Comprobante</label>

                <select
                  value={receiptType}
                  onChange={(e) => setReceiptType(e.target.value as ReceiptType)}
                >
                  <option value="TICKET">Ticket</option>
                  <option value="FACTURA">Factura</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descuento</label>

                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as DiscountType | '')
                  }
                >
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

              <select
                value={paymentMode}
                onChange={(e) =>
                  setPaymentMode(e.target.value as 'single' | 'multi')
                }
              >
                <option value="single">Un método</option>
                <option value="multi">Múltiples / parcial</option>
              </select>
            </div>

            {paymentMode === 'single' ? (
              <div className="form-group">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
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
                            i === idx
                              ? { ...x, method: e.target.value as PaymentMethod }
                              : x
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
                      value={
                        p.method === 'CUENTA_CORRIENTE'
                          ? debt || ''
                          : p.amount || ''
                      }
                      disabled={p.method === 'CUENTA_CORRIENTE'}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, amount: num(e.target.value) }
                              : x
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--text2)',
                marginBottom: 5,
              }}
            >
              <span>Subtotal</span>
              <span>{fmtMoney(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--warn)',
                  marginBottom: 5,
                }}
              >
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
              onClick={submit}
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
    </AppLayout>
  );
}