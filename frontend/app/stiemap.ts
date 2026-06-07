import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.grupovj.com.ar';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/tienda`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];
}