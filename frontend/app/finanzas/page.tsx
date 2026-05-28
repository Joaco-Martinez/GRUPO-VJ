'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { FinanceEntry } from '@/types';
import { Plus, TrendingUp, TrendingDown, Wallet, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'INGRESO', amount: '', description: '', category: '', date: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setLoading(true);
    api.get('/finance').then(r => setEntries(r.data.content ?? r.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const ingresos = entries.filter(e => e.type === 'INGRESO').reduce((a, e) => a + e.amount, 0);
  const egresos = entries.filter(e => e.type === 'EGRESO').reduce((a, e) => a + e.amount, 0);
  const balance = ingresos - egresos;

  const chartData = (() => {
    const map: Record<string, { date: string; ingresos: number; egresos: number }> = {};
    entries.forEach(e => {
      const d = new Date(e.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      if (!map[d]) map[d] = { date: d, ingresos: 0, egresos: 0 };
      if (e.type === 'INGRESO') map[d].ingresos += e.amount;
      else map[d].egresos += e.amount;
    });
    return Object.values(map).slice(-14);
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/finance', { ...form, amount: parseFloat(form.amount) });
      setModal(false);
      load();
    } catch { alert('Error'); } finally { setSaving(false); }
  };

  const field = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <AppLayout
      title="Finanzas"
      subtitle="Ingresos, egresos y balance"
      actions={<button className="btn btn-primary btn-sm" onClick={() => { setForm({ type: 'INGRESO', amount: '', description: '', category: '', date: new Date().toISOString().slice(0, 10) }); setModal(true); }}><Plus size={14} /> Nueva entrada</button>}
    >
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,229,160,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Ingresos</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(ingresos)}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={16} style={{ color: 'var(--danger)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Egresos</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)', fontSize: 22 }}>{fmt(egresos)}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79,142,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} style={{ color: 'var(--accent2)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Balance</span>
          </div>
          <div className="stat-value" style={{ color: balance >= 0 ? 'var(--accent)' : 'var(--danger)', fontSize: 22 }}>{fmt(balance)}</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Flujo de caja — últimos 14 días</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12 }} formatter={(v: unknown) => fmt(Number(v))} />
              <Bar dataKey="ingresos" fill="var(--accent)" radius={[3,3,0,0]} opacity={0.85} name="Ingresos" />
              <Bar dataKey="egresos" fill="var(--danger)" radius={[3,3,0,0]} opacity={0.7} name="Egresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
          ) : (
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Importe</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{new Date(e.date).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className={`badge ${e.type === 'INGRESO' ? 'badge-green' : 'badge-red'}`}>
                        {e.type === 'INGRESO' ? '↑' : '↓'} {e.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{e.description}</td>
                    <td><span className="badge badge-gray">{e.category || '—'}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: e.type === 'INGRESO' ? 'var(--accent)' : 'var(--danger)' }}>
                      {e.type === 'INGRESO' ? '+' : '-'}{fmt(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !entries.length && <div className="empty-state"><Wallet size={36} /><p>Sin entradas registradas</p></div>}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Nueva entrada financiera</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)} style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo *</label>
                  <select value={form.type} onChange={e => field('type', e.target.value)}>
                    <option value="INGRESO">INGRESO</option>
                    <option value="EGRESO">EGRESO</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => field('date', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Importe *</label>
                <input type="number" value={form.amount} onChange={e => field('amount', e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <input value={form.description} onChange={e => field('description', e.target.value)} placeholder="Descripción del movimiento" />
              </div>
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <input value={form.category} onChange={e => field('category', e.target.value)} placeholder="Ej: Alquiler, Sueldos, Ventas..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.amount || !form.description}>
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
