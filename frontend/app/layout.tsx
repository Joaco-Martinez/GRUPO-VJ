import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-geist',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const siteUrl = 'https://tudominio.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'Tienda Online',
    template: '%s | Tienda Online',
  },

  description:
    'Tienda online de Grupo VJ. Consultá productos, precios y stock disponible.',

  applicationName: 'Tienda Online',

  keywords: [
    'Tienda Online',
    'Grupo VJ',
    'productos',
    'stock',
    'ventas',
    'ecommerce',
  ],

  authors: [
    {
      name: 'Grupo VJ',
      url: siteUrl,
    },
  ],

  creator: 'Grupo VJ',
  publisher: 'Grupo VJ',

  alternates: {
    canonical: '/',
    languages: {
      'es-AR': '/',
    },
  },

  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: siteUrl,
    siteName: 'Tienda Online',
    title: 'Tienda Online',
    description:
      'Tienda online de Grupo VJ. Consultá productos, precios y stock disponible.',
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

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },

  category: 'ecommerce',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f4f6f8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className={`${geist.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}