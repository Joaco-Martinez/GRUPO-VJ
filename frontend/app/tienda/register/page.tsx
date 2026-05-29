'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shopApi } from '@/lib/shop';

export default function TiendaRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', nombre: '', apellido: '', dni: '', telefono: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setField(name: string, value: string) { setForm((prev) => ({ ...prev, [name]: value })); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await shopApi.register(form);
      await shopApi.login({ email: form.email, password: form.password });
      router.push('/tienda/carrito'); router.refresh();
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar');
    } finally { setSaving(false); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        :root { --black: #0a0a0a; --white: #ffffff; --gray-1: #f5f5f5; --gray-2: #e8e8e8; --gray-3: #b0b0b0; --gray-4: #555; }
        * { box-sizing: border-box; }
        .auth-page { font-family: 'Barlow', sans-serif; background: var(--gray-1); min-height: 100vh; display: grid; grid-template-columns: 1fr 560px; }
        @media (max-width: 900px) { .auth-page { grid-template-columns: 1fr; } .auth-left { display: none !important; } }
        .auth-left { background: var(--black); display: flex; flex-direction: column; padding: 48px; position: relative; overflow: hidden; }
        .auth-left-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.06; }
        .auth-logo { display: flex; align-items: center; gap: 12px; }
        .auth-logo-icon { width: 48px; height: 48px; background: white; display: flex; align-items: center; justify-content: center; }
        .auth-logo-grupo { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: #888; text-transform: uppercase; display: block; }
        .auth-logo-vj { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; color: white; text-transform: uppercase; display: block; line-height: 1; }
        .auth-tagline { font-family: 'Barlow Condensed', sans-serif; font-size: 42px; font-weight: 900; color: white; line-height: 1.05; letter-spacing: -0.01em; margin-top: 60px; }
        .auth-tagline em { font-style: normal; color: #e8e800; }
        .auth-sub { font-size: 14px; color: #888; margin-top: 16px; line-height: 1.6; }
        .benefits { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; }
        .benefit { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #ccc; }
        .benefit-dot { width: 8px; height: 8px; background: #e8e800; border-radius: 50%; flex-shrink: 0; }

        .auth-right { background: var(--white); display: flex; align-items: center; justify-content: center; padding: 48px 40px; border-left: 3px solid var(--black); overflow-y: auto; }
        .auth-form-wrap { width: 100%; max-width: 420px; }
        .auth-form-title { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
        .auth-form-sub { font-size: 14px; color: var(--gray-4); margin-bottom: 28px; }
        .section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-3); display: block; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1.5px solid var(--gray-2); }
        .field-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gray-4); display: block; margin-bottom: 5px; }
        .field-input { width: 100%; height: 44px; border: 1.5px solid var(--gray-2); background: var(--gray-1); padding: 0 14px; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; border-radius: 4px; transition: border-color 0.15s; margin-bottom: 14px; }
        .field-input:focus { border-color: var(--black); background: var(--white); }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .error-box { background: #fff5f5; border: 1.5px solid #ffcdd2; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #c62828; margin-bottom: 20px; }
        .btn-submit { width: 100%; height: 50px; background: var(--black); color: var(--white); border: none; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border-radius: 4px; transition: background 0.15s; margin-top: 8px; }
        .btn-submit:hover { background: #222; }
        .btn-submit:disabled { background: var(--gray-2); color: var(--gray-3); cursor: not-allowed; }
        .auth-footer { margin-top: 20px; text-align: center; font-size: 13px; color: var(--gray-4); }
        .auth-footer a { color: var(--black); font-weight: 600; text-decoration: none; }
        .auth-footer a:hover { text-decoration: underline; }
        .terms-note { font-size: 11px; color: var(--gray-3); text-align: center; margin-top: 12px; line-height: 1.5; }
      `}</style>

      <div className="auth-page">
        <div className="auth-left">
          <div className="auth-left-bg">
            <svg width="600" height="600" viewBox="0 0 100 100" fill="none">
              <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="white"/>
              <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="white"/>
            </svg>
          </div>
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
                <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="black"/>
                <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="black"/>
              </svg>
            </div>
            <div>
              <span className="auth-logo-grupo">Grupo</span>
              <span className="auth-logo-vj">VJ Distribuidora</span>
            </div>
          </div>
          <div className="auth-tagline" style={{ marginTop: 60 }}>
            Precio mayorista<br />desde el primer<br /><em>pedido.</em>
          </div>
          <p className="auth-sub">
            Creá tu cuenta y accedé a condiciones exclusivas para revendedores y comercios.
          </p>
          <div className="benefits">
            <div className="benefit"><div className="benefit-dot"/><span>Precios mayoristas y por volumen</span></div>
            <div className="benefit"><div className="benefit-dot"/><span>Stock actualizado en tiempo real</span></div>
            <div className="benefit"><div className="benefit-dot"/><span>Pedidos finalizados por WhatsApp</span></div>
            <div className="benefit"><div className="benefit-dot"/><span>Historial de compras en tu cuenta</span></div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-wrap">
            <h1 className="auth-form-title">Crear cuenta</h1>
            <p className="auth-form-sub">Completá tus datos. El admin asigna tu categoría de precio.</p>

            {error && <div className="error-box">⚠ {error}</div>}

            <form onSubmit={onSubmit}>
              <span className="section-label">Datos personales</span>
              <div className="field-grid">
                <div>
                  <label className="field-label">Nombre</label>
                  <input className="field-input" placeholder="Juan" value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Apellido</label>
                  <input className="field-input" placeholder="García" value={form.apellido} onChange={(e) => setField('apellido', e.target.value)} />
                </div>
              </div>
              <div className="field-grid">
                <div>
                  <label className="field-label">DNI / CUIT</label>
                  <input className="field-input" placeholder="20-12345678-9" value={form.dni} onChange={(e) => setField('dni', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Teléfono</label>
                  <input className="field-input" placeholder="11 1234-5678" value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} />
                </div>
              </div>

              <span className="section-label">Acceso a la cuenta</span>
              <label className="field-label">Email</label>
              <input className="field-input" type="email" placeholder="tu@email.com" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              <label className="field-label">Contraseña</label>
              <input className="field-input" type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => setField('password', e.target.value)} />

              <button type="submit" disabled={saving} className="btn-submit">
                {saving ? 'Creando cuenta...' : 'Crear cuenta →'}
              </button>
            </form>

            <p className="terms-note">Al registrarte aceptás las condiciones de uso de la plataforma.</p>
            <p className="auth-footer" style={{ marginTop: 16 }}>
              ¿Ya tenés cuenta? <Link href="/tienda/login">Iniciá sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
