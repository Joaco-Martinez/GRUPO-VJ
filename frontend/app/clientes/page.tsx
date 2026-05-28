'use client';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { AccountMovement, Client, ClientCategory, PaymentMethod } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import { CreditCard, Edit2, Plus, Search, Trash2, Users, Wallet, X } from 'lucide-react';

const paymentMethods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DEBITO', 'CREDITO', 'QR', 'QR_MERCADOPAGO', 'QR_NACION'];
const emptyForm = { nombre: '', apellido: '', dni: '', telefono: '', gmail: '', category: 'Cliente', creditLimit: '', isAccountEnabled: 'true' };

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'payment' | 'history' | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [payment, setPayment] = useState({ amount: '', method: 'EFECTIVO' as PaymentMethod, reference: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/clients'); setClients(normalizeArray<Client>(r.data)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalDebt = clients.reduce((a, c) => a + Math.max(0, num(c.currentBalance)), 0);
  const debtors = clients.filter(c => num(c.currentBalance) > 0).length;
  const filtered = useMemo(() => clients.filter(c => {
    const q = search.trim().toLowerCase();
    return !q || clientName(c).toLowerCase().includes(q) || String(c.dni ?? '').includes(q) || String(c.telefono ?? '').includes(q) || String(c.gmail ?? '').toLowerCase().includes(q);
  }), [clients, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal('create'); };
  const openEdit = (c: Client) => { setEditing(c); setForm({ nombre: c.nombre ?? '', apellido: c.apellido ?? '', dni: c.dni ?? '', telefono: c.telefono ?? '', gmail: c.gmail ?? '', category: c.category ?? 'Cliente', creditLimit: String(c.creditLimit ?? ''), isAccountEnabled: String(c.isAccountEnabled !== false) }); setModal('edit'); };
  const openPayment = (c: Client) => { setEditing(c); setPayment({ amount: '', method: 'EFECTIVO', reference: '', description: '' }); setModal('payment'); };
  const openHistory = async (c: Client) => { setEditing(c); setModal('history'); const r = await api.get(`/accounts/clients/${c.id}`); setMovements(normalizeArray<AccountMovement>(r.data?.movements ?? r.data)); };

  const saveClient = async () => {
    setSaving(true);
    try {
      const payload = { nombre: form.nombre, apellido: form.apellido, dni: form.dni, telefono: form.telefono || undefined, gmail: form.gmail || undefined, category: form.category as ClientCategory, creditLimit: form.creditLimit ? num(form.creditLimit) : null, isAccountEnabled: form.isAccountEnabled === 'true' };
      if (modal === 'create') await api.post('/clients', payload); else if (editing) await api.put(`/clients/${editing.id}`, payload);
      setModal(null); await load();
    } catch (e: unknown) { alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar cliente'); }
    finally { setSaving(false); }
  };
  const savePayment = async () => {
    if (!editing) return;
    setSaving(true);
    try { await api.post(`/accounts/clients/${editing.id}/payment`, { ...payment, amount: num(payment.amount) }); setModal(null); await load(); }
    catch (e: unknown) { alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al registrar abono'); }
    finally { setSaving(false); }
  };
  const deleteClient = async (c: Client) => { if (!confirm(`¿Eliminar ${clientName(c)}?`)) return; try { await api.delete(`/clients/${c.id}`); await load(); } catch (e: unknown) { alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo eliminar'); } };

  return <AppLayout title="Clientes" subtitle="Clientes, crédito y cuenta corriente" actions={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14}/> Nuevo cliente</button>}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}><div className="stat-card"><div className="stat-value">{clients.length}</div><div className="stat-label">Clientes</div></div><div className="stat-card"><div className="stat-value">{debtors}</div><div className="stat-label">Con deuda</div></div><div className="stat-card"><div className="stat-value" style={{ color: totalDebt > 0 ? 'var(--warn)' : 'var(--accent)' }}>{fmtMoney(totalDebt)}</div><div className="stat-label">Saldo pendiente</div></div><div className="stat-card"><div className="stat-value">{clients.filter(c => c.category === 'Mayorista').length}</div><div className="stat-label">Mayoristas</div></div></div>
    <div style={{ position: 'relative', marginBottom: 18, maxWidth: 460 }}><Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, DNI, teléfono o email..." style={{ paddingLeft: 34 }}/></div>
    <div className="card"><div className="table-wrap">{loading ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 220 }}/></div> : <table><thead><tr><th>Cliente</th><th>DNI</th><th>Contacto</th><th>Categoría</th><th>Cuenta corriente</th><th>Límite</th><th></th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}><td><b>{clientName(c)}</b><div style={{ color: 'var(--text3)', fontSize: 11 }}>{c.gmail ?? 'Sin email'}</div></td><td style={{ fontFamily: 'var(--mono)' }}>{c.dni}</td><td>{c.telefono ?? '—'}</td><td><span className={`badge ${c.category === 'Mayorista' ? 'badge-blue' : 'badge-green'}`}>{c.category}</span></td><td><span className={`badge ${num(c.currentBalance) > 0 ? 'badge-yellow' : 'badge-green'}`}>{fmtMoney(num(c.currentBalance))}</span><div style={{ color: c.isAccountEnabled === false ? 'var(--danger)' : 'var(--text3)', fontSize: 11 }}>{c.isAccountEnabled === false ? 'Deshabilitada' : 'Habilitada'}</div></td><td>{c.creditLimit ? fmtMoney(c.creditLimit) : 'Sin límite'}</td><td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn btn-secondary btn-sm" onClick={() => openPayment(c)} disabled={num(c.currentBalance) <= 0}><Wallet size={13}/> Abono</button><button className="btn btn-ghost btn-sm" onClick={() => openHistory(c)}><CreditCard size={13}/></button><button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Edit2 size={13}/></button><button className="btn btn-danger btn-sm" onClick={() => deleteClient(c)}><Trash2 size={13}/></button></div></td></tr>)}</tbody></table>}{!loading && !filtered.length && <div className="empty-state"><Users size={36}/><p>Sin clientes</p></div>}</div></div>

    {(modal === 'create' || modal === 'edit') && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}><div className="modal"><div className="modal-header"><b>{modal === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</b><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16}/></button></div><div className="modal-body"><div className="form-row"><div className="form-group"><label className="form-label">Nombre *</label><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}/></div><div className="form-group"><label className="form-label">Apellido *</label><input value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))}/></div></div><div className="form-row"><div className="form-group"><label className="form-label">DNI/CUIT *</label><input value={form.dni} onChange={e => setForm(p => ({ ...p, dni: e.target.value }))}/></div><div className="form-group"><label className="form-label">Categoría</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}><option value="Cliente">Cliente</option><option value="Mayorista">Mayorista</option></select></div></div><div className="form-row"><div className="form-group"><label className="form-label">Teléfono</label><input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}/></div><div className="form-group"><label className="form-label">Email</label><input value={form.gmail} onChange={e => setForm(p => ({ ...p, gmail: e.target.value }))}/></div></div><div className="form-row"><div className="form-group"><label className="form-label">Límite de crédito</label><input type="number" value={form.creditLimit} onChange={e => setForm(p => ({ ...p, creditLimit: e.target.value }))}/></div><div className="form-group"><label className="form-label">Cuenta corriente</label><select value={form.isAccountEnabled} onChange={e => setForm(p => ({ ...p, isAccountEnabled: e.target.value }))}><option value="true">Habilitada</option><option value="false">Deshabilitada</option></select></div></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveClient} disabled={saving || !form.nombre || !form.apellido || !form.dni}>{saving ? <span className="spinner"/> : 'Guardar'}</button></div></div></div>}
    {modal === 'payment' && editing && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}><div className="modal"><div className="modal-header"><b>Registrar abono</b><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16}/></button></div><div className="modal-body"><p style={{ color: 'var(--text2)', marginBottom: 14 }}>{clientName(editing)} · saldo {fmtMoney(editing.currentBalance)}</p><div className="form-row"><div className="form-group"><label className="form-label">Importe</label><input type="number" value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))}/></div><div className="form-group"><label className="form-label">Método</label><select value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value as PaymentMethod }))}>{paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div><div className="form-group"><label className="form-label">Referencia</label><input value={payment.reference} onChange={e => setPayment(p => ({ ...p, reference: e.target.value }))}/></div><div className="form-group"><label className="form-label">Descripción</label><input value={payment.description} onChange={e => setPayment(p => ({ ...p, description: e.target.value }))}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={savePayment} disabled={saving || !payment.amount}>{saving ? <span className="spinner"/> : 'Registrar'}</button></div></div></div>}
    {modal === 'history' && editing && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}><div className="modal" style={{ maxWidth: 760 }}><div className="modal-header"><b>Cuenta corriente · {clientName(editing)}</b><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16}/></button></div><div className="modal-body"><div className="card"><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Importe</th><th>Anterior</th><th>Nuevo</th><th>Detalle</th></tr></thead><tbody>{movements.map(m => <tr key={m.id}><td>{fmtDate(m.date)}</td><td><span className={`badge ${m.type === 'PAYMENT' || m.type === 'ADJUSTMENT_NEGATIVE' ? 'badge-green' : 'badge-yellow'}`}>{m.type}</span></td><td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{fmtMoney(m.amount)}</td><td>{fmtMoney(m.previousBalance)}</td><td>{fmtMoney(m.newBalance)}</td><td>{m.description ?? m.reference ?? '—'}</td></tr>)}</tbody></table></div></div></div></div></div>}
  </AppLayout>;
}
