import React from 'react';
import AppLayout from '@/components/AppLayout';
import StudentDashboardContent from './components/StudentDashboardContent';

export default function StudentDashboardPage() {
  return (
    <AppLayout>
      <StudentDashboardContent />
    </AppLayout>
  );
}