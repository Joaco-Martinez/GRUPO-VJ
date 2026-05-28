'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar from './Sidebar';
import Toasts from './Toasts';
import { useToast } from '@/hooks/useToast';
import { Menu, Bell } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { user, loading, me } = useAuthStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toasts } = useToast();

  useEffect(() => {
    if (loading) me();
  }, [loading, me]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" style={{ margin: '0 auto 16px' }}>
            <polygon points="10,15 50,85 90,15 75,15 50,60 25,15" fill="white" opacity="0.9"/>
            <polygon points="60,15 90,15 90,55 75,55 75,30" fill="white" opacity="0.9"/>
          </svg>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: 0 }} id="main-content">
        <style>{`@media (min-width: 768px) { #main-content { margin-left: 240px; } }`}</style>

        {/* Topbar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="md:hidden btn btn-ghost btn-sm" style={{ padding: 8 }} onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            {(title || subtitle) && (
              <div>
                {title && <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{title}</h1>}
                {subtitle && <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{subtitle}</p>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {actions}
            <button className="btn btn-ghost btn-sm" style={{ padding: 8 }}>
              <Bell size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px 20px', maxWidth: 1400, width: '100%', margin: '0 auto' }} className="animate-fade">
          {children}
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}
