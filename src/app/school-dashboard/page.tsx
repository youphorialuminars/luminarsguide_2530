'use client';

import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import SchoolDashboardContent from './components/SchoolDashboardContent';

export default function SchoolDashboardPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-purple-400">Loading...</div>}>
        <SchoolDashboardContent />
      </Suspense>
    </AppLayout>
  );
}
