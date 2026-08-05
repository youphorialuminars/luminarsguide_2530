'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
import { mockStudents, mockSessions } from '@/lib/mockData';
import type { Session } from '@/lib/mockData';
import AnalysisCards from './AnalysisCards';
import SessionHistoryTable from './SessionHistoryTable';

const ScoreBarChart = dynamic(() => import('./ScoreBarChart'), { ssr: false });
const TopicPieChart = dynamic(() => import('./TopicPieChart'), { ssr: false });

export default function AnalysisHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get('studentId') || 'student-001';
  const isNew = searchParams.get('newSession') === 'true';

  const student = mockStudents.find((s) => s.id === studentId) || mockStudents[0];
  const studentSessions = mockSessions.filter((s) => s.studentId === student.id);

  const [activeSession, setActiveSession] = useState<Session>(
    studentSessions[0] || mockSessions[0]
  );
  const [activeTab, setActiveTab] = useState<'analysis' | 'charts' | 'history'>('analysis');

  const barChartData = useMemo(() => {
    return [...studentSessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const parts = s.date.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          date: `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`,
          score: s.score,
          topic: s.topic,
        };
      });
  }, [studentSessions]);

  const pieChartData = useMemo(() => {
    const topicMap: Record<string, { count: number; totalScore: number }> = {};
    studentSessions.forEach((s) => {
      const short = s.topic.split(' — ')[1] || s.topic;
      if (!topicMap[short]) topicMap[short] = { count: 0, totalScore: 0 };
      topicMap[short].count++;
      topicMap[short].totalScore += s.score;
    });
    return Object.entries(topicMap).map(([topic, d]) => ({
      topic,
      count: d.count,
      avgScore: Math.round(d.totalScore / d.count),
    }));
  }, [studentSessions]);

  const scoreDelta =
    studentSessions.length >= 2
      ? studentSessions[0].score - studentSessions[studentSessions.length - 1].score
      : 0;

  const trendConfig = {
    up: { icon: 'ArrowTrendingUpIcon', color: 'text-positive', bg: 'bg-positive/10', label: 'Improving' },
    down: { icon: 'ArrowTrendingDownIcon', color: 'text-negative', bg: 'bg-negative/10', label: 'Declining' },
    stable: { icon: 'MinusIcon', color: 'text-info', bg: 'bg-info/10', label: 'Stable' },
  };
  const trend = trendConfig[student.scoreTrend];

  const tabs = [
    { id: 'analysis' as const, label: 'Current Analysis', icon: 'SparklesIcon' },
    { id: 'charts' as const, label: 'Progress Charts', icon: 'ChartBarIcon' },
    { id: 'history' as const, label: 'Session History', icon: 'ClockIcon' },
  ];

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`;
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => router.push('/student-dashboard')}
          className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors mt-0.5 flex-shrink-0"
          aria-label="Back to dashboard"
        >
          <Icon name="ArrowLeftIcon" size={17} className="text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-700 text-sm flex-shrink-0 shadow-sm"
                style={{ backgroundColor: student.avatarColor }}
              >
                {student.avatarInitials}
              </div>
              <div>
                <h1 className="text-2xl font-700 text-foreground leading-tight">{student.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {student.grade} · Enrolled {formatDate(student.enrolledDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-600 ${trend.bg} ${trend.color}`}>
                <Icon name={trend.icon as any} size={15} />
                {trend.label}
              </div>
              <button
                className="btn-primary text-sm py-2"
                onClick={() => router.push(`/new-session?studentId=${student.id}`)}
              >
                <Icon name="PlusCircleIcon" size={16} />
                New Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            id: 'stat-sessions',
            label: 'Total Sessions',
            value: studentSessions.length,
            suffix: '',
            icon: 'ClipboardDocumentListIcon',
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            id: 'stat-avg',
            label: 'Average Score',
            value: student.averageScore,
            suffix: '',
            icon: 'ChartBarIcon',
            color: 'text-positive',
            bg: 'bg-positive/10',
          },
          {
            id: 'stat-topics',
            label: 'Topics Covered',
            value: pieChartData.length,
            suffix: '',
            icon: 'BookOpenIcon',
            color: 'text-info',
            bg: 'bg-info/10',
          },
          {
            id: 'stat-delta',
            label: 'Score Change',
            value: scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`,
            suffix: ' pts',
            icon: scoreDelta >= 0 ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon',
            color: scoreDelta >= 0 ? 'text-positive' : 'text-negative',
            bg: scoreDelta >= 0 ? 'bg-positive/10' : 'bg-negative/10',
          },
        ].map((stat) => (
          <div key={stat.id} className="card-elevated p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={stat.icon as any} size={18} className={stat.color} />
            </div>
            <div>
              <p className={`tabular-nums text-xl font-700 ${stat.color} leading-none`}>
                {stat.value}{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* New session banner */}
      {isNew && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-positive/10 border border-positive/20 mb-5 animate-slide-up">
          <Icon name="CheckCircleIcon" size={20} className="text-positive flex-shrink-0" />
          <div>
            <p className="text-sm font-700 text-positive">Analysis Generated Successfully</p>
            <p className="text-xs text-positive/80 mt-0.5">
              The latest session has been analysed and stored. Review the results below.
            </p>
          </div>
        </div>
      )}

      {/* Active Session Context */}
      <div className="card-elevated p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-500">Viewing analysis for session</p>
            <p className="text-sm font-700 text-foreground">
              {formatDate(activeSession.date)} · {activeSession.topic}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`status-badge tabular-nums ${
            activeSession.score >= 80 ? 'badge-positive' :
            activeSession.score >= 65 ? 'badge-info' :
            activeSession.score >= 50 ? 'badge-warning' : 'badge-negative'
          }`}>
            Score: {activeSession.score}
          </span>
          <span className="text-xs text-muted-foreground font-500">{activeSession.modelUsed}</span>
          {activeSession.cacheHit && (
            <span className="status-badge badge-warning text-xs">
              <Icon name="BoltIcon" size={11} /> Cached
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-5 w-full sm:w-auto sm:inline-flex">
        {tabs.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 transition-all duration-150 flex-1 sm:flex-none justify-center ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-700 text-foreground">AI-Generated Analysis</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="SparklesIcon" size={13} className="text-primary" />
              Powered by {activeSession.modelUsed}
            </div>
          </div>

          {/* Observation Summary */}
          <div className="card-elevated p-4 mb-4 border-l-4 border-l-muted-foreground/30">
            <p className="section-label mb-2">Mentor Observation</p>
            <p className="text-sm text-foreground/80 leading-relaxed italic">
              &ldquo;{activeSession.observation}&rdquo;
            </p>
          </div>

          <AnalysisCards analysis={activeSession.analysis} isNew={isNew} />
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-700 text-foreground mb-4">Progress Visualizations</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Bar Chart */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className="font-700 text-foreground text-base">Score Progression</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Test scores across all sessions</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-0.5 bg-accent rounded-full" />
                    Average
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded bg-primary/60" />
                    Score
                  </div>
                </div>
              </div>

              {barChartData.length > 0 ? (
                <ScoreBarChart data={barChartData} />
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No session data yet</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="tabular-nums text-lg font-700 text-foreground">
                    {barChartData.length > 0 ? Math.min(...barChartData.map((d) => d.score)) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Lowest</p>
                </div>
                <div className="text-center">
                  <p className="tabular-nums text-lg font-700 text-primary">
                    {student.averageScore || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Average</p>
                </div>
                <div className="text-center">
                  <p className="tabular-nums text-lg font-700 text-foreground">
                    {barChartData.length > 0 ? Math.max(...barChartData.map((d) => d.score)) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Highest</p>
                </div>
                <div className="text-center">
                  <p className={`tabular-nums text-lg font-700 ${scoreDelta >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                  </p>
                  <p className="text-xs text-muted-foreground">Overall Δ</p>
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="card-elevated p-5">
              <div className="mb-1">
                <h3 className="font-700 text-foreground text-base">Topic Distribution</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sessions by subject area</p>
              </div>

              {pieChartData.length > 0 ? (
                <TopicPieChart data={pieChartData} />
              ) : (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No topic data yet</p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <p className="section-label mb-2">Topic Performance Summary</p>
                <div className="flex flex-col gap-1.5">
                  {pieChartData.map((d, i) => (
                    <div key={`topic-summary-${i}`} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-foreground font-500 truncate max-w-[160px]">{d.topic}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">{d.count} session{d.count !== 1 ? 's' : ''}</span>
                        <span className={`status-badge text-xs tabular-nums ${
                          d.avgScore >= 80 ? 'badge-positive' :
                          d.avgScore >= 65 ? 'badge-info' :
                          d.avgScore >= 50 ? 'badge-warning' : 'badge-negative'
                        }`}>
                          {d.avgScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-700 text-foreground">Session History</h2>
            <p className="text-sm text-muted-foreground">
              {studentSessions.length} session{studentSessions.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          <SessionHistoryTable
            sessions={studentSessions}
            activeSessionId={activeSession.id}
            onSelectSession={(session) => {
              setActiveSession(session);
              setActiveTab('analysis');
            }}
          />
        </div>
      )}

      {/* Student Notes */}
      {student.notes && (
        <div className="card-elevated p-4 mt-5 flex items-start gap-3">
          <Icon name="PencilSquareIcon" size={17} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="section-label mb-1">Mentor Notes</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{student.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}