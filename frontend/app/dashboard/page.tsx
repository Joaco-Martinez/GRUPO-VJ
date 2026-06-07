'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Sale, Alert, Product } from '@/types';
import { clientName, normalizeArray, productMinStock, productStock } from '@/lib/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

type DashboardData = {
  sales: Sale[];
  alerts: Alert[];
  products: Product[];
  totals: { totalRevenue?: number; totalSales?: number } | null;
};

async function fetchDashboardData(): Promise<DashboardData> {
  const [salesRes, alertsRes, productsRes, totalsRes] = await Promise.allSettled([
    api.get('/sales'),
    api.get('/alerts'),
    api.get('/products'),
    api.get('/product-stats/totals'),
  ]);

  const sales =
    salesRes.status === 'fulfilled'
      ? normalizeArray<Sale>(salesRes.value.data)
      : [];

  const alerts =
    alertsRes.status === 'fulfilled'
      ? normalizeArray<Alert>(alertsRes.value.data)
      : [];

  const products =
    productsRes.status === 'fulfilled'
      ? normalizeArray<Product>(productsRes.value.data)
      : [];

  const totals =
    totalsRes.status === 'fulfilled'
      ? totalsRes.value.data.content ?? totalsRes.value.data
      : null;

  return {
    sales,
    alerts,
    products,
    totals,
  };
}

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<{ totalRevenue?: number; totalSales?: number } | null>(null);

  useEffect(() => {
    let alive = true;

    fetchDashboardData()
      .then((data) => {
        if (!alive) return;

        setSales(data.sales);
        setAlerts(data.alerts);
        setProducts(data.products);
        setTotals(data.totals);

        const hasPartialError =
          data.sales.length === 0 &&
          data.alerts.length === 0 &&
          data.products.length === 0 &&
          !data.totals;

        if (hasPartialError) {
          toast.error('No se pudieron cargar los datos del dashboard');
        }
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error('Error al cargar el dashboard');
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const salesByDay = (() => {
    const map: Record<string, number> = {};

    (Array.isArray(sales) ? sales : []).forEach((s) => {
      if (s.status === 'COMPLETED') {
        const d = new Date(s.createdAt).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
        });

        map[d] = (map[d] || 0) + (s.total || 0);
      }
    });

    return Object.entries(map)
      .slice(-14)
      .map(([date, total]) => ({ date, total }));
  })();

  const todaySales = (Array.isArray(sales) ? sales : []).filter((s) => {
    const today = new Date().toDateString();
    return new Date(s.createdAt).toDateString() === today && s.status === 'COMPLETED';
  });

  const todayRevenue = todaySales.reduce((a, s) => a + (s.total || 0), 0);

  const lowStock = (Array.isArray(products) ? products : []).filter(
    (p) => productStock(p) <= productMinStock(p)
  ).length;

  return (
    <AppLayout title="Dashboard" subtitle="Resumen general">
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 28,
            }}
          >
            <StatCard
              icon={<DollarSign size={18} />}
              label="Ventas hoy"
              value={fmt(todayRevenue)}
              sub={`${todaySales.length} transacciones`}
              color="var(--accent)"
            />

            <StatCard
              icon={<ShoppingCart size={18} />}
              label="Total ventas"
              value={String(
                totals?.totalSales ??
                  (Array.isArray(sales) ? sales : []).filter((s) => s.status === 'COMPLETED')
                    .length
              )}
              sub="Completadas"
              color="var(--accent2)"
            />

            <StatCard
              icon={<Package size={18} />}
              label="Productos"
              value={String((Array.isArray(products) ? products : []).length)}
              sub={`${lowStock} bajo stock`}
              color="#a78bfa"
            />

            <StatCard
              icon={<AlertTriangle size={18} />}
              label="Alertas"
              value={String(alerts.length)}
              sub="Stock crítico"
              color={alerts.length > 0 ? 'var(--danger)' : 'var(--text3)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div className="section-title" style={{ fontSize: 15 }}>
                  Ingresos — últimos 14 días
                </div>
              </div>

              {salesByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesByDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />

                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'var(--text2)' }}
                      formatter={(v: unknown) => [fmt(Number(v)), 'Total']}
                    />

                    <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="empty-state"
                  style={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <TrendingUp size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>Sin datos de ventas todavía</p>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div className="section-title" style={{ fontSize: 15 }}>
                  Alertas de stock
                </div>

                <Link
                  href="/alertas"
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  Ver todas
                </Link>
              </div>

              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
                  <AlertTriangle size={28} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13 }}>Sin alertas activas</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.slice(0, 6).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: 'var(--surface2)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {a.productName ?? a.product?.name ?? a.message ?? 'Producto'}
                      </span>

                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          color: 'var(--danger)',
                        }}
                      >
                        {a.stockLocal ?? a.product?.stockLocal ?? '—'} /{' '}
                        {a.minStock ?? a.product?.minStock ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, padding: 24 }}>
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="section-title" style={{ fontSize: 15 }}>
                Ventas recientes
              </div>

              <Link
                href="/ventas"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
              >
                Ver historial
              </Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {(Array.isArray(sales) ? sales : []).slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--text3)',
                          }}
                        >
                          #{s.id.slice(-6)}
                        </span>
                      </td>

                      <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                        {new Date(s.createdAt).toLocaleDateString('es-AR')}
                      </td>

                      <td style={{ fontSize: 13 }}>{clientName(s.client)}</td>

                      <td>
                        <span className="badge badge-gray">{s.paymentMethod}</span>
                      </td>

                      <td
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}
                      >
                        {fmt(s.total)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            s.status === 'COMPLETED'
                              ? 'badge-green'
                              : s.status === 'PENDING'
                                ? 'badge-yellow'
                                : 'badge-red'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!sales || !sales.length) && (
                <div className="empty-state">
                  <p>Sin ventas registradas</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </div>
      </div>

      <div className="stat-value" style={{ color }}>
        {value}
      </div>

      <div className="stat-label">{label}</div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    </div>
  );
}