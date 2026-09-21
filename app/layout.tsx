import type { Metadata } from 'next';
import { Caveat, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://daily-bread-scripture-tracker.stanleychen123.chatgpt.site'),
  title: 'Daily Bread — Bible Reading Tracker',
  description: 'Build a steady Scripture reading habit, one daily portion at a time.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Daily Bread — Bible Reading Tracker',
    description: 'Build a steady Scripture reading habit, one daily portion at a time.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Daily Bread — Your daily portion of Scripture.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily Bread — Bible Reading Tracker',
    description: 'Build a steady Scripture reading habit, one daily portion at a time.',
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
