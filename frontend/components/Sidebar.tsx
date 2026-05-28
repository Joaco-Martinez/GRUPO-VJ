'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart2,
  AlertTriangle, Receipt, UserCog, Wallet, LogOut, ChevronRight, X, CreditCard
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#00e5a0' },
  { href: '/pos', icon: ShoppingCart, label: 'POS — Ventas', color: '#4f8eff' },
  { href: '/ventas', icon: Receipt, label: 'Historial Ventas', color: '#4f8eff' },
  { href: '/productos', icon: Package, label: 'Productos', color: '#00e5a0' },
  { href: '/clientes', icon: Users, label: 'Clientes', color: '#ff6b35' },
  { href: '/cuentas-corrientes', icon: CreditCard, label: 'Cuentas Corrientes', color: '#fbbf24' },
  { href: '/stock', icon: BarChart2, label: 'Stock', color: '#a78bfa' },
  { href: '/finanzas', icon: Wallet, label: 'Finanzas', color: '#34d399' },
  { href: '/alertas', icon: AlertTriangle, label: 'Alertas', color: '#ef4444' },
  { href: '/reportes', icon: BarChart2, label: 'Reportes', color: '#fbbf24' },
  { href: '/facturacion', icon: Receipt, label: 'AFIP / Facturas', color: '#06b6d4' },
];

const ADMIN_NAV = [
  { href: '/usuarios', icon: UserCog, label: 'Usuarios', color: '#fb923c' },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const content = (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>
              ERP SISTEMA
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* VJ Logo SVG */}
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                <polygon points="10,15 50,85 90,15 75,15 50,60 25,15" fill="white"/>
                <polygon points="60,15 90,15 90,55 75,55 75,30" fill="white"/>
              </svg>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>Grupo VJ</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>v2.0</div>
              </div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase' as const, fontFamily: 'var(--mono)', padding: '8px 10px 4px' }}>
          Principal
        </div>
        {NAV.map(({ href, icon: Icon, label, color }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                color: active ? 'var(--text)' : 'var(--text2)',
                background: active ? 'var(--surface2)' : 'none',
                transition: 'all 0.15s', marginBottom: 2,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? color : 'var(--border2)', flexShrink: 0, transition: 'background 0.15s' }} />
              <Icon size={15} style={{ color: active ? color : 'var(--text3)', flexShrink: 0 }} />
              {label}
              {active && <ChevronRight size={12} style={{ color: 'var(--text3)', marginLeft: 'auto' }} />}
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase' as const, fontFamily: 'var(--mono)', padding: '16px 10px 4px' }}>
              Admin
            </div>
            {ADMIN_NAV.map(({ href, icon: Icon, label, color }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                    borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    color: active ? 'var(--text)' : 'var(--text2)',
                    background: active ? 'var(--surface2)' : 'none',
                    transition: 'all 0.15s', marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? color : 'var(--border2)', flexShrink: 0 }} />
                  <Icon size={15} style={{ color: active ? color : 'var(--text3)', flexShrink: 0 }} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: user?.role === 'ADMIN' ? 'var(--accent)' : 'var(--text3)' }}>{user?.role}</div>
          </div>
        </div>
        <button onClick={() => logout()} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', gap: 8, color: 'var(--text3)' }}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex" style={{ width: 240, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40, flexDirection: 'column' }}>
        {content}
      </div>

      {/* Mobile overlay */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 260 }}>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
