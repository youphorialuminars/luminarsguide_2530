import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import NewSessionContent from './components/NewSessionContent';

export default function NewSessionPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-purple-400">Loading...</div>}>
        <NewSessionContent />
      </Suspense>
    </AppLayout>
  );
}