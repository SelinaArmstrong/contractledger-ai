import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'ContractLedger AI — Contract & Supplier Register Automation',
  description:
    'An AI-assisted workflow for reviewing new contracts and maintaining accurate contract and supplier registers.',
  openGraph: {
    title: 'ContractLedger AI',
    description: 'AI-assisted contract & supplier register automation',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ContractLedger AI',
    description: 'AI-assisted contract & supplier register automation',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
