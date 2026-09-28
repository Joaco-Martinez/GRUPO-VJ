'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { fmtMoney } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { Loader2, Save, Truck } from 'lucide-react';

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
}

export default function ConfiguracionEnviosPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [pricePerKm, setPricePerKm] = useState('');
  const [savedPricePerKm, setSavedPricePerKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/settings/delivery')
      .then((res) => {
        const value = Number(res.data?.pricePerKm);
        setSavedPricePerKm(value);
        setPricePerKm(String(value));
      })
      .catch((e) => toast.error(getErrorMessage(e, 'No se pudo cargar la configuración de envíos')))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(pricePerKm);

    if (!Number.isFinite(value) || value <= 0) {
      toast.error('El precio por km debe ser mayor a 0');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/settings/delivery', { pricePerKm: value });
      const saved = Number(res.data?.pricePerKm);
      setSavedPricePerKm(saved);
      setPricePerKm(String(saved));
      toast.success('Precio de envío actualizado');
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo guardar el precio de envío'));
    } finally {
      setSaving(false);
    }
  };

  const preview = Number(pricePerKm) > 0 ? Number(pricePerKm) : 0;

  return (
    <AppLayout title="Envíos" subtitle="Precio por kilómetro usado para calcular el costo de envío en ventas.">
      <div className="card envios-card">
        <div className="envios-head">
          <span className="envios-icon">
            <Truck size={18} />
          </span>
          <div>
            <h3>Precio por km</h3>
            <p>
              El POS y la edición de ventas usan este valor al calcular el envío (distancia × precio por km).
              {!isAdmin && ' Solo un administrador puede modificarlo.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="envios-loading">
            <Loader2 size={20} className="animate-spin" /> Cargando...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="envios-form">
            <label>
              <span>Precio por km (ARS)</span>
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={pricePerKm}
                onChange={(e) => setPricePerKm(e.target.value)}
                disabled={!isAdmin || saving}
              />
            </label>

            <small>
              Ejemplo: 10 km × {fmtMoney(preview)} = <strong>{fmtMoney(preview * 10)}</strong>
              {savedPricePerKm !== null && <> · Valor guardado: {fmtMoney(savedPricePerKm)}</>}
            </small>

            {isAdmin && (
              <div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving || Number(pricePerKm) === savedPricePerKm}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Guardar
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <style jsx>{`
        .envios-card {
          max-width: 560px;
          padding: 22px;
          display: grid;
          gap: 18px;
        }
        .envios-head {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .envios-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: var(--accent-dim);
          color: var(--accent);
          flex-shrink: 0;
        }
        h3 {
          font-size: 15px;
          font-weight: 900;
        }
        p {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text2);
        }
        .envios-loading {
          display: flex;
          gap: 8px;
          align-items: center;
          color: var(--text2);
          font-size: 13px;
          font-weight: 800;
        }
        .envios-form {
          display: grid;
          gap: 12px;
        }
        label {
          display: grid;
          gap: 6px;
        }
        label span {
          font-size: 12px;
          font-weight: 800;
          color: var(--text2);
        }
        small {
          font-size: 12px;
          color: var(--text3);
        }
      `}</style>
    </AppLayout>
  );
}
