import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface StatsStripProps {
  totalStudents: number;
  sessionsThisWeek: number;
  averageScore: number;
  studentsNeedingAttention: number;
}

export default function DashboardStatsStrip({
  totalStudents,
  sessionsThisWeek,
  averageScore,
  studentsNeedingAttention,
}: StatsStripProps) {
  const stats = [
    {
      id: 'stat-total',
      label: 'Total Students',
      value: totalStudents,
      icon: 'UserGroupIcon',
      color: 'text-primary',
      bg: 'bg-primary/10',
      suffix: '',
    },
    {
      id: 'stat-sessions',
      label: 'Sessions This Week',
      value: sessionsThisWeek,
      icon: 'CalendarDaysIcon',
      color: 'text-info',
      bg: 'bg-info/10',
      suffix: '',
    },
    {
      id: 'stat-avg',
      label: 'Average Score',
      value: averageScore,
      icon: 'ChartBarIcon',
      color: 'text-positive',
      bg: 'bg-positive/10',
      suffix: '%',
    },
    {
      id: 'stat-attention',
      label: 'Need Attention',
      value: studentsNeedingAttention,
      icon: 'ExclamationTriangleIcon',
      color: 'text-warning',
      bg: 'bg-warning/10',
      suffix: '',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => (
        <div key={stat.id} className="card-elevated p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon name={stat.icon as any} size={20} className={stat.color} />
          </div>
          <div>
            <p className="tabular-nums text-xl font-700 text-foreground leading-none">
              {stat.value}{stat.suffix}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}