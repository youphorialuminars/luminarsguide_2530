'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import type { Student } from '@/lib/mockData';

interface StudentCardProps {
  student: Student;
}

const trendConfig = {
  up: { icon: 'ArrowTrendingUpIcon', color: 'text-positive', bg: 'bg-positive/10', label: 'Improving' },
  down: { icon: 'ArrowTrendingDownIcon', color: 'text-negative', bg: 'bg-negative/10', label: 'Declining' },
  stable: { icon: 'MinusIcon', color: 'text-info', bg: 'bg-info/10', label: 'Stable' },
};

export default function StudentCard({ student }: StudentCardProps) {
  const router = useRouter();
  const trend = trendConfig[student.scoreTrend];

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parts[2]}`;
  };

  return (
    <div
      className="card-elevated p-5 cursor-pointer group hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col gap-4"
      onClick={() => router.push(`/student-analysis-history?studentId=${student.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View profile for ${student.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/student-analysis-history?studentId=${student.id}`);
      }}
    >
      {/* Avatar + Name */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-700 text-sm flex-shrink-0 shadow-sm"
            style={{ backgroundColor: student.avatarColor }}
          >
            {student.avatarInitials}
          </div>
          <div>
            <h3 className="font-700 text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
              {student.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{student.grade}</p>
            {(student.age || student.gender) && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {[student.age ? `Age ${student.age}` : null, student.gender].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-600 ${trend.bg} ${trend.color}`}>
          <Icon name={trend.icon as any} size={12} />
          {trend.label}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-500 mb-0.5">Avg. Score</p>
          <p className="tabular-nums text-2xl font-700 text-foreground">{student.averageScore}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-500 mb-0.5">Sessions</p>
          <p className="tabular-nums text-2xl font-700 text-foreground">{student.sessionCount}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-500 mb-0.5">Last Session</p>
          <p className="text-sm font-600 text-foreground">{formatDate(student.lastSessionDate)}</p>
        </div>
      </div>

      {/* Topics */}
      <div className="flex flex-wrap gap-1.5">
        {student.primaryTopics.slice(0, 2).map((topic) => {
          const short = topic.split(' — ')[1] || topic.split(' — ')[0];
          const shortLabel = short.length > 22 ? short.slice(0, 22) + '…' : short;
          return (
            <span
              key={`topic-${student.id}-${short.slice(0, 10)}`}
              className="status-badge badge-muted text-xs"
              title={topic}
            >
              {shortLabel}
            </span>
          );
        })}
        {student.primaryTopics.length > 2 && (
          <span className="status-badge badge-muted text-xs">
            +{student.primaryTopics.length - 2}
          </span>
        )}
      </div>

      {/* CTA row */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/new-session?studentId=${student.id}`);
          }}
        >
          <Icon name="PlusCircleIcon" size={13} />
          New Session
        </button>
        <span className="text-xs text-primary font-600 flex items-center gap-1 group-hover:gap-2 transition-all">
          View History
          <Icon name="ArrowRightIcon" size={12} />
        </span>
      </div>
    </div>
  );
}