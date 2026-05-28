'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Alert } from '@/types';
import { AlertTriangle, Bell } from 'lucide-react';

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/alerts').then(r => setAlerts(r.data.content ?? r.data ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Alertas de stock" subtitle="Productos con stock bajo el mínimo">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Bell size={48} style={{ color: 'var(--accent)', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Todo bajo control</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>No hay productos con stock crítico en este momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(a => (
            <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '3px solid var(--danger)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{a.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                    Alerta desde {new Date(a.createdAt).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 900, color: 'var(--danger)' }}>{a.stockLocal}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>mínimo: {a.minStock}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
