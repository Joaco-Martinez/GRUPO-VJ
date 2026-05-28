import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grupo VJ — ERP',
  description: 'Sistema de gestión empresarial Grupo VJ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600&family=Geist:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
