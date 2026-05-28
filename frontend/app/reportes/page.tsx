'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Award, DollarSign, Clock } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

const COLORS = ['#00e5a0', '#4f8eff', '#ff6b35', '#fbbf24', '#a78bfa', '#34d399'];

type ProductStat = {
  productId?: string;
  name: string;
  saleUnit?: 'UNIT' | 'KG';

  unitsSold?: number;
  kgSold?: number;

  totalSold: number;
  totalSoldLabel?: string;

  totalRevenue: number;
  grossRevenue?: number;
  collectedRevenue?: number;
  pendingRevenue?: number;

  rankValue?: number;
};

type Totals = {
  totalRevenue: number;
  totalSales: number;
  totalItems: number;
  totalUnits?: number;
  totalKg?: number;
  productsCount?: number;

  grossRevenue?: number;
  collectedRevenue?: number;
  pendingRevenue?: number;
};

function n0(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapResponse(data: unknown): unknown {
  if (!isRecord(data)) return data;

  if ('content' in data) return data.content;
  if ('data' in data) return data.data;
  if ('result' in data) return data.result;

  return data;
}

function normalizeProductStats(data: unknown): ProductStat[] {
  const unwrapped = unwrapResponse(data);

  if (!Array.isArray(unwrapped)) return [];

  return unwrapped.map((item, index) => {
    if (!isRecord(item)) {
      return {
        name: `Producto ${index + 1}`,
        totalSold: 0,
        totalRevenue: 0,
        grossRevenue: 0,
        collectedRevenue: 0,
        pendingRevenue: 0,
      };
    }

    const product = isRecord(item.product) ? item.product : null;

    const name = String(
      item.name ??
        item.productName ??
        product?.name ??
        `Producto ${index + 1}`
    );

    const saleUnit = String(item.saleUnit ?? product?.saleUnit ?? 'UNIT') as 'UNIT' | 'KG';

    const unitsSold = n0(item.unitsSold ?? item.quantity ?? item.totalQuantity);
    const kgSold = n0(item.kgSold ?? item.quantityKg);

    const totalSold = n0(
      item.totalSold ??
        item.rankValue ??
        (saleUnit === 'KG' ? kgSold : unitsSold)
    );

    const grossRevenue = n0(item.grossRevenue ?? item.totalRevenue ?? item.revenue ?? item.total);
    const collectedRevenue = n0(item.collectedRevenue);
    const pendingRevenue = n0(item.pendingRevenue);

    return {
      productId: String(item.productId ?? product?.id ?? ''),
      name,
      saleUnit,
      unitsSold,
      kgSold,
      totalSold,
      totalSoldLabel:
        String(item.totalSoldLabel ?? '') ||
        (saleUnit === 'KG' ? `${kgSold} kg` : `${totalSold} u.`),
      totalRevenue: grossRevenue,
      grossRevenue,
      collectedRevenue,
      pendingRevenue,
      rankValue: n0(item.rankValue ?? totalSold),
    };
  });
}

function normalizeTotals(data: unknown): Totals {
  const unwrapped = unwrapResponse(data);

  if (isRecord(unwrapped) && !Array.isArray(unwrapped)) {
    const grossRevenue = n0(unwrapped.grossRevenue ?? unwrapped.totalRevenue);
    const collectedRevenue = n0(unwrapped.collectedRevenue);
    const pendingRevenue = n0(unwrapped.pendingRevenue);

    return {
      totalRevenue: n0(unwrapped.totalRevenue ?? grossRevenue),
      totalSales: n0(unwrapped.totalSales),
      totalItems: n0(unwrapped.totalItems),
      totalUnits: n0(unwrapped.totalUnits),
      totalKg: n0(unwrapped.totalKg),
      productsCount: n0(unwrapped.productsCount),
      grossRevenue,
      collectedRevenue,
      pendingRevenue,
    };
  }

  if (Array.isArray(unwrapped)) {
    const products = normalizeProductStats(unwrapped);

    const grossRevenue = products.reduce((acc, p) => acc + n0(p.grossRevenue ?? p.totalRevenue), 0);
    const collectedRevenue = products.reduce((acc, p) => acc + n0(p.collectedRevenue), 0);
    const pendingRevenue = products.reduce((acc, p) => acc + n0(p.pendingRevenue), 0);

    return {
      totalRevenue: grossRevenue,
      totalSales: 0,
      totalItems: products.reduce((acc, p) => acc + n0(p.totalSold), 0),
      totalUnits: products.reduce((acc, p) => acc + n0(p.unitsSold), 0),
      totalKg: products.reduce((acc, p) => acc + n0(p.kgSold), 0),
      productsCount: products.length,
      grossRevenue,
      collectedRevenue,
      pendingRevenue,
    };
  }

  return {
    totalRevenue: 0,
    totalSales: 0,
    totalItems: 0,
    totalUnits: 0,
    totalKg: 0,
    productsCount: 0,
    grossRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
  };
}

export default function ReportesPage() {
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalRevenue: 0,
    totalSales: 0,
    totalItems: 0,
    totalUnits: 0,
    totalKg: 0,
    productsCount: 0,
    grossRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
  });

  const [topRange, setTopRange] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });

  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);

    Promise.all([
      api
        .get('/product-stats/top?limit=10')
        .then((r) => {
          setTopProducts(normalizeProductStats(r.data));
        })
        .catch((err) => {
          console.error('❌ Error /product-stats/top:', err);
          setTopProducts([]);
        }),

      api
        .get('/product-stats/totals')
        .then((r) => {
          setTotals(normalizeTotals(r.data));
        })
        .catch((err) => {
          console.error('❌ Error /product-stats/totals:', err);
          setTotals({
            totalRevenue: 0,
            totalSales: 0,
            totalItems: 0,
            totalUnits: 0,
            totalKg: 0,
            productsCount: 0,
            grossRevenue: 0,
            collectedRevenue: 0,
            pendingRevenue: 0,
          });
        }),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRangeLoading(true);

    api
      .get(`/product-stats/top-range?start=${from}&end=${to}&limit=10`)
      .then((r) => {
        setTopRange(normalizeProductStats(r.data));
      })
      .catch((err) => {
        console.error('❌ Error /product-stats/top-range:', err);
        setTopRange([]);
      })
      .finally(() => setRangeLoading(false));
  }, [from, to]);

  const pieData = useMemo(
    () =>
      topProducts
        .slice(0, 6)
        .map((p) => ({
          name: p.name,
          value: n0(p.collectedRevenue ?? 0),
        }))
        .filter((p) => p.value > 0),
    [topProducts]
  );

  return (
    <AppLayout title="Reportes y Estadísticas" subtitle="Análisis de ventas, cobros y cuenta corriente">
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={`skeleton-${i}`} className="skeleton" style={{ height: 200 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Totales */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
              marginBottom: 24,
            }}
          >
            {[
              {
                label: 'Ingresos cobrados',
                value: fmt(totals.collectedRevenue ?? 0),
                icon: <DollarSign size={18} />,
                color: 'var(--accent)',
              },
              {
                label: 'Ventas brutas',
                value: fmt(totals.grossRevenue ?? totals.totalRevenue),
                icon: <TrendingUp size={18} />,
                color: 'var(--accent2)',
              },
              {
                label: 'Pendiente CC',
                value: fmt(totals.pendingRevenue ?? 0),
                icon: <Clock size={18} />,
                color: '#a78bfa',
              },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${s.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: s.color,
                    marginBottom: 12,
                  }}
                >
                  {s.icon}
                </div>
                <div className="stat-value" style={{ color: s.color, fontSize: 24 }}>
                  {s.value}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Top products bar chart */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
                Top productos — unidades / kg vendidos
              </div>

              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topProducts.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'var(--mono)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--text)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [Number(v), 'Vendido']}
                    />
                    <Bar
                      dataKey="totalSold"
                      fill="var(--accent)"
                      radius={[0, 4, 4, 0]}
                      opacity={0.85}
                      name="Vendido"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <TrendingUp size={36} />
                  <p>Sin datos</p>
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
                Distribución de ingresos cobrados
              </div>

              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((d, i) => (
                          <Cell key={`${d.name}-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                        }}
                        formatter={(v: unknown) => fmt(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {pieData.slice(0, 5).map((d, i) => (
                      <div
                        key={`${d.name}-${i}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: COLORS[i % COLORS.length],
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: 'var(--text2)',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {d.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            color: 'var(--text)',
                            fontWeight: 600,
                          }}
                        >
                          {fmt(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Award size={36} />
                  <p>Sin ingresos cobrados por producto</p>
                </div>
              )}
            </div>
          </div>

          {/* Range filter */}
          <div className="card" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>Top por rango de fechas</div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ width: 150 }}
                />
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>hasta</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ width: 150 }}
                />
              </div>
            </div>

            {rangeLoading ? (
              <div className="skeleton" style={{ height: 180 }} />
            ) : topRange.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Vendido</th>
                      <th>Venta bruta</th>
                      <th>Cobrado</th>
                      <th>Pendiente CC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRange.map((p, i) => (
                      <tr key={`${p.productId ?? p.name}-${i}`}>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 13,
                              color: i < 3 ? 'var(--accent)' : 'var(--text3)',
                              fontWeight: 700,
                            }}
                          >
                            #{i + 1}
                          </span>
                        </td>

                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</td>

                        <td>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                            {p.totalSoldLabel ?? p.totalSold}
                          </span>
                        </td>

                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                          {fmt(p.grossRevenue ?? p.totalRevenue)}
                        </td>

                        <td
                          style={{
                            fontFamily: 'var(--mono)',
                            fontWeight: 700,
                            color: 'var(--accent)',
                          }}
                        >
                          {fmt(p.collectedRevenue ?? 0)}
                        </td>

                        <td
                          style={{
                            fontFamily: 'var(--mono)',
                            fontWeight: 700,
                            color: n0(p.pendingRevenue) > 0 ? '#a78bfa' : 'var(--text3)',
                          }}
                        >
                          {fmt(p.pendingRevenue ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <TrendingUp size={36} />
                <p>Sin datos para el rango seleccionado</p>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}