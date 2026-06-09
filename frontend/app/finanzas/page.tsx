/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { FinanceEntry, Product, Sale } from '@/types';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  Trophy,
  AlertTriangle,
  Tags,
  CalendarDays,
  Filter,
  RotateCcw,
  PackageCheck,
  HandCoins,
  ReceiptText,
  Percent,
  Search,
  ArrowUpDown,
  BadgeDollarSign,
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

const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

const MOVEMENTS_PAGE_SIZE = 5;
const MOBILE_MARGIN_PAGE_SIZE = 6;

type FinanceMobileTab = 'resumen' | 'margenes' | 'movimientos';

const FINANCE_CATEGORIES = [
  { value: 'VENTA', label: 'Venta' },
  { value: 'COBRANZA', label: 'Cobranza' },
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

type FinanceForm = {
  type: 'INGRESO' | 'EGRESO';
  amount: string;
  description: string;
  category: string;
  date: string;
};

type MarginRow = {
  id: string;
  name: string;
  sku?: string | null;
  saleUnit: Product['saleUnit'];
  category: string;
  cost: number;
  finalPrice: number;
  clientPrice: number;
  wholesalePrice: number;
  finalProfit: number;
  clientProfit: number;
  wholesaleProfit: number;
  finalMargin: number;
  clientMargin: number;
  wholesaleMargin: number;
};

type MarginSort =
  | 'name'
  | 'cost'
  | 'finalMargin'
  | 'clientMargin'
  | 'wholesaleMargin'
  | 'finalProfit'
  | 'clientProfit'
  | 'wholesaleProfit';

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
  p.productNameSnapshot ??
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

const getItemQuantity = (item: AnyObj) => {
  const quantityKg = Number(item.quantityKg || 0);
  if (quantityKg > 0) return quantityKg;

  const quantity = Number(item.quantity || 0);
  return quantity > 0 ? quantity : 1;
};

const getSaleItemCost = (item: AnyObj) => {
  const qty = getItemQuantity(item);
  return Number(item.purchasePriceSnapshot || 0) * qty;
};

const getSaleCost = (sale: Sale) => {
  return (sale.items || []).reduce((acc, item) => {
    return acc + getSaleItemCost(item as AnyObj);
  }, 0);
};

const getSaleProfit = (sale: Sale) => {
  if (typeof sale.grossProfit === 'number') {
    return Number(sale.grossProfit || 0);
  }

  const total = Number(sale.total || 0);
  const cost = getSaleCost(sale);

  return total - cost;
};

const getSaleDate = (sale: Sale) => {
  return new Date(sale.createdAt);
};


const getProductCategoryName = (product: Product) => {
  if (!product.category) return 'Sin categoría';
  if (typeof product.category === 'string') return product.category;
  return product.category.name || 'Sin categoría';
};

const getProductCost = (product: Product) => Number(product.purchasePrice || 0);

const getProductFinalPrice = (product: Product) => {
  if (product.saleUnit === 'KG') return Number(product.pricePerKg ?? product.price ?? 0);
  return Number(product.price || 0);
};

const getProductClientPrice = (product: Product) => {
  if (product.saleUnit === 'KG') {
    return Number(product.clientPricePerKg ?? product.clientPrice ?? product.pricePerKg ?? product.price ?? 0);
  }
  return Number(product.clientPrice ?? product.price ?? 0);
};

const getProductWholesalePrice = (product: Product) => {
  if (product.saleUnit === 'KG') {
    return Number(product.wholesalePricePerKg ?? product.wholesalePrice ?? product.pricePerKg ?? product.price ?? 0);
  }
  return Number(product.wholesalePrice ?? product.price ?? 0);
};

const getMargin = (price: number, cost: number) => {
  if (!price || price <= 0) return 0;
  return ((price - cost) / price) * 100;
};

const getProfitColor = (value: number) => {
  if (value > 0) return 'var(--accent)';
  if (value < 0) return 'var(--danger)';
  return 'var(--text2)';
};

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState(today());

  const [marginSearch, setMarginSearch] = useState('');
  const [marginSort, setMarginSort] = useState<MarginSort>('finalMargin');
  const [movementsPage, setMovementsPage] = useState(1);
  const [marginPage, setMarginPage] = useState(1);
  const [mobileTab, setMobileTab] = useState<FinanceMobileTab>('resumen');

  const [stats, setStats] = useState<StatsState>({
    week: 0,
    month: 0,
    year: 0,
  });

  const [categoryStats, setCategoryStats] = useState<AnyObj[]>([]);
  const [topProducts, setTopProducts] = useState<AnyObj[]>([]);
  const [worstProducts, setWorstProducts] = useState<AnyObj[]>([]);

  const [form, setForm] = useState<FinanceForm>({
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

      const [
        financeData,
        salesData,
        productsData,
        weekData,
        monthData,
        yearData,
        categoryData,
        topProductsData,
        worstProductsData,
      ] = await Promise.all([
        safeGet<any>('/finance', []),
        safeGet<any>('/sales', []),
        safeGet<any>('/products', []),
        safeGet<any>('/finance/income/week', 0, {
          year: selected.year,
          month: selected.month,
          day: selected.day,
        }),
        safeGet<any>('/finance/income/month', 0, {
          year: selected.year,
          month: selected.month,
        }),
        safeGet<any>('/finance/income/year', 0, {
          year: selected.year,
        }),
        safeGet<any>('/finance/income/category', [], {
          startDate: dateFrom,
          endDate: dateTo,
        }),
        safeGet<any>('/finance/products/top-range', [], {
          startDate: dateFrom,
          endDate: dateTo,
          limit: 5,
        }),
        safeGet<any>('/finance/products/worst-range', [], {
          startDate: dateFrom,
          endDate: dateTo,
          limit: 5,
        }),
      ]);

      setEntries(normalizeArray<FinanceEntry>(financeData));
      setSales(normalizeArray<Sale>(salesData));
      setProducts(normalizeArray<Product>(productsData));

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

  const filteredSales = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);

    return sales.filter(sale => {
      const date = getSaleDate(sale);
      return date >= from && date <= to && sale.status !== 'CANCELLED';
    });
  }, [sales, dateFrom, dateTo]);

  useEffect(() => {
    setMovementsPage(1);
  }, [dateFrom, dateTo, entries.length]);

  const recentEntries = useMemo(() => {
    return [...filteredEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredEntries]);

  const totalMovementPages = Math.max(1, Math.ceil(recentEntries.length / MOVEMENTS_PAGE_SIZE));
  const currentMovementPage = Math.min(movementsPage, totalMovementPages);

  const paginatedEntries = useMemo(() => {
    const start = (currentMovementPage - 1) * MOVEMENTS_PAGE_SIZE;
    return recentEntries.slice(start, start + MOVEMENTS_PAGE_SIZE);
  }, [recentEntries, currentMovementPage]);


  const marginRows = useMemo<MarginRow[]>(() => {
    return products
      .filter(product => product.isActive !== false)
      .map(product => {
        const cost = getProductCost(product);
        const finalPrice = getProductFinalPrice(product);
        const clientPrice = getProductClientPrice(product);
        const wholesalePrice = getProductWholesalePrice(product);
        const finalProfit = finalPrice - cost;
        const clientProfit = clientPrice - cost;
        const wholesaleProfit = wholesalePrice - cost;

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          saleUnit: product.saleUnit,
          category: getProductCategoryName(product),
          cost,
          finalPrice,
          clientPrice,
          wholesalePrice,
          finalProfit,
          clientProfit,
          wholesaleProfit,
          finalMargin: getMargin(finalPrice, cost),
          clientMargin: getMargin(clientPrice, cost),
          wholesaleMargin: getMargin(wholesalePrice, cost),
        };
      });
  }, [products]);

  const filteredMarginRows = useMemo(() => {
    const q = marginSearch.trim().toLowerCase();
    const rows = marginRows.filter(row => {
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        String(row.sku || '').toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });

    return [...rows].sort((a, b) => {
      if (marginSort === 'name') return a.name.localeCompare(b.name);
      return Number(b[marginSort] || 0) - Number(a[marginSort] || 0);
    });
  }, [marginRows, marginSearch, marginSort]);

  const totalMarginPages = Math.max(1, Math.ceil(filteredMarginRows.length / MOBILE_MARGIN_PAGE_SIZE));
  const currentMarginPage = Math.min(marginPage, totalMarginPages);

  const paginatedMarginRows = useMemo(() => {
    const start = (currentMarginPage - 1) * MOBILE_MARGIN_PAGE_SIZE;
    return filteredMarginRows.slice(start, start + MOBILE_MARGIN_PAGE_SIZE);
  }, [filteredMarginRows, currentMarginPage]);

  const marginSummary = useMemo(() => {
    const rowsWithCost = marginRows.filter(row => row.cost > 0);
    if (!rowsWithCost.length) {
      return { avgFinalMargin: 0, avgClientMargin: 0, avgWholesaleMargin: 0, productsWithoutCost: marginRows.length };
    }

    return {
      avgFinalMargin: rowsWithCost.reduce((acc, row) => acc + row.finalMargin, 0) / rowsWithCost.length,
      avgClientMargin: rowsWithCost.reduce((acc, row) => acc + row.clientMargin, 0) / rowsWithCost.length,
      avgWholesaleMargin: rowsWithCost.reduce((acc, row) => acc + row.wholesaleMargin, 0) / rowsWithCost.length,
      productsWithoutCost: marginRows.filter(row => row.cost <= 0).length,
    };
  }, [marginRows]);

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

  const ventasFacturadas = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0),
    [filteredSales]
  );

  const costoVendido = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + getSaleCost(sale), 0),
    [filteredSales]
  );

  const utilidadBruta = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + getSaleProfit(sale), 0),
    [filteredSales]
  );

  const margenBruto = ventasFacturadas > 0 ? (utilidadBruta / ventasFacturadas) * 100 : 0;

  const balance = ingresos - egresos;
  const resultadoEstimado = utilidadBruta - egresos;

  const chartData = useMemo(() => {
    const map: Record<
      string,
      { date: string; ingresos: number; egresos: number; utilidad: number }
    > = {};

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
          utilidad: 0,
        };
      }

      if (e.type === 'INGRESO') {
        map[d].ingresos += Number(e.amount || 0);
      } else {
        map[d].egresos += Number(e.amount || 0);
      }
    });

    filteredSales.forEach(sale => {
      const d = getSaleDate(sale).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });

      if (!map[d]) {
        map[d] = {
          date: d,
          ingresos: 0,
          egresos: 0,
          utilidad: 0,
        };
      }

      map[d].utilidad += getSaleProfit(sale);
    });

    return Object.values(map);
  }, [filteredEntries, filteredSales]);

  const filteredWorstProducts = useMemo(() => {
    const topNames = new Set(
      topProducts.map(p => getProductName(p).toLowerCase().trim())
    );

    return worstProducts.filter(p => {
      const name = getProductName(p).toLowerCase().trim();
      return !topNames.has(name);
    });
  }, [topProducts, worstProducts]);

  const field = (k: keyof FinanceForm, v: string) => {
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


  return (
    <AppLayout
      title="Finanzas"
      subtitle={`Movimientos desde ${dateFrom} hasta ${dateTo}`}
      actions={
        <div className="finance-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nueva entrada
          </button>
        </div>
      }
    >
      <div className={`finance-page finance-tab-${mobileTab}`}>
      <div className="card finance-filter-card" style={{ padding: 16, marginBottom: 20 }}>
        <div
          className="finance-filter-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) auto auto',
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

      <div className="finance-mobile-tabs" role="tablist" aria-label="Secciones de finanzas">
        <button
          type="button"
          className={mobileTab === 'resumen' ? 'is-active' : ''}
          onClick={() => setMobileTab('resumen')}
        >
          Resumen
        </button>

        <button
          type="button"
          className={mobileTab === 'margenes' ? 'is-active' : ''}
          onClick={() => setMobileTab('margenes')}
        >
          Márgenes
        </button>

        <button
          type="button"
          className={mobileTab === 'movimientos' ? 'is-active' : ''}
          onClick={() => setMobileTab('movimientos')}
        >
          Movimientos
        </button>
      </div>

      <div
        className="finance-stats-grid finance-summary-section"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
                background: 'rgba(15,159,92,0.1)',
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
              Balance financiero
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

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: resultadoEstimado >= 0 ? 'rgba(15,159,92,0.1)' : 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HandCoins
                size={16}
                style={{
                  color: resultadoEstimado >= 0 ? 'var(--accent)' : 'var(--danger)',
                }}
              />
            </div>

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Resultado estimado
            </span>
          </div>

          <div
            className="stat-value"
            style={{
              color: resultadoEstimado >= 0 ? 'var(--accent)' : 'var(--danger)',
              fontSize: 22,
            }}
          >
            {fmt(resultadoEstimado)}
          </div>
        </div>
      </div>

      <div
        className="finance-stats-grid finance-stats-grid-secondary finance-summary-section"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ReceiptText size={16} style={{ color: 'var(--accent2)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Ventas cobradas / emitidas
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--accent2)', fontSize: 22 }}>
            {fmt(ventasFacturadas)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <PackageCheck size={16} style={{ color: 'var(--text2)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Costo vendido
            </span>
          </div>

          <div className="stat-value" style={{ color: 'var(--text)', fontSize: 22 }}>
            {fmt(costoVendido)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Utilidad bruta
            </span>
          </div>

          <div
            className="stat-value"
            style={{
              color: utilidadBruta >= 0 ? 'var(--accent)' : 'var(--danger)',
              fontSize: 22,
            }}
          >
            {fmt(utilidadBruta)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Percent size={16} style={{ color: 'var(--accent)' }} />

            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Margen bruto
            </span>
          </div>

          <div
            className="stat-value"
            style={{
              color: margenBruto >= 0 ? 'var(--accent)' : 'var(--danger)',
              fontSize: 22,
            }}
          >
            {pct(margenBruto)}
          </div>
        </div>
      </div>

      <div className="card finance-margin-card" style={{ padding: 20, marginBottom: 20 }}>
        <div
          className="finance-card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BadgeDollarSign size={17} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Margen por producto según precio de venta
              </h3>
            </div>

            <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13 }}>
              Calculado con el costo de compra actual. En productos por KG usa los precios por KG.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-green">Final prom. {pct(marginSummary.avgFinalMargin)}</span>
            <span className="badge badge-blue">Cliente prom. {pct(marginSummary.avgClientMargin)}</span>
            <span className="badge badge-gray">Mayorista prom. {pct(marginSummary.avgWholesaleMargin)}</span>
            {marginSummary.productsWithoutCost > 0 && (
              <span className="badge badge-red">{marginSummary.productsWithoutCost} sin costo</span>
            )}
          </div>
        </div>

        <div
          className="finance-margin-controls"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 1fr) 260px',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text3)',
              }}
            />
            <input
              value={marginSearch}
              onChange={e => {
                setMarginSearch(e.target.value);
                setMarginPage(1);
              }}
              placeholder="Buscar producto, SKU o categoría..."
              style={{ paddingLeft: 36 }}
            />
          </div>

          <select value={marginSort} onChange={e => {
              setMarginSort(e.target.value as MarginSort);
              setMarginPage(1);
            }}>
            <option value="finalMargin">Ordenar por margen final</option>
            <option value="clientMargin">Ordenar por margen cliente</option>
            <option value="wholesaleMargin">Ordenar por margen mayorista</option>
            <option value="finalProfit">Ordenar por ganancia final</option>
            <option value="clientProfit">Ordenar por ganancia cliente</option>
            <option value="wholesaleProfit">Ordenar por ganancia mayorista</option>
            <option value="cost">Ordenar por costo</option>
            <option value="name">Ordenar por nombre</option>
          </select>
        </div>

        <div className="table-wrap finance-desktop-table">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Costo</th>
                <th>Final</th>
                <th>Gana final</th>
                <th>Margen final</th>
                <th>Cliente</th>
                <th>Gana cliente</th>
                <th>Margen cliente</th>
                <th>Mayorista</th>
                <th>Gana mayorista</th>
                <th>Margen mayorista</th>
              </tr>
            </thead>

            <tbody>
              {filteredMarginRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{row.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                      <span className="badge badge-gray">{row.saleUnit === 'KG' ? 'Por KG' : 'Unidad'}</span>
                      {row.sku && <span className="badge badge-gray">SKU {row.sku}</span>}
                      <span className="badge badge-gray">{row.category}</span>
                    </div>
                  </td>

                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                    {row.cost > 0 ? fmt(row.cost) : <span style={{ color: 'var(--danger)' }}>Sin costo</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{fmt(row.finalPrice)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: getProfitColor(row.finalProfit) }}>{fmt(row.finalProfit)}</td>
                  <td><span className={`badge ${row.finalMargin > 0 ? 'badge-green' : row.finalMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.finalMargin)}</span></td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{fmt(row.clientPrice)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: getProfitColor(row.clientProfit) }}>{fmt(row.clientProfit)}</td>
                  <td><span className={`badge ${row.clientMargin > 0 ? 'badge-green' : row.clientMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.clientMargin)}</span></td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{fmt(row.wholesalePrice)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: getProfitColor(row.wholesaleProfit) }}>{fmt(row.wholesaleProfit)}</td>
                  <td><span className={`badge ${row.wholesaleMargin > 0 ? 'badge-green' : row.wholesaleMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.wholesaleMargin)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredMarginRows.length && (
            <div className="empty-state">
              <ArrowUpDown size={36} />
              <p>No hay productos para mostrar</p>
            </div>
          )}
        </div>

        <div className="finance-mobile-list">
          {paginatedMarginRows.map(row => (
            <article key={row.id} className="finance-mobile-item finance-margin-mobile-item">
              <div className="finance-mobile-head">
                <div>
                  <h4>{row.name}</h4>
                  <div className="finance-mobile-badges">
                    <span className="badge badge-gray">{row.saleUnit === 'KG' ? 'Por KG' : 'Unidad'}</span>
                    {row.sku && <span className="badge badge-gray">SKU {row.sku}</span>}
                    <span className="badge badge-gray">{row.category}</span>
                  </div>
                </div>
              </div>

              <div className="finance-mobile-data">
                <div>
                  <small>Costo</small>
                  <strong>{row.cost > 0 ? fmt(row.cost) : 'Sin costo'}</strong>
                </div>
                <div>
                  <small>Final</small>
                  <strong>{fmt(row.finalPrice)}</strong>
                </div>
                <div>
                  <small>Gana final</small>
                  <strong style={{ color: getProfitColor(row.finalProfit) }}>{fmt(row.finalProfit)}</strong>
                </div>
                <div>
                  <small>Margen final</small>
                  <span className={`badge ${row.finalMargin > 0 ? 'badge-green' : row.finalMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.finalMargin)}</span>
                </div>
                <div>
                  <small>Cliente</small>
                  <strong>{fmt(row.clientPrice)}</strong>
                </div>
                <div>
                  <small>Gana cliente</small>
                  <strong style={{ color: getProfitColor(row.clientProfit) }}>{fmt(row.clientProfit)}</strong>
                </div>
                <div>
                  <small>Margen cliente</small>
                  <span className={`badge ${row.clientMargin > 0 ? 'badge-green' : row.clientMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.clientMargin)}</span>
                </div>
                <div>
                  <small>Mayorista</small>
                  <strong>{fmt(row.wholesalePrice)}</strong>
                </div>
                <div>
                  <small>Gana mayorista</small>
                  <strong style={{ color: getProfitColor(row.wholesaleProfit) }}>{fmt(row.wholesaleProfit)}</strong>
                </div>
                <div>
                  <small>Margen mayorista</small>
                  <span className={`badge ${row.wholesaleMargin > 0 ? 'badge-green' : row.wholesaleMargin < 0 ? 'badge-red' : 'badge-gray'}`}>{pct(row.wholesaleMargin)}</span>
                </div>
              </div>
            </article>
          ))}

          {!filteredMarginRows.length && (
            <div className="empty-state">
              <ArrowUpDown size={36} />
              <p>No hay productos para mostrar</p>
            </div>
          )}
        </div>

        {!loading && filteredMarginRows.length > MOBILE_MARGIN_PAGE_SIZE && (
          <div className="finance-pagination finance-margin-pagination">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMarginPage(page => Math.max(1, page - 1))}
              disabled={currentMarginPage <= 1}
            >
              Anterior
            </button>

            <span>
              Página {currentMarginPage} de {totalMarginPages} · {filteredMarginRows.length} productos
            </span>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMarginPage(page => Math.min(totalMarginPages, page + 1))}
              disabled={currentMarginPage >= totalMarginPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <div
        className="finance-mini-stats-grid finance-summary-section"
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
        <div className="card finance-chart-card finance-summary-section" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Flujo de caja y utilidad del rango
          </div>

          <div className="finance-chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
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

              <Bar
                dataKey="utilidad"
                fill="var(--accent2)"
                radius={[3, 3, 0, 0]}
                opacity={0.75}
                name="Utilidad"
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {categoryStats.length > 0 && (
        <div className="card finance-category-card finance-summary-section" style={{ padding: 20, marginBottom: 20 }}>
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
                  className="finance-category-row"
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
        className="finance-products-grid finance-summary-section"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="card finance-product-card" style={{ padding: 20 }}>
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

        <div className="card finance-product-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Productos con menor venta
            </div>
          </div>

          {filteredWorstProducts.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredWorstProducts.slice(0, 5).map((p: AnyObj, index: number) => (
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

      <div className="card finance-movements-card">
        <div className="finance-movements-title">
          <div>
            <h3>Últimos movimientos</h3>
            <p>Se muestran 5 por página, ordenados del más reciente al más antiguo.</p>
          </div>

          <span className="badge badge-gray">{MOVEMENTS_PAGE_SIZE} por página</span>
        </div>

        <div className="table-wrap finance-desktop-table">
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
                {paginatedEntries.map(e => (
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

        <div className="finance-mobile-list finance-movements-mobile">
          {loading ? (
            <div style={{ padding: 14 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 88, marginBottom: 10, borderRadius: 16 }} />
              ))}
            </div>
          ) : (
            paginatedEntries.map(e => (
              <article key={e.id} className="finance-mobile-item">
                <div className="finance-mobile-head">
                  <div>
                    <div className="finance-mobile-badges">
                      <span className={`badge ${e.type === 'INGRESO' ? 'badge-green' : 'badge-red'}`}>
                        {e.type === 'INGRESO' ? '↑' : '↓'} {e.type}
                      </span>
                      <span className="badge badge-gray">{categoryLabel(e.category)}</span>
                    </div>

                    <h4>{e.description || '—'}</h4>
                    <p>{new Date(e.date).toLocaleDateString('es-AR')}</p>
                  </div>

                  <strong className={e.type === 'INGRESO' ? 'finance-positive' : 'finance-negative'}>
                    {e.type === 'INGRESO' ? '+' : '-'}{fmt(Number(e.amount || 0))}
                  </strong>
                </div>
              </article>
            ))
          )}

          {!loading && !filteredEntries.length && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>Sin movimientos en el rango seleccionado</p>
            </div>
          )}
        </div>

        {!loading && recentEntries.length > MOVEMENTS_PAGE_SIZE && (
          <div className="finance-pagination">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMovementsPage(page => Math.max(1, page - 1))}
              disabled={currentMovementPage <= 1}
            >
              Anterior
            </button>

            <span>
              Página {currentMovementPage} de {totalMovementPages} · {recentEntries.length} movimientos
            </span>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMovementsPage(page => Math.min(totalMovementPages, page + 1))}
              disabled={currentMovementPage >= totalMovementPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      </div>

      {modal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setModal(false)}
        >
          <div className="modal finance-modal">
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
              <div className="form-row finance-form-row">
                <div className="form-group">
                  <label className="form-label">Tipo *</label>

                  <select
                    value={form.type}
                    onChange={e => field('type', e.target.value as FinanceForm['type'])}
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

            <div className="modal-footer finance-modal-footer">
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
      , document.body)}

      <style jsx>{`

        .finance-movements-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 16px 0;
        }

        .finance-movements-title h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .finance-movements-title p {
          margin: 4px 0 0;
          color: var(--text2);
          font-size: 13px;
        }

        .finance-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px 16px;
          border-top: 1px solid var(--border);
        }

        .finance-pagination span {
          color: var(--text2);
          font-size: 12px;
          font-family: var(--mono);
          text-align: center;
        }

        .finance-mobile-list {
          display: none;
        }


        .finance-mobile-tabs {
          display: none;
        }

        .finance-page {
          min-width: 0;
        }


        .finance-positive {
          color: var(--accent);
        }

        .finance-negative {
          color: var(--danger);
        }

        @media (max-width: 1100px) {
          .finance-stats-grid,
          .finance-stats-grid-secondary {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .finance-mini-stats-grid {
            grid-template-columns: 1fr !important;
          }

          .finance-products-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {

          .finance-page {
            display: grid;
            gap: 0;
          }

          .finance-mobile-tabs {
            position: sticky;
            top: 0;
            z-index: 40;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            padding: 8px;
            margin: 0 0 10px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: color-mix(in srgb, var(--surface) 92%, transparent);
            backdrop-filter: blur(12px);
          }

          .finance-mobile-tabs button {
            border: 1px solid transparent;
            border-radius: 999px;
            min-height: 34px;
            background: transparent;
            color: var(--text2);
            font-size: 11px;
            font-weight: 900;
            cursor: pointer;
          }

          .finance-mobile-tabs button.is-active {
            border-color: var(--accent);
            background: color-mix(in srgb, var(--accent) 13%, var(--surface));
            color: var(--accent);
          }

          .finance-tab-resumen .finance-margin-card,
          .finance-tab-resumen .finance-movements-card {
            display: none !important;
          }

          .finance-tab-margenes .finance-summary-section,
          .finance-tab-margenes .finance-movements-card {
            display: none !important;
          }

          .finance-tab-movimientos .finance-summary-section,
          .finance-tab-movimientos .finance-margin-card {
            display: none !important;
          }

          .finance-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 8px !important;
          }

          .finance-actions button {
            width: 100%;
            justify-content: center;
          }

          .finance-filter-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card,
          .finance-movements-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .finance-filter-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card {
            padding: 14px !important;
            margin-bottom: 14px !important;
          }

          .finance-filter-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .finance-filter-grid button {
            width: 100%;
            justify-content: center;
          }

          .finance-stats-grid,
          .finance-stats-grid-secondary,
          .finance-mini-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .finance-stats-grid .stat-card,
          .finance-stats-grid-secondary .stat-card,
          .finance-mini-stats-grid .stat-card {
            min-width: 0;
            min-height: 78px;
            border-radius: 16px;
            padding: 10px !important;
          }

          .finance-stats-grid .stat-card > div:first-child,
          .finance-stats-grid-secondary .stat-card > div:first-child,
          .finance-mini-stats-grid .stat-card > div:first-child {
            margin-bottom: 7px !important;
            gap: 6px !important;
          }

          .finance-stats-grid .stat-card span,
          .finance-stats-grid-secondary .stat-card span,
          .finance-mini-stats-grid .stat-card span {
            font-size: 10px !important;
            line-height: 1.2;
          }

          .finance-stats-grid .stat-value,
          .finance-stats-grid-secondary .stat-value,
          .finance-mini-stats-grid .stat-value {
            font-size: 15px !important;
            line-height: 1.15;
            overflow-wrap: anywhere;
          }

          .finance-card-header {
            flex-direction: column;
            gap: 12px !important;
            margin-bottom: 14px !important;
          }

          .finance-card-header > div:first-child {
            width: 100%;
            min-width: 0;
          }

          .finance-card-header > div:last-child {
            width: 100%;
            gap: 7px !important;
          }

          .finance-card-header h3 {
            font-size: 15px !important;
            line-height: 1.25;
          }

          .finance-card-header p {
            font-size: 12px !important;
            line-height: 1.4;
          }

          .finance-margin-controls {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .finance-margin-controls input,
          .finance-margin-controls select {
            width: 100%;
          }

          .finance-desktop-table {
            display: none;
          }

          .finance-mobile-list {
            display: grid;
            gap: 10px;
          }

          .finance-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 12px;
            min-width: 0;
          }

          .finance-mobile-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            min-width: 0;
          }

          .finance-mobile-head > div {
            min-width: 0;
            width: 100%;
          }

          .finance-mobile-head h4 {
            margin: 8px 0 0;
            font-size: 14px;
            font-weight: 900;
            color: var(--text);
            line-height: 1.25;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .finance-mobile-head p {
            margin: 5px 0 0;
            color: var(--text3);
            font-size: 12px;
          }

          .finance-mobile-head > strong {
            flex-shrink: 0;
            font-family: var(--mono);
            font-size: 13px;
            font-weight: 900;
            text-align: right;
          }

          .finance-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .finance-mobile-data {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            margin-top: 10px;
          }

          .finance-mobile-data > div {
            display: grid;
            gap: 4px;
            border-radius: 12px;
            background: var(--surface);
            padding: 8px;
            min-width: 0;
          }

          .finance-mobile-data small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .finance-mobile-data strong {
            font-family: var(--mono);
            font-size: 11px;
            text-align: left;
            overflow-wrap: anywhere;
          }

          .finance-chart-wrap {
            width: 100%;
            height: 240px;
            overflow: hidden;
          }

          .finance-category-row {
            align-items: flex-start !important;
            gap: 10px;
            border-radius: 14px !important;
          }

          .finance-category-row span:first-child {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .finance-category-row span:last-child {
            flex-shrink: 0;
            text-align: right;
          }

          .finance-products-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
            margin-bottom: 14px !important;
          }

          .finance-product-card > div:first-child {
            align-items: flex-start !important;
          }

          .finance-product-card div[style*='justify-content: space-between'] {
            align-items: flex-start !important;
          }

          .finance-product-card span {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .finance-movements-card {
            padding: 12px;
          }

          .finance-movements-mobile {
            padding: 0;
          }

          .finance-movements-title {
            padding: 14px 12px 0;
            flex-direction: column;
            gap: 8px;
          }

          .finance-movements-title h3 {
            font-size: 14px;
          }

          .finance-movements-title p {
            font-size: 12px;
          }

          .finance-pagination {
            display: grid;
            grid-template-columns: 1fr;
            padding: 12px;
          }

          .finance-pagination button {
            width: 100%;
            justify-content: center;
          }



          .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 0;
            background: rgba(0, 0, 0, 0.52);
          }

          .finance-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(88dvh, 640px) !important;
            margin: 0 !important;
            border-radius: 22px 22px 0 0 !important;
            overflow: hidden !important;
            display: flex;
            flex-direction: column;
            background: var(--surface);
          }

          .finance-modal .modal-header {
            flex-shrink: 0;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .finance-modal .modal-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 14px !important;
            background: var(--bg);
          }

          .finance-modal .modal-body .form-group,
          .finance-modal .modal-body .finance-form-row {
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 10px;
            background: var(--surface);
          }

          .finance-modal .modal-body .finance-form-row .form-group {
            border: 0;
            padding: 0;
            background: transparent;
          }

          .finance-modal-footer {
            flex-shrink: 0;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .finance-form-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .finance-modal-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .finance-modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .finance-filter-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .finance-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .finance-mobile-head {
            flex-direction: column;
          }

          .finance-mobile-head h4 {
            white-space: normal;
          }

          .finance-mobile-head > strong {
            text-align: left;
            font-size: 15px;
          }

          .finance-mobile-data > div {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .finance-mobile-data strong {
            text-align: left;
          }

          .finance-category-row {
            flex-direction: column;
          }

          .finance-category-row span:last-child {
            text-align: left;
          }
        }
      `}</style>

    </AppLayout>
  );
}
