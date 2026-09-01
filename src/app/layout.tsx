import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { AuthProvider } from '@/contexts/AuthContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Luminar's Guide — Mentorship Intelligence for Educators",
  description:
    "Luminar's Guide helps mentors generate AI-powered personalized educational analysis for students, tracking progress and insights across every session.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <link
          id="app-favicon"
          rel="icon"
          type="image/png"
          href="https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/faviconlight.png"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('luminar_theme');
                  var isDark = theme === 'dark';
                  if (isDark) {
                    document.documentElement.classList.add('theme-dark');
                  }
                  var fav = document.getElementById('app-favicon');
                  if (fav) {
                    fav.href = isDark
                      ? 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/favicondark.png'
                      : 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/faviconlight.png';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
</head>
      <body className={plusJakartaSans.className}>
        <FontSizeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </FontSizeProvider>
</body>
    </html>
  );
}