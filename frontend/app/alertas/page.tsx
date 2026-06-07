'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Alert } from '@/types';
import { AlertTriangle, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

function useIsMobile(maxWidth = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= maxWidth);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, [maxWidth]);

  return isMobile;
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    let alive = true;

    const loadAlerts = async () => {
      try {
        setLoading(true);

        const r = await api.get('/alerts');

        if (!alive) return;

        setAlerts(r.data.content ?? r.data ?? []);
      } catch (error) {
        console.error(error);

        if (!alive) return;

        toast.error('No se pudieron cargar las alertas de stock');
        setAlerts([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadAlerts();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppLayout title="Alertas de stock" subtitle="Productos con stock bajo el mínimo">
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: isMobile ? 92 : 72,
                borderRadius: 12,
              }}
            />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: isMobile ? '64px 16px' : '80px 20px',
            width: '100%',
          }}
        >
          <Bell
            size={isMobile ? 42 : 48}
            style={{
              color: 'var(--accent)',
              margin: '0 auto 16px',
              display: 'block',
            }}
          />

          <h2
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Todo bajo control
          </h2>

          <p
            style={{
              color: 'var(--text2)',
              fontSize: 14,
              lineHeight: 1.45,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            No hay productos con stock crítico en este momento.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
          }}
        >
          {alerts.map((a) => (
            <div
              key={a.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderLeft: '3px solid var(--danger)',
                borderRadius: 12,
                padding: isMobile ? '14px 14px' : '16px 20px',
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: isMobile ? 14 : 20,
                width: '100%',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? 10 : 14,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <AlertTriangle
                  size={20}
                  style={{
                    color: 'var(--danger)',
                    flexShrink: 0,
                    marginTop: isMobile ? 1 : 0,
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginBottom: 2,
                      lineHeight: 1.25,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {a.productName}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text2)',
                      fontFamily: 'var(--mono)',
                      lineHeight: 1.35,
                    }}
                  >
                    Alerta desde {new Date(a.createdAt).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>

              <div
                style={{
                  textAlign: 'right',
                  flexShrink: 0,
                  minWidth: isMobile ? 54 : 'auto',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: isMobile ? 18 : 20,
                    fontWeight: 900,
                    color: 'var(--danger)',
                    lineHeight: 1,
                  }}
                >
                  {a.stockLocal}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text3)',
                    fontFamily: 'var(--mono)',
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  mín: {a.minStock}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}