'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { clientName } from '@/lib/helpers';
import { FileText, Download, RefreshCcw, Receipt } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Invoice {
  id: string;
  saleId: string;
  cae: string;
  caeVto: string;
  tipo: string;
  total: number;
  createdAt: string;
  sale?: { client?: { name: string }; total: number; receiptType: string };
}

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/factura-pdf/all').then(r => setInvoices(r.data.content ?? r.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleRegenerar = async (saleId: string) => {
    setRegenerating(saleId);
    try {
      await api.post(`/factura-pdf/${saleId}/regenerar`);
      load();
    } catch { alert('Error al regenerar'); } finally { setRegenerating(''); }
  };

  return (
    <AppLayout title="AFIP / Facturación" subtitle="Facturas electrónicas y comprobantes">
      <div className="card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Receipt size={18} style={{ color: '#06b6d4' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Facturas emitidas</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>{invoices.length}</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}
            </div>
          ) : (
            <table>
              <thead><tr>
                <th>CAE</th><th>Tipo</th><th>Cliente</th><th>Total</th><th>Vto. CAE</th><th>Fecha</th><th>Acciones</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#06b6d4' }}>
                        {inv.cae ?? '—'}
                      </span>
                    </td>
                    <td><span className="badge badge-blue">{inv.sale?.receiptType ?? inv.tipo ?? '—'}</span></td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{clientName(inv.sale?.client as never)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
                      {fmt(inv.sale?.total ?? inv.total ?? 0)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>
                      {inv.caeVto ? new Date(inv.caeVto).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                      {new Date(inv.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => window.open(`${API_URL}/factura-pdf/${inv.saleId}/descargar`, '_blank')}
                        >
                          <Download size={12} /> PDF
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRegenerar(inv.saleId)}
                          disabled={regenerating === inv.saleId}
                          title="Regenerar PDF"
                        >
                          <RefreshCcw size={12} style={{ animation: regenerating === inv.saleId ? 'spin 0.7s linear infinite' : 'none' }} />
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
    </AppLayout>
  );
}
