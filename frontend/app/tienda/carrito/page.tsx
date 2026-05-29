'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2, ArrowLeft, MessageCircle, ShoppingBag } from 'lucide-react';
import { formatMoney, shopApi } from '@/lib/shop';
import { useCartStore } from '@/store/cart';

export default function TiendaCarritoPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total());
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function checkout() {
    setSaving(true);
    setError('');
    try {
      const result = await shopApi.checkoutWhatsapp({
        paymentMethod: 'TRANSFERENCIA',
        customerNotes: notes,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.product.saleUnit === 'KG' ? undefined : item.quantity,
          quantityKg: item.product.saleUnit === 'KG' ? item.quantity : undefined,
        })),
      });
      clear();
      if (result.whatsappUrl) { window.location.href = result.whatsappUrl; return; }
      setError('Pedido creado, pero falta configurar STORE_WHATSAPP_NUMBER en el backend.');
    } catch (err: any) {
      const message = err.message || 'No se pudo finalizar el pedido';
      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('sesión')) {
        router.push('/tienda/login'); return;
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        :root { --black: #0a0a0a; --white: #ffffff; --gray-1: #f5f5f5; --gray-2: #e8e8e8; --gray-3: #b0b0b0; --gray-4: #555; --accent: #e8e800; }
        * { box-sizing: border-box; }
        .cart-page { font-family: 'Barlow', sans-serif; background: var(--gray-1); color: var(--black); min-height: 100vh; }
        .cart-header { background: var(--white); border-bottom: 3px solid var(--black); }
        .cart-header-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 72px; }
        .logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .logo-icon { width: 44px; height: 44px; background: var(--black); display: flex; align-items: center; justify-content: center; }
        .logo-grupo { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: var(--gray-4); text-transform: uppercase; display: block; }
        .logo-vj { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: var(--black); text-transform: uppercase; letter-spacing: -0.02em; display: block; line-height: 1; }
        .back-btn { display: flex; align-items: center; gap: 8px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--black); text-decoration: none; padding: 10px 16px; border: 1.5px solid var(--gray-2); border-radius: 4px; transition: border-color 0.15s; }
        .back-btn:hover { border-color: var(--black); }

        .cart-main { max-width: 1280px; margin: 0 auto; padding: 32px 24px; display: grid; grid-template-columns: 1fr 360px; gap: 24px; align-items: start; }
        @media (max-width: 900px) { .cart-main { grid-template-columns: 1fr; } }

        .cart-title { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 20px; }

        .cart-table { background: var(--white); border: 1.5px solid var(--gray-2); border-radius: 6px; overflow: hidden; }
        .cart-table-head { display: grid; grid-template-columns: 1fr 120px 120px 40px; gap: 16px; padding: 12px 20px; background: var(--gray-1); border-bottom: 1.5px solid var(--gray-2); }
        .cart-table-head span { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-4); }
        .cart-row { display: grid; grid-template-columns: 1fr 120px 120px 40px; gap: 16px; padding: 16px 20px; align-items: center; border-bottom: 1.5px solid var(--gray-2); transition: background 0.1s; }
        .cart-row:last-child { border-bottom: none; }
        .cart-row:hover { background: #fafafa; }
        .row-name { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; color: var(--black); }
        .row-unit-price { font-size: 12px; color: var(--gray-3); margin-top: 2px; }
        .qty-input { width: 80px; height: 38px; border: 1.5px solid var(--gray-2); background: var(--gray-1); text-align: center; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; outline: none; border-radius: 4px; transition: border-color 0.15s; }
        .qty-input:focus { border-color: var(--black); }
        .row-subtotal { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; }
        .btn-remove { background: none; border: none; cursor: pointer; color: var(--gray-3); padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
        .btn-remove:hover { color: #c62828; background: #fce4ec; }

        .empty-cart { background: var(--white); border: 1.5px solid var(--gray-2); border-radius: 6px; padding: 80px 24px; text-align: center; }
        .empty-cart svg { opacity: 0.15; margin-bottom: 16px; }
        .empty-cart p { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-4); margin-bottom: 20px; }
        .btn-go-shop { display: inline-flex; align-items: center; gap: 8px; background: var(--black); color: var(--white); padding: 12px 24px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; border-radius: 4px; }

        .cart-summary { background: var(--white); border: 1.5px solid var(--gray-2); border-radius: 6px; padding: 24px; position: sticky; top: 90px; }
        .summary-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1.5px solid var(--gray-2); }
        .summary-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; color: var(--gray-4); }
        .summary-total { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 2px solid var(--black); margin-top: 10px; }
        .summary-total-label { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
        .summary-total-amount { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; }
        .notes-area { width: 100%; border: 1.5px solid var(--gray-2); border-radius: 4px; padding: 12px; font-family: 'Barlow', sans-serif; font-size: 13px; resize: vertical; min-height: 80px; outline: none; margin: 16px 0; transition: border-color 0.15s; background: var(--gray-1); }
        .notes-area:focus { border-color: var(--black); }
        .notes-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-4); display: block; margin-bottom: 6px; margin-top: 16px; }
        .btn-checkout { width: 100%; background: #25D366; color: var(--white); border: none; padding: 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 4px; transition: background 0.15s; margin-top: 20px; }
        .btn-checkout:hover { background: #1da851; }
        .btn-checkout:disabled { background: var(--gray-2); color: var(--gray-3); cursor: not-allowed; }
        .error-box { background: #fff5f5; border: 1.5px solid #ffcdd2; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #c62828; margin-bottom: 16px; }
        .payment-note { font-size: 11px; color: var(--gray-3); text-align: center; margin-top: 12px; line-height: 1.5; }
      `}</style>

      <div className="cart-page">
        <header className="cart-header">
          <div className="cart-header-inner">
            <Link href="/tienda" className="logo">
              <div className="logo-icon">
                <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                  <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="white"/>
                  <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="white"/>
                </svg>
              </div>
              <div>
                <span className="logo-grupo">Grupo</span>
                <span className="logo-vj">VJ Distribuidora</span>
              </div>
            </Link>
            <Link className="back-btn" href="/tienda">
              <ArrowLeft size={14} /> Seguir comprando
            </Link>
          </div>
        </header>

        <div className="cart-main">
          {/* Left: items */}
          <div>
            <h1 className="cart-title">Mi carrito ({items.length})</h1>

            {items.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag size={56} />
                <p>Tu carrito está vacío</p>
                <Link className="btn-go-shop" href="/tienda">Ver catálogo</Link>
              </div>
            ) : (
              <div className="cart-table">
                <div className="cart-table-head">
                  <span>Producto</span>
                  <span>Cantidad</span>
                  <span>Subtotal</span>
                  <span></span>
                </div>
                {items.map((item) => (
                  <div className="cart-row" key={item.product.id}>
                    <div>
                      <div className="row-name">{item.product.name}</div>
                      <div className="row-unit-price">
                        {formatMoney(item.product.price)} {item.product.saleUnit === 'KG' ? '/ kg' : 'c/u'}
                      </div>
                    </div>
                    <div>
                      <input
                        className="qty-input"
                        type="number"
                        min={1}
                        step={item.product.saleUnit === 'KG' ? 0.1 : 1}
                        value={item.quantity}
                        onChange={(e) => setQuantity(item.product.id, Number(e.target.value))}
                      />
                    </div>
                    <div className="row-subtotal">{formatMoney(item.product.price * item.quantity)}</div>
                    <button className="btn-remove" onClick={() => remove(item.product.id)} title="Quitar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: summary */}
          {items.length > 0 && (
            <div className="cart-summary">
              <div className="summary-title">Resumen del pedido</div>

              {items.map((item) => (
                <div className="summary-row" key={item.product.id}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product.name} ×{item.quantity}
                  </span>
                  <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--black)' }}>
                    {formatMoney(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}

              <div className="summary-total">
                <span className="summary-total-label">Total</span>
                <span className="summary-total-amount">{formatMoney(total)}</span>
              </div>

              {error && <div className="error-box">⚠ {error}</div>}

              <span className="notes-label">Notas del pedido</span>
              <textarea
                className="notes-area"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Envío, retiro, horario preferido..."
              />

              <button className="btn-checkout" disabled={saving} onClick={checkout}>
                <MessageCircle size={18} />
                {saving ? 'Creando pedido...' : 'Finalizar por WhatsApp'}
              </button>
              <p className="payment-note">Pago por transferencia bancaria.<br />Tu pedido queda registrado en el sistema.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
