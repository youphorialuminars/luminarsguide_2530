'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { SessionAnalysis } from '@/lib/mockData';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface AnalysisCardsProps {
  analysis: SessionAnalysis;
  isNew?: boolean;
  studentId?: string;
  mentorId?: string;
}

const sections = [
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
    label: 'AI-Suggested Tasks',
    icon: 'ClipboardDocumentListIcon',
    color: 'text-accent-foreground',
    bg: 'bg-accent/8',
    border: 'border-accent/20',
    dotColor: 'bg-accent',
    headerBg: 'bg-accent/10',
  },
] as const;

export default function AnalysisCards({ analysis, isNew, studentId, mentorId }: AnalysisCardsProps) {
  const supabase = createClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignedItems, setAssignedItems] = useState<Set<number>>(new Set());

  const toggleSelected = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAssignSelected = async () => {
    if (!studentId || !mentorId) {
      toast.error('Missing student or mentor context — cannot assign.');
      return;
    }
    if (selected.size === 0) {
      toast.error('Select at least one task to assign.');
      return;
    }
    setAssigning(true);
    const taskList = (analysis.taskList as string[]) || [];
    const inserts = Array.from(selected).map((idx) => ({
      student_id: studentId,
      mentor_id: mentorId,
      task_description: taskList[idx],
      priority_rating: 2,
      status: 'Pending',
      deadline,
    }));
    const { error } = await supabase.from('student_tasks').insert(inserts);
    if (error) {
      toast.error('Failed to assign tasks: ' + error.message);
    } else {
      toast.success(`${inserts.length} task(s) assigned to the student!`);
      setAssignedItems((prev) => new Set([...prev, ...selected]));
      setSelected(new Set());
    }
    setAssigning(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section, sIdx) => {
        const items = analysis[section.key] as string[];
        const isTaskSection = section.key === 'taskList';

        return (
          <div
            key={`analysis-${section.key}`}
            className={`rounded-xl border ${section.border} overflow-hidden ${isNew ? 'animate-slide-up' : ''} ${isTaskSection ? 'md:col-span-2' : ''}`}
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

            {isTaskSection ? (
              <div className="p-4 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  These are AI suggestions only. Select the ones you want to actually assign to the student, then confirm below.
                </p>
                <ul className="flex flex-col gap-2">
                  {items.map((item, i) => {
                    const isAssigned = assignedItems.has(i);
                    return (
                      <li key={`taskList-item-${i}`} className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 rounded border-border flex-shrink-0"
                          checked={selected.has(i)}
                          disabled={isAssigned}
                          onChange={() => toggleSelected(i)}
                        />
                        <p className={`text-sm leading-relaxed ${isAssigned ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {item} {isAssigned && <span className="text-xs text-positive font-600 no-underline">(assigned)</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border/50">
                  <label className="text-xs font-600 text-foreground">Deadline for selected:</label>
                  <input
                    type="date"
                    className="input-mystic text-xs w-auto py-1"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <button
                    className="btn-primary text-xs py-1.5 px-4 ml-auto"
                    onClick={handleAssignSelected}
                    disabled={assigning || selected.size === 0}
                  >
                    {assigning ? 'Assigning...' : `Assign Selected (${selected.size})`}
                  </button>
                </div>
              </div>
            ) : (
              <ul className="p-4 flex flex-col gap-2.5">
                {items.map((item, i) => (
                  <li key={`${section.key}-item-${i}`} className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${section.dotColor} mt-1.5 flex-shrink-0`} />
                    <p className="text-sm text-foreground leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}