/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { PaymentMethod, Sale } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import { remitoApi, type Remito } from '@/service/remito.service';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Search,
  Send,
  Truck,
  X,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 10;

const badge = (s: string) =>
  s === 'COMPLETED' ? 'badge-green' : s === 'PENDING' ? 'badge-yellow' : 'badge-red';

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

type CreditNoteModalState = {
  sale: Sale;
  motivo: string;
  importe: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type PaymentView = {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
  notes?: string | null;
};

type ProductView = {
  name?: string | null;
};

type SaleItemView = {
  id?: string;
  productNameSnapshot?: string | null;
  product?: ProductView | null;
  quantity?: number | null;
  quantityKg?: number | null;
  price: number;
  subtotal?: number | null;
};

type InvoiceAfipView = {
  id?: string;
  tipoComprobante?: number | null;
  relatedInvoiceId?: string | null;
  creditNotes?: CreditNoteView[];
  creditNote?: CreditNoteView | null;
  relatedCreditNotes?: CreditNoteView[];
};

type CreditNoteView = {
  id?: string;
  saleId?: string;
  sale?: {
    id?: string;
  } | null;
};

type SaleExtra = Sale & {
  invoiceStatus?: string | null;
  isInvoiced?: boolean | null;
  isNoteCredit?: boolean | null;
  hasCreditNote?: boolean | null;
  receiptType?: 'TICKET' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA DE CREDITO' | 'NOTA DE CRÉDITO' | string | null;
  invoiceAfip?: InvoiceAfipView | null;
  invoiceAfipId?: string | null;
  invoice?: InvoiceAfipView | null;
  factura?: InvoiceAfipView | null;
  creditNoteAfip?: CreditNoteView | null;
  creditNote?: CreditNoteView | null;
  creditNotes?: CreditNoteView[];
  remitos?: Remito[];
  remito?: Remito | null;
  transportName?: string | null;
  transportCuit?: string | null;
  packagesCount?: number | null;
  declaredValue?: number | null;
  quotationExpiresAt?: string | null;
  payments?: PaymentView[];
  items?: SaleItemView[];
  client?: (NonNullable<Sale['client']> & {
    dni?: string | null;
    category?: string | null;
  }) | null;
};

type AfipInvoiceResponse = {
  invoiceStatus?: string;
  cae?: string;
  factura?: {
    cae?: string;
  };
  content?: {
    cae?: string;
  };
  invoice?: {
    cae?: string;
  };
};

type CreditNoteResponse = {
  message?: string;
  notaCredito?: {
    cae?: string;
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    (error as { message?: string })?.message ??
    fallback
  );
}

async function getBlobErrorMessage(error: unknown, fallback: string) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (responseData instanceof Blob) {
    const text = await responseData.text();

    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      return parsed.message || parsed.error || fallback;
    } catch {
      return text || fallback;
    }
  }

  return getErrorMessage(error, fallback);
}

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
  const s = sale as SaleExtra;

  if (s.invoiceStatus) return s.invoiceStatus;
  if (s.isInvoiced) return 'INVOICED';

  return 'NONE';
}

function isSaleInvoiced(sale: Sale) {
  const s = sale as SaleExtra;
  return Boolean(s.isInvoiced) || s.invoiceStatus === 'INVOICED';
}

function isCreditNoteSale(sale: Sale) {
  const saleExtra = sale as SaleExtra;
  const receiptType = String(saleExtra.receiptType ?? '');

  return Boolean(
    saleExtra.isNoteCredit ||
      receiptType === 'NOTA_CREDITO' ||
      receiptType === 'NOTA DE CREDITO' ||
      receiptType === 'NOTA DE CRÉDITO' ||
      saleExtra.invoiceAfip?.relatedInvoiceId ||
      [3, 8, 13].includes(Number(saleExtra.invoiceAfip?.tipoComprobante))
  );
}

function hasCreditNote(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  return Boolean(
    saleExtra.hasCreditNote ||
      saleExtra.creditNoteAfip ||
      saleExtra.creditNote ||
      (saleExtra.creditNotes?.length ?? 0) > 0 ||
      (saleExtra.invoiceAfip?.creditNotes?.length ?? 0) > 0 ||
      saleExtra.invoiceAfip?.creditNote ||
      (saleExtra.invoiceAfip?.relatedCreditNotes?.length ?? 0) > 0
  );
}

function canEmitCreditNote(sale: Sale) {
  return (
    isSaleInvoiced(sale) &&
    sale.status !== 'CANCELLED' &&
    !isCreditNoteSale(sale) &&
    !hasCreditNote(sale)
  );
}

function getCreditNoteSaleId(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (isCreditNoteSale(sale)) {
    return sale.id;
  }

  const firstCreditNote =
    saleExtra.invoiceAfip?.creditNotes?.[0] ||
    saleExtra.creditNotes?.[0] ||
    saleExtra.creditNoteAfip ||
    saleExtra.creditNote ||
    saleExtra.invoiceAfip?.creditNote ||
    saleExtra.invoiceAfip?.relatedCreditNotes?.[0];

  return firstCreditNote?.saleId || firstCreditNote?.sale?.id || firstCreditNote?.id || null;
}

function canDownloadCreditNote(sale: Sale) {
  return Boolean(isCreditNoteSale(sale) || getCreditNoteSaleId(sale));
}

function getSaleRemitos(sale: Sale): Remito[] {
  const saleExtra = sale as SaleExtra;

  if (Array.isArray(saleExtra.remitos)) {
    return saleExtra.remitos.filter((r) => r.status !== 'CANCELLED');
  }

  if (saleExtra.remito && saleExtra.remito.status !== 'CANCELLED') {
    return [saleExtra.remito];
  }

  return [];
}

function hasRemito(sale: Sale) {
  return getSaleRemitos(sale).length > 0;
}

function canEmitRemito(sale: Sale) {
  return sale.status === 'COMPLETED' || isSaleInvoiced(sale);
}

function defaultInvoiceTypeForSale(sale: Sale): InvoiceType {
  const client = (sale as SaleExtra).client;

  if (!client) return 11;

  const category = String(client.category ?? '').toLowerCase();

  if (category.includes('mayorista') || category.includes('cliente')) {
    return 6;
  }

  return 11;
}

