import type { Metadata } from 'next';
import { ShopAuthProvider } from '../../context/ShopAuthContext';

const siteUrl = 'https://www.grupovj.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'Grupo VJ | Bebidas mayoristas y minoristas en Córdoba',
    template: '%s | Grupo VJ',
  },

  description:
    'Grupo VJ es una tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista de fernet, cervezas, vinos, gaseosas, energizantes, combos y más productos para comercios y clientes particulares.',

  applicationName: 'Grupo VJ',

  keywords: [
    'Grupo VJ',
    'Grupo VJ Córdoba',
    'Grupo VJ bebidas',
    'tienda Grupo VJ',
    'tienda de bebidas en Córdoba',
    'bebidas Córdoba',
    'bebidas mayoristas',
    'bebidas minoristas',
    'mayorista de bebidas',
    'minorista de bebidas',
    'distribuidora de bebidas',
    'venta de bebidas',
    'bebidas para comercios',
    'bebidas para eventos',
    'fernet',
    'cervezas',
    'vinos',
    'gaseosas',
    'energizantes',
    'combos de bebidas',
    'bebidas en Argentina',
  ],

  authors: [{ name: 'Grupo VJ' }],
  creator: 'Grupo VJ',
  publisher: 'Grupo VJ',

  category: 'Tienda de bebidas',

  alternates: {
    canonical: '/tienda',
  },

  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/tienda',
    siteName: 'Grupo VJ',
    title: 'Grupo VJ | Bebidas mayoristas y minoristas en Córdoba',
    description:
      'Tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista para comercios, eventos y clientes particulares.',
    images: [
      {
        url: '/logo-vj-white-transparent.png',
        width: 512,
        height: 512,
        alt: 'Logo de Grupo VJ',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'Grupo VJ | Bebidas mayoristas y minoristas en Córdoba',
    description:
      'Venta mayorista y minorista de bebidas en Córdoba para comercios, eventos y clientes particulares.',
    images: ['/logo-vj-white-transparent.png'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',

      /**
       * IMPORTANTE:
       * Esto limita cuánto texto puede usar Google como snippet.
       * No garantiza al 100% que nunca muestre precios, pero ayuda.
       *
       * Si querés que Google pueda mostrar una descripción más larga,
       * podés volverlo a -1.
       */
      'max-snippet': 160,

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
    '@id': `${siteUrl}/tienda#store`,
    name: 'Grupo VJ',
    alternateName: 'Grupo VJ Bebidas',
    url: `${siteUrl}/tienda`,
    description:
      'Tienda y distribuidora de bebidas en Córdoba con venta mayorista y minorista para comercios, eventos y clientes particulares.',
    image: `${siteUrl}/logo-vj-white-transparent.png`,
    logo: `${siteUrl}/logo-vj-white-transparent.png`,

    slogan: 'Bebidas mayoristas y minoristas en Córdoba',

    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Paso de los Andes 893',
      addressLocality: 'Córdoba',
      addressRegion: 'Córdoba',
      addressCountry: 'AR',
    },

    areaServed: [
      {
        '@type': 'AdministrativeArea',
        name: 'Córdoba',
      },
      {
        '@type': 'Country',
        name: 'Argentina',
      },
    ],

    knowsAbout: [
      'Venta mayorista de bebidas',
      'Venta minorista de bebidas',
      'Distribución de bebidas',
      'Bebidas para comercios',
      'Bebidas para eventos',
      'Fernet',
      'Cervezas',
      'Vinos',
      'Gaseosas',
      'Energizantes',
      'Combos de bebidas',
    ],

    makesOffer: [
      {
        '@type': 'Offer',
        name: 'Venta mayorista de bebidas',
        itemOffered: {
          '@type': 'Product',
          name: 'Bebidas para comercios',
          category: 'Bebidas',
        },
      },
      {
        '@type': 'Offer',
        name: 'Venta minorista de bebidas',
        itemOffered: {
          '@type': 'Product',
          name: 'Bebidas para clientes particulares',
          category: 'Bebidas',
        },
      },
    ],
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