'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shopApi } from '@/lib/shop';

export default function TiendaLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await shopApi.login({ email, password });
      router.push('/tienda/carrito'); router.refresh();
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally { setSaving(false); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        :root { --black: #0a0a0a; --white: #ffffff; --gray-1: #f5f5f5; --gray-2: #e8e8e8; --gray-3: #b0b0b0; --gray-4: #555; }
        * { box-sizing: border-box; }
        .auth-page { font-family: 'Barlow', sans-serif; background: var(--gray-1); min-height: 100vh; display: grid; grid-template-columns: 1fr 480px; }
        @media (max-width: 768px) { .auth-page { grid-template-columns: 1fr; } .auth-left { display: none !important; } }
        .auth-left { background: var(--black); display: flex; flex-direction: column; justify-content: space-between; padding: 48px; position: relative; overflow: hidden; }
        .auth-left-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.06; }
        .auth-left-content { position: relative; z-index: 1; }
        .auth-logo { display: flex; align-items: center; gap: 12px; margin-bottom: auto; }
        .auth-logo-icon { width: 48px; height: 48px; background: white; display: flex; align-items: center; justify-content: center; }
        .auth-logo-grupo { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: #888; text-transform: uppercase; display: block; }
        .auth-logo-vj { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; color: white; text-transform: uppercase; display: block; line-height: 1; }
        .auth-tagline { font-family: 'Barlow Condensed', sans-serif; font-size: 42px; font-weight: 900; color: white; line-height: 1.05; letter-spacing: -0.01em; margin-top: 60px; }
        .auth-tagline em { font-style: normal; color: #e8e800; }
        .auth-sub { font-size: 14px; color: #888; margin-top: 16px; line-height: 1.6; max-width: 320px; }

        .auth-right { background: var(--white); display: flex; align-items: center; justify-content: center; padding: 48px 40px; border-left: 3px solid var(--black); }
        .auth-form-wrap { width: 100%; max-width: 360px; }
        .auth-form-title { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
        .auth-form-sub { font-size: 14px; color: var(--gray-4); margin-bottom: 32px; }
        .field-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-4); display: block; margin-bottom: 6px; }
        .field-input { width: 100%; height: 46px; border: 1.5px solid var(--gray-2); background: var(--gray-1); padding: 0 14px; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; border-radius: 4px; transition: border-color 0.15s; margin-bottom: 16px; }
        .field-input:focus { border-color: var(--black); background: var(--white); }
        .error-box { background: #fff5f5; border: 1.5px solid #ffcdd2; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #c62828; margin-bottom: 20px; }
        .btn-submit { width: 100%; height: 50px; background: var(--black); color: var(--white); border: none; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border-radius: 4px; transition: background 0.15s; margin-top: 8px; }
        .btn-submit:hover { background: #222; }
        .btn-submit:disabled { background: var(--gray-2); color: var(--gray-3); cursor: not-allowed; }
        .auth-footer { margin-top: 24px; text-align: center; font-size: 13px; color: var(--gray-4); }
        .auth-footer a { color: var(--black); font-weight: 600; text-decoration: none; }
        .auth-footer a:hover { text-decoration: underline; }
        .divider { height: 1.5px; background: var(--gray-2); margin: 24px 0; }
        .back-to-shop { display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-4); text-decoration: none; }
        .back-to-shop:hover { color: var(--black); }
      `}</style>

      <div className="auth-page">
        {/* Left panel */}
        <div className="auth-left">
          <div className="auth-left-bg">
            <svg width="600" height="600" viewBox="0 0 100 100" fill="none">
              <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="white"/>
              <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="white"/>
            </svg>
          </div>
          <div className="auth-left-content">
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
            <div style={{ marginTop: 'auto', paddingTop: 80 }}>
              <div className="auth-tagline">
                Tu distribuidora<br />de bebidas.<br /><em>Online.</em>
              </div>
              <p className="auth-sub">
                Accedé a precios mayoristas, stock en tiempo real y pedidos directo por WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="auth-right">
          <div className="auth-form-wrap">
            <h1 className="auth-form-title">Iniciar sesión</h1>
            <p className="auth-form-sub">Ingresá para ver tus precios y gestionar pedidos.</p>

            {error && <div className="error-box">⚠ {error}</div>}

            <form onSubmit={onSubmit}>
              <label className="field-label">Email</label>
              <input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

              <label className="field-label">Contraseña</label>
              <input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />

              <button type="submit" disabled={saving} className="btn-submit">
                {saving ? 'Ingresando...' : 'Ingresar →'}
              </button>
            </form>

            <div className="divider" />

            <p className="auth-footer">
              ¿No tenés cuenta? <Link href="/tienda/register">Registrate gratis</Link>
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className="back-to-shop" href="/tienda">← Ver catálogo sin cuenta</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
