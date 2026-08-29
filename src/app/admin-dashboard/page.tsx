'use client';

import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import AdminDashboardContent from './components/AdminDashboardContent';

export default function AdminDashboardPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-purple-400">Loading...</div>}>
        <AdminDashboardContent />
      </Suspense>
    </AppLayout>
  );
}
