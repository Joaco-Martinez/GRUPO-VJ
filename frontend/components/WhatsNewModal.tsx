'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

const WHATS_NEW_STORAGE_KEY = 'grupo-vj-whats-new-seen';
// Cambiar este valor cada vez que haya novedades nuevas para volver a mostrar el cartel.
const WHATS_NEW_VERSION = '2026-09-04-proveedores-listas-precios';

const WHATS_NEW_ITEMS = [
  {
    title: 'Proveedores',
    description:
      'Nueva sección "Proveedores" para cargar razón social, CUIT, contacto, etc. (ningún dato es obligatorio) y asignarlos directamente a las compras.',
  },
  {
    title: 'Listas de precios descargables',
    description:
      'Desde Productos ahora se puede descargar la lista de precios mayorista o minorista en PDF o Excel, lista para compartir.',
  },
  {
    title: 'Recorte de fotos de producto',
    description:
      'Al subir o cambiar la foto de un producto ahora se puede recortar antes de guardarla, para que quede cuadrada (1:1) y del tamaño correcto (mínimo 800x800px).',
  },
  {
    title: 'Sesiones más largas',
    description:
      'La sesión ahora dura 14 días en vez de 1, para no tener que iniciar sesión tan seguido.',
  },
  {
    title: 'Menos redirecciones raras',
    description:
      'Se corrigió un problema que a veces mandaba al POS sin querer al editar un producto u otra sección.',
  },
];

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      return window.localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== WHATS_NEW_VERSION;
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      // Sin persistencia, se volverá a mostrar en la próxima visita.
    }

    setVisible(false);
  };

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            Novedades
          </b>

          <button className="btn btn-ghost btn-sm" onClick={dismiss}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
          {WHATS_NEW_ITEMS.map((item) => (
            <div key={item.title}>
              <b style={{ fontSize: 14 }}>{item.title}</b>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary btn-sm" onClick={dismiss}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
