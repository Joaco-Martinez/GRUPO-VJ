import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

const siteUrl = 'https://www.grupovj.com.ar';

export const metadata: Metadata = {
  title: 'Grupo VJ | Bebidas mayoristas y minoristas en Córdoba',

  description:
    'Grupo VJ es una tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista de fernet, cervezas, vinos, gaseosas, energizantes, combos y más productos para comercios, eventos y clientes particulares.',

  alternates: {
    canonical: `${siteUrl}/`,
  },

  openGraph: {
    title: 'Grupo VJ | Bebidas mayoristas y minoristas en Córdoba',
    description:
      'Tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista para comercios, eventos y clientes particulares.',
    url: `${siteUrl}/`,
    siteName: 'Grupo VJ',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/logo-vj-white-transparent.png`,
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
    images: [`${siteUrl}/logo-vj-white-transparent.png`],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': 160,
      'max-video-preview': -1,
    },
  },
};

export default function Home() {
  redirect('/tienda');
}