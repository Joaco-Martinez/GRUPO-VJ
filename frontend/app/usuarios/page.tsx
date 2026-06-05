'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { ClientCategory, Role, User } from '@/types';
import {
  Plus,
  Edit2,
  Trash2,
  UserCog,
  X,
  Shield,
  Search,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLEADO',
  isActive: 'true',

  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  category: 'Price',
  creditLimit: '',
  isAccountEnabled: 'false',
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return (value as { content: T[] }).content;
  }

  if (
    value &&
    typeof value === 'object' &&
    'users' in value &&
    Array.isArray((value as { users?: unknown }).users)
  ) {
    return (value as { users: T[] }).users;
  }

  return [];
}

export default function UsuariosPage() {
  const { user: me } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<User | null>(null);

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const [toast, setToast] = useState<ToastState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = () => {
    setLoading(true);

    api
      .get('/users')
      .then((r) => setUsers(normalizeArray<User>(r.data)))
      .catch((e) => {
        console.error(e);
        showToast('error', 'Error al cargar usuarios');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((u) => {
      return (
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.client?.dni?.toLowerCase().includes(q) ||
        u.client?.category?.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setModal('create');
  };

  const openEdit = (u: User) => {
    setEditing(u);

    setForm({
      ...emptyForm,
      name: u.name ?? '',
      email: u.email ?? '',
      role: u.role,
      isActive: String(u.isActive !== false),
      password: '',
    });

    setModal('edit');
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setEditing(null);
    setForm(emptyForm);
  };

  const field = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'role' && value === 'CLIENTE') {
        const [firstName, ...rest] = String(prev.name || '').trim().split(' ');

        next.nombre = prev.nombre || firstName || '';
        next.apellido = prev.apellido || rest.join(' ') || '';
        next.category = prev.category || 'Price';
        next.isAccountEnabled = prev.isAccountEnabled || 'false';
      }

      if (key === 'name' && prev.role === 'CLIENTE') {
        const [firstName, ...rest] = String(value || '').trim().split(' ');

        if (!prev.nombre) next.nombre = firstName || '';
        if (!prev.apellido) next.apellido = rest.join(' ') || '';
      }

      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (modal === 'create') {
        const role = form.role as Role;

        const payload: any = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role,
          isActive: form.isActive === 'true',
        };

        if (role === 'CLIENTE') {
          payload.nombre = form.nombre.trim();
          payload.apellido = form.apellido.trim();
          payload.dni = form.dni.trim();
          payload.telefono = form.telefono.trim() || null;
          payload.category = form.category as ClientCategory;
          payload.creditLimit = form.creditLimit ? Number(form.creditLimit) : null;
          payload.isAccountEnabled = form.isAccountEnabled === 'true';
        }

        await api.post('/users', payload);
        showToast('success', 'Usuario creado correctamente');
      }

      if (modal === 'edit' && editing) {
        const payload: any = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          isActive: form.isActive === 'true',
        };

        if (form.password) {
          payload.password = form.password;
        }

        await api.put(`/users/${editing.id}`, payload);
        showToast('success', 'Usuario actualizado correctamente');
      }

      closeModal();
      load();
    } catch (error: unknown) {
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al guardar usuario'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) {
      showToast('error', 'No podés eliminarte a vos mismo');
      return;
    }

    setConfirmModal({
      title: 'Eliminar usuario',
      message: `¿Eliminar usuario "${u.name}"?`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/users/${u.id}`);
          load();
          showToast('success', 'Usuario eliminado correctamente');
        } catch (error: unknown) {
          showToast(
            'error',
            (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? 'No se pudo eliminar el usuario'
          );
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (me?.role !== 'ADMIN') {
    return (
      <AppLayout title="Usuarios">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Shield
            size={48}
            style={{
              color: 'var(--danger)',
              margin: '0 auto 16px',
              display: 'block',
            }}
          />

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Acceso restringido
          </h2>

          <p style={{ color: 'var(--text2)' }}>
            Solo los administradores pueden gestionar usuarios.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Usuarios"
      subtitle="Gestión de administradores, empleados y clientes ecommerce"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCcw size={14} />
            Actualizar
          </button>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Nuevo usuario
          </button>
        </div>
      }
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            minWidth: 280,
            maxWidth: 420,
            borderRadius: 14,
            border:
              toast.type === 'success'
                ? '1px solid rgba(34,197,94,0.35)'
                : '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(15,23,42,0.96)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: 1 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 1 }} />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
              {toast.type === 'success' ? 'Listo' : 'Atención'}
            </div>

            <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>
              {toast.message}
            </div>
          </div>

          <button
            onClick={() => setToast(null)}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Usuarios</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {users.filter((u) => u.role === 'ADMIN').length}
          </div>
          <div className="stat-label">Administradores</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {users.filter((u) => u.role === 'EMPLEADO').length}
          </div>
          <div className="stat-label">Empleados</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {users.filter((u) => u.role === 'CLIENTE').length}
          </div>
          <div className="stat-label">Clientes web</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 18, maxWidth: 480 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text3)',
          }}
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, rol, DNI o categoría..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(4)].map((_, i) => (
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
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Cliente vinculado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background:
                              u.role === 'ADMIN'
                                ? 'rgba(0,229,160,0.15)'
                                : 'var(--surface2)',
                            border: `1px solid ${
                              u.role === 'ADMIN'
                                ? 'rgba(0,229,160,0.4)'
                                : 'var(--border)'
                            }`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 14,
                            color:
                              u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text2)',
                          }}
                        >
                          {u.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>

                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {u.name}

                          {u.id === me?.id && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--text3)',
                                fontFamily: 'var(--mono)',
                                marginLeft: 8,
                              }}
                            >
                              — vos
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{u.email}</td>

                    <td>
                      <span
                        className={`badge ${
                          u.role === 'ADMIN'
                            ? 'badge-green'
                            : u.role === 'CLIENTE'
                              ? 'badge-blue'
                              : 'badge-gray'
                        }`}
                      >
                        {u.role === 'ADMIN' ? '👑 ' : ''}
                        {u.role}
                      </span>
                    </td>

                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                      {u.client ? (
                        <>
                          <b>
                            {u.client.nombre} {u.client.apellido}
                          </b>

                          <div
                            style={{
                              color: 'var(--text3)',
                              fontFamily: 'var(--mono)',
                              marginTop: 2,
                            }}
                          >
                            {u.client.category} · {u.client.dni}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          u.isActive === false ? 'badge-gray' : 'badge-green'
                        }`}
                      >
                        {u.isActive === false ? 'INACTIVO' : 'ACTIVO'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(u)}
                          style={{ padding: 6 }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {u.id !== me?.id && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u)}
                            style={{ padding: 6 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <UserCog size={36} />
              <p>Sin usuarios</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>
                {modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
              </span>

              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input
                    value={form.name ?? ''}
                    onChange={(e) => field('name', e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => field('email', e.target.value)}
                    placeholder="correo@grupovj.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    {modal === 'create' ? 'Contraseña *' : 'Nueva contraseña'}
                  </label>
                  <input
                    type="password"
                    value={form.password ?? ''}
                    onChange={(e) => field('password', e.target.value)}
                    placeholder={
                      modal === 'create'
                        ? 'Mínimo 6 caracteres'
                        : 'Dejar vacío para no cambiar'
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select
                    value={form.role ?? 'EMPLEADO'}
                    onChange={(e) => field('role', e.target.value)}
                    disabled={modal === 'edit' && editing?.id === me?.id}
                  >
                    <option value="EMPLEADO">EMPLEADO</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="CLIENTE">CLIENTE</option>
                  </select>
                </div>
              </div>

              {modal === 'edit' && (
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    value={form.isActive ?? 'true'}
                    onChange={(e) => field('isActive', e.target.value)}
                    disabled={editing?.id === me?.id}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}

              {modal === 'create' && form.role === 'CLIENTE' && (
                <div className="card" style={{ padding: 14, marginTop: 8 }}>
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    Datos comerciales del cliente
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nombre *</label>
                      <input
                        value={form.nombre ?? ''}
                        onChange={(e) => field('nombre', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Apellido *</label>
                      <input
                        value={form.apellido ?? ''}
                        onChange={(e) => field('apellido', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">DNI/CUIT *</label>
                      <input
                        value={form.dni ?? ''}
                        onChange={(e) => field('dni', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input
                        value={form.telefono ?? ''}
                        onChange={(e) => field('telefono', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Categoría de precio</label>
                      <select
                        value={form.category ?? 'Price'}
                        onChange={(e) => field('category', e.target.value)}
                      >
                        <option value="Price">Price / Público</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Mayorista">Mayorista</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Límite de crédito</label>
                      <input
                        type="number"
                        value={form.creditLimit ?? ''}
                        onChange={(e) => field('creditLimit', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cuenta corriente</label>
                    <select
                      value={form.isAccountEnabled ?? 'false'}
                      onChange={(e) => field('isAccountEnabled', e.target.value)}
                    >
                      <option value="false">Deshabilitada</option>
                      <option value="true">Habilitada</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name ||
                  !form.email ||
                  (modal === 'create' && !form.password) ||
                  (modal === 'create' &&
                    form.role === 'CLIENTE' &&
                    (!form.nombre || !form.apellido || !form.dni))
                }
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}