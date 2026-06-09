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

const siteUrl = 'https://www.grupovj.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'Grupo VJ | Tienda de bebidas en Córdoba',
    template: '%s | Grupo VJ',
  },

  description:
    'Tienda online de Grupo VJ. Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más. Consultá precios, stock disponible y opciones de compra.',

  applicationName: 'Grupo VJ',

  keywords: [
    'Grupo VJ',
    'Grupo VJ Córdoba',
    'Grupo VJ bebidas',
    'tienda Grupo VJ',
    'tienda de bebidas',
    'bebidas Córdoba',
    'bebidas Argentina',
    'comprar bebidas online',
    'mayorista de bebidas',
    'minorista de bebidas',
    'distribuidora de bebidas',
    'fernet',
    'cerveza',
    'cervezas',
    'gaseosas',
    'energizantes',
    'combos de bebidas',
    'stock de bebidas',
    'ecommerce bebidas',
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
    siteName: 'Grupo VJ',
    title: 'Grupo VJ | Tienda de bebidas en Córdoba',
    description:
      'Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más en Grupo VJ. Consultá precios y stock disponible.',
    images: [
      {
        url: '/favicon.ico',
        width: 64,
        height: 64,
        alt: 'Grupo VJ',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'Grupo VJ | Tienda de bebidas en Córdoba',
    description:
      'Tienda online de Grupo VJ. Comprá bebidas, combos y productos con stock actualizado.',
    images: ['/favicon.ico'],
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
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

  other: {
    'geo.region': 'AR-X',
    'geo.placename': 'Córdoba, Argentina',
    'og:country-name': 'Argentina',
    'og:email': '',
    'theme-color': '#f4f6f8',
  },
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Grupo VJ',
    url: siteUrl,
    description:
      'Tienda online de Grupo VJ. Venta de bebidas, combos, gaseosas, cervezas, fernet, energizantes y más.',
    areaServed: {
      '@type': 'Country',
      name: 'Argentina',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'AR',
      addressRegion: 'Córdoba',
    },
    sameAs: [],
  };

  return (
    <html lang="es-AR" className={`${geist.variable} ${jetBrainsMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}