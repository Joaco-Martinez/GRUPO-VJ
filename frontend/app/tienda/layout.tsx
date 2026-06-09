import type { Metadata } from 'next';
import { ShopAuthProvider } from "../../context/ShopAuthContext";
const siteUrl = 'https://www.grupovj.com.ar';

export const metadata: Metadata = {
  title: 'Grupo VJ | Tienda de bebidas en Córdoba',

  description:
    'Tienda online de Grupo VJ. Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más. Consultá precios, stock disponible y opciones de compra.',

  keywords: [
    'Grupo VJ',
    'Grupo VJ Córdoba',
    'Grupo VJ bebidas',
    'tienda Grupo VJ',
    'tienda de bebidas',
    'bebidas Córdoba',
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
  ],

  alternates: {
    canonical: `${siteUrl}/tienda`,
  },

  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: `${siteUrl}/tienda`,
    siteName: 'Grupo VJ',
    title: 'Grupo VJ | Tienda de bebidas en Córdoba',
    description:
      'Comprá bebidas, combos, gaseosas, cervezas, fernet, energizantes y más en Grupo VJ. Consultá precios y stock disponible.',
    images: [
      {
        url: `${siteUrl}/favicon.ico`,
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
    images: [`${siteUrl}/favicon.ico`],
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
};

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Grupo VJ',
    url: `${siteUrl}/tienda`,
    description:
      'Tienda online de Grupo VJ. Venta de bebidas, combos, gaseosas, cervezas, fernet, energizantes y más.',
    image: `${siteUrl}/favicon.ico`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Paso de los Andes 893',
      addressLocality: 'Córdoba',
      addressRegion: 'Córdoba',
      addressCountry: 'AR',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Argentina',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <ShopAuthProvider>{children}</ShopAuthProvider>
    </>
  );
}