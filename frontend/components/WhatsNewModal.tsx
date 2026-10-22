'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

const WHATS_NEW_STORAGE_KEY = 'grupo-vj-whats-new-seen';
// Cambiar este valor cada vez que haya novedades nuevas para volver a mostrar el cartel.
const WHATS_NEW_VERSION = '2026-10-22-envio-manual-editar-venta';

const WHATS_NEW_ITEMS = [
  {
    title: 'Envío en ventas de consumidor final',
    description:
      'Al editar una venta de consumidor final desde Ventas > Editar, ahora se puede agregar o cambiar el envío. Como no hay cliente para calcular por km, se carga a mano: escribís el costo de envío y, si querés, la dirección de entrega. Para sacarlo, dejá el costo en 0 o tocá "Quitar envío". Las ventas con cliente siguen calculando el envío por km como siempre.',
  },
  {
    title: 'Saldo a favor: aviso en el POS',
    description:
      'Al elegir en el POS un cliente que tiene plata a favor, aparece el aviso "Este cliente tiene $X a favor". Si tiene la cuenta corriente activada, el saldo se descuenta solo cuando dejás la venta (o una parte) en cuenta corriente; si cobrás todo en efectivo u otro medio, el saldo no se usa y queda guardado. Si la cuenta está desactivada, el aviso lo indica: el saldo no se puede aplicar.',
  },
  {
    title: 'Saldo a favor en el ticket y el comprobante',
    description:
      'El ticket y el comprobante PDF ahora muestran los pagos con nombres claros: "Saldo a favor aplicado" (lo que se pagó con saldo), "Queda en cta. cte." (lo que el cliente quedó debiendo) y "Abono cta. cte.". También muestran el saldo que le quedó al cliente después de la compra: "Saldo a favor restante" o "Saldo deudor en cta. cte.". Solo aparece para clientes con cuenta corriente activada o con algún saldo.',
  },
  {
    title: 'Saldo a favor: cómo se genera',
    description:
      'Los clientes pueden tener plata a favor. Queda a favor lo que sobra cuando: un abono supera la deuda; en Ventas > Editar pagos se cobra más que el total (se ve como "Excedente a favor del cliente"); se carga un ajuste negativo; o se cancela una venta que se había pagado por cuenta corriente. Para cobrar de más o hacer un ajuste no hace falta tener la cuenta corriente activada. El botón "Abono" en Clientes sí aparece solo si la cuenta está activada o si el cliente ya tiene saldo.',
  },
  {
    title: 'Saldo a favor: dónde se ve y cómo se usa',
    description:
      'Se ve en verde como "$X a favor" en Cuentas corrientes (lista "Clientes con saldo", total en "Saldo a favor de clientes" y en cada movimiento), en Clientes, en el POS, en Ventas y en Mi cuenta de la tienda. Se descuenta solo en la próxima venta que el cliente deje en cuenta corriente. Importante: para usarlo, el cliente tiene que tener la cuenta corriente activada; si está desactivada, el saldo queda guardado pero no se puede aplicar a una venta.',
  },
  {
    title: 'Pedidos en preparación',
    description:
      'En Ventas > Opciones ahora se puede marcar un pedido como "En preparación", "En camino" o "Entregado". Al pasarlo a preparación, el cliente ya no puede modificarlo desde la tienda (si se vuelve a pendiente, puede editarlo otra vez). El cliente ve el estado de su pedido en Mi cuenta.',
  },
  {
    title: 'Los clientes pueden modificar sus pedidos',
    description:
      'Desde la tienda, en Mi cuenta, los clientes pueden sumar productos, cambiar cantidades o quitar ítems de sus pedidos web mientras sigan pendientes. Se valida el stock al guardar y se respetan el envío y los precios manuales. Si el pedido ya tiene pagos, está facturado o en preparación, ya no lo pueden tocar.',
  },
  {
    title: 'Precio de envío configurable',
    description:
      'El precio por km del envío ahora lo define el administrador desde Configuración > Envíos. El POS y la edición de ventas lo toman automáticamente, y solo el administrador puede cambiarlo.',
  },
  {
    title: 'Cotizaciones sin stock',
    description:
      'Nueva sección "Cotizaciones s/stock" para armar presupuestos que no reservan ni descuentan stock. Se puede elegir un cliente o cargar los datos a mano, usar precios minoristas o mayoristas, agregar ítems libres y descargar o enviar el PDF por WhatsApp.',
  },
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
