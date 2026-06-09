'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { shopApi } from '@/lib/shop';
import toast from 'react-hot-toast';

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

export default function TiendaLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function validateForm() {
    if (!email.trim()) {
      toast.error('Ingresá tu correo electrónico');
      return false;
    }

    if (!password.trim()) {
      toast.error('Ingresá tu contraseña');
      return false;
    }

    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    setError('');

    const toastId = toast.loading('Iniciando sesión...');

    try {
      await shopApi.login({
        email: email.trim(),
        password,
      });

      toast.success('Sesión iniciada correctamente', { id: toastId });

      router.push('/tienda/carrito');
      router.refresh();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'No se pudo iniciar sesión');

      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --bg: #f4f6f8;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --red: #dc2626;
          --red-soft: #fef2f2;
          --shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input {
          font-family: inherit;
        }

        .login-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 34%),
            var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 34px;
          box-shadow: var(--shadow);
        }

        .logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
          text-align: center;
        }

        .logo-mark {
          width: 68px;
          height: 68px;
          border-radius: 22px;
          background: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 14px;
          box-shadow: 0 14px 34px rgba(17, 24, 39, 0.18);
        }

        .logo-img {
          width: 48px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .logo-title {
          margin: 0;
          color: var(--text);
          font-size: 23px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .logo-subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        .form-title {
          margin: 0;
          color: var(--text);
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
          text-align: center;
        }

        .form-sub {
          margin: 10px 0 26px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
          font-weight: 600;
          text-align: center;
        }

        .field-group {
          margin-bottom: 16px;
        }

        .field-label {
          display: block;
          color: var(--text);
          font-size: 13px;
          font-weight: 850;
          margin-bottom: 8px;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--soft);
          width: 18px;
          height: 18px;
        }

        .field-input {
          width: 100%;
          height: 50px;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--text);
          border-radius: 16px;
          padding: 0 15px 0 46px;
          outline: none;
          font-size: 14px;
          font-weight: 600;
          transition: 0.18s ease;
        }

        .field-input::placeholder {
          color: var(--soft);
        }

        .field-input:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .field-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error-box {
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid rgba(220, 38, 38, 0.14);
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 750;
          margin-bottom: 18px;
        }

        .btn-submit {
          width: 100%;
          height: 52px;
          border: none;
          border-radius: 16px;
          background: var(--primary);
          color: var(--white);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 6px;
          transition: 0.18s ease;
          box-shadow: 0 16px 32px rgba(17, 24, 39, 0.16);
        }

        .btn-submit:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .btn-submit:disabled {
          background: #e5e7eb;
          color: var(--soft);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .divider {
          height: 1px;
          background: var(--line);
          margin: 24px 0;
        }

        .auth-footer {
          margin: 0;
          color: var(--muted);
          text-align: center;
          font-size: 13px;
          font-weight: 600;
        }

        .auth-footer a {
          color: var(--text);
          font-weight: 900;
          text-decoration: none;
        }

        .auth-footer a:hover {
          text-decoration: underline;
        }

        .back-to-shop {
          margin-top: 16px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 850;
          transition: 0.18s ease;
        }

        .back-to-shop:hover {
          background: #f9fafb;
          border-color: var(--line-strong);
        }

        @media (max-width: 480px) {
          .login-page {
            padding: 18px;
          }

          .login-card {
            padding: 26px 22px;
            border-radius: 24px;
          }

          .logo-mark {
            width: 62px;
            height: 62px;
            border-radius: 20px;
          }

          .logo-img {
            width: 44px;
          }

          .form-title {
            font-size: 26px;
          }
        }
      `}</style>

      <main className="login-page">
        <section className="login-card">
          <div className="logo-wrap">
            <div className="logo-mark">
              <Image
                src="/logo-vj-white-transparent.png"
                alt="Grupo VJ"
                width={120}
                height={120}
                className="logo-img"
                priority
              />
            </div>

            <h1 className="logo-title">Grupo VJ</h1>
            <p className="logo-subtitle">Portal de clientes</p>
          </div>

          <h2 className="form-title">Iniciar sesión</h2>

          <p className="form-sub">
            Ingresá con tu cuenta para ver tus precios y continuar tu pedido.
          </p>

          {error && <div className="error-box">⚠ {error}</div>}

          <form onSubmit={onSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Correo electrónico
              </label>

              <div className="input-wrap">
                <Mail className="input-icon" />
                <input
                  id="email"
                  className="field-input"
                  type="email"
                  autoComplete="email"
                  placeholder="cliente@empresa.com"
                  value={email}
                  disabled={saving}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Contraseña
              </label>

              <div className="input-wrap">
                <Lock className="input-icon" />
                <input
                  id="password"
                  className="field-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Ingresá tu contraseña"
                  value={password}
                  disabled={saving}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-submit">
              {saving ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="divider" />

          <p className="auth-footer">
            ¿No tenés cuenta? <Link href="/tienda/register">Registrate</Link>
          </p>

          <Link className="back-to-shop" href="/tienda">
            <ArrowLeft size={15} />
            Volver a la tienda
          </Link>
        </section>
      </main>
    </>
  );
}