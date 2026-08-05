import React from 'react';
import Icon from '@/components/ui/AppIcon';
import type { SessionAnalysis } from '@/lib/mockData';

interface AnalysisCardsProps {
  analysis: SessionAnalysis;
  isNew?: boolean;
}

const sections = [
  {
    key: 'strengths' as keyof SessionAnalysis,
    label: 'Strengths',
    icon: 'StarIcon',
    color: 'text-positive',
    bg: 'bg-positive/8',
    border: 'border-positive/20',
    dotColor: 'bg-positive',
    headerBg: 'bg-positive/10',
  },
  {
    key: 'weaknesses' as keyof SessionAnalysis,
    label: 'Areas to Develop',
    icon: 'ExclamationTriangleIcon',
    color: 'text-negative',
    bg: 'bg-negative/8',
    border: 'border-negative/20',
    dotColor: 'bg-negative',
    headerBg: 'bg-negative/10',
  },
  {
    key: 'approachRequired' as keyof SessionAnalysis,
    label: 'Approach Required',
    icon: 'LightBulbIcon',
    color: 'text-info',
    bg: 'bg-info/8',
    border: 'border-info/20',
    dotColor: 'bg-info',
    headerBg: 'bg-info/10',
  },
  {
    key: 'taskList' as keyof SessionAnalysis,
    label: 'Task List',
    icon: 'ClipboardDocumentListIcon',
    color: 'text-accent-foreground',
    bg: 'bg-accent/8',
    border: 'border-accent/20',
    dotColor: 'bg-accent',
    headerBg: 'bg-accent/10',
  },
] as const;

export default function AnalysisCards({ analysis, isNew }: AnalysisCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section, sIdx) => {
        const items = analysis[section.key] as string[];
        return (
          <div
            key={`analysis-${section.key}`}
            className={`rounded-xl border ${section.border} overflow-hidden ${isNew ? 'animate-slide-up' : ''}`}
            style={{ animationDelay: isNew ? `${sIdx * 80}ms` : undefined }}
          >
            <div className={`flex items-center gap-2.5 px-4 py-3 ${section.headerBg} border-b ${section.border}`}>
              <div className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center">
                <Icon name={section.icon as any} size={15} className={section.color} />
              </div>
              <h3 className={`font-700 text-sm ${section.color}`}>{section.label}</h3>
              <span className={`ml-auto text-xs font-600 px-2 py-0.5 rounded-full bg-white/50 ${section.color}`}>
                {items.length} point{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="p-4 flex flex-col gap-2.5">
              {items.map((item, i) => (
                <li key={`${section.key}-item-${i}`} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${section.dotColor} mt-1.5 flex-shrink-0`} />
                  <p className="text-sm text-foreground leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}