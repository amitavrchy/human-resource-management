import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';

const geistSans = localFont({
  src: '../../public/fonts/geist-latin.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'PeopleOS · People ops without the busywork', template: '%s · PeopleOS' },
  description:
    'One thoughtful workspace for your people, hiring, time off and everything in between.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
