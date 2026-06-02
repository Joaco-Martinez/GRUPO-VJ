'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Mail, User, Phone, IdCard } from 'lucide-react';
import { shopApi } from '@/lib/shop';

export default function TiendaRegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await shopApi.register(form);
      await shopApi.login({ email: form.email, password: form.password });
      router.push('/tienda/carrito');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar');
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

        .register-page {
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

        .register-card {
          width: 100%;
          max-width: 520px;
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
          margin-bottom: 26px;
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

        .section-title {
          display: block;
          margin: 22px 0 12px;
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
        }

        .section-title:first-of-type {
          margin-top: 0;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
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

        .field-help {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 600;
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
          margin-top: 8px;
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

        .terms-note {
          margin: 14px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
          text-align: center;
          font-weight: 600;
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

        @media (max-width: 620px) {
          .register-page {
            padding: 18px;
            align-items: flex-start;
          }

          .register-card {
            padding: 26px 22px;
            border-radius: 24px;
          }

          .field-grid {
            grid-template-columns: 1fr;
            gap: 0;
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

      <main className="register-page">
        <section className="register-card">
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

          <h2 className="form-title">Crear cuenta</h2>

          <p className="form-sub">
            Completá tus datos para registrarte y acceder al catálogo.
          </p>

          {error && <div className="error-box">⚠ {error}</div>}

          <form onSubmit={onSubmit}>
            <span className="section-title">Datos personales</span>

            <div className="field-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="nombre">
                  Nombre
                </label>

                <div className="input-wrap">
                  <User className="input-icon" />
                  <input
                    id="nombre"
                    className="field-input"
                    placeholder="Juan"
                    value={form.nombre}
                    onChange={(e) => setField('nombre', e.target.value)}
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="apellido">
                  Apellido
                </label>

                <div className="input-wrap">
                  <User className="input-icon" />
                  <input
                    id="apellido"
                    className="field-input"
                    placeholder="García"
                    value={form.apellido}
                    onChange={(e) => setField('apellido', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="field-grid">
<div className="field-group">
  <label className="field-label" htmlFor="dni">
    DNI / CUIT
  </label>

  <div className="input-wrap">
    <IdCard className="input-icon" />
    <input
      id="dni"
      className="field-input"
      placeholder="Ej: 20123456789"
      value={form.dni}
      inputMode="numeric"
      onChange={(e) => setField('dni', e.target.value.replace(/\D/g, ''))}
    />
  </div>

  <p className="field-help">
    Ingresá solo números, sin guiones ni espacios.
  </p>
</div>

              <div className="field-group">
                <label className="field-label" htmlFor="telefono">
                  Teléfono
                </label>

                <div className="input-wrap">
                  <Phone className="input-icon" />
                  <input
                    id="telefono"
                    className="field-input"
                    placeholder="11 1234-5678"
                    value={form.telefono}
                    onChange={(e) => setField('telefono', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <span className="section-title">Acceso a la cuenta</span>

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
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
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
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-submit">
              {saving ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="terms-note">
            Al registrarte aceptás las condiciones de uso de la plataforma.
          </p>

          <div className="divider" />

          <p className="auth-footer">
            ¿Ya tenés cuenta? <Link href="/tienda/login">Iniciá sesión</Link>
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