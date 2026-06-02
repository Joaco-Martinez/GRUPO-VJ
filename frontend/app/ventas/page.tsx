'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { PaymentMethod, Sale } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import {
  Check,
  FileText,
  Loader2,
  ReceiptText,
  Search,
  Send,
  X,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const badge = (s: string) =>
  s === 'COMPLETED'
    ? 'badge-green'
    : s === 'PENDING'
    ? 'badge-yellow'
    : 'badge-red';

const invoiceBadge = (s?: string | null) =>
  s === 'INVOICED'
    ? 'badge-green'
    : s === 'PENDING_AFIP'
    ? 'badge-yellow'
    : s === 'ERROR'
    ? 'badge-red'
    : 'badge-gray';

const methods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
  'CUENTA_CORRIENTE',
];

type InvoiceType = 1 | 6 | 11;

type InvoiceModalState = {
  sale: Sale;
  tipoComprobante: InvoiceType;
  receiverDoc: string;
  condicionIVAReceptor: number;
};

function onlyNumbers(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function detectDocType(doc: string) {
  const clean = onlyNumbers(doc);

  if (!clean || clean === '0') {
    return {
      tipoDoc: 99,
      nroDoc: 0,
    };
  }

  if (clean.length === 7 || clean.length === 8) {
    return {
      tipoDoc: 96,
      nroDoc: Number(clean),
    };
  }

  if (clean.length === 11) {
    const prefix = clean.slice(0, 2);

    if (['20', '23', '24', '27'].includes(prefix)) {
      return {
        tipoDoc: 86,
        nroDoc: Number(clean),
      };
    }

    return {
      tipoDoc: 80,
      nroDoc: Number(clean),
    };
  }

  return null;
}

function getSaleInvoiceStatus(sale: Sale) {
  const s = sale as any;

  if (s.invoiceStatus) return s.invoiceStatus;
  if (s.isInvoiced) return 'INVOICED';

  return 'NONE';
}

function isSaleInvoiced(sale: Sale) {
  const s = sale as any;
  return Boolean(s.isInvoiced) || s.invoiceStatus === 'INVOICED';
}

function defaultInvoiceTypeForSale(sale: Sale): InvoiceType {
  const client = (sale as any).client;

  if (!client) return 11;

  const category = String(client.category ?? '').toLowerCase();

  if (category.includes('mayorista') || category.includes('cliente')) {
    return 6;
  }

  return 11;
}

function getSaleProductsForAfip(sale: Sale) {
  const items = (sale as any).items || [];

  return items.map((item: any) => {
    const quantity = item.quantityKg ? num(item.quantityKg) : num(item.quantity || 1);
    const price = num(item.price);

    return {
      name: item.productNameSnapshot || item.product?.name || 'Producto',
      quantity,
      price,
    };
  });
}

function getSalePaymentLabel(sale: Sale) {
  const saleAny = sale as any;

  if (saleAny.payments?.length) {
    return saleAny.payments
      .map((p: any) => `${p.method}: ${fmtMoney(num(p.amount))}`)
      .join(' | ');
  }

  return saleAny.paymentMethod;
}

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<Sale | null>(null);
  const [payEdit, setPayEdit] = useState<Sale | null>(null);
  const [payments, setPayments] = useState<
    { method: PaymentMethod; amount: number; reference?: string; notes?: string }[]
  >([]);

  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    try {
      const r = await api.get('/sales');
      setSales(normalizeArray<Sale>(r.data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = sales.filter(
    (s) =>
      (!status || s.status === status) &&
      (!search ||
        s.id.includes(search) ||
        clientName(s.client).toLowerCase().includes(search.toLowerCase()))
  );

  const total = sales
    .filter((s) => s.status !== 'CANCELLED')
    .reduce((a, s) => a + num(s.total), 0);

  const debt = sales.reduce((a, s) => a + num(s.accountDebtAmount), 0);

  const setSaleStatus = async (s: Sale, next: Sale['status']) => {
    if (next === 'CANCELLED' && !confirm('¿Cancelar venta y revertir stock/deuda?')) {
      return;
    }

    await api.patch(`/sales/${s.id}/status`, { status: next });
    await load();
  };

  const openPayments = (s: Sale) => {
    setPayEdit(s);

    setPayments(
      (s.payments?.length
        ? s.payments
        : [
            {
              method: s.paymentMethod,
              amount: s.paymentMethod === 'CUENTA_CORRIENTE' ? 0 : s.total,
            },
          ]
      ).map((p) => ({
        method: p.method,
        amount: num(p.amount),
        reference: p.reference ?? '',
        notes: p.notes ?? '',
      }))
    );
  };

  const savePayments = async () => {
    if (!payEdit) return;

    await api.patch(`/sales/${payEdit.id}/payments`, {
      setAsPrimary: true,
      payments,
    });

    setPayEdit(null);
    await load();
  };

  const openInvoiceModal = (sale: Sale) => {
    const saleAny = sale as any;
    const clientDoc = saleAny.client?.dni || '';

    setInvoiceModal({
      sale,
      tipoComprobante: defaultInvoiceTypeForSale(sale),
      receiverDoc: clientDoc,
      condicionIVAReceptor: 5,
    });
  };

  const submitInvoice = async () => {
    if (!invoiceModal) return;

    const { sale, tipoComprobante, receiverDoc, condicionIVAReceptor } = invoiceModal;
    const detectedDoc = detectDocType(receiverDoc);
    const saleAny = sale as any;

    if (sale.status === 'CANCELLED') {
      alert('No se puede facturar una venta cancelada.');
      return;
    }

    if (isSaleInvoiced(sale)) {
      alert('Esta venta ya está facturada.');
      return;
    }

    if (tipoComprobante === 1) {
      if (!detectedDoc || String(detectedDoc.nroDoc).length !== 11) {
        alert('Para Factura A tenés que cargar CUIT del receptor.');
        return;
      }
    }

    if (tipoComprobante === 6) {
      if (!detectedDoc || detectedDoc.nroDoc === 0) {
        alert('Para Factura B tenés que cargar DNI, CUIL o CUIT del receptor.');
        return;
      }
    }

    const payload = {
      saleId: sale.id,
      tipoComprobante,
      tipoDoc: tipoComprobante === 1 ? 80 : detectedDoc?.tipoDoc || 99,
      nroDoc: tipoComprobante === 1 ? detectedDoc?.nroDoc : detectedDoc?.nroDoc || 0,
      importe: num(sale.total),
      condicionIVAReceptor,
      products: getSaleProductsForAfip(sale),
      metodoPago: getSalePaymentLabel(sale),
    };

    try {
      setInvoicingId(sale.id);

      const response = await api.post('/afip/facturar', payload);

      const data = response.data;
      const factura = data?.factura || data?.content || data?.invoice;

      setInvoiceModal(null);
      await load();

      if (data?.invoiceStatus === 'PENDING_AFIP') {
        alert(
          'ARCA no respondió correctamente. La factura quedó pendiente para reintento automático.'
        );
        return;
      }

      if (factura?.cae) {
        alert(`Factura generada correctamente. CAE: ${factura.cae}`);
        return;
      }

      if (data?.cae) {
        alert(`Factura generada correctamente. CAE: ${data.cae}`);
        return;
      }

      alert('Factura generada correctamente.');
    } catch (error: any) {
      alert(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'No se pudo facturar la venta.'
      );
    } finally {
      setInvoicingId(null);
    }
  };

  return (
    <AppLayout
      title="Ventas"
      subtitle="Historial, pagos y comprobantes"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={load}>
          Actualizar
        </button>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{sales.length}</div>
          <div className="stat-label">Ventas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {fmtMoney(total)}
          </div>
          <div className="stat-label">Total activo</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {sales.filter((s) => s.status === 'PENDING').length}
          </div>
          <div className="stat-label">Pendientes</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: debt > 0 ? 'var(--warn)' : 'var(--accent)' }}
          >
            {fmtMoney(debt)}
          </div>
          <div className="stat-label">Deuda generada</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
            placeholder="Buscar por ID o cliente..."
            style={{ paddingLeft: 34 }}
          />
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Deuda</th>
                  <th>Estado</th>
                  <th>AFIP</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((s) => {
                  const invoiceStatus = getSaleInvoiceStatus(s);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setDetail(s)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                        #{s.id.slice(-8)}
                      </td>

                      <td>{fmtDate(s.createdAt)}</td>

                      <td>{clientName(s.client)}</td>

                      <td>
                        <span className="badge badge-gray">
                          {s.payments?.length ? 'MIXTO' : s.paymentMethod}
                        </span>
                      </td>

                      <td
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 900,
                          color: 'var(--accent)',
                        }}
                      >
                        {fmtMoney(s.total)}
                      </td>

                      <td>
                        {num(s.accountDebtAmount) > 0 ? (
                          <span className="badge badge-yellow">
                            {fmtMoney(s.accountDebtAmount ?? 0)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td>
                        <span className={`badge ${badge(s.status)}`}>{s.status}</span>
                      </td>

                      <td>
                        <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                          {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                        </span>
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {s.status === 'PENDING' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setSaleStatus(s, 'COMPLETED')}
                            >
                              Confirmar
                            </button>
                          )}

                          {s.status !== 'CANCELLED' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setSaleStatus(s, 'CANCELLED')}
                            >
                              Cancelar
                            </button>
                          )}

                          <button className="btn btn-secondary btn-sm" onClick={() => openPayments(s)}>
                            Pagos
                          </button>

                          {!isSaleInvoiced(s) && s.status !== 'CANCELLED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={invoicingId === s.id}
                              onClick={() => openInvoiceModal(s)}
                              title="Facturar en ARCA"
                            >
                              {invoicingId === s.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <ReceiptText size={13} />
                              )}
                              Facturar
                            </button>
                          )}

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank')
                            }
                            title="Descargar comprobante PDF"
                          >
                            <FileText size={13} />
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
              <FileText size={36} />
              <p>Sin ventas</p>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <b>Venta #{detail.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div>
                  <small>Cliente</small>
                  <b style={{ display: 'block' }}>{clientName(detail.client)}</b>
                </div>

                <div>
                  <small>Total</small>
                  <b style={{ display: 'block' }}>{fmtMoney(detail.total)}</b>
                </div>

                <div>
                  <small>Estado</small>
                  <b style={{ display: 'block' }}>{detail.status}</b>
                </div>
              </div>

              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detail.items?.map((i) => (
                      <tr key={i.id}>
                        <td>{i.productNameSnapshot ?? i.product?.name ?? 'Producto'}</td>
                        <td>{i.quantityKg ? `${i.quantityKg} kg` : i.quantity}</td>
                        <td>{fmtMoney(i.price)}</td>
                        <td>{fmtMoney(i.subtotal ?? i.price * (i.quantityKg ?? i.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.payments?.length ? (
                <div style={{ marginTop: 16 }}>
                  <b>Pagos</b>

                  {detail.payments.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span>{p.method}</span>
                      <b>{fmtMoney(p.amount)}</b>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {invoiceModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setInvoiceModal(null)}
        >
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <b>Facturar venta #{invoiceModal.sale.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setInvoiceModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Total a facturar: <b>{fmtMoney(invoiceModal.sale.total)}</b>
              </p>

              <div className="form-group">
                <label className="form-label">Tipo de comprobante</label>

                <select
                  value={invoiceModal.tipoComprobante}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            tipoComprobante: Number(e.target.value) as InvoiceType,
                          }
                        : prev
                    )
                  }
                >
                  <option value={11}>Factura C</option>
                  <option value={6}>Factura B</option>
                  <option value={1}>Factura A</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Documento receptor{' '}
                  {invoiceModal.tipoComprobante === 11 ? '(opcional)' : '(obligatorio)'}
                </label>

                <input
                  value={invoiceModal.receiverDoc}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev ? { ...prev, receiverDoc: e.target.value } : prev
                    )
                  }
                  placeholder={
                    invoiceModal.tipoComprobante === 11
                      ? 'Consumidor final sin documento'
                      : 'DNI / CUIL / CUIT'
                  }
                />

                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  Factura A requiere CUIT. Factura B requiere DNI, CUIL o CUIT. Factura C
                  puede salir como consumidor final.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Condición IVA receptor</label>

                <select
                  value={invoiceModal.condicionIVAReceptor}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            condicionIVAReceptor: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                >
                  <option value={5}>Consumidor Final</option>
                  <option value={1}>IVA Responsable Inscripto</option>
                  <option value={6}>Responsable Monotributo</option>
                  <option value={4}>IVA Sujeto Exento</option>
                </select>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  color: 'var(--text2)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Este botón llama a <b>POST /afip/facturar</b>, genera CAE en ARCA,
                guarda la factura AFIP y actualiza la venta como facturada.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setInvoiceModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                disabled={invoicingId === invoiceModal.sale.id}
                onClick={submitInvoice}
              >
                {invoicingId === invoiceModal.sale.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Facturar en ARCA
              </button>
            </div>
          </div>
        </div>
      )}

      {payEdit && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setPayEdit(null)}
        >
          <div className="modal">
            <div className="modal-header">
              <b>Editar pagos</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setPayEdit(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
                Total venta: {fmtMoney(payEdit.total)}. Si la suma es menor, la
                diferencia queda en cuenta corriente.
              </p>

              {payments.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 36px',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                method: e.target.value as PaymentMethod,
                              }
                            : x
                        )
                      )
                    }
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={p.amount || ''}
                    disabled={p.method === 'CUENTA_CORRIENTE'}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                amount: num(e.target.value),
                              }
                            : x
                        )
                      )
                    }
                  />

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setPayments((prev) => [...prev, { method: 'TRANSFERENCIA', amount: 0 }])
                }
              >
                Agregar pago
              </button>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayEdit(null)}>
                Cancelar
              </button>

              <button className="btn btn-primary" onClick={savePayments}>
                <Check size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}