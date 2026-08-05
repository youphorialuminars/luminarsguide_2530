import { Suspense } from 'react';
import CounselorStudentViewContent from './components/CounselorStudentViewContent';
import AppLayout from '@/components/AppLayout';

export default function CounselorStudentViewPage() {
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }>
        <CounselorStudentViewContent />
      </Suspense>
    </AppLayout>
  );
}
