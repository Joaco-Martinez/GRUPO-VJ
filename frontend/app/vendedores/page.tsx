/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  ArrowRightLeft,
  CalendarDays,
  DollarSign,
  Eye,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound,
  Users,
  Warehouse,
  X,
} from 'lucide-react';

const PAGE_SIZE = 8;

type UserView = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  client?: unknown;
};

type SaleItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  productSkuSnapshot?: string | null;
  product?: {
    id?: string | null;
    name?: string | null;
    sku?: string | null;
    saleUnit?: string | null;
    category?: {
      name?: string | null;
    } | null;
  } | null;
  quantity?: number | null;
  quantityKg?: number | null;
  price?: number | null;
  subtotal?: number | null;
};

type PaymentView = {
  method?: string | null;
  amount?: number | null;
  reference?: string | null;
  notes?: string | null;
};

type SaleView = {
  id: string;
  userId?: string | null;
  user?: UserView | null;
  client?: unknown;
  subtotal?: number | null;
  total?: number | null;
  status?: string | null;
  invoiceStatus?: string | null;
  isInvoiced?: boolean | null;
  paymentMethod?: string | null;
  stockLocation?: string | null;
  accountDebtAmount?: number | null;
  createdAt?: string | null;
  items?: SaleItemView[];
  payments?: PaymentView[];
};

type StockMovementView = {
  id: string;
  productId?: string | null;
  userId?: string | null;
  user?: UserView | null;
  product?: {
    id?: string | null;
    name?: string | null;
    sku?: string | null;
    saleUnit?: string | null;
    category?: {
      name?: string | null;
    } | null;
  } | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  quantity?: number | null;
  quantityKg?: number | null;
  reason?: string | null;
  reference?: string | null;
  createdAt?: string | null;
};

type ProductAggregate = {
  key: string;
  name: string;
  sku?: string | null;
  quantity: number;
  quantityKg: number;
  unitsLabel: string;
  subtotal: number;
  salesCount: number;
};

type SellerSummary = {
  seller: UserView;
  sales: SaleView[];
  movements: StockMovementView[];
  products: ProductAggregate[];
  totalSold: number;
  totalDebt: number;
  completedSales: number;
  pendingSales: number;
  cancelledSales: number;
  averageTicket: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    (error as { message?: string })?.message ??
    fallback
  );
}

function toInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayRange(dateValue: string) {
  const safeDate = dateValue || toInputDate();
  const from = new Date(`${safeDate}T00:00:00`);
  const to = new Date(`${safeDate}T23:59:59.999`);

  return { from, to };
}

function isSameDay(value: unknown, dateValue: string) {
  if (!value) return false;

  const { from, to } = getDayRange(dateValue);
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return false;

  return date >= from && date <= to;
}

function normalizeResponseArray<T>(data: unknown): T[] {
  return normalizeArray<T>(
    (data as any)?.items ??
      (data as any)?.users ??
      (data as any)?.sales ??
      (data as any)?.movements ??
      (data as any)?.data ??
      (data as any)?.results ??
      (data as any)?.rows ??
      data
  );
}

function getClientLabel(client: unknown) {
  return clientName(client as Parameters<typeof clientName>[0]);
}

function isSellerRole(role?: string | null) {
  const cleanRole = String(role ?? '').toUpperCase();
  return cleanRole === 'ADMIN' || cleanRole === 'EMPLEADO';
}

function countsAsMoney(sale: SaleView) {
  return (
    sale.status !== 'CANCELLED' &&
    (sale.status === 'COMPLETED' || sale.isInvoiced || sale.invoiceStatus === 'INVOICED')
  );
}

function getSellerIdFromSale(sale: SaleView) {
  return sale.userId || sale.user?.id || 'sin-vendedor';
}

function getSellerName(seller?: UserView | null) {
  return seller?.name || seller?.email || 'Sin vendedor';
}

function getStockLocationLabel(value?: string | null) {
  const location = String(value ?? '').toUpperCase();

  if (location === 'LOCAL') return 'Mayorista';
  if (location === 'DEPOSITO') return 'Minorista';

  return 'Sin dato';
}

function getMovementTypeLabel(type?: string | null) {
  const value = String(type ?? '').toUpperCase();

  if (value === 'SALE') return 'Venta';
  if (value === 'SALE_CANCEL') return 'Cancelación venta';
  if (value === 'TRANSFER') return 'Transferencia';
  if (value === 'INGRESS') return 'Ingreso';
  if (value === 'ADJUSTMENT') return 'Ajuste';

  return value || 'Movimiento';
}

