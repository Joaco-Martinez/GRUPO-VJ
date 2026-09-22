'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Client, DiscountType, Product, Quotation, QuotationPriceType, SaleUnit } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num, productPrice } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  FileText,
  Plus,
  Search,
  RefreshCcw,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Download,
  Send,
  PackageOpen,
  Minus,
} from 'lucide-react';

type Modal = 'create' | 'edit' | null;

type FormItem = {
  key: string;
  productId: string | null;
  name: string;
  sku: string;
  saleUnit: SaleUnit;
  quantity: string;
  price: string;
};

type QuotationForm = {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientDoc: string;
  clientAddress: string;
  priceType: QuotationPriceType;
  discountType: DiscountType | '';
  discountValue: string;
  notes: string;
  expiresAt: string;
  items: FormItem[];
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
} | null;

const DEFAULT_VALID_DAYS = 7;

function dateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function emptyForm(): QuotationForm {
  return {
    clientId: '',
    clientName: '',
    clientPhone: '',
    clientDoc: '',
    clientAddress: '',
    priceType: 'price',
    discountType: '',
    discountValue: '',
    notes: '',
    expiresAt: dateInputValue(new Date(Date.now() + DEFAULT_VALID_DAYS * 86400000)),
    items: [],
  };
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

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

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

function quotationClientName(q: Quotation) {
  return q.clientName || (q.client ? clientName(q.client) : 'Consumidor final');
}

function isExpired(q: Quotation) {
  return Boolean(q.expiresAt && new Date(q.expiresAt).getTime() < Date.now());
}

function qtyLabel(quantity: number, saleUnit: SaleUnit) {
  return saleUnit === 'KG' ? `${quantity} kg` : `${quantity}`;
}

function formTotals(form: QuotationForm) {
  const subtotal = form.items.reduce((acc, item) => acc + num(item.quantity) * num(item.price), 0);
  const discountValue = num(form.discountValue);
  const discount = !form.discountType || discountValue <= 0
    ? 0
    : form.discountType === 'PERCENTAGE'
      ? (subtotal * Math.min(discountValue, 100)) / 100
      : discountValue;

  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

async function getPdfBlob(q: Quotation) {
  const response = await api.get(`/quotations/${q.id}/pdf`, { responseType: 'blob' });
  const contentType = String(response.headers['content-type'] ?? '');

  if (!contentType.includes('application/pdf')) {
    const text = await (response.data as Blob).text();
    let message = 'El servidor no devolvió un PDF válido';
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message || message;
    } catch {}
    throw new Error(message);
  }

  return new Blob([response.data], { type: 'application/pdf' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function CotizacionesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [productSearch, setProductSearch] = useState('');

  const [search, setSearch] = useState('');

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isMobile = useIsMobile();

  const loadQuotations = async (showSuccess = false) => {
    setLoading(true);
    try {
      const res = await api.get('/quotations');
      setQuotations(normalizeArray<Quotation>(res.data?.quotations ?? res.data));
      if (showSuccess) toast.success('Cotizaciones actualizadas');
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get('/quotations')
      .then((res) => {
        if (alive) setQuotations(normalizeArray<Quotation>(res.data?.quotations ?? res.data));
      })
      .catch((e) => {
        console.error(e);
        if (alive) toast.error('Error al cargar cotizaciones');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Productos y clientes se cargan aparte para no bloquear el listado si fallan.
    api
      .get('/products')
      .then((res) => {
        if (alive) setProducts(normalizeArray<Product>(res.data).filter((p) => p.isActive !== false));
      })
      .catch((e) => console.error(e));

    api
      .get('/clients?light=true')
      .then((res) => {
        if (alive) setClients(normalizeArray<Client>(res.data));
      })
      .catch((e) => console.error(e));

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotations;

    return quotations.filter((quotation) =>
      String(quotation.number).includes(q) ||
      quotationClientName(quotation).toLowerCase().includes(q) ||
      quotation.clientPhone?.toLowerCase().includes(q) ||
      quotation.items.some((item) => item.productNameSnapshot.toLowerCase().includes(q)),
    );
  }, [quotations, search]);

  const productResults = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];

    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productSearch]);

  const totalQuoted = useMemo(
    () => quotations.reduce((acc, q) => acc + num(q.total), 0),
    [quotations],
  );
  const activeCount = useMemo(() => quotations.filter((q) => !isExpired(q)).length, [quotations]);

  const totals = formTotals(form);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setProductSearch('');
    setModal('create');
  };

  const openEdit = (q: Quotation) => {
    setEditing(q);
    setForm({
      clientId: q.clientId ?? '',
      clientName: q.clientName ?? '',
      clientPhone: q.clientPhone ?? '',
      clientDoc: q.clientDoc ?? '',
      clientAddress: q.clientAddress ?? '',
      priceType: q.priceType === 'wholesalePrice' ? 'wholesalePrice' : 'price',
      discountType: q.discountType ?? '',
      discountValue: q.discountValue ? String(q.discountValue) : '',
      notes: q.notes ?? '',
      expiresAt: q.expiresAt ? dateInputValue(new Date(q.expiresAt)) : '',
      items: q.items.map((item) => ({
        key: item.id,
        productId: item.productId ?? null,
        name: item.productNameSnapshot,
        sku: item.productSkuSnapshot ?? '',
        saleUnit: item.saleUnit,
        quantity: String(item.quantity),
        price: String(item.price),
      })),
    });
    setProductSearch('');
    setModal('edit');
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setEditing(null);
  };

  const selectClient = (id: string) => {
    const client = clients.find((c) => c.id === id);

    setForm((prev) => {
      if (!client) return { ...prev, clientId: '' };

      const address = [client.addressStreet, client.addressNumber, client.addressCity]
        .filter(Boolean)
        .join(' ');
      const priceType: QuotationPriceType = client.category === 'Mayorista' ? 'wholesalePrice' : 'price';

      return {
        ...prev,
        clientId: client.id,
        clientName: clientName(client),
        clientPhone: client.telefono ?? '',
        clientDoc: client.dni ?? '',
        clientAddress: address,
        priceType,
        items: repriceItems(prev.items, priceType),
      };
    });
  };

  const repriceItems = (items: FormItem[], priceType: QuotationPriceType) =>
    items.map((item) => {
      const product = item.productId ? products.find((p) => p.id === item.productId) : null;
      return product ? { ...item, price: String(productPrice(product, priceType)) } : item;
    });

  const changePriceType = (priceType: QuotationPriceType) => {
    setForm((prev) => ({ ...prev, priceType, items: repriceItems(prev.items, priceType) }));
  };

  const addProduct = (product: Product) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => item.productId === product.id);

      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.key === existing.key ? { ...item, quantity: String(num(item.quantity) + 1) } : item,
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            key: newKey(),
            productId: product.id,
            name: product.name,
            sku: product.sku ?? '',
            saleUnit: product.saleUnit,
            quantity: '1',
            price: String(productPrice(product, prev.priceType)),
          },
        ],
      };
    });
    setProductSearch('');
  };

  const addFreeItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { key: newKey(), productId: null, name: '', sku: '', saleUnit: 'UNIT', quantity: '1', price: '' },
      ],
    }));
  };

  const updateItem = (key: string, patch: Partial<FormItem>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (key: string) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.key !== key) }));
  };

  const saveQuotation = async () => {
    if (!form.items.length) {
      toast.error('Agregá al menos un producto');
      return;
    }

    if (form.items.some((item) => !item.name.trim())) {
      toast.error('Todos los ítems tienen que tener nombre');
      return;
    }

    if (form.items.some((item) => !(num(item.quantity) > 0))) {
      toast.error('Revisá las cantidades');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        clientId: form.clientId || null,
        clientName: form.clientName.trim() || null,
        clientPhone: form.clientPhone.trim() || null,
        clientDoc: form.clientDoc.trim() || null,
        clientAddress: form.clientAddress.trim() || null,
        priceType: form.priceType,
        discountType: form.discountType || null,
        discountValue: form.discountType ? num(form.discountValue) : null,
        notes: form.notes.trim() || null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
        items: form.items.map((item) => ({
          productId: item.productId,
          name: item.name.trim(),
          sku: item.sku.trim() || null,
          quantity: num(item.quantity),
          price: num(item.price),
        })),
      };

      if (modal === 'edit' && editing) {
        await api.put(`/quotations/${editing.id}`, payload);
        toast.success('Cotización actualizada');
      } else {
        await api.post('/quotations', payload);
        toast.success('Cotización creada (no se descontó stock)');
      }

      setModal(null);
      setEditing(null);
      await loadQuotations();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al guardar la cotización'));
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (q: Quotation) => {
    setPdfLoadingId(q.id);
    const toastId = toast.loading('Generando PDF...');
    try {
      const blob = await getPdfBlob(q);
      downloadBlob(blob, `cotizacion-${q.number}.pdf`);
      toast.success('Cotización descargada', { id: toastId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF', { id: toastId });
    } finally {
      setPdfLoadingId(null);
    }
  };

  const sharePdf = async (q: Quotation) => {
    setPdfLoadingId(q.id);
    const toastId = toast.loading('Generando PDF para compartir...');
    try {
      const blob = await getPdfBlob(q);
      const filename = `cotizacion-${q.number}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData: ShareData = {
        title: `Cotización N° ${q.number}`,
        text: `Hola, te envío la cotización de Grupo VJ. Total: ${fmtMoney(q.total)}`,
        files: [file],
      };
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

      if (navigator.share && (!nav.canShare || nav.canShare(shareData))) {
        await navigator.share(shareData);
        toast.success('Elegí WhatsApp para enviar la cotización', { id: toastId });
        return;
      }

      downloadBlob(blob, filename);
      toast.error('Este navegador no permite compartir PDFs. Te lo descargué para adjuntarlo a mano.', { id: toastId });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        toast.dismiss(toastId);
        return;
      }
      toast.error(e instanceof Error ? e.message : 'No se pudo compartir el PDF', { id: toastId });
    } finally {
      setPdfLoadingId(null);
    }
  };

  const deleteQuotation = (q: Quotation) => {
    setConfirmModal({
      title: 'Eliminar cotización',
      message: `¿Eliminar la cotización N° ${q.number} de ${quotationClientName(q)}?`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await api.delete(`/quotations/${q.id}`);
          toast.success('Cotización eliminada');
          await loadQuotations();
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, 'Error al eliminar la cotización'));
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

  const renderActions = (q: Quotation) => (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => downloadPdf(q)} disabled={pdfLoadingId === q.id} title="Descargar PDF">
        <Download size={13} />
        {isMobile && ' PDF'}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => sharePdf(q)} disabled={pdfLoadingId === q.id} title="Compartir (WhatsApp)">
        <Send size={13} />
        {isMobile && ' Enviar'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)} title="Editar">
        <Edit2 size={13} />
      </button>
      <button className="btn btn-danger btn-sm" onClick={() => deleteQuotation(q)} title="Eliminar">
        <Trash2 size={13} />
      </button>
    </>
  );

  return (
    <AppLayout title="Cotizaciones s/stock" subtitle="Presupuestos que no reservan ni descuentan stock">
      <button
        className="btn btn-primary btn-sm"
        onClick={openCreate}
        style={{ marginBottom: 14, width: isMobile ? '100%' : undefined, justifyContent: 'center' }}
      >
        <Plus size={14} />
        Nueva cotización
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 10 : 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{quotations.length}</div>
          <div className="stat-label">Cotizaciones</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Vigentes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: isMobile ? 15 : undefined }}>{fmtMoney(totalQuoted)}</div>
          <div className="stat-label">Total cotizado</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 18,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, teléfono o producto..."
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => loadQuotations(true)}
          disabled={loading}
          style={{ width: isMobile ? '100%' : undefined, justifyContent: 'center' }}
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
              {filtered.map((q) => (
                <article
                  key={q.id}
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
                      <b style={{ fontSize: 14 }}>N° {q.number} · {quotationClientName(q)}</b>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(q.createdAt)}</div>
                    </div>
                    <span className={`badge ${isExpired(q) ? 'badge-gray' : 'badge-green'}`}>
                      {isExpired(q) ? 'VENCIDA' : 'VIGENTE'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {q.items.length} ítem(s) · {q.priceType === 'wholesalePrice' ? 'Mayorista' : 'Minorista'}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 16 }}>{fmtMoney(q.total)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
                    {renderActions(q)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Vence</th>
                  <th>Ítems</th>
                  <th>Lista</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{q.number}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{quotationClientName(q)}</div>
                      {q.clientPhone && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{q.clientPhone}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(q.createdAt)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{q.expiresAt ? fmtDate(q.expiresAt) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }} title={q.items.map((i) => `${qtyLabel(i.quantity, i.saleUnit)} × ${i.productNameSnapshot}`).join('\n')}>
                      {q.items.length}
                    </td>
                    <td style={{ fontSize: 12 }}>{q.priceType === 'wholesalePrice' ? 'Mayorista' : 'Minorista'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{fmtMoney(q.total)}</td>
                    <td>
                      <span className={`badge ${isExpired(q) ? 'badge-gray' : 'badge-green'}`}>
                        {isExpired(q) ? 'VENCIDA' : 'VIGENTE'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>{renderActions(q)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state" style={{ padding: isMobile ? '48px 16px' : undefined }}>
              <FileText size={36} />
              <p>Sin cotizaciones</p>
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
                width: isMobile ? 'calc(100vw - 24px)' : 820,
                maxWidth: isMobile ? 'calc(100vw - 24px)' : 820,
                maxHeight: isMobile ? 'calc(100vh - 24px)' : '90vh',
                overflowY: 'auto',
              }}
            >
              <div className="modal-header">
                <b>{modal === 'create' ? 'Nueva cotización' : `Editar cotización N° ${editing?.number ?? ''}`}</b>
                <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--surface2)',
                    fontSize: 12,
                    color: 'var(--text2)',
                    marginBottom: 14,
                  }}
                >
                  <PackageOpen size={14} />
                  Esta cotización no reserva ni descuenta stock.
                </div>

                <div className="form-group">
                  <label className="form-label">Cliente registrado</label>
                  <select value={form.clientId} onChange={(e) => selectClient(e.target.value)}>
                    <option value="">— Sin cliente registrado (cargar datos a mano) —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {clientName(c)}{c.dni ? ` · ${c.dni}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre del cliente</label>
                    <input
                      value={form.clientName}
                      onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                      placeholder="Consumidor final"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      value={form.clientPhone}
                      onChange={(e) => setForm((p) => ({ ...p, clientPhone: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">DNI / CUIT</label>
                    <input
                      value={form.clientDoc}
                      onChange={(e) => setForm((p) => ({ ...p, clientDoc: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección</label>
                    <input
                      value={form.clientAddress}
                      onChange={(e) => setForm((p) => ({ ...p, clientAddress: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Lista de precios</label>
                    <select value={form.priceType} onChange={(e) => changePriceType(e.target.value as QuotationPriceType)}>
                      <option value="price">Minorista</option>
                      <option value="wholesalePrice">Mayorista</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Válida hasta</label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Agregar producto</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
                      />
                      <input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU..."
                        style={{ paddingLeft: 34, width: '100%' }}
                      />
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={addFreeItem} title="Agregar ítem libre (sin producto del catálogo)">
                      <Plus size={13} /> Ítem libre
                    </button>
                  </div>

                  {productResults.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'var(--surface)',
                        overflow: 'hidden',
                      }}
                    >
                      {productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          style={{
                            display: 'flex',
                            width: '100%',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            borderBottom: '1px solid var(--border)',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: 13,
                          }}
                        >
                          <span>
                            {p.name}
                            {p.sku && <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {p.sku}</span>}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                            {fmtMoney(productPrice(p, form.priceType))}{p.saleUnit === 'KG' ? '/kg' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {form.items.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                    {form.items.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr 1fr' : 'minmax(0, 1fr) 130px 130px 110px auto',
                          gap: 8,
                          alignItems: 'center',
                          padding: 10,
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                        }}
                      >
                        <div style={{ gridColumn: isMobile ? '1 / -1' : undefined, minWidth: 0 }}>
                          {item.productId ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                              {item.sku && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.sku}</div>}
                            </>
                          ) : (
                            <input
                              value={item.name}
                              onChange={(e) => updateItem(item.key, { name: e.target.value })}
                              placeholder="Descripción del ítem"
                              style={{ width: '100%' }}
                            />
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {item.saleUnit !== 'KG' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updateItem(item.key, { quantity: String(Math.max(1, num(item.quantity) - 1)) })}
                            >
                              <Minus size={12} />
                            </button>
                          )}
                          <input
                            type="number"
                            min={0}
                            step={item.saleUnit === 'KG' ? 0.001 : 1}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                            style={{ width: '100%', textAlign: 'center' }}
                            title={item.saleUnit === 'KG' ? 'Kilos' : 'Cantidad'}
                          />
                          {item.saleUnit !== 'KG' ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updateItem(item.key, { quantity: String(num(item.quantity) + 1) })}
                            >
                              <Plus size={12} />
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>kg</span>
                          )}
                        </div>

                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateItem(item.key, { price: e.target.value })}
                          placeholder="Precio"
                          title="Precio unitario"
                        />

                        <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, textAlign: 'right' }}>
                          {fmtMoney(num(item.quantity) * num(item.price))}
                        </div>

                        <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.key)} title="Quitar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
                    Todavía no agregaste productos.
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Descuento</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DiscountType | '' }))}
                    >
                      <option value="">Sin descuento</option>
                      <option value="PERCENTAGE">Porcentaje (%)</option>
                      <option value="FIXED">Monto fijo ($)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Valor del descuento</label>
                    <input
                      type="number"
                      min={0}
                      value={form.discountValue}
                      onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                      disabled={!form.discountType}
                      placeholder={form.discountType === 'PERCENTAGE' ? 'Ej: 10' : 'Ej: 5000'}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas internas</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Opcional (no se imprime en el PDF)"
                    rows={2}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 4,
                    justifyItems: 'end',
                    padding: '10px 4px 0',
                    borderTop: '1px solid var(--border)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--text2)' }}>Subtotal: <b>{fmtMoney(totals.subtotal)}</b></span>
                  {totals.discount > 0 && (
                    <span style={{ color: 'var(--text2)' }}>Descuento: <b>- {fmtMoney(totals.discount)}</b></span>
                  )}
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)' }}>
                    Total: {fmtMoney(totals.total)}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button className="btn btn-secondary" onClick={closeModal} disabled={saving} style={{ width: isMobile ? '100%' : undefined }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={saveQuotation} disabled={saving} style={{ width: isMobile ? '100%' : undefined }}>
                  {saving ? <span className="spinner" /> : 'Guardar cotización'}
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
                      background: 'rgba(239,68,68,0.12)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                  </span>
                  <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>{confirmModal.message}</p>
                </div>
              </div>

              <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading} style={{ width: isMobile ? '100%' : undefined }}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={confirmAction} disabled={confirmLoading} style={{ width: isMobile ? '100%' : undefined }}>
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
