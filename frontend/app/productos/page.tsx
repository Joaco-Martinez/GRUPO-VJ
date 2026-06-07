'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { FinanceEntry, Product, Sale } from '@/types';
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

function reactKey(value: unknown, fallback: string): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return fallback;
}

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

type UnknownObj = Record<string, unknown>;

type ApiError = {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
};

type SaleItemLike = {
  quantity?: number | string | null;
  quantityKg?: number | string | null;
  purchasePriceSnapshot?: number | string | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const e = error as ApiError;
  return e.response?.data?.message ?? e.response?.data?.error ?? fallback;
};

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

const isRecord = (value: unknown): value is UnknownObj =>
  typeof value === 'object' && value !== null;

const getRecord = (value: unknown): UnknownObj | undefined =>
  isRecord(value) ? value : undefined;

const getNestedRecord = (value: unknown, key: string): UnknownObj | undefined => {
  const obj = getRecord(value);
  return obj && isRecord(obj[key]) ? obj[key] : undefined;
};



const getStringField = (value: unknown, key: string) => {
  const obj = getRecord(value);
  const field = obj?.[key];
  return typeof field === 'string' ? field : undefined;
};

const normalizeArray = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];

  const obj = getRecord(data);

  if (Array.isArray(obj?.content)) return obj.content as T[];
  if (Array.isArray(obj?.data)) return obj.data as T[];
  if (Array.isArray(obj?.items)) return obj.items as T[];
  if (Array.isArray(obj?.results)) return obj.results as T[];

  return [];
};

const normalizeAmount = (data: unknown): number => {
  if (typeof data === 'number') return data;

  const obj = getRecord(data);
  const sum = getNestedRecord(data, '_sum');

  if (typeof obj?.total === 'number') return obj.total;
  if (typeof obj?.amount === 'number') return obj.amount;
  if (typeof obj?.income === 'number') return obj.income;
  if (typeof obj?.totalIncome === 'number') return obj.totalIncome;
  if (typeof sum?.amount === 'number') return sum.amount;

  return 0;
};

const getProductName = (p: UnknownObj) => {
  const product = getRecord(p.product);

  return (
    getStringField(p, 'name') ??
    getStringField(p, 'productName') ??
    getStringField(p, 'productNameSnapshot') ??
    getStringField(product, 'name') ??
    getStringField(product, 'title') ??
    getStringField(p, 'title') ??
    'Producto'
  );
};

const getProductQty = (p: UnknownObj) => {
  const sum = getRecord(p._sum);

  return Number(
    p.quantity ??
      p.totalSold ??
      p.totalQuantity ??
      p.sold ??
      sum?.quantity ??
      sum?.quantityKg ??
      0
  );
};

const getItemQuantity = (item: SaleItemLike) => {
  const quantityKg = Number(item.quantityKg || 0);
  if (quantityKg > 0) return quantityKg;

  const quantity = Number(item.quantity || 0);
  return quantity > 0 ? quantity : 1;
};

const getSaleItemCost = (item: SaleItemLike) => {
  const qty = getItemQuantity(item);
  return Number(item.purchasePriceSnapshot || 0) * qty;
};