function getMovementBadgeClass(type?: string | null) {
  const value = String(type ?? '').toUpperCase();

  if (value === 'SALE') return 'badge-green';
  if (value === 'SALE_CANCEL') return 'badge-red';
  if (value === 'TRANSFER') return 'badge-yellow';
  if (value === 'INGRESS') return 'badge-green';
  if (value === 'ADJUSTMENT') return 'badge-gray';

  return 'badge-gray';
}

function getRoleBadgeClass(role?: string | null) {
  const value = String(role ?? '').toUpperCase();

  if (value === 'ADMIN') return 'badge-green';
  if (value === 'EMPLEADO') return 'badge-yellow';

  return 'badge-gray';
}

function getSaleStatusBadgeClass(status?: string | null) {
  const value = String(status ?? '').toUpperCase();

  if (value === 'COMPLETED') return 'badge-green';
  if (value === 'PENDING') return 'badge-yellow';
  if (value === 'CANCELLED') return 'badge-red';

  return 'badge-gray';
}

function getItemName(item: SaleItemView) {
  return item.productNameSnapshot || item.product?.name || 'Producto';
}

function getItemSku(item: SaleItemView) {
  return item.productSkuSnapshot || item.product?.sku || null;
}

function getMovementQuantityLabel(movement: StockMovementView) {
  if (
    movement.quantityKg !== undefined &&
    movement.quantityKg !== null &&
    num(movement.quantityKg) > 0
  ) {
    return `${num(movement.quantityKg).toLocaleString('es-AR')} kg`;
  }

  return `${num(movement.quantity).toLocaleString('es-AR')} u.`;
}

function buildProductAggregates(sales: SaleView[]) {
  const map = new Map<string, ProductAggregate>();

  for (const sale of sales.filter(countsAsMoney)) {
    for (const item of sale.items ?? []) {
      const productId = item.productId || item.product?.id || getItemName(item);
      const key = String(productId);
      const quantity = num(item.quantity);
      const quantityKg = num(item.quantityKg);
      const subtotal =
        item.subtotal !== undefined && item.subtotal !== null
          ? num(item.subtotal)
          : num(item.price) * (quantityKg > 0 ? quantityKg : quantity || 1);

      const existing = map.get(key);

      if (existing) {
        existing.quantity += quantity;
        existing.quantityKg += quantityKg;
        existing.subtotal += subtotal;
        existing.salesCount += 1;
        existing.unitsLabel = existing.quantityKg > 0
          ? `${existing.quantityKg.toLocaleString('es-AR')} kg`
          : `${existing.quantity.toLocaleString('es-AR')} u.`;
        continue;
      }

      map.set(key, {
        key,
        name: getItemName(item),
        sku: getItemSku(item),
        quantity,
        quantityKg,
        unitsLabel:
          quantityKg > 0
            ? `${quantityKg.toLocaleString('es-AR')} kg`
            : `${quantity.toLocaleString('es-AR')} u.`,
        subtotal,
        salesCount: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal);
}

function buildSellerSummaries(users: UserView[], sales: SaleView[], movements: StockMovementView[]) {
  const sellerMap = new Map<string, UserView>();

  for (const user of users) {
    if (!user?.id) continue;
    if (!isSellerRole(user.role)) continue;
    sellerMap.set(user.id, user);
  }

  for (const sale of sales) {
    const sellerId = getSellerIdFromSale(sale);
    if (sellerId === 'sin-vendedor') continue;

    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, {
        id: sellerId,
        name: sale.user?.name || 'Sin nombre',
        email: sale.user?.email || null,
        role: sale.user?.role || 'EMPLEADO',
        isActive: sale.user?.isActive ?? true,
        createdAt: sale.user?.createdAt ?? null,
        updatedAt: sale.user?.updatedAt ?? null,
      });
    }
  }

  for (const movement of movements) {
    const sellerId = movement.userId || movement.user?.id;
    if (!sellerId) continue;

    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, {
        id: sellerId,
        name: movement.user?.name || 'Sin nombre',
        email: movement.user?.email || null,
        role: movement.user?.role || 'EMPLEADO',
        isActive: movement.user?.isActive ?? true,
        createdAt: movement.user?.createdAt ?? null,
        updatedAt: movement.user?.updatedAt ?? null,
      });
    }
  }

  return Array.from(sellerMap.values())
    .map((seller) => {
      const sellerSales = sales.filter((sale) => getSellerIdFromSale(sale) === seller.id);
      const sellerMovements = movements.filter(
        (movement) => (movement.userId || movement.user?.id) === seller.id
      );
      const moneySales = sellerSales.filter(countsAsMoney);
      const totalSold = moneySales.reduce((acc, sale) => acc + num(sale.total), 0);
      const totalDebt = moneySales.reduce((acc, sale) => acc + num(sale.accountDebtAmount), 0);
      const completedSales = sellerSales.filter((sale) => sale.status === 'COMPLETED').length;
      const pendingSales = sellerSales.filter((sale) => sale.status === 'PENDING').length;
      const cancelledSales = sellerSales.filter((sale) => sale.status === 'CANCELLED').length;

      return {
        seller,
        sales: sellerSales,
        movements: sellerMovements,
        products: buildProductAggregates(sellerSales),
        totalSold,
        totalDebt,
        completedSales,
        pendingSales,
        cancelledSales,
        averageTicket: moneySales.length ? totalSold / moneySales.length : 0,
      } satisfies SellerSummary;
    })
    .sort((a, b) => b.totalSold - a.totalSold);
}

