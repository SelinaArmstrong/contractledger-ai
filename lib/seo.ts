import type { Metadata } from 'next';

export const SITE_NAME = 'ContractLedger AI';
export const SITE_TITLE = 'ContractLedger AI | Contract & Supplier Operations';
export const SITE_DESCRIPTION =
  'Explore AI-assisted contract review, supplier registers, approvals and obligations—with source-traceable records and human verification. A portfolio demo.';
export const PRODUCTION_ORIGIN = 'https://contractledger.selinaq.com';

/** Never let an empty, malformed or credential-bearing value leak into metadata. */
export function resolveSiteOrigin(value = process.env.SITE_URL): string {
  if (!value?.trim()) return PRODUCTION_ORIGIN;
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return PRODUCTION_ORIGIN;
    }
    return url.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

export function absoluteUrl(path = '/') {
  return new URL(path, `${resolveSiteOrigin()}/`).toString();
}

export const socialImage = {
  url: '/social/contractledger-og.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'ContractLedger AI — From contracts to accountable records. Source-traceable. Human-verified. Rule-driven.',
};

export function pageMetadata({
  title = SITE_TITLE,
  description = SITE_DESCRIPTION,
  path = '/',
  index = true,
}: {
  title?: string;
  description?: string;
  path?: string;
  index?: boolean;
} = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: {
      index,
      follow: true,
      googleBot: {
        index,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: SITE_NAME,
      url: absoluteUrl(path),
      title,
      description,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  };
}

export function websiteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: absoluteUrl(),
    description: SITE_DESCRIPTION,
    inLanguage: 'en-US',
  };
}

export function productStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': absoluteUrl('/about#creator'),
        name: 'Selina Armstrong',
        sameAs: ['https://www.linkedin.com/in/selinaarmstrong/'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': absoluteUrl('/about#application'),
        name: SITE_NAME,
        url: absoluteUrl('/about'),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web browser',
        description: SITE_DESCRIPTION,
        image: absoluteUrl(socialImage.url),
        author: { '@id': absoluteUrl('/about#creator') },
        featureList: [
          'AI-assisted contract extraction with source pages and quotes',
          'Human verification and rule-driven approvals',
          'Contract and supplier registers',
          'Obligation tracking and evidence history',
          'AI evaluation using fictional fixtures',
        ],
      },
      {
        '@type': 'AboutPage',
        '@id': absoluteUrl('/about#page'),
        url: absoluteUrl('/about'),
        name: 'AI Contract & Supplier Operations — Product Overview',
        description: SITE_DESCRIPTION,
        isPartOf: { '@id': absoluteUrl('/#website') },
        mainEntity: { '@id': absoluteUrl('/about#application') },
      },
    ],
  };
}
