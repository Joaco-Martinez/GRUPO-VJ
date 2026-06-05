'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { ProductCategory } from '@/types';
import { normalizeArray } from '@/lib/helpers';
import {
  Tags,
  Plus,
  Search,
  RefreshCcw,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  FolderTree,
  Power,
  PowerOff,
  Package,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type Modal = 'create' | 'edit' | null;

type CategoryForm = {
  name: string;
  description: string;
  isActive: boolean;
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

const emptyForm: CategoryForm = {
  name: '',
  description: '',
  isActive: true,
};

function formatDate(value?: string) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function productsCount(category: ProductCategory) {
  return Number(category._count?.products ?? 0);
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const [toast, setToast] = useState<ToastState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = async () => {
    setLoading(true);

    try {
      const res = await api.get('/categories?includeInactive=true');
      setCategories(normalizeArray<ProductCategory>(res.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return categories.filter((c) => {
      const matchesText =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        String(c.description ?? '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.isActive) ||
        (statusFilter === 'inactive' && !c.isActive);

      return matchesText && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).length,
    [categories]
  );

  const inactiveCategories = useMemo(
    () => categories.filter((c) => !c.isActive).length,
    [categories]
  );

  const totalProductsAssociated = useMemo(
    () => categories.reduce((acc, c) => acc + productsCount(c), 0),
    [categories]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (category: ProductCategory) => {
    setEditing(category);
    setForm({
      name: category.name ?? '',
      description: category.description ?? '',
      isActive: category.isActive,
    });
    setModal('edit');
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setEditing(null);
    setForm(emptyForm);
  };

  const saveCategory = async () => {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
      };

      if (modal === 'create') {
        await api.post('/categories', payload);
        showToast('success', 'Categoría creada correctamente');
      }

      if (modal === 'edit' && editing) {
        await api.put(`/categories/${editing.id}`, payload);
        showToast('success', 'Categoría actualizada correctamente');
      }

      closeModal();
      await load();
    } catch (e: unknown) {
      const error = e as { response?: { status?: number; data?: { message?: string } } };

      if (error?.response?.status === 409) {
        showToast('error', 'Ya existe una categoría con ese nombre');
      } else {
        showToast('error', error?.response?.data?.message ?? 'Error al guardar categoría');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: ProductCategory) => {
    const count = productsCount(category);

    const message =
      count > 0
        ? `La categoría "${category.name}" tiene ${count} producto/s asociados. Se va a desactivar, no eliminar definitivamente. ¿Continuar?`
        : `¿Eliminar definitivamente la categoría "${category.name}"?`;

    setConfirmModal({
      title: count > 0 ? 'Desactivar categoría' : 'Eliminar categoría',
      message,
      confirmText: count > 0 ? 'Desactivar' : 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/categories/${category.id}`);
          await load();

          showToast(
            'success',
            count > 0
              ? 'Categoría desactivada correctamente'
              : 'Categoría eliminada correctamente'
          );
        } catch (e: unknown) {
          const error = e as { response?: { data?: { message?: string } } };
          showToast('error', error?.response?.data?.message ?? 'Error al eliminar categoría');
        }
      },
    });
  };

  const restoreCategory = async (category: ProductCategory) => {
    try {
      await api.patch(`/categories/${category.id}/restore`);
      await load();
      showToast('success', 'Categoría restaurada correctamente');
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } };
      showToast('error', error?.response?.data?.message ?? 'Error al restaurar categoría');
    }
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
    <AppLayout
      title="Categorías"
      subtitle="Clasificación dinámica para productos, promos y stock"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCcw size={14} />
            Actualizar
          </button>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Nueva categoría
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
          <div className="stat-value">{categories.length}</div>
          <div className="stat-label">Categorías</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{activeCategories}</div>
          <div className="stat-label">Activas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{inactiveCategories}</div>
          <div className="stat-label">Inactivas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{totalProductsAssociated}</div>
          <div className="stat-label">Productos asociados</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
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
            placeholder="Buscar por nombre, slug o descripción..."
            style={{ paddingLeft: 34 }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          style={{ width: 220 }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Solo activas</option>
          <option value="inactive">Solo inactivas</option>
        </select>

        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCcw size={14} />
          Actualizar
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 220 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Slug</th>
                  <th>Descripción</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((category) => (
                  <tr key={category.id}>
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
                          <Tags size={15} />
                        </span>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>
                            {category.name}
                          </div>

                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              color: 'var(--text3)',
                              fontSize: 11,
                            }}
                          >
                            ID {String(category.id).slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-gray">{category.slug}</span>
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 280 }}>
                      {category.description || '—'}
                    </td>

                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--mono)',
                          fontWeight: 800,
                        }}
                      >
                        <Package size={13} />
                        {productsCount(category)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          category.isActive ? 'badge-green' : 'badge-gray'
                        }`}
                      >
                        {category.isActive ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        color: 'var(--text2)',
                        fontSize: 12,
                      }}
                    >
                      {formatDate(category.createdAt)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(category)}
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>

                        {!category.isActive && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => restoreCategory(category)}
                            title="Restaurar"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteCategory(category)}
                          title="Eliminar o desactivar"
                        >
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
            <div className="empty-state">
              <FolderTree size={36} />
              <p>Sin categorías</p>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal">
            <div className="modal-header">
              <b>{modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}</b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Ej: Bebidas, Promociones, Repuestos"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descripción interna de la categoría"
                />
              </div>

              <div
                className="card"
                style={{
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    {form.isActive ? <Power size={15} /> : <PowerOff size={15} />}
                  </span>

                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      Categoría activa
                    </div>
                    <div style={{ color: 'var(--text3)', fontSize: 12 }}>
                      Las categorías inactivas no deberían usarse para nuevos productos.
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  style={{ width: 18, height: 18 }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveCategory}
                disabled={saving || !form.name.trim()}
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
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
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