'use client';

import { Suspense } from 'react';
import ParentsHubContent from './components/ParentsHubContent';
import AppLayout from '@/components/AppLayout';

export default function ParentsHubPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <ParentsHubContent />
      </Suspense>
    </AppLayout>
  );
}
