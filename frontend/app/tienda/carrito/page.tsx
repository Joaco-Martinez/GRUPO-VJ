'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  ArrowLeft,
  MessageCircle,
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Plus,
  Minus,
  AlertTriangle,
  X,
} from 'lucide-react';
import { formatMoney, shopApi } from '@/lib/shop';
import { useCartStore } from '@/store/cart';
import toast from 'react-hot-toast';

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  const apiError = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
  };

  return apiError.response?.data?.message ?? apiError.response?.data?.error ?? fallback;
}

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
  const [customerCategory, setCustomerCategory] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const storeSuffix = useMemo(() => {
    if (customerCategory === 'Mayorista') return 'Mayorista';
    if (customerCategory === 'Cliente') return 'Clientes';
    return 'Minorista';
  }, [customerCategory]);

  const priceLabel = useMemo(() => {
    if (customerCategory === 'Mayorista') return 'Precio mayorista';
    if (customerCategory === 'Cliente') return 'Precio cliente';
    return 'Precio público';
  }, [customerCategory]);

  useEffect(() => {
    let alive = true;

    shopApi
      .getProducts({ limit: 1 })
      .then((result) => {
        if (!alive) return;
        setCustomerCategory(result.customer?.category ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setCustomerCategory(null);
      });

    return () => {
      alive = false;
    };
  }, []);

  async function checkout() {
    if (!items.length) {
      toast.error('Tu carrito está vacío');
      return;
    }

    setSaving(true);
    setError('');

    const toastId = toast.loading('Creando pedido...');

    try {
      const result = await shopApi.checkoutWhatsapp({
        paymentMethod: 'TRANSFERENCIA',
        customerNotes: notes.trim(),
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.product.saleUnit === 'KG' ? undefined : item.quantity,
          quantityKg: item.product.saleUnit === 'KG' ? item.quantity : undefined,
        })),
      });

      clear();

      if (result.whatsappUrl) {
        toast.success('Pedido creado. Abriendo WhatsApp...', { id: toastId });
        window.location.href = result.whatsappUrl;
        return;
      }

      const message = 'Pedido creado, pero falta configurar STORE_WHATSAPP_NUMBER en el backend.';
      setError(message);
      toast.error(message, { id: toastId });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'No se pudo finalizar el pedido');

      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('sesión')) {
        toast.error('Tu sesión venció. Iniciá sesión nuevamente', { id: toastId });
        router.push('/tienda/login');
        return;
      }

      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  function openCheckoutConfirm() {
    if (!items.length) {
      toast.error('Tu carrito está vacío');
      return;
    }

    setConfirmModal({
      title: 'Finalizar pedido',
      message: `¿Confirmás crear el pedido por ${formatMoney(total)} y abrir WhatsApp con el detalle?`,
      confirmText: 'Finalizar por WhatsApp',
      danger: false,
      onConfirm: checkout,
    });
  }

  async function confirmAction() {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  function decreaseQuantity(productId: string, currentQuantity: number, isKg: boolean) {
    const step = isKg ? 0.1 : 1;
    const nextQuantity = Math.max(step, Number((currentQuantity - step).toFixed(2)));
    setQuantity(productId, nextQuantity);
  }

  function increaseQuantity(productId: string, currentQuantity: number, isKg: boolean) {
    const step = isKg ? 0.1 : 1;
    const nextQuantity = Number((currentQuantity + step).toFixed(2));
    setQuantity(productId, nextQuantity);
  }

  function handleQuantityInput(productId: string, value: string, isKg: boolean) {
    const parsed = Number(value);
    const min = isKg ? 0.1 : 1;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantity(productId, min);
      return;
    }

    setQuantity(productId, parsed);
  }

  function handleRemove(productId: string) {
    remove(productId);
    toast.success('Producto quitado del carrito');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --bg: #f6f7f9;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --green: #14b86a;
          --green-dark: #0f9f5c;
          --green-soft: #e9f9f1;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --red: #e11d48;
          --red-soft: #fff1f2;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --shadow-sm: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input,
        textarea {
          font-family: inherit;
        }

        .cart-page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .cart-header {
          background: var(--white);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .cart-header-inner {
          max-width: 1320px;
          height: 76px;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          min-width: 0;
        }

        .brand-mark {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.18);
          flex-shrink: 0;
        }

        .brand-logo {
          width: 38px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .brand-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .brand-kicker {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
        }

        .brand-name {
          color: var(--text);
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.035em;
          line-height: 1;
          white-space: nowrap;
        }

        .back-btn {
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .back-btn:hover {
          background: #f9fafb;
          border-color: var(--line-strong);
          transform: translateY(-1px);
        }

        .info-bar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
        }

        .info-bar-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 10px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          color: var(--muted);
          font-size: 13px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 600;
        }

        .info-item strong {
          color: var(--text);
          font-weight: 800;
        }

        .info-item.green {
          color: var(--green);
          font-weight: 800;
        }

        .cart-main {
          max-width: 1320px;
          margin: 0 auto;
          padding: 32px 28px 80px;
        }

        .page-head {
          margin-bottom: 22px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .page-title {
          margin: 0;
          color: var(--text);
          font-size: clamp(30px, 4vw, 46px);
          line-height: 0.98;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .page-subtitle {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14px;
          font-weight: 600;
        }

        .head-chips {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .cart-count-chip {
          height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: var(--white);
          border: 1px solid var(--line);
          box-shadow: var(--shadow-sm);
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cart-count-chip strong {
          color: var(--text);
        }

        .price-chip {
          height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: var(--green-soft);
          border: 1px solid rgba(20, 184, 106, 0.16);
          color: var(--green);
          box-shadow: var(--shadow-sm);
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .price-chip strong {
          color: var(--green);
          font-weight: 950;
        }

        .cart-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 24px;
          align-items: start;
        }

        .items-card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 26px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }

        .items-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 150px 150px 46px;
          gap: 16px;
          padding: 16px 20px;
          background: #f9fafb;
          border-bottom: 1px solid var(--line);
        }

        .items-head span {
          color: var(--muted);
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .cart-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 150px 150px 46px;
          gap: 16px;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid var(--line);
          transition: 0.16s ease;
        }

        .cart-row:last-child {
          border-bottom: none;
        }

        .cart-row:hover {
          background: #fcfcfd;
        }

        .product-info {
          min-width: 0;
        }

        .row-name {
          color: var(--text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.025em;
          line-height: 1.35;
          margin: 0 0 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .row-unit-price {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .row-unit-price strong {
          color: var(--text);
          font-weight: 900;
        }

        .qty-control {
          width: 128px;
          height: 42px;
          border: 1px solid var(--line);
          background: #f9fafb;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
        }

        .qty-btn {
          width: 38px;
          height: 100%;
          border: none;
          background: transparent;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .qty-btn:hover {
          color: var(--text);
          background: var(--white);
        }

        .qty-input {
          width: 48px;
          border: none;
          background: transparent;
          color: var(--text);
          text-align: center;
          font-size: 14px;
          font-weight: 900;
          outline: none;
        }

        .qty-input::-webkit-outer-spin-button,
        .qty-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .row-subtotal {
          color: var(--text);
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.035em;
          white-space: nowrap;
        }

        .btn-remove {
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 14px;
          background: #f9fafb;
          color: var(--soft);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .btn-remove:hover {
          color: var(--red);
          background: var(--red-soft);
        }

        .cart-summary {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 26px;
          box-shadow: var(--shadow);
          padding: 22px;
          position: sticky;
          top: 106px;
        }

        .summary-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-title {
          margin: 0;
          color: var(--text);
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.035em;
        }

        .summary-price-label {
          height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: var(--green-soft);
          color: var(--green);
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .summary-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 290px;
          overflow: auto;
          padding-right: 3px;
          margin-bottom: 16px;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
        }

        .summary-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .summary-price {
          flex-shrink: 0;
          color: var(--text);
          font-weight: 900;
        }

        .summary-total {
          padding: 18px 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .summary-total-label {
          color: var(--text);
          font-size: 15px;
          font-weight: 900;
        }

        .summary-total-amount {
          color: var(--text);
          font-size: 32px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
          white-space: nowrap;
        }

        .notes-label {
          display: block;
          margin: 18px 0 8px;
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
        }

        .notes-area {
          width: 100%;
          min-height: 94px;
          resize: vertical;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #f9fafb;
          color: var(--text);
          outline: none;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.5;
          transition: 0.18s ease;
        }

        .notes-area::placeholder {
          color: var(--soft);
        }

        .notes-area:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .btn-checkout {
          width: 100%;
          height: 52px;
          border: none;
          border-radius: 999px;
          background: #25D366;
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          margin-top: 16px;
          font-size: 14px;
          font-weight: 950;
          transition: 0.18s ease;
          box-shadow: 0 14px 30px rgba(37, 211, 102, 0.25);
        }

        .btn-checkout:hover {
          background: #1fb85a;
          transform: translateY(-1px);
        }

        .btn-checkout:disabled {
          background: #e5e7eb;
          color: var(--soft);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .payment-note {
          margin: 14px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
          font-weight: 600;
        }

        .secure-note {
          margin-top: 14px;
          padding: 12px;
          border-radius: 18px;
          background: var(--green-soft);
          color: var(--green);
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 800;
        }

        .secure-note svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .error-box {
          margin-top: 16px;
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid rgba(225, 29, 72, 0.14);
          border-radius: 18px;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 750;
        }

        .empty-cart {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 28px;
          box-shadow: var(--shadow-sm);
          padding: 82px 26px;
          text-align: center;
        }

        .empty-icon {
          width: 74px;
          height: 74px;
          border-radius: 24px;
          background: #f9fafb;
          border: 1px solid var(--line);
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--soft);
        }

        .empty-cart h2 {
          margin: 0;
          color: var(--text);
          font-size: 25px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .empty-cart p {
          margin: 10px auto 24px;
          max-width: 390px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
          font-weight: 600;
        }

        .btn-go-shop {
          height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--white);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 900;
          transition: 0.18s ease;
        }

        .btn-go-shop:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(15, 23, 42, 0.58);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .modal {
          width: 100%;
          max-width: 440px;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: 0 30px 90px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .modal-header b {
          color: var(--text);
          font-size: 15px;
          font-weight: 950;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 12px;
          background: #f9fafb;
          color: var(--muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .modal-close:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-message-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .modal-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: var(--green-soft);
          color: var(--green);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .modal-message {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
          font-weight: 650;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--line);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .modal-secondary,
        .modal-primary {
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .modal-secondary {
          background: var(--white);
          color: var(--text);
          border: 1px solid var(--line);
        }

        .modal-primary {
          background: #25D366;
          color: var(--white);
          border: 1px solid #25D366;
        }

        .modal-secondary:disabled,
        .modal-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .cart-layout {
            grid-template-columns: 1fr;
          }

          .cart-summary {
            position: static;
          }

          .items-head {
            display: none;
          }

          .cart-row {
            grid-template-columns: 1fr;
            gap: 13px;
          }

          .row-name {
            white-space: normal;
          }

          .mobile-row-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .row-subtotal {
            font-size: 20px;
          }
        }

        @media (min-width: 981px) {
          .mobile-row-actions {
            display: contents;
          }
        }

        @media (max-width: 640px) {
          .cart-header-inner {
            height: auto;
            padding: 14px 18px;
          }

          .brand-mark {
            width: 48px;
            height: 48px;
            border-radius: 16px;
          }

          .brand-logo {
            width: 34px;
          }

          .brand-kicker {
            font-size: 11px;
          }

          .brand-name {
            font-size: 14px;
          }

          .back-btn {
            width: 42px;
            padding: 0;
            justify-content: center;
          }

          .back-btn span {
            display: none;
          }

          .info-bar-inner {
            padding: 10px 18px;
            flex-direction: column;
            align-items: flex-start;
            gap: 7px;
          }

          .cart-main {
            padding: 24px 18px 60px;
          }

          .page-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .head-chips {
            justify-content: flex-start;
          }

          .page-title {
            font-size: 34px;
          }

          .items-card,
          .cart-summary,
          .empty-cart {
            border-radius: 22px;
          }

          .cart-row {
            padding: 16px;
          }

          .summary-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .summary-total-amount {
            font-size: 28px;
          }
        }
      `}</style>

      <div className="cart-page">
        <header className="cart-header">
          <div className="cart-header-inner">
            <Link href="/tienda" className="brand">
              <div className="brand-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Grupo VJ"
                  width={120}
                  height={120}
                  className="brand-logo"
                  priority
                />
              </div>

              <div className="brand-info">
                <span className="brand-kicker">Grupo VJ</span>
                <span className="brand-name">Carrito {storeSuffix}</span>
              </div>
            </Link>

            <Link className="back-btn" href="/tienda">
              <ArrowLeft size={16} />
              <span>Seguir comprando</span>
            </Link>
          </div>
        </header>

        <div className="info-bar">
          <div className="info-bar-inner">
            <div className="info-item">
              <MapPin size={14} />
              <span>
                Retiro y atención en <strong>Paso de los Andes 893, Córdoba</strong>
              </span>
            </div>
          </div>
        </div>

        <main className="cart-main">
          <div className="page-head">
            <div>
              <h1 className="page-title">Mi carrito</h1>
              <p className="page-subtitle">
                Revisá los productos antes de finalizar el pedido por WhatsApp.
              </p>
            </div>

            <div className="head-chips">
              <div className="cart-count-chip">
                <ShoppingBag size={15} />
                <strong>{items.length}</strong> {items.length === 1 ? 'producto' : 'productos'}
              </div>

              <div className="price-chip">
                Lista: <strong>{storeSuffix}</strong>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">
                <ShoppingBag size={34} />
              </div>

              <h2>Tu carrito está vacío</h2>

              <p>
                Agregá productos desde el catálogo para armar tu pedido y continuar por WhatsApp.
              </p>

              <Link className="btn-go-shop" href="/tienda">
                <ShoppingBag size={16} />
                Ver catálogo
              </Link>
            </div>
          ) : (
            <div className="cart-layout">
              <section className="items-card">
                <div className="items-head">
                  <span>Producto</span>
                  <span>Cantidad</span>
                  <span>Subtotal</span>
                  <span></span>
                </div>

                {items.map((item) => {
                  const isKg = item.product.saleUnit === 'KG';

                  return (
                    <div className="cart-row" key={item.product.id}>
                      <div className="product-info">
                        <p className="row-name">{item.product.name}</p>

                        <div className="row-unit-price">
                          <strong>{priceLabel}:</strong> {formatMoney(item.product.price)}{' '}
                          {isKg ? '/ kg' : 'c/u'}
                        </div>
                      </div>

                      <div className="mobile-row-actions">
                        <div className="qty-control">
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => decreaseQuantity(item.product.id, item.quantity, isKg)}
                            title="Restar"
                          >
                            <Minus size={14} />
                          </button>

                          <input
                            className="qty-input"
                            type="number"
                            min={isKg ? 0.1 : 1}
                            step={isKg ? 0.1 : 1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityInput(item.product.id, e.target.value, isKg)
                            }
                          />

                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => increaseQuantity(item.product.id, item.quantity, isKg)}
                            title="Sumar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="row-subtotal">
                          {formatMoney(item.product.price * item.quantity)}
                        </div>

                        <button
                          className="btn-remove"
                          onClick={() => handleRemove(item.product.id)}
                          title="Quitar"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>

              <aside className="cart-summary">
                <div className="summary-heading">
                  <h2 className="summary-title">Resumen del pedido</h2>
                  <span className="summary-price-label">{priceLabel}</span>
                </div>

                <div className="summary-list">
                  {items.map((item) => (
                    <div className="summary-row" key={item.product.id}>
                      <span className="summary-name">
                        {item.product.name} × {item.quantity}
                      </span>

                      <span className="summary-price">
                        {formatMoney(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="summary-total">
                  <span className="summary-total-label">Total</span>
                  <span className="summary-total-amount">{formatMoney(total)}</span>
                </div>

                {error && <div className="error-box">⚠ {error}</div>}

                <label className="notes-label" htmlFor="notes">
                  Notas del pedido
                </label>

                <textarea
                  id="notes"
                  className="notes-area"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: retiro por local, envío, horario preferido, aclaraciones..."
                  disabled={saving}
                />

                <button className="btn-checkout" disabled={saving} onClick={openCheckoutConfirm}>
                  <MessageCircle size={18} />
                  {saving ? 'Creando pedido...' : 'Finalizar por WhatsApp'}
                </button>

                <p className="payment-note">
                  Pago por transferencia bancaria.
                  <br />
                  Tu pedido queda registrado en el sistema como pendiente.
                </p>

                <div className="secure-note">
                  <ShieldCheck size={16} />
                  <span>
                    Al finalizar, se crea la venta en el ERP y se abre WhatsApp con el detalle
                    del pedido.
                  </span>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="modal-close"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-message-row">
                <span className="modal-icon">
                  <AlertTriangle size={18} />
                </span>

                <p className="modal-message">{confirmModal.message}</p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className="modal-primary"
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Creando...' : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}