export default function VendedoresPage() {
  const [users, setUsers] = useState<UserView[]>([]);
  const [sales, setSales] = useState<SaleView[]>([]);
  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [date, setDate] = useState(toInputDate());
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<SellerSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async (showSuccess = false) => {
    setLoading(true);
    setUsersError(null);

    try {
      const { from, to } = getDayRange(date);

      const usersRequest = api
        .get('/users')
        .then((response) => normalizeResponseArray<UserView>(response.data))
        .catch((error) => {
          setUsersError(getErrorMessage(error, 'No se pudieron cargar usuarios'));
          return [] as UserView[];
        });

      const salesRequest = api.get('/sales').then((response) =>
        normalizeResponseArray<SaleView>(response.data).filter((sale) => isSameDay(sale.createdAt, date))
      );

      const movementsRequest = api
        .get('/products/movements', {
          params: {
            fromDate: from.toISOString(),
            toDate: to.toISOString(),
          },
        })
        .then((response) => normalizeResponseArray<StockMovementView>(response.data))
        .catch(() => [] as StockMovementView[]);

      const [loadedUsers, loadedSales, loadedMovements] = await Promise.all([
        usersRequest,
        salesRequest,
        movementsRequest,
      ]);

      setUsers(loadedUsers);
      setSales(loadedSales);
      setMovements(loadedMovements);

      if (showSuccess) {
        toast.success('Vendedores actualizados');
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, 'No se pudo cargar la información de vendedores'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, date]);

  const summaries = useMemo(() => buildSellerSummaries(users, sales, movements), [users, sales, movements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return summaries;

    return summaries.filter((summary) => {
      const seller = summary.seller;

      return (
        String(seller.name ?? '').toLowerCase().includes(q) ||
        String(seller.email ?? '').toLowerCase().includes(q) ||
        String(seller.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [summaries, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totals = useMemo(() => {
    const moneySales = sales.filter(countsAsMoney);

    return {
      sellers: summaries.length,
      totalSold: moneySales.reduce((acc, sale) => acc + num(sale.total), 0),
      sales: moneySales.length,
      movements: movements.length,
      products: moneySales.reduce((acc, sale) => acc + (sale.items?.length ?? 0), 0),
    };
  }, [sales, movements, summaries]);

  const selected = selectedSeller
    ? summaries.find((summary) => summary.seller.id === selectedSeller.seller.id) ?? selectedSeller
    : null;

  return (
    <AppLayout
      title="Vendedores"
      subtitle="Resumen diario de ventas, productos vendidos y movimientos de stock"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Actualizar
        </button>
      }
    >
      <div className="seller-toolbar">
        <div className="seller-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar vendedor por nombre, email o rol..."
          />
        </div>

        <label className="seller-date-filter">
          <CalendarDays size={14} />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {usersError && (
        <div className="seller-warning">
          No pude leer <b>/users</b>. Igual armé la vista con vendedores encontrados en ventas y movimientos.
        </div>
      )}

      <div className="seller-stats-grid">
        <div className="stat-card seller-stat-card">
          <span>
            <Users size={18} />
          </span>
          <div>
            <div className="stat-value">{totals.sellers}</div>
            <div className="stat-label">Vendedores</div>
          </div>
        </div>

        <div className="stat-card seller-stat-card">
          <span>
            <DollarSign size={18} />
          </span>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {fmtMoney(totals.totalSold)}
            </div>
            <div className="stat-label">Vendido en el día</div>
          </div>
        </div>

        <div className="stat-card seller-stat-card">
          <span>
            <ShoppingCart size={18} />
          </span>
          <div>
            <div className="stat-value">{totals.sales}</div>
            <div className="stat-label">Ventas reales</div>
          </div>
        </div>

        <div className="stat-card seller-stat-card">
          <span>
            <Package size={18} />
          </span>
          <div>
            <div className="stat-value">{totals.products}</div>
            <div className="stat-label">Items vendidos</div>
          </div>
        </div>

        <div className="stat-card seller-stat-card">
          <span>
            <ArrowRightLeft size={18} />
          </span>
          <div>
            <div className="stat-value">{totals.movements}</div>
            <div className="stat-label">Mov. stock</div>
          </div>
        </div>
      </div>

      <div className="card seller-card">
        {loading ? (
          <div style={{ padding: 18 }}>
            <div className="skeleton" style={{ height: 300 }} />
          </div>
        ) : filtered.length ? (
          <>
            <div className="seller-list">
              {paginated.map((summary) => (
                <article key={summary.seller.id} className="seller-row">
                  <div className="seller-avatar">
                    <UserRound size={20} />
                  </div>

                  <div className="seller-main">
                    <div className="seller-head">
                      <div>
                        <h3>{getSellerName(summary.seller)}</h3>
                        <p>{summary.seller.email || 'Sin email'}</p>
                      </div>

                      <div className="seller-badges">
                        <span className={`badge ${getRoleBadgeClass(summary.seller.role)}`}>
                          {summary.seller.role || 'SIN ROL'}
                        </span>
                        <span className={`badge ${summary.seller.isActive === false ? 'badge-red' : 'badge-green'}`}>
                          {summary.seller.isActive === false ? 'Inactivo' : 'Activo'}
                        </span>
                      </div>
                    </div>

                    <div className="seller-metrics">
                      <div>
                        <small>Vendido</small>
                        <b className="seller-money">{fmtMoney(summary.totalSold)}</b>
                      </div>

                      <div>
                        <small>Ventas</small>
                        <b>{summary.completedSales}</b>
                      </div>

                      <div>
                        <small>Pendientes</small>
                        <b>{summary.pendingSales}</b>
                      </div>

                      <div>
                        <small>Mov. stock</small>
                        <b>{summary.movements.length}</b>
                      </div>

                      <div>
                        <small>Ticket prom.</small>
                        <b>{fmtMoney(summary.averageTicket)}</b>
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSeller(summary)}>
                    <Eye size={14} />
                    Ver detalle
                  </button>
                </article>
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="seller-pagination">
                <span>
                  Página {currentPage} de {totalPages}
                </span>

                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="seller-empty">
            <Users size={40} />
            <b>Sin vendedores para este día</b>
            <p>No encontré ventas ni movimientos de stock con vendedor asignado.</p>
          </div>
        )}
      </div>

      {mounted && selected && createPortal(
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedSeller(null)}>
          <div className="modal seller-detail-modal">
            <div className="modal-header">
              <div>
                <b>{getSellerName(selected.seller)}</b>
                <small>{selected.seller.email || 'Sin email'} · {selected.seller.role || 'SIN ROL'}</small>
              </div>

              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSeller(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body seller-detail-body">
              <section className="seller-detail-grid">
                <div>
                  <small>Total vendido</small>
                  <b className="seller-money">{fmtMoney(selected.totalSold)}</b>
                </div>

                <div>
                  <small>Ventas completadas</small>
                  <b>{selected.completedSales}</b>
                </div>

                <div>
                  <small>Ventas pendientes</small>
                  <b>{selected.pendingSales}</b>
                </div>

                <div>
                  <small>Canceladas</small>
                  <b>{selected.cancelledSales}</b>
                </div>

                <div>
                  <small>Deuda generada</small>
                  <b>{fmtMoney(selected.totalDebt)}</b>
                </div>

                <div>
                  <small>Movimientos stock</small>
                  <b>{selected.movements.length}</b>
                </div>
              </section>

              <section className="seller-section">
                <div className="seller-section-head">
                  <b>Productos vendidos</b>
                  <span>{selected.products.length}</span>
                </div>

                {selected.products.length ? (
                  <div className="seller-products-list">
                    {selected.products.map((product) => (
                      <div key={product.key} className="seller-product-row">
                        <span>
                          <Package size={16} />
                        </span>
                        <div>
                          <b>{product.name}</b>
                          <small>{product.sku || 'SIN-SKU'} · {product.unitsLabel} · {product.salesCount} venta/s</small>
                        </div>
                        <strong>{fmtMoney(product.subtotal)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="seller-muted-box">No vendió productos reales en esta fecha.</div>
                )}
              </section>

              <section className="seller-section">
                <div className="seller-section-head">
                  <b>Ventas del día</b>
                  <span>{selected.sales.length}</span>
                </div>

                {selected.sales.length ? (
                  <div className="seller-sales-list">
                    {selected.sales.map((sale) => (
                      <div key={sale.id} className="seller-sale-row">
                        <div>
                          <b>#{sale.id.slice(-8)}</b>
                          <small>{fmtDate(String(sale.createdAt))} · {getClientLabel(sale.client)}</small>
                        </div>

                        <div className="seller-sale-badges">
                          <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>{sale.status}</span>
                          <span className="badge badge-gray">{getStockLocationLabel(sale.stockLocation)}</span>
                          <span className="badge badge-gray">{sale.payments?.length ? 'MIXTO' : sale.paymentMethod}</span>
                        </div>

                        <strong>{fmtMoney(num(sale.total))}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="seller-muted-box">No tiene ventas registradas en esta fecha.</div>
                )}
              </section>

              <section className="seller-section">
                <div className="seller-section-head">
                  <b>Movimientos de stock</b>
                  <span>{selected.movements.length}</span>
                </div>

                {selected.movements.length ? (
                  <div className="seller-movements-list">
                    {selected.movements.map((movement) => (
                      <div key={movement.id} className="seller-movement-row">
                        <span className={`badge ${getMovementBadgeClass(movement.type)}`}>
                          {getMovementTypeLabel(movement.type)}
                        </span>

                        <div>
                          <b>{movement.product?.name || 'Producto'}</b>
                          <small>
                            {fmtDate(String(movement.createdAt))} · {getMovementQuantityLabel(movement)}
                            {movement.from || movement.to
                              ? ` · ${getStockLocationLabel(movement.from)} → ${getStockLocationLabel(movement.to)}`
                              : ''}
                          </small>
                          {movement.reason && <small>Motivo: {movement.reason}</small>}
                        </div>

                        <Warehouse size={16} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="seller-muted-box">No movió stock en esta fecha.</div>
                )}
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .seller-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
          gap: 10px;
          margin-bottom: 16px;
        }

        .seller-search,
        .seller-date-filter {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
          padding: 0 12px;
          min-height: 44px;
          color: var(--text3);
        }

        .seller-search input,
        .seller-date-filter input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          color: var(--text);
          font: inherit;
        }

        .seller-warning {
          border: 1px solid rgba(245, 158, 11, 0.32);
          background: rgba(245, 158, 11, 0.08);
          color: var(--warn);
          border-radius: 14px;
          padding: 11px 13px;
          margin-bottom: 14px;
          font-size: 13px;
        }

        .seller-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .seller-stat-card {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .seller-stat-card > span {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--surface2);
          color: var(--accent);
          flex-shrink: 0;
        }

        .seller-card {
          overflow: hidden;
        }

        .seller-list {
          display: grid;
        }

        .seller-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) auto;
          gap: 13px;
          align-items: center;
          padding: 14px;
          border-bottom: 1px solid var(--border);
        }

        .seller-row:last-child {
          border-bottom: none;
        }

        .seller-avatar {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: var(--surface2);
          display: grid;
          place-items: center;
          color: var(--accent);
        }

        .seller-main {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .seller-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .seller-head h3 {
          font-size: 14px;
          font-weight: 900;
          margin: 0 0 3px;
          color: var(--text);
        }

        .seller-head p {
          margin: 0;
          color: var(--text3);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .seller-badges,
        .seller-sale-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .seller-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .seller-metrics > div,
        .seller-detail-grid > div {
          border: 1px solid var(--border);
          background: var(--surface2);
          border-radius: 14px;
          padding: 10px;
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .seller-metrics small,
        .seller-detail-grid small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .seller-metrics b,
        .seller-detail-grid b {
          font-size: 13px;
          font-family: var(--mono);
          overflow-wrap: anywhere;
        }

        .seller-money {
          color: var(--accent) !important;
        }

        .seller-pagination {
          border-top: 1px solid var(--border);
          padding: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .seller-pagination > div {
          display: flex;
          gap: 8px;
        }

        .seller-empty {
          padding: 34px 18px;
          text-align: center;
          color: var(--text3);
          display: grid;
          justify-items: center;
          gap: 8px;
        }

        .seller-empty b {
          color: var(--text);
        }

        .seller-empty p {
          margin: 0;
        }

        .modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .seller-detail-modal {
          width: min(980px, calc(100vw - 32px));
        }

        .seller-detail-modal .modal-header {
          align-items: flex-start;
        }

        .seller-detail-modal .modal-header small {
          display: block;
          margin-top: 3px;
          color: var(--text3);
          font-size: 12px;
        }

        .seller-detail-body {
          display: grid;
          gap: 16px;
          padding: 16px !important;
        }

        .seller-detail-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }

        .seller-section {
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface);
          overflow: hidden;
        }

        .seller-section-head {
          padding: 13px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .seller-section-head b {
          font-size: 14px;
        }

        .seller-section-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .seller-products-list,
        .seller-sales-list,
        .seller-movements-list {
          display: grid;
        }

        .seller-product-row,
        .seller-sale-row,
        .seller-movement-row {
          padding: 12px 13px;
          border-bottom: 1px solid var(--border);
          display: grid;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }

        .seller-product-row:last-child,
        .seller-sale-row:last-child,
        .seller-movement-row:last-child {
          border-bottom: none;
        }

        .seller-product-row {
          grid-template-columns: 36px minmax(0, 1fr) auto;
        }

        .seller-product-row > span {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: var(--surface2);
          color: var(--accent);
        }

        .seller-product-row b,
        .seller-sale-row b,
        .seller-movement-row b {
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .seller-product-row small,
        .seller-sale-row small,
        .seller-movement-row small {
          display: block;
          color: var(--text3);
          font-size: 11px;
          margin-top: 2px;
          line-height: 1.35;
        }

        .seller-product-row strong,
        .seller-sale-row strong {
          font-family: var(--mono);
          color: var(--accent);
          font-size: 13px;
          white-space: nowrap;
        }

        .seller-sale-row {
          grid-template-columns: minmax(0, 1fr) auto auto;
        }

        .seller-movement-row {
          grid-template-columns: auto minmax(0, 1fr) 20px;
        }

        .seller-muted-box {
          margin: 12px;
          border: 1px dashed var(--border);
          border-radius: 14px;
          padding: 16px;
          color: var(--text3);
          background: var(--surface2);
          text-align: center;
          font-size: 12px;
        }

        @media (max-width: 1100px) {
          .seller-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .seller-detail-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .seller-toolbar {
            grid-template-columns: 1fr;
          }

          .seller-stats-grid {
            grid-template-columns: 1fr;
          }

          .seller-row {
            grid-template-columns: 38px minmax(0, 1fr);
          }

          .seller-row > button {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .seller-avatar {
            width: 38px;
            height: 38px;
            border-radius: 14px;
          }

          .seller-head {
            display: grid;
          }

          .seller-badges {
            justify-content: flex-start;
          }

          .seller-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .seller-pagination {
            display: grid;
            text-align: center;
          }

          .seller-pagination > div {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .seller-detail-modal {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            border-radius: 18px;
          }

          .seller-detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .seller-sale-row {
            grid-template-columns: 1fr;
          }

          .seller-sale-badges {
            justify-content: flex-start;
          }

          .seller-product-row {
            grid-template-columns: 34px minmax(0, 1fr);
          }

          .seller-product-row strong {
            grid-column: 2;
          }
        }

        @media (max-width: 420px) {
          .seller-metrics,
          .seller-detail-grid {
            grid-template-columns: 1fr;
          }

          .seller-detail-body {
            padding: 12px !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
