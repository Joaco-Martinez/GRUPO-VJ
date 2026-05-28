'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Award, DollarSign } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const COLORS = ['#00e5a0', '#4f8eff', '#ff6b35', '#fbbf24', '#a78bfa', '#34d399'];

export default function ReportesPage() {
  const [topProducts, setTopProducts] = useState<{ name: string; totalSold: number; totalRevenue: number }[]>([]);
  const [totals, setTotals] = useState<{ totalRevenue: number; totalSales: number; totalItems: number } | null>(null);
  const [topRange, setTopRange] = useState<typeof topProducts>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/product-stats/top').then(r => setTopProducts(r.data.content ?? r.data ?? [])).catch(() => {}),
      api.get('/product-stats/totals').then(r => setTotals(r.data.content ?? r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const loadRange = () => {
    api.get(`/product-stats/top-range?from=${from}&to=${to}&limit=10`)
      .then(r => setTopRange(r.data.content ?? r.data ?? []))
      .catch(() => {});
  };

  useEffect(() => { loadRange(); }, [from, to]);

  const pieData = topProducts.slice(0, 6).map(p => ({ name: p.name, value: p.totalRevenue }));

  return (
    <AppLayout title="Reportes y Estadísticas" subtitle="Análisis de ventas y rendimiento">
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 200 }} />)}
        </div>
      ) : (
        <>
          {/* Totales */}
          {totals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Ingresos totales', value: fmt(totals.totalRevenue), icon: <DollarSign size={18} />, color: 'var(--accent)' },
                { label: 'Ventas totales', value: String(totals.totalSales), icon: <TrendingUp size={18} />, color: 'var(--accent2)' },
                { label: 'Ítems vendidos', value: String(totals.totalItems), icon: <Award size={18} />, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, marginBottom: 12 }}>
                    {s.icon}
                  </div>
                  <div className="stat-value" style={{ color: s.color, fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Top products bar chart */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Top productos — ventas totales</div>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12 }}
                      formatter={(v: unknown, name: unknown) => [name === 'totalRevenue' ? fmt(Number(v)) : Number(v), name === 'totalRevenue' ? 'Revenue' : 'Unidades']}
                    />
                    <Bar dataKey="totalSold" fill="var(--accent)" radius={[0, 4, 4, 0]} opacity={0.85} name="totalSold" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><TrendingUp size={36} /><p>Sin datos</p></div>
              )}
            </div>

            {/* Pie chart */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Distribución de ingresos</div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} formatter={(v: unknown) => fmt(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {pieData.slice(0, 5).map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i], flexShrink: 0 }} />
                        <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state"><TrendingUp size={36} /><p>Sin datos</p></div>
              )}
            </div>
          </div>

          {/* Range filter */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Top por rango de fechas</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>hasta</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
              </div>
            </div>
            {topRange.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Producto</th><th>Unidades vendidas</th><th>Ingresos</th></tr></thead>
                  <tbody>
                    {topRange.map((p, i) => (
                      <tr key={p.name}>
                        <td><span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: i < 3 ? 'var(--accent)' : 'var(--text3)', fontWeight: 700 }}>#{i + 1}</span></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</td>
                        <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{p.totalSold}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><TrendingUp size={36} /><p>Sin datos para el rango seleccionado</p></div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
