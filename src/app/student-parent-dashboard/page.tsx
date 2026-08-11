import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import StudentParentDashboardContent from './components/StudentParentDashboardContent';

export default function StudentParentDashboardPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" /></div>}>
        <StudentParentDashboardContent />
      </Suspense>
    </AppLayout>
  );
}
