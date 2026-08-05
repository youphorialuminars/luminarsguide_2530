import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import AnalysisHistoryContent from './components/AnalysisHistoryContent';

export default function StudentAnalysisHistoryPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-purple-400">Loading...</div>}>
        <AnalysisHistoryContent />
      </Suspense>
    </AppLayout>
  );
}