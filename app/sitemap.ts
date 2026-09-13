import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Query-driven workbench views and sign-in are intentionally excluded.
  return ['/', '/about'].map((path) => ({ url: absoluteUrl(path) }));
}
