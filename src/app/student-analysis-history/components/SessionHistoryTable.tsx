'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { Session } from '@/lib/mockData';

interface SessionHistoryTableProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (session: Session) => void;
}

type SortKey = 'date' | 'topic' | 'score';
type SortDir = 'asc' | 'desc';

export default function SessionHistoryTable({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionHistoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...sessions].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
    if (sortKey === 'topic') cmp = a.topic.localeCompare(b.topic);
    if (sortKey === 'score') cmp = a.score - b.score;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`;
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'badge-positive';
    if (score >= 65) return 'badge-info';
    if (score >= 50) return 'badge-warning';
    return 'badge-negative';
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Icon name="ChevronUpDownIcon" size={13} className="text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={13} className="text-primary" />
      : <Icon name="ChevronDownIcon" size={13} className="text-primary" />;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/60 border-b border-border">
            <th className="text-left px-4 py-3">
              <button
                className="flex items-center gap-1.5 section-label hover:text-foreground transition-colors"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon col="date" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                className="flex items-center gap-1.5 section-label hover:text-foreground transition-colors"
                onClick={() => handleSort('topic')}
              >
                Topic / Pillar <SortIcon col="topic" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                className="flex items-center gap-1.5 section-label hover:text-foreground transition-colors"
                onClick={() => handleSort('score')}
              >
                Score <SortIcon col="score" />
              </button>
            </th>
            <th className="text-left px-4 py-3 section-label">Model Used</th>
            <th className="text-left px-4 py-3 section-label">Cache</th>
            <th className="text-right px-4 py-3 section-label">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((session, idx) => {
            const isActive = session.id === activeSessionId;
            return (
              <tr
                key={session.id}
                className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : idx % 2 === 0
                    ? 'bg-card hover:bg-secondary/40' :'bg-secondary/20 hover:bg-secondary/40'
                }`}
                onClick={() => onSelectSession(session)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-sm font-500 text-foreground">{formatDate(session.date)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-foreground font-500 max-w-[200px] truncate" title={session.topic}>
                    {session.topic}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${getScoreBadge(session.score)} tabular-nums`}>
                    {session.score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground font-500">{session.modelUsed}</span>
                </td>
                <td className="px-4 py-3">
                  {session.cacheHit ? (
                    <span className="status-badge badge-warning text-xs">
                      <Icon name="BoltIcon" size={11} /> Hit
                    </span>
                  ) : (
                    <span className="status-badge badge-muted text-xs">New</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className={`text-xs font-600 flex items-center gap-1 ml-auto transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    }`}
                    onClick={(e) => { e.stopPropagation(); onSelectSession(session); }}
                  >
                    {isActive ? (
                      <><Icon name="EyeIcon" size={13} /> Viewing</>
                    ) : (
                      <><Icon name="ArrowRightIcon" size={13} /> View</>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground mb-3" />
          <p className="font-600 text-foreground text-sm mb-1">No sessions yet</p>
          <p className="text-xs text-muted-foreground">
            Sessions will appear here after the first analysis is submitted.
          </p>
        </div>
      )}
    </div>
  );
}