'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { FinanceEntry } from '@/types';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  FileSpreadsheet,
  FileText,
  Trophy,
  AlertTriangle,
  Tags,
  CalendarDays,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const FINANCE_CATEGORIES = [
  { value: 'VENTA', label: 'Venta' },
  { value: 'AlquilerL1', label: 'Alquiler Local 1' },
  { value: 'AlquilerF1', label: 'Alquiler Fábrica / Fondo 1' },
  { value: 'Alarma', label: 'Alarma' },
  { value: 'Sueldos', label: 'Sueldos' },
  { value: 'MateriaPrima', label: 'Materia prima' },
  { value: 'Impuestos', label: 'Impuestos' },
  { value: 'VEP', label: 'VEP' },
  { value: 'Contadora', label: 'Contadora' },
  { value: 'Arca', label: 'ARCA' },
  { value: 'Eenvios', label: 'Envíos' },
  { value: 'Publicidad', label: 'Publicidad' },
  { value: 'Otro', label: 'Otro' },
];

const categoryLabel = (value?: string | null) => {
  if (!value) return '—';
  return FINANCE_CATEGORIES.find(c => c.value === value)?.label ?? value;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const today = () => new Date().toISOString().slice(0, 10);

const firstDayOfCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
};

const getPartsFromDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);

  return {
    year,
    month,
    day,
  };
};

