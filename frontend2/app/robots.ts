import type { MetadataRoute } from 'next';

const siteUrl = 'https://tudominio.com.ar';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/tienda'],
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard/',
        '/configuracion/',
        '/ventas/',
        '/productos/',
        '/clientes/',
        '/finanzas/',
        '/login',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}