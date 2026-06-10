import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tienda Online',
  description:
    'Tienda online de Grupo VJ. Consultá productos, precios y stock disponible.',

  alternates: {
    canonical: '/tienda',
  },

  openGraph: {
    title: 'Tienda Online',
    description:
      'Tienda online de Grupo VJ. Consultá productos, precios y stock disponible.',
    url: '/tienda',
    images: [
      {
        url: '/favicon.ico',
        width: 64,
        height: 64,
        alt: 'Tienda Online',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'Tienda Online',
    description:
      'Tienda online de Grupo VJ. Consultá productos, precios y stock disponible.',
    images: ['/favicon.ico'],
  },
};

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}