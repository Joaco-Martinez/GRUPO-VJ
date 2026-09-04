'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Provider } from '@/types';
import { normalizeArray } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  Truck,
  Plus,
  Search,
  RefreshCcw,
  Edit2,
  Trash2,
  X,
  Power,
  PowerOff,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Building2,
  ShoppingCart,
} from 'lucide-react';

type Modal = 'create' | 'edit' | null;

type ProviderForm = {
  razonSocial: string;
  nombreFantasia: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  contactoNombre: string;
  notas: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const emptyForm: ProviderForm = {
  razonSocial: '',
  nombreFantasia: '',
  cuit: '',
  telefono: '',
  email: '',
  direccion: '',
  contactoNombre: '',
  notas: '',
};

function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= maxWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [maxWidth]);

  return isMobile;
}

function providerDisplayName(provider: Provider) {
  return provider.razonSocial || provider.nombreFantasia || 'Proveedor sin nombre';
}

function purchasesCount(provider: Provider) {
  return Number(provider._count?.purchases ?? 0);
}

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

export default function ProveedoresPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isMobile = useIsMobile();

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const res = await api.get('/providers?includeInactive=true');
      setProviders(normalizeArray<Provider>(res.data?.providers ?? res.data));

      if (showSuccess) toast.success('Proveedores actualizados');
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get('/providers?includeInactive=true')
      .then((res) => {
        if (!alive) return;
        setProviders(normalizeArray<Provider>(res.data?.providers ?? res.data));
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        toast.error('Error al cargar proveedores');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return providers.filter((p) => {
      const matchesText =
        !q ||
        p.razonSocial?.toLowerCase().includes(q) ||
        p.nombreFantasia?.toLowerCase().includes(q) ||
        p.cuit?.toLowerCase().includes(q) ||
        p.contactoNombre?.toLowerCase().includes(q) ||
        p.telefono?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.isActive) ||
        (statusFilter === 'inactive' && !p.isActive);

      return matchesText && matchesStatus;
    });
  }, [providers, search, statusFilter]);

  const activeCount = useMemo(() => providers.filter((p) => p.isActive).length, [providers]);
  const inactiveCount = useMemo(() => providers.filter((p) => !p.isActive).length, [providers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (provider: Provider) => {
    setEditing(provider);
    setForm({
      razonSocial: provider.razonSocial ?? '',
      nombreFantasia: provider.nombreFantasia ?? '',
      cuit: provider.cuit ?? '',
      telefono: provider.telefono ?? '',
      email: provider.email ?? '',
      direccion: provider.direccion ?? '',
      contactoNombre: provider.contactoNombre ?? '',
      notas: provider.notas ?? '',
    });
    setModal('edit');
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setEditing(null);
    setForm(emptyForm);
  };

  const saveProvider = async () => {
    setSaving(true);

    try {
      const payload = {
        razonSocial: form.razonSocial.trim() || null,
        nombreFantasia: form.nombreFantasia.trim() || null,
        cuit: form.cuit.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        direccion: form.direccion.trim() || null,
        contactoNombre: form.contactoNombre.trim() || null,
        notas: form.notas.trim() || null,
      };

      if (modal === 'create') {
        await toast.promise(api.post('/providers', payload), {
          loading: 'Creando proveedor...',
          success: 'Proveedor creado correctamente',
          error: 'Error al crear proveedor',
        });
      }

      if (modal === 'edit' && editing) {
        await toast.promise(api.put(`/providers/${editing.id}`, payload), {
          loading: 'Guardando cambios...',
          success: 'Proveedor actualizado correctamente',
          error: 'Error al actualizar proveedor',
        });
      }

      setModal(null);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al guardar proveedor'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (provider: Provider) => {
    const activate = !provider.isActive;

    setConfirmModal({
      title: activate ? 'Reactivar proveedor' : 'Desactivar proveedor',
      message: activate
        ? `¿Reactivar a "${providerDisplayName(provider)}"?`
        : `¿Desactivar a "${providerDisplayName(provider)}"? Vas a poder seguir viéndolo en compras anteriores.`,
      confirmText: activate ? 'Reactivar' : 'Desactivar',
      danger: !activate,
      onConfirm: async () => {
        try {
          await toast.promise(
            api.patch(`/providers/${provider.id}/${activate ? 'activate' : 'deactivate'}`),
            {
              loading: activate ? 'Reactivando...' : 'Desactivando...',
              success: activate ? 'Proveedor reactivado' : 'Proveedor desactivado',
              error: 'Error al actualizar el estado',
            },
          );
          await load();
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, 'Error al actualizar el estado'));
        }
      },
    });
  };

  const deleteProvider = (provider: Provider) => {
    setConfirmModal({
      title: 'Eliminar proveedor',
      message: `¿Eliminar definitivamente a "${providerDisplayName(provider)}"? Esto solo es posible si no tiene compras asociadas.`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await toast.promise(api.delete(`/providers/${provider.id}`), {
            loading: 'Eliminando proveedor...',
            success: 'Proveedor eliminado correctamente',
            error: 'Error al eliminar proveedor',
          });
          await load();
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, 'Error al eliminar proveedor'));
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

  return (
    <AppLayout title="Proveedores" subtitle="Gestioná los proveedores que usás en tus compras">
      <button
        className="btn btn-primary btn-sm"
        onClick={openCreate}
        style={{ marginBottom: 14, width: isMobile ? '100%' : undefined, justifyContent: 'center' }}
      >
        <Plus size={14} />
        Nuevo proveedor
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, 1fr)',
          gap: isMobile ? 10 : 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{providers.length}</div>
          <div className="stat-label">Proveedores</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{inactiveCount}</div>
          <div className="stat-label">Inactivos</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 18,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : 240 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razón social, CUIT, contacto..."
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          style={{ width: isMobile ? '100%' : 200 }}
        >
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
          <option value="all">Todos los estados</option>
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => load(true)}
          disabled={loading}
          style={{ width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined }}
        >
          <RefreshCcw size={14} />
          Actualizar
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: isMobile ? 14 : 20 }}>
              <div className="skeleton" style={{ height: isMobile ? 320 : 220, borderRadius: 12 }} />
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {filtered.map((provider) => (
                <article
                  key={provider.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    background: 'var(--surface)',
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <b style={{ fontSize: 14 }}>{providerDisplayName(provider)}</b>
                      {provider.nombreFantasia && provider.razonSocial && (
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{provider.nombreFantasia}</div>
                      )}
                    </div>
                    <span className={`badge ${provider.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {provider.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
                    {provider.cuit && <span><Building2 size={12} /> CUIT: {provider.cuit}</span>}
                    {provider.telefono && <span><Phone size={12} /> {provider.telefono}</span>}
                    {provider.email && <span><Mail size={12} /> {provider.email}</span>}
                    {provider.direccion && <span><MapPin size={12} /> {provider.direccion}</span>}
                    <span><ShoppingCart size={12} /> {purchasesCount(provider)} compra(s)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(provider)}>
                      <Edit2 size={13} /> Editar
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(provider)}>
                      {provider.isActive ? <PowerOff size={13} /> : <Power size={13} />}
                      {provider.isActive ? 'Desact.' : 'Activar'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteProvider(provider)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Compras</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((provider) => (
                  <tr key={provider.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: 'var(--surface2)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <Truck size={15} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{providerDisplayName(provider)}</div>
                          {provider.nombreFantasia && provider.razonSocial && (
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{provider.nombreFantasia}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{provider.cuit || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{provider.contactoNombre || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{provider.telefono || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{provider.email || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{purchasesCount(provider)}</td>
                    <td>
                      <span className={`badge ${provider.isActive ? 'badge-green' : 'badge-gray'}`}>
                        {provider.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(provider)} title="Editar">
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleActive(provider)}
                          title={provider.isActive ? 'Desactivar' : 'Reactivar'}
                        >
                          {provider.isActive ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProvider(provider)} title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state" style={{ padding: isMobile ? '48px 16px' : undefined }}>
              <Truck size={36} />
              <p>Sin proveedores</p>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && typeof document !== 'undefined' &&
        createPortal(
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
            <div
              className="modal"
              style={{
                width: isMobile ? 'calc(100vw - 24px)' : 520,
                maxWidth: isMobile ? 'calc(100vw - 24px)' : 520,
                maxHeight: isMobile ? 'calc(100vh - 24px)' : '86vh',
                overflowY: 'auto',
              }}
            >
              <div className="modal-header">
                <b>{modal === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}</b>
                <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Razón social</label>
                    <input
                      value={form.razonSocial}
                      onChange={(e) => setForm((p) => ({ ...p, razonSocial: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nombre de fantasía</label>
                    <input
                      value={form.nombreFantasia}
                      onChange={(e) => setForm((p) => ({ ...p, nombreFantasia: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">CUIT</label>
                    <input
                      value={form.cuit}
                      onChange={(e) => setForm((p) => ({ ...p, cuit: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      value={form.telefono}
                      onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input
                    value={form.direccion}
                    onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contacto</label>
                  <input
                    value={form.contactoNombre}
                    onChange={(e) => setForm((p) => ({ ...p, contactoNombre: e.target.value }))}
                    placeholder="Nombre de la persona de contacto (opcional)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                    placeholder="Opcional"
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button className="btn btn-secondary" onClick={closeModal} disabled={saving} style={{ width: isMobile ? '100%' : undefined }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={saveProvider} disabled={saving} style={{ width: isMobile ? '100%' : undefined }}>
                  {saving ? <span className="spinner" /> : 'Guardar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {confirmModal && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (confirmLoading) return;
              if (e.target === e.currentTarget) setConfirmModal(null);
            }}
          >
            <div className="modal" style={{ maxWidth: isMobile ? 'calc(100vw - 24px)' : 440, width: isMobile ? 'calc(100vw - 24px)' : undefined }}>
              <div className="modal-header">
                <b>{confirmModal.title}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => !confirmLoading && setConfirmModal(null)} disabled={confirmLoading}>
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
                      background: confirmModal.danger ? 'rgba(239,68,68,0.12)' : 'var(--surface2)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={18} style={{ color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)' }} />
                  </span>
                  <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0, overflowWrap: 'anywhere' }}>
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading} style={{ width: isMobile ? '100%' : undefined }}>
                  Cancelar
                </button>
                <button
                  className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={confirmAction}
                  disabled={confirmLoading}
                  style={{ width: isMobile ? '100%' : undefined }}
                >
                  {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </AppLayout>
  );
}
