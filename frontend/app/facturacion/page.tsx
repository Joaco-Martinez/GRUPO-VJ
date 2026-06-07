'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { clientName } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  FileText,
  Download,
  RefreshCcw,
  Receipt,
  X,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Invoice {
  id: string;
  saleId: string;
  cae: string;
  caeVto: string;
  tipo: string;
  total: number;
  createdAt: string;
  sale?: {
    client?: {
      id?: string;
      name?: string;
      nombre?: string;
      apellido?: string;
      dni?: string;
    } | null;
    total: number;
    receiptType: string;
  };
}

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

function normalizeInvoices(data: unknown): Invoice[] {
  if (Array.isArray(data)) return data as Invoice[];

  if (
    data &&
    typeof data === 'object' &&
    'content' in data &&
    Array.isArray((data as { content?: unknown }).content)
  ) {
    return (data as { content: Invoice[] }).content;
  }

  return [];
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

async function fetchInvoices() {
  const r = await api.get('/factura-pdf/all');
  return normalizeInvoices(r.data);
}

export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchInvoices();
      setInvoices(data);

      if (showSuccess) {
        toast.success('Facturas actualizadas');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchInvoices()
      .then((data) => {
        if (!alive) return;
        setInvoices(data);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;
        toast.error('Error al cargar facturas');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleDownload = (saleId: string) => {
    toast.success('Abriendo PDF');
    window.open(`${API_URL}/factura-pdf/${saleId}/descargar`, '_blank');
  };

  const handleRegenerar = (saleId: string) => {
    setConfirmModal({
      title: 'Regenerar PDF',
      message:
        '¿Querés regenerar el PDF de esta factura? Se volverá a crear el comprobante con los datos actuales de la venta.',
      confirmText: 'Regenerar',
      danger: false,
      onConfirm: async () => {
        setRegenerating(saleId);

        const toastId = toast.loading('Regenerando PDF...');

        try {
          await api.post(`/factura-pdf/${saleId}/regenerar`);
          toast.success('PDF regenerado correctamente', { id: toastId });
          await load();
        } catch (e) {
          console.error(e);
          toast.error(getErrorMessage(e, 'Error al regenerar el PDF'), { id: toastId });
        } finally {
          setRegenerating('');
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
    <AppLayout title="AFIP / Facturación" subtitle="Facturas electrónicas y comprobantes">
      <div className="card">
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Receipt size={18} style={{ color: '#06b6d4' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Facturas emitidas</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>
            {invoices.length}
          </span>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>CAE</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Vto. CAE</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: '#06b6d4',
                        }}
                      >
                        {inv.cae ?? '—'}
                      </span>
                    </td>

                    <td>
                      <span className="badge badge-blue">
                        {inv.sale?.receiptType ?? inv.tipo ?? '—'}
                      </span>
                    </td>

                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {inv.sale?.client ? clientName(inv.sale.client as never) : '—'}
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                      }}
                    >
                      {fmt(inv.sale?.total ?? inv.total ?? 0)}
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        color: 'var(--text2)',
                      }}
                    >
                      {inv.caeVto ? new Date(inv.caeVto).toLocaleDateString('es-AR') : '—'}
                    </td>

                    <td
                      style={{
                        fontSize: 12,
                        color: 'var(--text2)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {new Date(inv.createdAt).toLocaleDateString('es-AR')}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(inv.saleId)}
                        >
                          <Download size={12} /> PDF
                        </button>

                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRegenerar(inv.saleId)}
                          disabled={regenerating === inv.saleId}
                          title="Regenerar PDF"
                        >
                          <RefreshCcw
                            size={12}
                            style={{
                              animation:
                                regenerating === inv.saleId ? 'spin 0.7s linear infinite' : 'none',
                            }}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !invoices.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin facturas emitidas todavía</p>
            </div>
          )}
        </div>
      </div>

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