const getSaleCost = (sale: Sale) => {
  return (sale.items || []).reduce((acc, item) => {
    return acc + getSaleItemCost(item as SaleItemLike);
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

  const [stats, setStats] = useState<StatsState>({
    week: 0,
    month: 0,
    year: 0,
  });

  const [categoryStats, setCategoryStats] = useState<UnknownObj[]>([]);
  const [topProducts, setTopProducts] = useState<UnknownObj[]>([]);
  const [worstProducts, setWorstProducts] = useState<UnknownObj[]>([]);

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
    params?: Record<string, unknown>
  ): Promise<T> => {
    try {
      const res = await api.get(url, { params });
      return res.data;
    } catch {
      return fallback;
    }
  };

  const fetchFinanceData = async (fromDate = dateFrom, toDate = dateTo) => {
    const selected = getPartsFromDate(toDate);

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
      safeGet<unknown>('/finance', []),
      safeGet<unknown>('/sales', []),
      safeGet<unknown>('/products', []),
      safeGet<unknown>('/finance/income/week', 0, {
        year: selected.year,
        month: selected.month,
        day: selected.day,
      }),
      safeGet<unknown>('/finance/income/month', 0, {
        year: selected.year,
        month: selected.month,
      }),
      safeGet<unknown>('/finance/income/year', 0, {
        year: selected.year,
      }),
      safeGet<unknown>('/finance/income/category', [], {
        startDate: fromDate,
        endDate: toDate,
      }),
      safeGet<unknown>('/finance/products/top-range', [], {
        startDate: fromDate,
        endDate: toDate,
        limit: 5,
      }),
      safeGet<unknown>('/finance/products/worst-range', [], {
        startDate: fromDate,
        endDate: toDate,
        limit: 5,
      }),
    ]);

    return {
      entries: normalizeArray<FinanceEntry>(financeData),
      sales: normalizeArray<Sale>(salesData),
      products: normalizeArray<Product>(productsData),
      stats: {
        week: normalizeAmount(weekData),
        month: normalizeAmount(monthData),
        year: normalizeAmount(yearData),
      },
      categoryStats: normalizeArray<UnknownObj>(categoryData),
      topProducts: normalizeArray<UnknownObj>(topProductsData),
      worstProducts: normalizeArray<UnknownObj>(worstProductsData),
    };
  };

  const applyFinanceData = (data: Awaited<ReturnType<typeof fetchFinanceData>>) => {
    setEntries(data.entries);
    setSales(data.sales);
    setProducts(data.products);
    setStats(data.stats);
    setCategoryStats(data.categoryStats);
    setTopProducts(data.topProducts);
    setWorstProducts(data.worstProducts);
  };

  const load = async (showSuccess = false, fromDate = dateFrom, toDate = dateTo) => {
    setLoading(true);

    try {
      const data = await fetchFinanceData(fromDate, toDate);
      applyFinanceData(data);

      if (showSuccess) {
        toast.success('Finanzas actualizadas');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar finanzas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchFinanceData()
      .then((data) => {
        if (!alive) return;
        applyFinanceData(data);
      })
      .catch((error) => {
        console.error(error);

        if (!alive) return;
        toast.error('Error al cargar finanzas');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
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
    const nextFrom = firstDayOfCurrentMonth();
    const nextTo = today();

    setDateFrom(nextFrom);
    setDateTo(nextTo);

    await load(true, nextFrom, nextTo);
  };

  const applyFilters = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccioná desde y hasta');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      toast.error('La fecha desde no puede ser mayor a la fecha hasta');
      return;
    }

    await load(true);
  };

  const handleSave = async () => {
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      toast.error('Ingresá un importe válido');
      return;
    }

    if (!form.description.trim()) {
      toast.error('Ingresá una descripción');
      return;
    }

    setSaving(true);

    const toastId = toast.loading('Guardando movimiento...');

    try {
      await api.post('/finance', {
        type: form.type,
        amount,
        description: form.description.trim(),
        category: form.category || 'Otro',
        date: `${form.date}T12:00:00.000Z`,
      });

      setModal(false);
      toast.success('Movimiento financiero guardado', { id: toastId });
      await load();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error guardando el movimiento financiero'), {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blobData: BlobPart, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([blobData]));
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const toastId = toast.loading('Generando Excel...');

    try {
      const res = await api.get('/finance/export/excel', {
        responseType: 'blob',
        params: {
          startDate: dateFrom,
          endDate: dateTo,
        },
      });

      downloadBlob(res.data, `finanzas-${dateFrom}-a-${dateTo}.xlsx`);
      toast.success('Excel descargado correctamente', { id: toastId });
    } catch {
      toast.error('Error exportando Excel', { id: toastId });
    }
  };

  const exportPDF = async () => {
    const toastId = toast.loading('Generando PDF...');

    try {
      const res = await api.get('/finance/export/pdf', {
        responseType: 'blob',
        params: {
          startDate: dateFrom,
          endDate: dateTo,
        },
      });

      downloadBlob(res.data, `finanzas-${dateFrom}-a-${dateTo}.pdf`);
      toast.success('PDF descargado correctamente', { id: toastId });
    } catch {
      toast.error('Error exportando PDF', { id: toastId });
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

      <div
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
                background: resultadoEstimado >= 0 ? 'rgba(0,229,160,0.1)' : 'rgba(239,68,68,0.1)',
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

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div
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
              onChange={e => setMarginSearch(e.target.value)}
              placeholder="Buscar producto, SKU o categoría..."
              style={{ paddingLeft: 36 }}
            />
          </div>

          <select value={marginSort} onChange={e => setMarginSort(e.target.value as MarginSort)}>
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

        <div className="table-wrap">
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
            Flujo de caja y utilidad del rango
          </div>

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
            {categoryStats.map((item: UnknownObj, index: number) => {
              const sum = getRecord(item._sum);
              const category =
                getStringField(item, 'category') ??
                getStringField(item, 'name') ??
                getStringField(item, 'label') ??
                'Sin categoría';

              const total = Number(
                item.total ??
                  item.amount ??
                  item.income ??
                  item.totalIncome ??
                  sum?.amount ??
                  0
              );

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
                    {fmt(total)}
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
              {topProducts.slice(0, 5).map((p: UnknownObj, index: number) => (
                <div
                  key={reactKey(p.id, `${getProductName(p)}-${index}`)}
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

          {filteredWorstProducts.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredWorstProducts.slice(0, 5).map((p: UnknownObj, index: number) => (
                <div
                  key={reactKey(p.id, `${getProductName(p)}-${index}`)}
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
