import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Grupo VJ | Tienda de bebidas en Córdoba',
  description:
    'Tienda online de Grupo VJ. Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más. Consultá precios, stock disponible y opciones de compra.',
  alternates: {
    canonical: 'https://www.grupovj.com.ar/',
  },
  openGraph: {
    title: 'Grupo VJ | Tienda de bebidas en Córdoba',
    description:
      'Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más en Grupo VJ.',
    url: 'https://www.grupovj.com.ar/',
    siteName: 'Grupo VJ',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Grupo VJ | Tienda de bebidas en Córdoba',
    description:
      'Tienda online de Grupo VJ. Comprá bebidas, combos y productos con stock actualizado.',
  },
};

export default function Home() {
  redirect('/tienda');
}