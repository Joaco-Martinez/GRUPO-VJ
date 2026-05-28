'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { User } from '@/types';
import { Plus, Edit2, Trash2, UserCog, X, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function UsuariosPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data.content ?? r.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ role: 'EMPLEADO' });
    setEditing(null);
    setModal('create');
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role });
    setModal('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/auth/register', form);
      } else if (editing) {
        await api.put(`/users/${editing.id}`, form);
      }
      setModal(null);
      load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) return alert('No podés eliminarte a vos mismo');
    if (!confirm(`¿Eliminar usuario "${u.name}"?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch { alert('Error'); }
  };

  const field = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  if (me?.role !== 'ADMIN') {
    return (
      <AppLayout title="Usuarios">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Shield size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Acceso restringido</h2>
          <p style={{ color: 'var(--text2)' }}>Solo los administradores pueden gestionar usuarios.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Usuarios"
      subtitle="Gestión de empleados y accesos"
      actions={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> Nuevo usuario</button>}
    >
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
          ) : (
            <table>
              <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.role === 'ADMIN' ? 'rgba(0,229,160,0.15)' : 'var(--surface2)', border: `1px solid ${u.role === 'ADMIN' ? 'rgba(0,229,160,0.4)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text2)' }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {u.name}
                          {u.id === me?.id && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 8 }}>— vos</span>}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-green' : 'badge-gray'}`}>
                        {u.role === 'ADMIN' ? '👑 ' : ''}{u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ padding: 6 }}><Edit2 size={13} /></button>
                        {u.id !== me?.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} style={{ padding: 6 }}><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !users.length && <div className="empty-state"><UserCog size={36} /><p>Sin usuarios</p></div>}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>{modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre completo *</label>
                <input value={form.name ?? ''} onChange={e => field('name', e.target.value)} placeholder="Nombre del empleado" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" value={form.email ?? ''} onChange={e => field('email', e.target.value)} placeholder="correo@grupovj.com" />
              </div>
              {modal === 'create' && (
                <div className="form-group">
                  <label className="form-label">Contraseña *</label>
                  <input type="password" value={form.password ?? ''} onChange={e => field('password', e.target.value)} placeholder="••••••••" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select value={form.role ?? 'EMPLEADO'} onChange={e => field('role', e.target.value)}>
                  <option value="EMPLEADO">EMPLEADO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
