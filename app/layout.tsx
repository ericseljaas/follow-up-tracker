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
  title: 'Follow Through — Executive Follow-up Cockpit',
  description: 'Capture commitments quickly and make sure nothing falls through the cracks.',
  openGraph: {
    title: 'Follow Through',
    description: 'Your executive follow-up cockpit',
    images: ['https://follow-through-eric.workspace-132596.chatgpt.site/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Follow Through',
    description: 'Your executive follow-up cockpit',
    images: ['https://follow-through-eric.workspace-132596.chatgpt.site/og.png'],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
