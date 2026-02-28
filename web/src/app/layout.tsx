import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TimezoneProvider } from '@/lib/timezone';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlowVision | Netflow Analyzer',
  description: 'A modern, dynamic Netflow analyzer for your homelab.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen selection:bg-blue-500/30`}>
        <TimezoneProvider>
          {children}
        </TimezoneProvider>
      </body>
    </html>
  );
}
