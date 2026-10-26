import type { Metadata } from 'next';
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wingst — Personal Browser Workspace & Modular New Tab',
  description:
    'An editorial, local-first personal browser workspace, customizable mosaic dashboard, and Chrome New Tab experience.',
  openGraph: {
    title: 'Wingst — Personal Browser Workspace & Modular New Tab',
    description:
      'An editorial, local-first personal browser workspace, customizable mosaic dashboard, and Chrome New Tab experience.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wingst — Personal Browser Workspace & Modular New Tab',
    description:
      'An editorial, local-first personal browser workspace, customizable mosaic dashboard, and Chrome New Tab experience.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${syne.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning className="min-h-screen selection:bg-[var(--accent-primary)] selection:text-white">
        {children}
      </body>
    </html>
  );
}