function getSaleProductsForAfip(sale: Sale) {
  const items = (sale as SaleExtra).items ?? [];

  return items.map((item) => {
    const quantityKg =
      item.quantityKg !== null && item.quantityKg !== undefined ? num(item.quantityKg) : undefined;

    const quantity = quantityKg !== undefined && quantityKg > 0 ? quantityKg : num(item.quantity || 1);
    const price = num(item.price);

    return {
      name: item.productNameSnapshot || item.product?.name || 'Producto',
      quantity,
      quantityKg,
      price,
      subtotal:
        item.subtotal !== undefined && item.subtotal !== null ? num(item.subtotal) : quantity * price,
    };
  });
}

function getSalePaymentLabel(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (saleExtra.payments?.length) {
    return saleExtra.payments
      .map((p) => `${p.method}: ${fmtMoney(num(p.amount))}`)
      .join(' | ');
  }

  return sale.paymentMethod;
}

function getQuotationExpirationLabel(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (!saleExtra.quotationExpiresAt) return null;

  return fmtDate(String(saleExtra.quotationExpiresAt));
}

async function fetchSales() {
  const r = await api.get('/sales');
  return normalizeArray<Sale>(r.data);
}

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [payEdit, setPayEdit] = useState<Sale | null>(null);
  const [mobileActionsSale, setMobileActionsSale] = useState<Sale | null>(null);
  const [mounted, setMounted] = useState(false);

  const [payments, setPayments] = useState<PaymentView[]>([]);

  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState | null>(null);
  const [creditNoteModal, setCreditNoteModal] = useState<CreditNoteModalState | null>(null);
  const [quotationModal, setQuotationModal] = useState<Sale | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [creditNoteLoadingId, setCreditNoteLoadingId] = useState<string | null>(null);
  const [quotationLoadingId, setQuotationLoadingId] = useState<string | null>(null);
  const [printingTicketId, setPrintingTicketId] = useState<string | null>(null);

  const [remitoLoadingId, setRemitoLoadingId] = useState<string | null>(null);
  const [openingRemitoId, setOpeningRemitoId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchSales();
      setSales(data);

      if (showSuccess) {
        toast.success('Ventas actualizadas');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchSales()
      .then((data) => {
        if (!alive) return;
        setSales(data);
      })
      .catch((error) => {
        console.error(error);

        if (!alive) return;
        toast.error('Error al cargar ventas');
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
    const cleanSearch = search.trim().toLowerCase();

    return sales.filter(
      (s) =>
        (!status || s.status === status) &&
        (!cleanSearch ||
          s.id.toLowerCase().includes(cleanSearch) ||
          clientName(s.client).toLowerCase().includes(cleanSearch))
    );
  }, [sales, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const total = sales
    .filter((s) => s.status !== 'CANCELLED')
    .reduce((a, s) => a + num(s.total), 0);

  const debt = sales.reduce((a, s) => a + num(s.accountDebtAmount), 0);

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

  const setSaleStatus = async (s: Sale, next: Sale['status']) => {
    if (next === 'CANCELLED') {
      setConfirmModal({
        title: 'Cancelar venta',
        message: `¿Cancelar venta #${s.id.slice(-8)} y revertir stock/deuda?`,
        confirmText: 'Cancelar venta',
        danger: true,
        onConfirm: async () => {
          const toastId = toast.loading('Cancelando venta...');

          try {
            await api.patch(`/sales/${s.id}/status`, { status: next });
            await load();
            toast.success('Venta cancelada correctamente', { id: toastId });
          } catch (error) {
            toast.error(getErrorMessage(error, 'No se pudo cancelar la venta'), { id: toastId });
          }
        },
      });

      return;
    }

    const toastId = toast.loading('Actualizando venta...');

    try {
      await api.patch(`/sales/${s.id}/status`, { status: next });
      await load();
      toast.success('Venta actualizada correctamente', { id: toastId });
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo actualizar la venta'), { id: toastId });
    }
  };

  const printTicket = async (sale: Sale) => {
    try {
      setPrintingTicketId(sale.id);

      const toastId = toast.loading('Enviando ticket a impresión...');
      await api.post(`/tickets/sale/${sale.id}/print`);
      toast.success('Ticket enviado a impresión', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo imprimir el ticket'));
    } finally {
      setPrintingTicketId(null);
    }
  };

  const createRemito = async (sale: Sale) => {
    if (!canEmitRemito(sale)) {
      toast.error('El remito solo se puede emitir si la venta está completada o facturada');
      return;
    }

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede emitir remito de una venta cancelada');
      return;
    }

    setConfirmModal({
      title: 'Generar remito',
      message:
        `¿Generar remito para la venta #${sale.id.slice(-8)}?\n\n` +
        `Cliente: ${clientName(sale.client)}\n` +
        `Total declarado: ${fmtMoney(num(sale.total))}`,
      confirmText: 'Generar remito',
      danger: false,
      onConfirm: async () => {
        const saleExtra = sale as SaleExtra;
        const toastId = toast.loading('Generando remito...');

        try {
          setRemitoLoadingId(sale.id);

          const remito = await remitoApi.createFromSale(sale.id, {
            placeOfIssue: 'VILLA GENERAL BELGRANO',
            saleCondition: getSalePaymentLabel(sale),
            transportName: saleExtra.transportName || '',
            transportCuit: saleExtra.transportCuit || '',
            packagesCount: saleExtra.packagesCount ?? 1,
            declaredValue: saleExtra.declaredValue ?? sale.total,
            observations: 'Remito generado desde venta',
          });

          await load();

          toast.success(`Remito generado correctamente: ${remito.fullNumber}`, { id: toastId });
        } catch (error: unknown) {
          toast.error(getErrorMessage(error, 'No se pudo generar el remito'), { id: toastId });
        } finally {
          setRemitoLoadingId(null);
        }
      },
    });
  };

  const openRemitoPdf = async (sale: Sale) => {
    try {
      setOpeningRemitoId(sale.id);

      const localRemitos = getSaleRemitos(sale);
      const localRemito = localRemitos.find((r) => r.status !== 'CANCELLED');

      if (localRemito?.id) {
        await remitoApi.downloadPdf(localRemito.id);
        toast.success('Descargando remito');
        return;
      }

      const remitos = await remitoApi.getBySaleId(sale.id);
      const remito = remitos.find((r) => r.status !== 'CANCELLED');

      if (!remito) {
        toast.error('Esta venta todavía no tiene remito emitido');
        return;
      }

      await remitoApi.downloadPdf(remito.id);
      toast.success('Descargando remito');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo descargar el remito'));
    } finally {
      setOpeningRemitoId(null);
    }
  };

  const getQuotationPdfBlob = async (sale: Sale) => {
    const response = await api.get(`/sales/${sale.id}/cotizacion-pdf`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] ?? '');

    if (!contentType.includes('application/pdf')) {
      const errorText = await response.data.text();

      try {
        const parsed = JSON.parse(errorText) as { message?: string; error?: string };
        throw new Error(parsed.message || parsed.error || 'El backend no devolvió un PDF');
      } catch {
        throw new Error(errorText || 'El backend no devolvió un PDF válido');
      }
    }

    return new Blob([response.data], {
      type: 'application/pdf',
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadQuotation = async (sale: Sale) => {
    if (sale.status !== 'PENDING') {
      toast.error('Solo se puede descargar cotización de una venta pendiente');
      return;
    }

    try {
      setQuotationLoadingId(sale.id);

      const toastId = toast.loading('Generando cotización...');

      const blob = await getQuotationPdfBlob(sale);

      downloadBlob(blob, `cotizacion-${sale.id}.pdf`);

      setQuotationModal(null);
      await load();
      toast.success('Cotización descargada', { id: toastId });
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo descargar la cotización.');
      toast.error(message);
    } finally {
      setQuotationLoadingId(null);
    }
  };

  const shareQuotationPdfWhatsapp = async (sale: Sale) => {
    if (sale.status !== 'PENDING') {
      toast.error('Solo se puede enviar cotización de una venta pendiente');
      return;
    }

    try {
      setQuotationLoadingId(sale.id);

      const toastId = toast.loading('Generando cotización para WhatsApp...');

      const blob = await getQuotationPdfBlob(sale);
      const filename = `cotizacion-${sale.id.slice(-8)}.pdf`;
      const file = new File([blob], filename, {
        type: 'application/pdf',
      });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      const shareData: ShareData = {
        title: `Cotización #${sale.id.slice(-8)}`,
        text: `Hola, te envío la cotización en PDF de Grupo VJ. Total: ${fmtMoney(sale.total)}`,
        files: [file],
      };

      if (navigator.share && (!nav.canShare || nav.canShare(shareData))) {
        await navigator.share(shareData);

        setQuotationModal(null);
        await load();

        toast.success('Elegí WhatsApp para enviar la cotización PDF', { id: toastId });
        return;
      }

      downloadBlob(blob, filename);

      toast.error(
        'Este navegador no permite enviar PDFs directo por WhatsApp. Te descargué el PDF para adjuntarlo manualmente.',
        { id: toastId }
      );
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo compartir la cotización PDF.');
      toast.error(message);
    } finally {
      setQuotationLoadingId(null);
    }
  };

  const openPayments = (s: Sale) => {
    const saleExtra = s as SaleExtra;

    setPayEdit(s);

    setPayments(
      (saleExtra.payments?.length
        ? saleExtra.payments
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

    const toastId = toast.loading('Guardando pagos...');

    try {
      await api.patch(`/sales/${payEdit.id}/payments`, {
        setAsPrimary: true,
        payments,
      });

      setPayEdit(null);
      await load();

      toast.success('Pagos actualizados correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudieron guardar los pagos'), { id: toastId });
    }
  };

  const openInvoiceModal = (sale: Sale) => {
    const saleExtra = sale as SaleExtra;
    const clientDoc = saleExtra.client?.dni || '';

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

    const cleanDoc = onlyNumbers(receiverDoc);
    const detectedDoc = detectDocType(receiverDoc);

    const isConsumidorFinal = !cleanDoc || cleanDoc === '0' || condicionIVAReceptor === 5;

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede facturar una venta cancelada');
      return;
    }

    if (isSaleInvoiced(sale)) {
      toast.error('Esta venta ya está facturada');
      return;
    }

    if (tipoComprobante === 1) {
      if (!detectedDoc || detectedDoc.tipoDoc !== 80 || String(detectedDoc.nroDoc).length !== 11) {
        toast.error('Para Factura A tenés que cargar CUIT del receptor');
        return;
      }
    }

    if ((tipoComprobante === 6 || tipoComprobante === 11) && !isConsumidorFinal && !detectedDoc) {
      toast.error('El documento del receptor no es válido. Podés dejarlo vacío para Consumidor Final');
      return;
    }

    const payload = {
      saleId: sale.id,
      tipoComprobante,

      tipoDoc:
        tipoComprobante === 1 ? 80 : isConsumidorFinal ? 99 : detectedDoc?.tipoDoc ?? 99,

      nroDoc:
        tipoComprobante === 1
          ? detectedDoc?.nroDoc
          : isConsumidorFinal
            ? 0
            : detectedDoc?.nroDoc ?? 0,

      importe: num(sale.total),

      condicionIVAReceptor: isConsumidorFinal ? 5 : condicionIVAReceptor,

      products: getSaleProductsForAfip(sale),
      metodoPago: getSalePaymentLabel(sale),
    };

    const toastId = toast.loading('Facturando en ARCA...');

    try {
      setInvoicingId(sale.id);

      const response = await api.post('/afip/facturar', payload);

      const data = response.data as AfipInvoiceResponse;
      const factura = data?.factura || data?.content || data?.invoice;

      setInvoiceModal(null);
      await load();

      if (data?.invoiceStatus === 'PENDING_AFIP') {
        toast.error('ARCA no respondió correctamente. La factura quedó pendiente para reintento automático.', {
          id: toastId,
        });
        return;
      }

      if (factura?.cae) {
        toast.success(`Factura generada correctamente. CAE: ${factura.cae}`, { id: toastId });
        return;
      }

      if (data?.cae) {
        toast.success(`Factura generada correctamente. CAE: ${data.cae}`, { id: toastId });
        return;
      }

      toast.success('Factura generada correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo facturar la venta'), { id: toastId });
    } finally {
      setInvoicingId(null);
    }
  };

  const getFacturaOriginalId = async (sale: Sale) => {
    const saleExtra = sale as SaleExtra;

    const localId =
      saleExtra.invoiceAfip?.id ||
      saleExtra.invoiceAfipId ||
      saleExtra.invoice?.id ||
      saleExtra.factura?.id;

    if (localId) return localId;

    const response = await api.get(`/afip/factura-by-sale/${sale.id}`);

    return response.data?.id as string | undefined;
  };

  const openCreditNoteModal = (sale: Sale) => {
    if (!isSaleInvoiced(sale)) {
      toast.error('La venta tiene que estar facturada para emitir una nota de crédito');
      return;
    }

    if (isCreditNoteSale(sale)) {
      toast.error('No se puede emitir una nota de crédito sobre otra nota de crédito');
      return;
    }

    if (hasCreditNote(sale)) {
      toast.error('Esta factura ya tiene una nota de crédito emitida');
      return;
    }

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede generar nota de crédito sobre una venta cancelada');
      return;
    }

    setCreditNoteModal({
      sale,
      motivo: 'Devolución de productos',
      importe: String(num(sale.total)),
    });
  };

  const submitCreditNote = async () => {
    if (!creditNoteModal) return;

    const { sale, motivo, importe } = creditNoteModal;

    const importeNumber = num(importe);

    if (!motivo.trim()) {
      toast.error('Tenés que indicar un motivo');
      return;
    }

    if (importeNumber <= 0) {
      toast.error('El importe tiene que ser mayor a 0');
      return;
    }

    if (importeNumber > num(sale.total)) {
      setConfirmModal({
        title: 'Confirmar importe',
        message:
          'El importe de la nota de crédito es mayor al total de la venta. ¿Querés continuar igual?',
        confirmText: 'Continuar',
        danger: true,
        onConfirm: submitCreditNoteConfirmed,
      });

      return;
    }

    await submitCreditNoteConfirmed();
  };

  const submitCreditNoteConfirmed = async () => {
    if (!creditNoteModal) return;

    const { sale, motivo, importe } = creditNoteModal;
    const importeNumber = num(importe);

    const toastId = toast.loading('Emitiendo nota de crédito...');

    try {
      setCreditNoteLoadingId(sale.id);

      const facturaOriginalId = await getFacturaOriginalId(sale);

      if (!facturaOriginalId) {
        toast.error('No encontré la factura original de esta venta', { id: toastId });
        return;
      }

      const response = await api.post('/afip/nota-credito', {
        saleId: sale.id,
        facturaOriginalId,
        motivo: motivo.trim(),
        importe: importeNumber,
      });

      setCreditNoteModal(null);
      await load();

      const data = response.data as CreditNoteResponse;
      const notaCredito = data?.notaCredito;

      if (notaCredito?.cae) {
        toast.success(`Nota de crédito emitida correctamente. CAE: ${notaCredito.cae}`, {
          id: toastId,
        });
        return;
      }

      toast.success(data?.message || 'Nota de crédito emitida correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo emitir la nota de crédito'), { id: toastId });
    } finally {
      setCreditNoteLoadingId(null);
    }
  };

  const openCreditNotePdf = (sale: Sale) => {
    const creditNoteSaleId = getCreditNoteSaleId(sale);

    if (!creditNoteSaleId) {
      toast.error('No encontré la nota de crédito asociada');
      return;
    }

    toast.success('Abriendo nota de crédito');
    window.open(`${API_URL}/nota-credito-pdf/${creditNoteSaleId}/descargar`, '_blank');
  };

  return (
    <AppLayout
      title="Ventas"
      subtitle="Historial, pagos y comprobantes"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={loading}>
          Actualizar
        </button>
      }
    >
      <div
        className="sales-stats-grid"
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

      <div className="sales-filters" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div className="sales-search" style={{ position: 'relative', flex: 1 }}>
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

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <div className="card sales-card">
        <div className="table-wrap sales-desktop-table">
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
                {paginatedSales.map((s) => {
                  const invoiceStatus = getSaleInvoiceStatus(s);
                  const quotationExpirationLabel = getQuotationExpirationLabel(s);
                  const saleIsCreditNote = isCreditNoteSale(s);
                  const saleHasCreditNote = hasCreditNote(s);
                  const saleCanEmitCreditNote = canEmitCreditNote(s);
                  const saleCanDownloadCreditNote = canDownloadCreditNote(s);
                  const saleHasRemito = hasRemito(s);
                  const saleCanEmitRemito = canEmitRemito(s);

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
                          {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge ${badge(s.status)}`}>{s.status}</span>

                          {s.status === 'PENDING' && quotationExpirationLabel && (
                            <small style={{ color: 'var(--text3)' }}>
                              Vence: {quotationExpirationLabel}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                            {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                          </span>

                          {saleIsCreditNote ? (
                            <span className="badge badge-red">NOTA CRÉDITO</span>
                          ) : saleHasCreditNote ? (
                            <span className="badge badge-red">NC EMITIDA</span>
                          ) : null}

                          {saleHasRemito && <span className="badge badge-green">REMITO</span>}
                        </div>
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

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openPayments(s)}
                          >
                            Pagos
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={printingTicketId === s.id}
                            onClick={() => printTicket(s)}
                            title="Imprimir ticket no fiscal"
                          >
                            {printingTicketId === s.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Printer size={13} />
                            )}
                            Ticket
                          </button>

                          {saleCanEmitRemito && !saleHasRemito && s.status !== 'CANCELLED' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={remitoLoadingId === s.id}
                              onClick={() => createRemito(s)}
                              title="Generar remito"
                            >
                              {remitoLoadingId === s.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Truck size={13} />
                              )}
                              Remito
                            </button>
                          )}

                          {saleHasRemito && (
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={openingRemitoId === s.id}
                              onClick={() => openRemitoPdf(s)}
                              title="Descargar remito PDF"
                            >
                              {openingRemitoId === s.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <FileText size={13} />
                              )}
                              Ver remito
                            </button>
                          )}

                          {saleCanEmitRemito && !saleHasRemito && (
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={openingRemitoId === s.id}
                              onClick={() => openRemitoPdf(s)}
                              title="Buscar remito existente"
                            >
                              {openingRemitoId === s.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <FileText size={13} />
                              )}
                              Ver remito
                            </button>
                          )}

                          {s.status === 'PENDING' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={quotationLoadingId === s.id}
                              onClick={() => setQuotationModal(s)}
                              title="Cotización PDF"
                            >
                              {quotationLoadingId === s.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <FileText size={13} />
                              )}
                              Cotización
                            </button>
                          )}

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

                          {isSaleInvoiced(s) && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  toast.success('Abriendo factura');
                                  window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank');
                                }}
                                title="Descargar factura PDF"
                              >
                                <FileText size={13} />
                                Factura
                              </button>

                              {saleCanDownloadCreditNote && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openCreditNotePdf(s)}
                                  title="Descargar nota de crédito PDF"
                                >
                                  <FileText size={13} />
                                  NC PDF
                                </button>
                              )}

                              {saleCanEmitCreditNote && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={creditNoteLoadingId === s.id}
                                  onClick={() => openCreditNoteModal(s)}
                                  title="Emitir nota de crédito en ARCA"
                                >
                                  {creditNoteLoadingId === s.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <ReceiptText size={13} />
                                  )}
                                  Nota crédito
                                </button>
                              )}
                            </>
                          )}
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

        <div className="sales-mobile-list">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            paginatedSales.map((s) => {
              const invoiceStatus = getSaleInvoiceStatus(s);
              const quotationExpirationLabel = getQuotationExpirationLabel(s);
              const saleIsCreditNote = isCreditNoteSale(s);
              const saleHasCreditNote = hasCreditNote(s);
              const saleCanEmitCreditNote = canEmitCreditNote(s);
              const saleCanDownloadCreditNote = canDownloadCreditNote(s);
              const saleHasRemito = hasRemito(s);
              const saleCanEmitRemito = canEmitRemito(s);

              return (
                <article
                  key={`${s.id}-mobile`}
                  className="sales-mobile-item"
                  onClick={() => setDetail(s)}
                >
                  <div className="sales-mobile-head">
                    <div>
                      <span className="sales-mobile-id">#{s.id.slice(-8)}</span>
                      <h3>{clientName(s.client)}</h3>
                      <p>{fmtDate(s.createdAt)}</p>
                    </div>

                    <span className={`badge ${badge(s.status)}`}>{s.status}</span>
                  </div>

                  <div className="sales-mobile-badges">
                    <span className="badge badge-gray">
                      {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
                    </span>

                    <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                      {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                    </span>

                    {saleIsCreditNote ? (
                      <span className="badge badge-red">NOTA CRÉDITO</span>
                    ) : saleHasCreditNote ? (
                      <span className="badge badge-red">NC EMITIDA</span>
                    ) : null}

                    {saleHasRemito && <span className="badge badge-green">REMITO</span>}

                    {s.status === 'PENDING' && quotationExpirationLabel && (
                      <span className="badge badge-yellow">Vence {quotationExpirationLabel}</span>
                    )}
                  </div>

                  <div className="sales-mobile-data">
                    <div>
                      <small>Total</small>
                      <strong className="sales-accent">{fmtMoney(s.total)}</strong>
                    </div>

                    <div>
                      <small>Deuda</small>
                      <strong>{num(s.accountDebtAmount) > 0 ? fmtMoney(s.accountDebtAmount ?? 0) : '—'}</strong>
                    </div>
                  </div>

                  <div className="sales-mobile-actions" onClick={(e) => e.stopPropagation()}>
                    {s.status === 'PENDING' && (
                      <button
                        className="btn btn-primary btn-sm sales-mobile-main-action"
                        onClick={() => setSaleStatus(s, 'COMPLETED')}
                      >
                        <Check size={14} />
                        Confirmar
                      </button>
                    )}

                    {!isSaleInvoiced(s) && s.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-primary btn-sm sales-mobile-main-action"
                        disabled={invoicingId === s.id}
                        onClick={() => openInvoiceModal(s)}
                      >
                        {invoicingId === s.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ReceiptText size={14} />
                        )}
                        Facturar
                      </button>
                    )}

                    {isSaleInvoiced(s) && (
                      <button
                        className="btn btn-ghost btn-sm sales-mobile-main-action"
                        onClick={() => {
                          toast.success('Abriendo factura');
                          window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank');
                        }}
                      >
                        <FileText size={14} />
                        Factura
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm sales-mobile-more-action"
                      onClick={() => setMobileActionsSale(s)}
                    >
                      <MoreHorizontal size={15} />
                      Más acciones
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin ventas</p>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="sales-pagination">
            <div className="sales-pagination-info">
              Mostrando {pageStart} - {pageEnd} de {filtered.length} ventas
            </div>

            <div className="sales-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span className="sales-pagination-page">
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>


      {mounted &&
        mobileActionsSale &&
        createPortal(
          (() => {
          const s = mobileActionsSale;
          const invoiceStatus = getSaleInvoiceStatus(s);
          const quotationExpirationLabel = getQuotationExpirationLabel(s);
          const saleIsCreditNote = isCreditNoteSale(s);
          const saleHasCreditNote = hasCreditNote(s);
          const saleCanEmitCreditNote = canEmitCreditNote(s);
          const saleCanDownloadCreditNote = canDownloadCreditNote(s);
          const saleHasRemito = hasRemito(s);
          const saleCanEmitRemito = canEmitRemito(s);

          return (
            <div
              className="modal-overlay sales-mobile-actions-overlay"
              onClick={(e) => e.target === e.currentTarget && setMobileActionsSale(null)}
            >
              <div className="modal sales-actions-sheet" role="dialog" aria-modal="true">
                <div className="sales-actions-grabber" />

                <div className="modal-header sales-actions-header">
                  <div>
                    <small>Acciones de venta</small>
                    <b>#{s.id.slice(-8)} · {clientName(s.client)}</b>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMobileActionsSale(null)}
                    aria-label="Cerrar acciones"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body sales-actions-body">
                  <div className="sales-actions-summary">
                    <div>
                      <small>Total</small>
                      <b>{fmtMoney(s.total)}</b>
                    </div>

                    <div>
                      <small>Estado</small>
                      <span className={`badge ${badge(s.status)}`}>{s.status}</span>
                    </div>

                    <div>
                      <small>AFIP</small>
                      <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                        {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                      </span>
                    </div>
                  </div>

                  <div className="sales-actions-badges">
                    <span className="badge badge-gray">
                      {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
                    </span>

                    {saleIsCreditNote ? (
                      <span className="badge badge-red">NOTA CRÉDITO</span>
                    ) : saleHasCreditNote ? (
                      <span className="badge badge-red">NC EMITIDA</span>
                    ) : null}

                    {saleHasRemito && <span className="badge badge-green">REMITO</span>}

                    {s.status === 'PENDING' && quotationExpirationLabel && (
                      <span className="badge badge-yellow">Vence {quotationExpirationLabel}</span>
                    )}
                  </div>

                  <div className="sales-actions-list">
                    <button
                      className="sales-action-row"
                      onClick={() => {
                        setDetail(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        <FileText size={17} />
                      </span>
                      <div>
                        <b>Ver detalle</b>
                        <small>Productos, pagos y remitos</small>
                      </div>
                    </button>

                    {s.status === 'PENDING' && (
                      <button
                        className="sales-action-row sales-action-row-primary"
                        onClick={() => {
                          setSaleStatus(s, 'COMPLETED');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <Check size={17} />
                        </span>
                        <div>
                          <b>Confirmar venta</b>
                          <small>Pasar la venta a completada</small>
                        </div>
                      </button>
                    )}

                    {s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row sales-action-row-danger"
                        onClick={() => {
                          setSaleStatus(s, 'CANCELLED');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <X size={17} />
                        </span>
                        <div>
                          <b>Cancelar venta</b>
                          <small>Revertir stock/deuda si corresponde</small>
                        </div>
                      </button>
                    )}

                    <button
                      className="sales-action-row"
                      onClick={() => {
                        openPayments(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        <ReceiptText size={17} />
                      </span>
                      <div>
                        <b>Editar pagos</b>
                        <small>Efectivo, transferencia, tarjeta o mixto</small>
                      </div>
                    </button>

                    <button
                      className="sales-action-row"
                      disabled={printingTicketId === s.id}
                      onClick={() => {
                        printTicket(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        {printingTicketId === s.id ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Printer size={17} />
                        )}
                      </span>
                      <div>
                        <b>Imprimir ticket</b>
                        <small>Enviar ticket no fiscal a impresión</small>
                      </div>
                    </button>

                    {saleCanEmitRemito && !saleHasRemito && s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row"
                        disabled={remitoLoadingId === s.id}
                        onClick={() => {
                          createRemito(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {remitoLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Truck size={17} />
                          )}
                        </span>
                        <div>
                          <b>Generar remito</b>
                          <small>Crear remito desde esta venta</small>
                        </div>
                      </button>
                    )}

                    {(saleHasRemito || saleCanEmitRemito) && (
                      <button
                        className="sales-action-row"
                        disabled={openingRemitoId === s.id}
                        onClick={() => {
                          openRemitoPdf(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {openingRemitoId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <FileText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Ver remito</b>
                          <small>Descargar PDF del remito si existe</small>
                        </div>
                      </button>
                    )}

                    {s.status === 'PENDING' && (
                      <button
                        className="sales-action-row"
                        disabled={quotationLoadingId === s.id}
                        onClick={() => {
                          setQuotationModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {quotationLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <MessageCircle size={17} />
                          )}
                        </span>
                        <div>
                          <b>Cotización</b>
                          <small>Descargar o enviar PDF por WhatsApp</small>
                        </div>
                      </button>
                    )}

                    {!isSaleInvoiced(s) && s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row sales-action-row-primary"
                        disabled={invoicingId === s.id}
                        onClick={() => {
                          openInvoiceModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {invoicingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <ReceiptText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Facturar en ARCA</b>
                          <small>Generar CAE y comprobante fiscal</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && (
                      <button
                        className="sales-action-row"
                        onClick={() => {
                          toast.success('Abriendo factura');
                          window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <FileText size={17} />
                        </span>
                        <div>
                          <b>Ver factura</b>
                          <small>Descargar PDF de factura</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && saleCanDownloadCreditNote && (
                      <button
                        className="sales-action-row"
                        onClick={() => {
                          openCreditNotePdf(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <FileText size={17} />
                        </span>
                        <div>
                          <b>Ver nota de crédito</b>
                          <small>Descargar PDF de NC</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && saleCanEmitCreditNote && (
                      <button
                        className="sales-action-row sales-action-row-danger"
                        disabled={creditNoteLoadingId === s.id}
                        onClick={() => {
                          openCreditNoteModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {creditNoteLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <ReceiptText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Emitir nota de crédito</b>
                          <small>Generar NC vinculada en ARCA</small>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          })(),
          document.body
        )}

      {detail && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="modal sales-detail-modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <b>Venta #{detail.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                className="sales-detail-grid"
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

              {(detail as SaleExtra).quotationExpiresAt && detail.status === 'PENDING' && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <small>Cotización válida hasta</small>
                    <b style={{ display: 'block' }}>
                      {fmtDate((detail as SaleExtra).quotationExpiresAt)}
                    </b>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={quotationLoadingId === detail.id}
                    onClick={() => setQuotationModal(detail)}
                  >
                    {quotationLoadingId === detail.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FileText size={13} />
                    )}
                    Cotización
                  </button>
                </div>
              )}

              <div className="card sales-detail-products-card">
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
                    {(detail as SaleExtra).items?.map((i, index) => (
                      <tr key={i.id ?? `${i.productNameSnapshot ?? 'producto'}-${index}`}>
                        <td>{i.productNameSnapshot ?? i.product?.name ?? 'Producto'}</td>
                        <td>{i.quantityKg ? `${i.quantityKg} kg` : i.quantity}</td>
                        <td>{fmtMoney(i.price)}</td>
                        <td>{fmtMoney(i.subtotal ?? i.price * (i.quantityKg ?? i.quantity ?? 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(detail as SaleExtra).payments?.length ? (
                <div style={{ marginTop: 16 }}>
                  <b>Pagos</b>

                  {(detail as SaleExtra).payments?.map((p, i) => (
                    <div
                      key={`${p.method}-${i}`}
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

              <div style={{ marginTop: 16 }}>
                <b>Remitos</b>

                <div
                  style={{
                    marginTop: 10,
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {hasRemito(detail) ? (
                      <>
                        <small style={{ color: 'var(--text3)' }}>Remito emitido</small>
                        <b style={{ display: 'block' }}>
                          {getSaleRemitos(detail)[0]?.fullNumber || 'Remito generado'}
                        </b>
                      </>
                    ) : (
                      <>
                        <small style={{ color: 'var(--text3)' }}>Estado</small>
                        <b style={{ display: 'block' }}>
                          {canEmitRemito(detail)
                            ? 'Disponible para emitir'
                            : 'La venta debe estar completada o facturada'}
                        </b>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canEmitRemito(detail) && !hasRemito(detail) && detail.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={remitoLoadingId === detail.id}
                        onClick={() => createRemito(detail)}
                      >
                        {remitoLoadingId === detail.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Truck size={13} />
                        )}
                        Generar remito
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={openingRemitoId === detail.id}
                      onClick={() => openRemitoPdf(detail)}
                    >
                      {openingRemitoId === detail.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <FileText size={13} />
                      )}
                      Ver remito
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {quotationModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setQuotationModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <b>Cotización #{quotationModal.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setQuotationModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Elegí qué querés hacer con la cotización PDF de{' '}
                <b>{clientName(quotationModal.client)}</b>.
              </p>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <small style={{ color: 'var(--text3)' }}>Total cotizado</small>
                <b style={{ fontSize: 20, color: 'var(--accent)' }}>
                  {fmtMoney(quotationModal.total)}
                </b>
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
                Para enviar el <b>PDF por WhatsApp</b>, el sistema usa el menú de compartir del
                dispositivo. En celular te debería aparecer WhatsApp como opción. En PC, si el
                navegador no permite compartir archivos, se descarga el PDF para adjuntarlo manualmente.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={quotationLoadingId === quotationModal.id}
                onClick={() => downloadQuotation(quotationModal)}
              >
                {quotationLoadingId === quotationModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Descargar PDF
              </button>

              <button
                className="btn btn-primary"
                disabled={quotationLoadingId === quotationModal.id}
                onClick={() => shareQuotationPdfWhatsapp(quotationModal)}
              >
                {quotationLoadingId === quotationModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                Enviar PDF por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setInvoiceModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 560 }}>
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
                  {invoiceModal.tipoComprobante === 1 ? '(CUIT obligatorio)' : '(opcional)'}
                </label>

                <input
                  value={invoiceModal.receiverDoc}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev ? { ...prev, receiverDoc: e.target.value } : prev
                    )
                  }
                  placeholder={
                    invoiceModal.tipoComprobante === 1
                      ? 'CUIT del receptor'
                      : 'Vacío = Consumidor Final / o cargá DNI, CUIL o CUIT'
                  }
                />

                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  Factura A requiere CUIT. Factura B y C pueden salir como Consumidor Final
                  sin documento. Si cargás documento, debe ser DNI, CUIL o CUIT válido.
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

      {creditNoteModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setCreditNoteModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <b>Emitir nota de crédito</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCreditNoteModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Venta #{creditNoteModal.sale.id.slice(-8)} — Total original:{' '}
                <b>{fmtMoney(creditNoteModal.sale.total)}</b>
              </p>

              <div className="form-group">
                <label className="form-label">Motivo</label>

                <textarea
                  value={creditNoteModal.motivo}
                  onChange={(e) =>
                    setCreditNoteModal((prev) =>
                      prev ? { ...prev, motivo: e.target.value } : prev
                    )
                  }
                  placeholder="Ej: Devolución de productos"
                  style={{
                    minHeight: 90,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Importe a acreditar</label>

                <input
                  type="number"
                  value={creditNoteModal.importe}
                  onChange={(e) =>
                    setCreditNoteModal((prev) =>
                      prev ? { ...prev, importe: e.target.value } : prev
                    )
                  }
                  placeholder="Importe"
                />
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
                Este botón llama a <b>POST /afip/nota-credito</b>. ARCA genera una nota
                de crédito vinculada a la factura original de esta venta.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCreditNoteModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-danger"
                disabled={creditNoteLoadingId === creditNoteModal.sale.id}
                onClick={submitCreditNote}
              >
                {creditNoteLoadingId === creditNoteModal.sale.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Emitir nota de crédito
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
          <div className="modal sales-small-modal">
            <div className="modal-header">
              <b>Editar pagos</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setPayEdit(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
                Total venta: {fmtMoney(payEdit.total)}. Si la suma es menor, la diferencia
                queda en cuenta corriente.
              </p>

              {payments.map((p, idx) => (
                <div
                  key={`${p.method}-${idx}`}
                  className="sales-payment-row"
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

      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 440 }}>
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

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-line' }}>
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

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .sales-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
        }

        .sales-pagination-info {
          color: var(--text3);
          font-size: 12px;
          font-weight: 700;
        }

        .sales-pagination-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sales-pagination-page {
          color: var(--text2);
          font-size: 12px;
          font-weight: 800;
          padding: 0 4px;
        }

        .sales-mobile-list {
          display: none;
        }

        .sales-accent {
          color: var(--accent);
        }

        @media (max-width: 1024px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            align-items: flex-start;
            padding: 12px;
          }

          .modal {
            margin-top: 0;
            max-height: calc(100dvh - 24px);
          }

          .sales-pagination {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: stretch;
            padding: 12px;
          }

          .sales-pagination-info {
            text-align: center;
          }

          .sales-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .sales-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .sales-pagination-page {
            text-align: center;
          }

          .sales-stats-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }

          .sales-filters {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }

          .sales-search {
            width: 100%;
          }

          .sales-search input,
          .sales-filters select {
            width: 100% !important;
          }

          .sales-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .sales-desktop-table {
            display: none;
          }

          .sales-mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .sales-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 12px;
            display: grid;
            gap: 12px;
            min-width: 0;
            cursor: pointer;
          }

          .sales-mobile-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            min-width: 0;
          }

          .sales-mobile-head > div {
            min-width: 0;
            display: grid;
            gap: 4px;
          }

          .sales-mobile-id {
            font-family: var(--mono);
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .sales-mobile-head h3 {
            font-size: 14px;
            line-height: 1.25;
            font-weight: 900;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sales-mobile-head p {
            margin: 0;
            color: var(--text3);
            font-size: 12px;
          }

          .sales-mobile-head > .badge {
            flex-shrink: 0;
          }

          .sales-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
          }

          .sales-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .sales-mobile-data > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
            min-width: 0;
          }

          .sales-mobile-data small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .sales-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .sales-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .sales-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 34px;
          }

          .sales-detail-modal,
          .sales-small-modal {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .sales-detail-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .sales-detail-products-card {
            overflow-x: auto;
          }

          .sales-detail-products-card table {
            min-width: 520px;
          }

          .modal-header {
            gap: 12px;
          }

          .modal-header b {
            font-size: 14px;
            line-height: 1.3;
          }

          .modal-body {
            padding: 14px !important;
          }

          .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .modal-footer button {
            width: 100%;
            justify-content: center;
          }

          .form-row {
            grid-template-columns: 1fr !important;
          }

          .sales-payment-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 10px;
            background: var(--surface2);
          }

          .sales-payment-row button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .sales-mobile-list {
            padding: 10px;
          }

          .sales-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .sales-mobile-head {
            flex-direction: column;
            align-items: stretch;
          }

          .sales-mobile-head h3 {
            white-space: normal;
          }

          .sales-mobile-head > .badge {
            width: fit-content;
          }

          .sales-mobile-data > div {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .sales-mobile-data strong {
            text-align: left;
          }

          .sales-mobile-actions {
            grid-template-columns: 1fr;
          }

          .sales-detail-modal,
          .sales-small-modal {
            width: calc(100vw - 18px) !important;
            max-width: calc(100vw - 18px) !important;
            border-radius: 16px;
          }
        }

        .sales-actions-sheet {
          width: min(520px, calc(100vw - 24px));
          border-radius: 22px;
        }

        .sales-actions-grabber {
          display: none;
        }

        .sales-actions-header {
          align-items: flex-start;
        }

        .sales-actions-header > div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .sales-actions-header small {
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sales-actions-header b {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sales-actions-body {
          display: grid;
          gap: 12px;
        }

        .sales-actions-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .sales-actions-summary > div {
          border: 1px solid var(--border);
          background: var(--surface2);
          border-radius: 14px;
          padding: 10px;
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .sales-actions-summary small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .sales-actions-summary b {
          font-family: var(--mono);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .sales-actions-badges {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .sales-actions-list {
          display: grid;
          gap: 8px;
        }

        .sales-action-row {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          color: var(--text);
          padding: 11px;
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 10px;
          text-align: left;
          align-items: center;
          cursor: pointer;
          transition:
            transform 0.12s ease,
            border-color 0.12s ease,
            background 0.12s ease;
        }

        .sales-action-row:not(:disabled):active {
          transform: scale(0.99);
        }

        .sales-action-row:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sales-action-row > span {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: var(--bg);
          display: grid;
          place-items: center;
          color: var(--text2);
        }

        .sales-action-row div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .sales-action-row b {
          font-size: 13px;
          line-height: 1.2;
        }

        .sales-action-row small {
          color: var(--text3);
          font-size: 11px;
          line-height: 1.25;
        }

        .sales-action-row-primary {
          border-color: rgba(16, 185, 129, 0.28);
        }

        .sales-action-row-primary > span {
          color: var(--accent);
        }

        .sales-action-row-danger {
          border-color: rgba(239, 68, 68, 0.25);
        }

        .sales-action-row-danger > span {
          color: var(--danger);
        }

        @media (max-width: 768px) {
          .sales-mobile-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .sales-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 38px;
            border-radius: 13px;
          }

          .sales-mobile-main-action {
            min-width: 0;
          }

          .sales-mobile-more-action {
            grid-column: 1 / -1;
          }

          .sales-mobile-actions-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .sales-actions-sheet {
            width: 100% !important;
            max-width: 100% !important;
            max-height: min(82dvh, 720px);
            margin: 0;
            border-radius: 24px 24px 0 0;
            animation: salesSheetUp 0.16s ease-out;
          }

          .sales-actions-grabber {
            display: block;
            width: 42px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 0;
            flex-shrink: 0;
          }

          .sales-actions-header {
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--surface);
          }

          .sales-actions-body {
            padding-bottom: calc(16px + env(safe-area-inset-bottom)) !important;
          }
        }

        @media (max-width: 420px) {
          .sales-mobile-actions {
            grid-template-columns: 1fr !important;
          }

          .sales-actions-summary {
            grid-template-columns: 1fr;
          }

          .sales-action-row {
            grid-template-columns: 36px 1fr;
            border-radius: 14px;
          }

          .sales-action-row > span {
            width: 36px;
            height: 36px;
          }
        }


        @media (max-width: 768px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .sales-stats-grid .stat-card {
            padding: 10px !important;
            min-height: 64px;
          }

          .sales-stats-grid .stat-value {
            font-size: 18px !important;
            line-height: 1.05 !important;
          }

          .sales-stats-grid .stat-label {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .sales-filters {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 118px !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .sales-filters select,
          .sales-search input {
            min-height: 38px !important;
            height: 38px !important;
            font-size: 12px !important;
          }

          .sales-mobile-list {
            gap: 7px !important;
            padding: 8px !important;
          }

          .sales-mobile-item {
            padding: 9px !important;
            gap: 7px !important;
            border-radius: 13px !important;
          }

          .sales-mobile-head {
            flex-direction: row !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }

          .sales-mobile-id {
            font-size: 10px !important;
          }

          .sales-mobile-head h3 {
            font-size: 13px !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
          }

          .sales-mobile-head p {
            font-size: 10.5px !important;
            line-height: 1.15 !important;
          }

          .sales-mobile-badges {
            gap: 5px !important;
            max-height: 23px;
            overflow: hidden;
          }

          .sales-mobile-badges .badge {
            font-size: 9.5px !important;
            padding: 4px 6px !important;
            line-height: 1 !important;
          }

          .sales-mobile-badges .badge:nth-child(n + 4) {
            display: none !important;
          }

          .sales-mobile-data {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .sales-mobile-data > div {
            padding: 7px 8px !important;
            border-radius: 10px !important;
            align-items: flex-start !important;
          }

          .sales-mobile-data small {
            font-size: 9.5px !important;
          }

          .sales-mobile-data strong {
            font-size: 11px !important;
            line-height: 1.15 !important;
          }

          .sales-mobile-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .sales-mobile-actions button {
            min-height: 32px !important;
            border-radius: 11px !important;
            font-size: 11px !important;
            padding: 7px 6px !important;
            gap: 4px !important;
          }

          .sales-mobile-more-action {
            grid-column: auto !important;
          }

          .sales-mobile-actions-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483000 !important;
            align-items: flex-end !important;
            justify-content: center !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: rgba(0, 0, 0, 0.48) !important;
          }

          .sales-actions-sheet {
            width: 100% !important;
            max-width: 100% !important;
            max-height: min(86dvh, 760px) !important;
            margin: 0 !important;
            border-radius: 24px 24px 0 0 !important;
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.28);
          }

          .sales-actions-body {
            overflow-y: auto !important;
            padding-bottom: calc(18px + env(safe-area-inset-bottom)) !important;
          }
        }

        @media (max-width: 420px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .sales-filters {
            grid-template-columns: minmax(0, 1fr) 108px !important;
          }

          .sales-mobile-head {
            flex-direction: row !important;
            align-items: flex-start !important;
          }

          .sales-mobile-head > .badge {
            width: auto !important;
            flex-shrink: 0;
          }

          .sales-mobile-data > div {
            flex-direction: column !important;
            gap: 3px !important;
          }

          .sales-mobile-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .sales-mobile-actions button {
            font-size: 10.5px !important;
          }
        }

        @keyframes salesSheetUp {
          from {
            transform: translateY(18px);
            opacity: 0.85;
          }

          to {
            transform: translateY(0);
            opacity: 1;
          }
        }


      `}</style>

    </AppLayout>
  );
}