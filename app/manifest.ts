import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ContractLedger AI',
    short_name: 'ContractLedger',
    description:
      'AI-assisted contract and supplier operations with human verification.',
    start_url: '/',
    scope: '/',
    display: 'browser',
    lang: 'en-US',
    background_color: '#f5f4ee',
    theme_color: '#0d2638',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
