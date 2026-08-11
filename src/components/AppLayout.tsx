'use client';

import React from 'react';
import Sidebar from './Sidebar';
import { Toaster } from 'sonner';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen mystic-gradient-bg flex">
      <Sidebar />
      {/* Desktop: offset by sidebar width (matches default expanded w-60) */}
      <main className="flex-1 md:ml-60 transition-all duration-200">
        {/* Mobile top bar spacer */}
        <div className="md:hidden h-14" />
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          {children}
        </div>
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-sans)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
          },
        }}
      />
    </div>
  );
}