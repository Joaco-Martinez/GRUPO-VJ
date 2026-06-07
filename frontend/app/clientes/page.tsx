'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { AccountMovement, Client, ClientCategory, PaymentMethod } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CreditCard,
  Edit2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';

type ClientWithAddress = Client & {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const paymentMethods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
];

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  gmail: '',
  category: 'Cliente',
  creditLimit: '',
  isAccountEnabled: 'true',

  addressStreet: '',
  addressNumber: '',
  addressFloor: '',
  addressApartment: '',
  addressCity: '',
  addressProvince: '',
  addressPostalCode: '',
  addressNotes: '',
  latitude: '',
  longitude: '',
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

function cleanString(value: string) {
  const text = String(value || '').trim();
  return text || undefined;
}

function toNumberOrUndefined(value: string) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clientAddress(c: ClientWithAddress) {
  const streetLine = [c.addressStreet, c.addressNumber].filter(Boolean).join(' ');
  const floorLine = [
    c.addressFloor ? `Piso ${c.addressFloor}` : '',
    c.addressApartment ? `Dto ${c.addressApartment}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const cityLine = [c.addressCity, c.addressProvince, c.addressPostalCode]
    .filter(Boolean)
    .join(' · ');

  const parts = [streetLine, floorLine, cityLine].filter(Boolean);

  return parts.length ? parts.join(' — ') : '';
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientWithAddress[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'payment' | 'history' | null>(null);
  const [editing, setEditing] = useState<ClientWithAddress | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [payment, setPayment] = useState({
    amount: '',
    method: 'EFECTIVO' as PaymentMethod,
    reference: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const r = await api.get('/clients');
      setClients(normalizeArray<ClientWithAddress>(r.data));

      if (showSuccess) {
        toast.success('Clientes actualizados');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get('/clients')
      .then((r) => {
        if (!alive) return;
        setClients(normalizeArray<ClientWithAddress>(r.data));
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        toast.error('Error al cargar clientes');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const totalDebt = clients.reduce((a, c) => a + Math.max(0, num(c.currentBalance)), 0);
  const debtors = clients.filter((c) => num(c.currentBalance) > 0).length;
  const clientsWithAddress = clients.filter((c) => clientAddress(c)).length;

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const q = search.trim().toLowerCase();
        const address = clientAddress(c).toLowerCase();

        return (
          !q ||
          clientName(c).toLowerCase().includes(q) ||
          String(c.dni ?? '').includes(q) ||
          String(c.telefono ?? '').includes(q) ||
          String(c.gmail ?? '').toLowerCase().includes(q) ||
          address.includes(q)
        );
      }),
    [clients, search]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (c: ClientWithAddress) => {
    setEditing(c);
    setForm({
      nombre: c.nombre ?? '',
      apellido: c.apellido ?? '',
      dni: c.dni ?? '',
      telefono: c.telefono ?? '',
      gmail: c.gmail ?? '',
      category: c.category ?? 'Cliente',
      creditLimit: String(c.creditLimit ?? ''),
      isAccountEnabled: String(c.isAccountEnabled !== false),

      addressStreet: c.addressStreet ?? '',
      addressNumber: c.addressNumber ?? '',
      addressFloor: c.addressFloor ?? '',
      addressApartment: c.addressApartment ?? '',
      addressCity: c.addressCity ?? '',
      addressProvince: c.addressProvince ?? '',
      addressPostalCode: c.addressPostalCode ?? '',
      addressNotes: c.addressNotes ?? '',
      latitude: c.latitude === null || c.latitude === undefined ? '' : String(c.latitude),
      longitude: c.longitude === null || c.longitude === undefined ? '' : String(c.longitude),
    });
    setModal('edit');
  };

  const openPayment = (c: ClientWithAddress) => {
    setEditing(c);
    setPayment({
      amount: '',
      method: 'EFECTIVO',
      reference: '',
      description: '',
    });
    setModal('payment');
  };

  const openHistory = async (c: ClientWithAddress) => {
    setEditing(c);
    setMovements([]);
    setModal('history');

    const toastId = toast.loading('Cargando cuenta corriente...');

    try {
      const r = await api.get(`/accounts/clients/${c.id}`);
      setMovements(normalizeArray<AccountMovement>(r.data?.movements ?? r.data));
      toast.success('Cuenta corriente cargada', { id: toastId });
    } catch (e) {
      console.error(e);
      setMovements([]);
      toast.error('Error al cargar la cuenta corriente', { id: toastId });
    }
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setEditing(null);
    setMovements([]);
  };

  const forceCloseModal = () => {
    setModal(null);
    setEditing(null);
    setMovements([]);
  };

  const saveClient = async () => {
    if (!form.nombre.trim()) {
      toast.error('Ingresá el nombre del cliente');
      return;
    }

    if (!form.apellido.trim()) {
      toast.error('Ingresá el apellido del cliente');
      return;
    }

    if (!form.dni.trim()) {
      toast.error('Ingresá el DNI/CUIT del cliente');
      return;
    }

    const latitude = toNumberOrUndefined(form.latitude);
    const longitude = toNumberOrUndefined(form.longitude);

    if (form.latitude && latitude === undefined) {
      toast.error('La latitud no es válida');
      return;
    }

    if (form.longitude && longitude === undefined) {
      toast.error('La longitud no es válida');
      return;
    }

    setSaving(true);

    const toastId = toast.loading(modal === 'create' ? 'Creando cliente...' : 'Guardando cliente...');

    try {
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        telefono: cleanString(form.telefono),
        gmail: cleanString(form.gmail),
        category: form.category as ClientCategory,
        creditLimit: form.creditLimit ? num(form.creditLimit) : null,
        isAccountEnabled: form.isAccountEnabled === 'true',

        addressStreet: cleanString(form.addressStreet),
        addressNumber: cleanString(form.addressNumber),
        addressFloor: cleanString(form.addressFloor),
        addressApartment: cleanString(form.addressApartment),
        addressCity: cleanString(form.addressCity),
        addressProvince: cleanString(form.addressProvince),
        addressPostalCode: cleanString(form.addressPostalCode),
        addressNotes: cleanString(form.addressNotes),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      };

      if (modal === 'create') {
        await api.post('/clients', payload);
        toast.success('Cliente creado correctamente', { id: toastId });
      } else if (editing) {
        await api.put(`/clients/${editing.id}`, payload);
        toast.success('Cliente actualizado correctamente', { id: toastId });
      }

      forceCloseModal();
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al guardar cliente'), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!editing) return;

    const amount = num(payment.amount);

    if (!payment.amount || amount <= 0) {
      toast.error('Ingresá un importe válido');
      return;
    }

    setSaving(true);

    const toastId = toast.loading('Registrando abono...');

    try {
      await api.post(`/accounts/clients/${editing.id}/payment`, {
        ...payment,
        amount,
      });

      toast.success('Abono registrado correctamente', { id: toastId });
      forceCloseModal();
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al registrar abono'), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (c: ClientWithAddress) => {
    setConfirmModal({
      title: 'Eliminar cliente',
      message: `¿Eliminar ${clientName(c)}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        const toastId = toast.loading('Eliminando cliente...');

        try {
          await api.delete(`/clients/${c.id}`);
          await load();
          toast.success('Cliente eliminado correctamente', { id: toastId });
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, 'No se pudo eliminar'), { id: toastId });
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
    <AppLayout
      title="Clientes"
      subtitle="Clientes, direcciones, crédito y cuenta corriente"
      actions={
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={14} /> Nuevo cliente
        </button>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{clients.length}</div>
          <div className="stat-label">Clientes</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{clientsWithAddress}</div>
          <div className="stat-label">Con dirección</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{debtors}</div>
          <div className="stat-label">Con deuda</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: totalDebt > 0 ? 'var(--warn)' : 'var(--accent)' }}
          >
            {fmtMoney(totalDebt)}
          </div>
          <div className="stat-label">Saldo pendiente</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {clients.filter((c) => c.category === 'Mayorista').length}
          </div>
          <div className="stat-label">Mayoristas</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 18, maxWidth: 520 }}>
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
          placeholder="Buscar por nombre, DNI, teléfono, email o dirección..."
          style={{ paddingLeft: 34 }}
        />
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
                  <th>Cliente</th>
                  <th>DNI/CUIT</th>
                  <th>Contacto</th>
                  <th>Dirección</th>
                  <th>Categoría</th>
                  <th>Cuenta corriente</th>
                  <th>Límite</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => {
                  const address = clientAddress(c);

                  return (
                    <tr key={c.id}>
                      <td>
                        <b>{clientName(c)}</b>
                        <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                          {c.gmail ?? 'Sin email'}
                        </div>
                      </td>

                      <td style={{ fontFamily: 'var(--mono)' }}>{c.dni}</td>

                      <td>{c.telefono ?? '—'}</td>

                      <td style={{ minWidth: 230 }}>
                        {address ? (
                          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                            <MapPin
                              size={13}
                              style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }}
                            />
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.35 }}>
                                {address}
                              </div>
                              {c.addressNotes && (
                                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>
                                  {c.addressNotes}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                            Sin dirección
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            c.category === 'Mayorista' ? 'badge-blue' : 'badge-green'
                          }`}
                        >
                          {c.category}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            num(c.currentBalance) > 0 ? 'badge-yellow' : 'badge-green'
                          }`}
                        >
                          {fmtMoney(num(c.currentBalance))}
                        </span>
                        <div
                          style={{
                            color:
                              c.isAccountEnabled === false ? 'var(--danger)' : 'var(--text3)',
                            fontSize: 11,
                          }}
                        >
                          {c.isAccountEnabled === false ? 'Deshabilitada' : 'Habilitada'}
                        </div>
                      </td>

                      <td>{c.creditLimit ? fmtMoney(c.creditLimit) : 'Sin límite'}</td>

                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openPayment(c)}
                            disabled={num(c.currentBalance) <= 0}
                          >
                            <Wallet size={13} /> Abono
                          </button>

                          <button className="btn btn-ghost btn-sm" onClick={() => openHistory(c)}>
                            <CreditCard size={13} />
                          </button>

                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                            <Edit2 size={13} />
                          </button>

                          <button className="btn btn-danger btn-sm" onClick={() => deleteClient(c)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Users size={36} />
              <p>Sin clientes</p>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <b>{modal === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal} disabled={saving}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}>
                  Datos del cliente
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 12 }}>
                  Información comercial, categoría y cuenta corriente.
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Apellido *</label>
                  <input
                    value={form.apellido}
                    onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">DNI/CUIT *</label>
                  <input
                    value={form.dni}
                    onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="Cliente">Cliente</option>
                    <option value="Mayorista">Mayorista</option>
                    <option value="Price">Consumidor final / Minorista</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    value={form.gmail}
                    onChange={(e) => setForm((p) => ({ ...p, gmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Límite de crédito</label>
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cuenta corriente</label>
                  <select
                    value={form.isAccountEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, isAccountEnabled: e.target.value }))}
                  >
                    <option value="true">Habilitada</option>
                    <option value="false">Deshabilitada</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  margin: '20px 0 16px',
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MapPin size={16} style={{ color: 'var(--accent)' }} />
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Dirección de entrega</div>
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                  Esta dirección se va a usar después para calcular envío, remitos y entregas.
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Calle</label>
                  <input
                    value={form.addressStreet}
                    placeholder="Ej: San Martín"
                    onChange={(e) => setForm((p) => ({ ...p, addressStreet: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input
                    value={form.addressNumber}
                    placeholder="Ej: 810"
                    onChange={(e) => setForm((p) => ({ ...p, addressNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Piso</label>
                  <input
                    value={form.addressFloor}
                    placeholder="Opcional"
                    onChange={(e) => setForm((p) => ({ ...p, addressFloor: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <input
                    value={form.addressApartment}
                    placeholder="Opcional"
                    onChange={(e) => setForm((p) => ({ ...p, addressApartment: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Localidad</label>
                  <input
                    value={form.addressCity}
                    placeholder="Ej: Villa General Belgrano"
                    onChange={(e) => setForm((p) => ({ ...p, addressCity: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Provincia</label>
                  <input
                    value={form.addressProvince}
                    placeholder="Ej: Córdoba"
                    onChange={(e) => setForm((p) => ({ ...p, addressProvince: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código postal</label>
                  <input
                    value={form.addressPostalCode}
                    placeholder="Ej: 5194"
                    onChange={(e) => setForm((p) => ({ ...p, addressPostalCode: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notas de dirección</label>
                  <input
                    value={form.addressNotes}
                    placeholder="Ej: casa roja, portón negro, tocar timbre..."
                    onChange={(e) => setForm((p) => ({ ...p, addressNotes: e.target.value }))}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'rgba(79,142,255,0.07)',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}>
                  Coordenadas para cálculo automático
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.45 }}>
                  Por ahora se pueden cargar manualmente. Después conectamos Google para obtenerlas
                  automáticamente desde la dirección.
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Latitud</label>
                  <input
                    value={form.latitude}
                    placeholder="-31.978"
                    onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Longitud</label>
                  <input
                    value={form.longitude}
                    placeholder="-64.556"
                    onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveClient}
                disabled={saving || !form.nombre || !form.apellido || !form.dni}
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'payment' && editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <b>Registrar abono</b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal} disabled={saving}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                {clientName(editing)} · saldo {fmtMoney(editing.currentBalance)}
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Importe</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Método</label>
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        method: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Referencia</label>
                <input
                  value={payment.reference}
                  onChange={(e) => setPayment((p) => ({ ...p, reference: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={payment.description}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={savePayment}
                disabled={saving || !payment.amount}
              >
                {saving ? <span className="spinner" /> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'history' && editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <b>Cuenta corriente · {clientName(editing)}</b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Importe</th>
                        <th>Anterior</th>
                        <th>Nuevo</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{fmtDate(m.date)}</td>
                          <td>
                            <span
                              className={`badge ${
                                m.type === 'PAYMENT' ? 'badge-green' : 'badge-yellow'
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                            {fmtMoney(m.amount)}
                          </td>
                          <td>{fmtMoney(m.previousBalance)}</td>
                          <td>{fmtMoney(m.newBalance)}</td>
                          <td>{m.description ?? m.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!movements.length && (
                    <div className="empty-state">
                      <CreditCard size={36} />
                      <p>Sin movimientos</p>
                    </div>
                  )}
                </div>
              </div>
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

                <p
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
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