const startOfDay = (date: string) => new Date(`${date}T00:00:00.000`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`);

type StatsState = {
  week: number;
  month: number;
  year: number;
};

type AnyObj = Record<string, any>;

const normalizeArray = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const normalizeAmount = (data: any): number => {
  if (typeof data === 'number') return data;

  if (typeof data?.total === 'number') return data.total;
  if (typeof data?.amount === 'number') return data.amount;
  if (typeof data?.income === 'number') return data.income;
  if (typeof data?.totalIncome === 'number') return data.totalIncome;
  if (typeof data?._sum?.amount === 'number') return data._sum.amount;

  return 0;
};

const getProductName = (p: AnyObj) =>
  p.name ??
  p.productName ??
  p.product?.name ??
  p.product?.title ??
  p.title ??
  'Producto';

const getProductQty = (p: AnyObj) =>
  Number(
    p.quantity ??
      p.totalSold ??
      p.totalQuantity ??
      p.sold ??
      p._sum?.quantity ??
      p._sum?.quantityKg ??
      0
  );

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState(today());

  const [stats, setStats] = useState<StatsState>({
    week: 0,
    month: 0,
    year: 0,
  });

  const [categoryStats, setCategoryStats] = useState<AnyObj[]>([]);
  const [topProducts, setTopProducts] = useState<AnyObj[]>([]);
  const [worstProducts, setWorstProducts] = useState<AnyObj[]>([]);

  const [form, setForm] = useState({
    type: 'INGRESO',
    amount: '',
    description: '',
    category: 'Otro',
    date: today(),
  });

const safeGet = async <T,>(
  url: string,
  fallback: T,
  params?: AnyObj
): Promise<T> => {
  try {
    const res = await api.get(url, { params });
    return res.data;
  } catch {
    return fallback;
  }
};

  const load = async () => {
    setLoading(true);

    try {
      const selected = getPartsFromDate(dateTo);

      const financeData = await safeGet<any>('/finance', []);

      const weekData = await safeGet<any>('/finance/income/week', 0, {
        year: selected.year,
        month: selected.month,
        day: selected.day,
      });

      const monthData = await safeGet<any>('/finance/income/month', 0, {
        year: selected.year,
        month: selected.month,
      });

      const yearData = await safeGet<any>('/finance/income/year', 0, {
        year: selected.year,
      });

      const categoryData = await safeGet<any>('/finance/income/category', [], {
        startDate: dateFrom,
        endDate: dateTo,
      });

      const topRangeData = await safeGet<any>('/finance/products/top-range', [], {
        startDate: dateFrom,
        endDate: dateTo,
      });

      const topProductsData =
        normalizeArray<AnyObj>(topRangeData).length > 0
          ? topRangeData
          : await safeGet<any>('/finance/products/top', []);

      const worstProductsData = await safeGet<any>('/finance/products/worst', []);

      setEntries(normalizeArray<FinanceEntry>(financeData));

      setStats({
        week: normalizeAmount(weekData),
        month: normalizeAmount(monthData),
        year: normalizeAmount(yearData),
      });

      setCategoryStats(normalizeArray<AnyObj>(categoryData));
      setTopProducts(normalizeArray<AnyObj>(topProductsData));
      setWorstProducts(normalizeArray<AnyObj>(worstProductsData));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEntries = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);

    return entries.filter(e => {
      const date = new Date(e.date);
      return date >= from && date <= to;
    });
  }, [entries, dateFrom, dateTo]);

  const ingresos = useMemo(
    () =>
      filteredEntries
        .filter(e => e.type === 'INGRESO')
        .reduce((a, e) => a + Number(e.amount || 0), 0),
    [filteredEntries]
  );

  const egresos = useMemo(
    () =>
      filteredEntries
        .filter(e => e.type === 'EGRESO')
        .reduce((a, e) => a + Number(e.amount || 0), 0),
    [filteredEntries]
  );

  const balance = ingresos - egresos;

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; ingresos: number; egresos: number }> = {};

    filteredEntries.forEach(e => {
      const d = new Date(e.date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });

      if (!map[d]) {
        map[d] = {
          date: d,
          ingresos: 0,
          egresos: 0,
        };
      }

      if (e.type === 'INGRESO') {
        map[d].ingresos += Number(e.amount || 0);
      } else {
        map[d].egresos += Number(e.amount || 0);
      }
    });

    return Object.values(map);
  }, [filteredEntries]);

  const field = (k: string, v: string) => {
    setForm(p => ({
      ...p,
      [k]: v,
    }));
  };

  const openCreate = () => {
    setForm({
      type: 'INGRESO',
      amount: '',
      description: '',
      category: 'Otro',
      date: today(),
    });

    setModal(true);
  };

  const resetDates = async () => {
    setDateFrom(firstDayOfCurrentMonth());
    setDateTo(today());

    setTimeout(() => {
      load();
    }, 0);
  };

  const applyFilters = async () => {
    if (!dateFrom || !dateTo) {
      alert('Seleccioná desde y hasta');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      alert('La fecha desde no puede ser mayor a la fecha hasta');
      return;
    }

    await load();
  };

  const handleSave = async () => {
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert('Ingresá un importe válido');
      return;
    }

    if (!form.description.trim()) {
      alert('Ingresá una descripción');
      return;
    }

    setSaving(true);

    try {
      await api.post('/finance', {
        type: form.type,
        amount,
        description: form.description.trim(),
        category: form.category || 'Otro',
        date: `${form.date}T12:00:00.000Z`,
      });

      setModal(false);
      await load();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Error guardando el movimiento financiero');
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      const res = await api.get('/finance/export/excel', {
        responseType: 'blob',
        params: {
          startDate: dateFrom,
          endDate: dateTo,
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `finanzas-${dateFrom}-a-${dateTo}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      alert('Error exportando Excel');
    }
  };

  const exportPDF = async () => {
    try {
      const res = await api.get('/finance/export/pdf', {
        responseType: 'blob',
        params: {
          startDate: dateFrom,
          endDate: dateTo,
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `finanzas-${dateFrom}-a-${dateTo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      alert('Error exportando PDF');
    }
  };

  return (
    <AppLayout
      title="Finanzas"
      subtitle={`Movimientos desde ${dateFrom} hasta ${dateTo}`}
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel}>
            <FileSpreadsheet size={14} /> Excel
          </button>

          <button className="btn btn-secondary btn-sm" onClick={exportPDF}>
            <FileText size={14} /> PDF
          </button>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nueva entrada
          </button>
        </div>
      }
    >
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={applyFilters}>
            <Filter size={15} /> Aplicar
          </button>

          <button className="btn btn-secondary" onClick={resetDates}>
            <RotateCcw size={15} /> Mes actual
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(0,229,160,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            </div>

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Ingresos del rango
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
            {fmt(ingresos)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingDown size={16} style={{ color: 'var(--danger)' }} />
            </div>

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Egresos del rango
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--danger)', fontSize: 22 }}>
            {fmt(egresos)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(79,142,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={16} style={{ color: 'var(--accent2)' }} />
            </div>

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Balance del rango
            </span>
          </div>

          <div
            className="stat-value"
            style={{
              color: balance >= 0 ? 'var(--accent)' : 'var(--danger)',
              fontSize: 22,
            }}
          >
            {fmt(balance)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Semana de la fecha hasta
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
            {fmt(stats.week)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Mes de la fecha hasta
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
            {fmt(stats.month)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Año de la fecha hasta
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
            {fmt(stats.year)}
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Flujo de caja del rango
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{
                  fill: 'var(--text3)',
                  fontSize: 11,
                  fontFamily: 'var(--mono)',
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fill: 'var(--text3)',
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`}
              />

              <Tooltip
                contentStyle={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
                formatter={(v: unknown) => fmt(Number(v))}
              />

              <Bar
                dataKey="ingresos"
                fill="var(--accent)"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
                name="Ingresos"
              />

              <Bar
                dataKey="egresos"
                fill="var(--danger)"
                radius={[3, 3, 0, 0]}
                opacity={0.7}
                name="Egresos"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryStats.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Tags size={16} style={{ color: 'var(--accent2)' }} />

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Ingresos por categoría del rango
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {categoryStats.map((item: AnyObj, index: number) => {
              const category = item.category ?? item.name ?? item.label ?? 'Sin categoría';

              const total =
                item.total ??
                item.amount ??
                item.income ??
                item.totalIncome ??
                item._sum?.amount ??
                0;

              return (
                <div
                  key={`${category}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--surface2)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {categoryLabel(category)}
                  </span>

                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                    {fmt(Number(total || 0))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Trophy size={16} style={{ color: 'var(--accent)' }} />

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Productos más vendidos
            </div>
          </div>

          {topProducts.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {topProducts.slice(0, 5).map((p: AnyObj, index: number) => (
                <div
                  key={p.id ?? `${getProductName(p)}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {index + 1}. {getProductName(p)}
                  </span>

                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {getProductQty(p)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>
              Sin datos todavía
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Productos con menor venta
            </div>
          </div>

          {worstProducts.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {worstProducts.slice(0, 5).map((p: AnyObj, index: number) => (
                <div
                  key={p.id ?? `${getProductName(p)}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {index + 1}. {getProductName(p)}
                  </span>

                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)' }}>
                    {getProductQty(p)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>
              Sin datos todavía
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 44, marginBottom: 8 }}
                />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Importe</th>
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map(e => (
                  <tr key={e.id}>
                    <td
                      style={{
                        fontSize: 12,
                        color: 'var(--text2)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {new Date(e.date).toLocaleDateString('es-AR')}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          e.type === 'INGRESO' ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {e.type === 'INGRESO' ? '↑' : '↓'} {e.type}
                      </span>
                    </td>

                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {e.description || '—'}
                    </td>

                    <td>
                      <span className="badge badge-gray">
                        {categoryLabel(e.category)}
                      </span>
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        color: e.type === 'INGRESO' ? 'var(--accent)' : 'var(--danger)',
                      }}
                    >
                      {e.type === 'INGRESO' ? '+' : '-'}
                      {fmt(Number(e.amount || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filteredEntries.length && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>Sin movimientos en el rango seleccionado</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setModal(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Nueva entrada financiera</span>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setModal(false)}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo *</label>

                  <select
                    value={form.type}
                    onChange={e => field('type', e.target.value)}
                  >
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha *</label>

                  <input
                    type="date"
                    value={form.date}
                    onChange={e => field('date', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Importe *</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => field('amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción *</label>

                <input
                  value={form.description}
                  onChange={e => field('description', e.target.value)}
                  placeholder="Ej: Alquiler mayo, sueldo empleado, pago proveedor..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>

                <select
                  value={form.category}
                  onChange={e => field('category', e.target.value)}
                >
                  {FINANCE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.amount || !form.description || !form.category}
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}