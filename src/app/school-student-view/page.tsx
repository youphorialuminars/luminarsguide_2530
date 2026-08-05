'use client';

import AppLayout from '@/components/AppLayout';
import { Suspense } from 'react';
import SchoolStudentViewContent from './components/SchoolStudentViewContent';

export default function SchoolStudentViewPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]" />}>
        <SchoolStudentViewContent />
      </Suspense>
    </AppLayout>
  );
}
