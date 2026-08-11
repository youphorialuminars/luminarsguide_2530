import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface StatsStripProps {
  totalStudents: number;
  sessionsThisWeek: number;
  averageScore: number;
  studentsNeedingAttention: number;
  onNeedsAttentionClick?: () => void;
}

export default function DashboardStatsStrip({
  totalStudents,
  sessionsThisWeek,
  averageScore,
  studentsNeedingAttention,
  onNeedsAttentionClick,
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
      clickable: false,
    },
    {
      id: 'stat-sessions',
      label: 'Sessions This Week',
      value: sessionsThisWeek,
      icon: 'CalendarDaysIcon',
      color: 'text-info',
      bg: 'bg-info/10',
      suffix: '',
      clickable: false,
    },
    {
      id: 'stat-avg',
      label: 'Average Score',
      value: averageScore,
      icon: 'ChartBarIcon',
      color: 'text-positive',
      bg: 'bg-positive/10',
      suffix: '%',
      clickable: false,
    },
    {
      id: 'stat-attention',
      label: 'Need Attention',
      value: studentsNeedingAttention,
      icon: 'ExclamationTriangleIcon',
      color: 'text-warning',
      bg: 'bg-warning/10',
      suffix: '',
      clickable: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => {
        const inner = (
          <>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={stat.icon as any} size={20} className={stat.color} />
            </div>
            <div>
              <p className="tabular-nums text-xl font-700 text-foreground leading-none">
                {stat.value}{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-500">{stat.label}</p>
            </div>
            {stat.clickable && onNeedsAttentionClick && (
              <div className="ml-auto flex-shrink-0">
                <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground" />
              </div>
            )}
          </>
        );

        if (stat.clickable && onNeedsAttentionClick) {
          return (
            <button
              key={stat.id}
              onClick={onNeedsAttentionClick}
              className="card-elevated p-4 flex items-center gap-3 w-full text-left hover:border-warning/40 hover:shadow-md transition-all duration-150 cursor-pointer"
              title="View students needing attention"
            >
              {inner}
            </button>
          );
        }

        return (
          <div key={stat.id} className="card-elevated p-4 flex items-center gap-3">
            {inner}
          </div>
        );
      })}
    </div>
  );
}