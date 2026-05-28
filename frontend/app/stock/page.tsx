'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { MovementLocation, Product, StockMovement } from '@/types';
import { fmtDate, normalizeArray, num, productMinStock, productStock } from '@/lib/helpers';
import { ArrowDownCircle, ArrowUpCircle, BarChart2, RefreshCcw, Search } from 'lucide-react';

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ productId: '', location: 'LOCAL' as MovementLocation, quantity: '', quantityKg: '', mode: 'ADD' });
  const [saving, setSaving] = useState(false);

  const load = async () => { setLoading(true); try { const [p, m] = await Promise.all([api.get('/products'), api.get('/products/movements').catch(() => ({ data: [] }))]); setProducts(normalizeArray<Product>(p.data)); setMovements(normalizeArray<StockMovement>(m.data)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || String(p.sku ?? '').toLowerCase().includes(search.toLowerCase()));
  const selected = products.find(p => p.id === form.productId);
  const save = async () => { if (!selected) return; setSaving(true); try { if (selected.saleUnit === 'KG') await api.post(`/products/${selected.id}/add-stock-kg`, { to: form.location, quantityKg: num(form.quantityKg) }); else await api.post('/products/add-stock', { productId: selected.id, to: form.location, quantity: num(form.quantity) }); setForm({ productId: '', location: 'LOCAL', quantity: '', quantityKg: '', mode: 'ADD' }); await load(); } catch (e: unknown) { alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al mover stock'); } finally { setSaving(false); } };

  return <AppLayout title="Stock" subtitle="Inventario local, depósito y movimientos">
    <div className="card" style={{ padding: 16, marginBottom: 18 }}><div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}><div><label className="form-label">Producto</label><select value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}><option value="">Seleccionar...</option>{products.filter(p => p.type === 'SIMPLE').map(p => <option key={p.id} value={p.id}>{p.name} · {p.saleUnit === 'KG' ? `${p.stockLocalKg ?? 0} kg` : p.stockLocal}</option>)}</select></div><div><label className="form-label">Destino</label><select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value as MovementLocation }))}><option value="LOCAL">Local</option><option value="DEPOSITO">Depósito</option></select></div><div><label className="form-label">Cantidad {selected?.saleUnit === 'KG' ? 'kg' : ''}</label><input type="number" value={selected?.saleUnit === 'KG' ? form.quantityKg : form.quantity} onChange={e => setForm(p => ({ ...p, [selected?.saleUnit === 'KG' ? 'quantityKg' : 'quantity']: e.target.value }))}/></div><button className="btn btn-primary" onClick={save} disabled={saving || !selected}>{saving ? <span className="spinner"/> : 'Agregar stock'}</button></div></div>
    <div style={{ position: 'relative', marginBottom: 18, maxWidth: 420 }}><Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft: 34 }}/></div>
    <div className="card" style={{ marginBottom: 18 }}><div className="table-wrap">{loading ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 200 }}/></div> : <table><thead><tr><th>Producto</th><th>SKU</th><th>Unidad</th><th>Local</th><th>Depósito</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{filtered.map(p => { const stock=productStock(p), min=productMinStock(p), critical=stock<=min; return <tr key={p.id}><td><b>{p.name}</b></td><td style={{ fontFamily: 'var(--mono)' }}>{p.sku}</td><td><span className="badge badge-gray">{p.saleUnit}</span></td><td style={{ fontFamily: 'var(--mono)', color: critical ? 'var(--danger)' : 'var(--text)' }}>{stock}{p.saleUnit === 'KG' ? ' kg' : ''}</td><td>{p.saleUnit === 'KG' ? num(p.stockDepositoKg) : num(p.stockDeposito)}</td><td>{min}</td><td><span className={`badge ${critical ? 'badge-red' : 'badge-green'}`}>{critical ? 'BAJO' : 'OK'}</span></td></tr>; })}</tbody></table>}{!loading && !filtered.length && <div className="empty-state"><BarChart2 size={36}/><p>Sin productos</p></div>}</div></div>
    <div className="card"><div style={{ padding: 16, borderBottom: '1px solid var(--border)', fontWeight: 800 }}>Movimientos recientes</div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Desde</th><th>Hacia</th><th>Cantidad</th><th>Referencia</th></tr></thead><tbody>{movements.slice(0, 80).map(m => <tr key={m.id}><td>{fmtDate(m.createdAt)}</td><td>{m.product?.name ?? m.productId}</td><td><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{m.type === 'SALE' ? <ArrowUpCircle size={14} style={{ color: 'var(--danger)' }}/> : <ArrowDownCircle size={14} style={{ color: 'var(--accent)' }}/>} {m.type}</span></td><td>{m.from ?? '—'}</td><td>{m.to ?? '—'}</td><td style={{ fontFamily: 'var(--mono)' }}>{m.quantityKg ? `${m.quantityKg} kg` : m.quantity ?? '—'}</td><td>{m.reason ?? m.reference ?? '—'}</td></tr>)}</tbody></table></div></div>
  </AppLayout>;
}
