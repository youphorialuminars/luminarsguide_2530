import React, { Suspense } from 'react';
import CounselorDashboardContent from './components/CounselorDashboardContent';
import AppLayout from '@/components/AppLayout';

export default function CounselorDashboardPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-purple-400">Loading...</div>}>
        <CounselorDashboardContent />
      </Suspense>
    </AppLayout>
  );
}