'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { MovementLocation, Product, StockMovement } from '@/types';
import { fmtDate, normalizeArray, num, productMinStock, productStock } from '@/lib/helpers';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BarChart2,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

type StockMode = 'ADD' | 'TRANSFER';

type StockForm = {
  productId: string;
  from: MovementLocation;
  to: MovementLocation;
  location: MovementLocation;
  quantity: string;
  quantityKg: string;
  mode: StockMode;
};

const emptyForm: StockForm = {
  productId: '',
  from: 'LOCAL',
  to: 'DEPOSITO',
  location: 'LOCAL',
  quantity: '',
  quantityKg: '',
  mode: 'ADD',
};

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

async function fetchStockData() {
  const [p, m] = await Promise.all([
    api.get('/products'),
    api.get('/products/movements').catch(() => ({ data: [] })),
  ]);

  return {
    products: normalizeArray<Product>(p.data),
    movements: normalizeArray<StockMovement>(m.data),
  };
}

function movementIcon(type?: string) {
  if (type === 'SALE') {
    return <ArrowUpCircle size={14} style={{ color: 'var(--danger)' }} />;
  }

  if (type === 'TRANSFER') {
    return <ArrowLeftRight size={14} style={{ color: 'var(--accent2)' }} />;
  }

  return <ArrowDownCircle size={14} style={{ color: 'var(--accent)' }} />;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<StockForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchStockData();

      setProducts(data.products);
      setMovements(data.movements);

      if (showSuccess) {
        toast.success('Stock actualizado correctamente');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchStockData()
      .then((data) => {
        if (!alive) return;

        setProducts(data.products);
        setMovements(data.movements);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error('Error al cargar stock');
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      String(p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = products.find((p) => p.id === form.productId);

  const save = async () => {
    if (!selected) {
      toast.error('Seleccioná un producto');
      return;
    }

    const quantity = num(form.quantity);
    const quantityKg = num(form.quantityKg);
    const isKg = selected.saleUnit === 'KG';
    const isTransfer = form.mode === 'TRANSFER';

    if (isKg && quantityKg <= 0) {
      toast.error('Ingresá una cantidad válida en kg');
      return;
    }

    if (!isKg && quantity <= 0) {
      toast.error('Ingresá una cantidad válida');
      return;
    }

    if (isTransfer && form.from === form.to) {
      toast.error('El origen y el destino no pueden ser iguales');
      return;
    }

    setSaving(true);

    const toastId = toast.loading(isTransfer ? 'Transfiriendo stock...' : 'Agregando stock...');

    try {
      if (isTransfer) {
        if (isKg) {
          await api.post(`/products/${selected.id}/transfer-kg`, {
            from: form.from,
            to: form.to,
            quantityKg,
          });
        } else {
          await api.post('/products/transfer', {
            productId: selected.id,
            from: form.from,
            to: form.to,
            quantity,
          });
        }
      } else {
        if (isKg) {
          await api.post(`/products/${selected.id}/add-stock-kg`, {
            to: form.location,
            quantityKg,
          });
        } else {
          await api.post('/products/add-stock', {
            productId: selected.id,
            to: form.location,
            quantity,
          });
        }
      }

      setForm(emptyForm);

      toast.success(
        isTransfer ? 'Stock transferido correctamente' : 'Stock agregado correctamente',
        { id: toastId }
      );

      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al mover stock'), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Stock" subtitle="Inventario local, depósito y movimientos">
      <div className="card stock-form-card" style={{ padding: 16, marginBottom: 18 }}>
        <div
          className="stock-form-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 0.9fr 1fr 1fr auto',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <div>
            <label className="form-label">Producto</label>

            <select
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
              disabled={saving}
            >
              <option value="">Seleccionar...</option>

              {products
                .filter((p) => p.type === 'SIMPLE')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.saleUnit === 'KG' ? `${p.stockLocalKg ?? 0} kg` : p.stockLocal}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="form-label">Operación</label>

            <select
              value={form.mode}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  mode: e.target.value as StockMode,
                }))
              }
              disabled={saving}
            >
              <option value="ADD">Agregar</option>
              <option value="TRANSFER">Transferir</option>
            </select>
          </div>

          {form.mode === 'TRANSFER' ? (
            <>
              <div>
                <label className="form-label">Desde</label>

                <select
                  value={form.from}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      from: e.target.value as MovementLocation,
                    }))
                  }
                  disabled={saving}
                >
                  <option value="LOCAL">Local</option>
                  <option value="DEPOSITO">Depósito</option>
                </select>
              </div>

              <div>
                <label className="form-label">Hacia</label>

                <select
                  value={form.to}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      to: e.target.value as MovementLocation,
                    }))
                  }
                  disabled={saving}
                >
                  <option value="LOCAL">Local</option>
                  <option value="DEPOSITO">Depósito</option>
                </select>
              </div>
            </>
          ) : (
            <div className="stock-location-field">
              <label className="form-label">Destino</label>

              <select
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    location: e.target.value as MovementLocation,
                  }))
                }
                disabled={saving}
              >
                <option value="LOCAL">Local</option>
                <option value="DEPOSITO">Depósito</option>
              </select>
            </div>
          )}

          <div>
            <label className="form-label">
              Cantidad {selected?.saleUnit === 'KG' ? 'kg' : ''}
            </label>

            <input
              type="number"
              min="0"
              step={selected?.saleUnit === 'KG' ? '0.001' : '1'}
              value={selected?.saleUnit === 'KG' ? form.quantityKg : form.quantity}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  [selected?.saleUnit === 'KG' ? 'quantityKg' : 'quantity']: e.target.value,
                }))
              }
              disabled={saving}
            />
          </div>

          <button className="btn btn-primary stock-submit-btn" onClick={save} disabled={saving || !selected}>
            {saving ? (
              <span className="spinner" />
            ) : form.mode === 'TRANSFER' ? (
              <>
                <ArrowLeftRight size={14} /> Transferir
              </>
            ) : (
              'Agregar stock'
            )}
          </button>
        </div>
      </div>

      <div className="stock-search" style={{ position: 'relative', marginBottom: 18, maxWidth: 420 }}>
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
          placeholder="Buscar producto..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div className="card stock-card" style={{ marginBottom: 18 }}>
        <div className="table-wrap stock-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Unidad</th>
                  <th>Local</th>
                  <th>Depósito</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => {
                  const stock = productStock(p);
                  const min = productMinStock(p);
                  const deposito = p.saleUnit === 'KG' ? num(p.stockDepositoKg) : num(p.stockDeposito);
                  const critical = stock <= min;

                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                      </td>

                      <td style={{ fontFamily: 'var(--mono)' }}>{p.sku}</td>

                      <td>
                        <span className="badge badge-gray">{p.saleUnit}</span>
                      </td>

                      <td
                        style={{
                          fontFamily: 'var(--mono)',
                          color: critical ? 'var(--danger)' : 'var(--text)',
                        }}
                      >
                        {stock}
                        {p.saleUnit === 'KG' ? ' kg' : ''}
                      </td>

                      <td style={{ fontFamily: 'var(--mono)' }}>
                        {deposito}
                        {p.saleUnit === 'KG' ? ' kg' : ''}
                      </td>

                      <td>{min}</td>

                      <td>
                        <span className={`badge ${critical ? 'badge-red' : 'badge-green'}`}>
                          {critical ? 'BAJO' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        <div className="stock-mobile-list">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : (
            filtered.map((p) => {
              const stock = productStock(p);
              const min = productMinStock(p);
              const deposito = p.saleUnit === 'KG' ? num(p.stockDepositoKg) : num(p.stockDeposito);
              const critical = stock <= min;

              return (
                <article className="stock-mobile-item" key={p.id}>
                  <div className="stock-mobile-head">
                    <div>
                      <h3>{p.name}</h3>
                      <span>{p.sku || 'Sin SKU'}</span>
                    </div>

                    <span className={`badge ${critical ? 'badge-red' : 'badge-green'}`}>
                      {critical ? 'BAJO' : 'OK'}
                    </span>
                  </div>

                  <div className="stock-mobile-badges">
                    <span className="badge badge-gray">{p.saleUnit}</span>
                    <span className="badge badge-gray">Mínimo {min}</span>
                  </div>

                  <div className="stock-mobile-data">
                    <div>
                      <small>Local</small>
                      <strong className={critical ? 'stock-danger' : ''}>
                        {stock}
                        {p.saleUnit === 'KG' ? ' kg' : ''}
                      </strong>
                    </div>

                    <div>
                      <small>Depósito</small>
                      <strong>
                        {deposito}
                        {p.saleUnit === 'KG' ? ' kg' : ''}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>
      </div>

      <div className="card stock-card">
        <div
          className="stock-card-title"
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          Movimientos recientes
        </div>

        <div className="table-wrap stock-desktop-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Desde</th>
                <th>Hacia</th>
                <th>Cantidad</th>
                <th>Referencia</th>
              </tr>
            </thead>

            <tbody>
              {movements.slice(0, 80).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.createdAt)}</td>

                  <td>{m.product?.name ?? m.productId}</td>

                  <td>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {movementIcon(m.type)}
                      {m.type}
                    </span>
                  </td>

                  <td>{m.from ?? '—'}</td>

                  <td>{m.to ?? '—'}</td>

                  <td style={{ fontFamily: 'var(--mono)' }}>
                    {m.quantityKg ? `${m.quantityKg} kg` : m.quantity ?? '—'}
                  </td>

                  <td>{m.reason ?? m.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!movements.length && !loading && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>

        <div className="stock-mobile-list stock-movements-mobile-list">
          {movements.slice(0, 80).map((m) => (
            <article className="stock-mobile-item" key={m.id}>
              <div className="stock-mobile-head">
                <div>
                  <h3>{m.product?.name ?? m.productId}</h3>
                  <span>{fmtDate(m.createdAt)}</span>
                </div>

                <span className="stock-movement-type">
                  {movementIcon(m.type)}
                  {m.type}
                </span>
              </div>

              <div className="stock-mobile-data">
                <div>
                  <small>Desde</small>
                  <strong>{m.from ?? '—'}</strong>
                </div>

                <div>
                  <small>Hacia</small>
                  <strong>{m.to ?? '—'}</strong>
                </div>

                <div>
                  <small>Cantidad</small>
                  <strong>{m.quantityKg ? `${m.quantityKg} kg` : m.quantity ?? '—'}</strong>
                </div>

                <div>
                  <small>Referencia</small>
                  <strong>{m.reason ?? m.reference ?? '—'}</strong>
                </div>
              </div>
            </article>
          ))}

          {!movements.length && !loading && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .stock-mobile-list {
          display: none;
        }

        .stock-location-field {
          grid-column: auto;
        }

        @media (max-width: 1200px) {
          .stock-form-grid {
            grid-template-columns: 1.5fr 1fr 1fr !important;
          }

          .stock-submit-btn {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .stock-location-field {
            grid-column: auto;
          }
        }

        @media (max-width: 768px) {
          .stock-form-card {
            padding: 14px !important;
            border-radius: 18px;
          }

          .stock-form-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .stock-submit-btn {
            width: 100%;
            height: 42px;
            justify-content: center;
          }

          .stock-search {
            max-width: none !important;
            width: 100%;
            margin-bottom: 14px !important;
          }

          .stock-search input {
            width: 100%;
          }

          .stock-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .stock-card-title {
            padding: 14px !important;
            font-size: 14px;
          }

          .stock-desktop-table {
            display: none;
          }

          .stock-mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .stock-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 12px;
            display: grid;
            gap: 12px;
            min-width: 0;
          }

          .stock-mobile-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            min-width: 0;
          }

          .stock-mobile-head > div {
            min-width: 0;
            display: grid;
            gap: 4px;
          }

          .stock-mobile-head h3 {
            font-size: 14px;
            line-height: 1.25;
            font-weight: 900;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-head span:not(.badge):not(.stock-movement-type) {
            color: var(--text3);
            font-size: 11px;
            font-family: var(--mono);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
          }

          .stock-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .stock-mobile-data > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
            min-width: 0;
          }

          .stock-mobile-data small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .stock-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .stock-danger {
            color: var(--danger);
          }

          .stock-movement-type {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 900;
            color: var(--text2);
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 5px 8px;
            flex-shrink: 0;
          }

          .stock-movements-mobile-list {
            padding-top: 12px;
          }
        }

        @media (max-width: 420px) {
          .stock-form-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .stock-mobile-list {
            padding: 10px;
          }

          .stock-mobile-item {
            padding: 10px;
            border-radius: 14px;
          }

          .stock-mobile-head {
            flex-direction: column;
            align-items: stretch;
          }

          .stock-mobile-head h3 {
            white-space: normal;
          }

          .stock-mobile-head .badge,
          .stock-movement-type {
            width: fit-content;
          }

          .stock-mobile-data > div {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .stock-mobile-data strong {
            text-align: left;
          }
        }
      `}</style>
    </AppLayout>
  );
}