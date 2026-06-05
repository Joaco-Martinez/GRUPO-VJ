'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { AccountMovement, Client, PaymentMethod } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Search,
  Wallet,
  X,
} from 'lucide-react';

const methods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
];

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function CuentasCorrientesPage() {
  const [debtors, setDebtors] = useState<Client[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [payment, setPayment] = useState({
    amount: '',
    method: 'EFECTIVO' as PaymentMethod,
    reference: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = async () => {
    setLoading(true);

    try {
      const [d, m] = await Promise.all([
        api.get('/accounts/debtors'),
        api.get('/accounts/movements'),
      ]);

      setDebtors(normalizeArray<Client>(d.data));
      setMovements(normalizeArray<AccountMovement>(m.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar cuentas corrientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = debtors.reduce((a, c) => a + num(c.currentBalance), 0);

  const filtered = debtors.filter(
    (c) =>
      !search ||
      clientName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.dni?.includes(search)
  );

  const openPayment = (c: Client) => {
    setClient(c);
    setPayment({
      amount: '',
      method: 'EFECTIVO',
      reference: '',
      description: '',
    });
  };

  const closePaymentModal = () => {
    if (saving) return;

    setClient(null);
    setPayment({
      amount: '',
      method: 'EFECTIVO',
      reference: '',
      description: '',
    });
  };

  const savePayment = async () => {
    if (!client) return;

    setSaving(true);

    try {
      await api.post(`/accounts/clients/${client.id}/payment`, {
        ...payment,
        amount: num(payment.amount),
      });

      setClient(null);
      showToast('success', 'Abono registrado correctamente');
      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Error al registrar abono'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Cuentas corrientes"
      subtitle="Deudas, abonos e historial de saldos"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCcw size={14} /> Actualizar
        </button>
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
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{debtors.length}</div>
          <div className="stat-label">Clientes con deuda</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: total > 0 ? 'var(--warn)' : 'var(--accent)' }}
          >
            {fmtMoney(total)}
          </div>
          <div className="stat-label">Total pendiente</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{movements.length}</div>
          <div className="stat-label">Movimientos</div>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 460, marginBottom: 18 }}>
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
          placeholder="Buscar cliente o DNI..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          Clientes con saldo pendiente
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 180 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI</th>
                  <th>Saldo</th>
                  <th>Límite</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{clientName(c)}</b>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                        {c.telefono ?? c.gmail ?? '—'}
                      </div>
                    </td>

                    <td style={{ fontFamily: 'var(--mono)' }}>{c.dni}</td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 900,
                        color: 'var(--warn)',
                      }}
                    >
                      {fmtMoney(c.currentBalance)}
                    </td>

                    <td>{c.creditLimit ? fmtMoney(c.creditLimit) : 'Sin límite'}</td>

                    <td>
                      <span
                        className={`badge ${
                          c.isAccountEnabled === false ? 'badge-red' : 'badge-green'
                        }`}
                      >
                        {c.isAccountEnabled === false ? 'Bloqueada' : 'Habilitada'}
                      </span>
                    </td>

                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openPayment(c)}>
                        <Wallet size={13} /> Registrar abono
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>No hay deudas pendientes</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          Últimos movimientos
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Saldo anterior</th>
                <th>Saldo nuevo</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {movements.slice(0, 60).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.date)}</td>

                  <td>{m.client ? clientName(m.client) : '—'}</td>

                  <td>
                    <span
                      className={`badge ${
                        m.type === 'PAYMENT' || m.type === 'ADJUSTMENT_NEGATIVE'
                          ? 'badge-green'
                          : 'badge-yellow'
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

          {!movements.length && !loading && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>
      </div>

      {client && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closePaymentModal()}
        >
          <div className="modal">
            <div className="modal-header">
              <b>Registrar abono</b>

              <button className="btn btn-ghost btn-sm" onClick={closePaymentModal}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                {clientName(client)} · saldo actual {fmtMoney(client.currentBalance)}
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Importe</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        amount: e.target.value,
                      }))
                    }
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
                    {methods.map((m) => (
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
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      reference: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={payment.description}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closePaymentModal}>
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
    </AppLayout>
  );
}