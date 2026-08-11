'use client';

import AppLayout from '@/components/AppLayout';
import { Suspense } from 'react';
import SchoolMentorViewContent from './components/SchoolMentorViewContent';

export default function SchoolMentorViewPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]" />}>
        <SchoolMentorViewContent />
      </Suspense>
    </AppLayout>
  );
}
