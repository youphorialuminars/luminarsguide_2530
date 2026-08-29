'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
import AnalysisCards from './AnalysisCards';
import SessionHistoryTable from './SessionHistoryTable';
import AttendanceCalendar from './AttendanceCalendar';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@/lib/mockData';

const ScoreBarChart = dynamic(() => import('./ScoreBarChart'), { ssr: false });
const TopicPieChart = dynamic(() => import('./TopicPieChart'), { ssr: false });

// ─── Student Reflections View (Mentor Read-Only) ──────────────────────────────
interface StudentReflection {
  id: string;
  week_start: string;
  learned_this_week: string;
  needs_work: string;
  team_dynamics: string;
  peer_appreciation: string;
  mentor_response: string | null;
  created_at: string;
}

// ─── Mic Button ────────────────────────────────────────────────────────────
function MicButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      onResult(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('Voice input error. Please try again.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
        listening ? 'bg-negative text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'
      }`}
      title={listening ? 'Stop recording' : 'Start voice input'}
    >
      <Icon name={listening ? 'StopIcon' : 'MicrophoneIcon'} size={15} />
    </button>
  );
}

function StudentReflectionsView({ studentId }: { studentId: string }) {
  const supabase = createClient();
  const [reflections, setReflections] = useState<StudentReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: studentRow } = await supabase
        .from('students')
        .select('student_user_id')
        .eq('id', studentId)
        .maybeSingle();

      if (studentRow?.student_user_id) {
        const { data } = await supabase
          .from('student_reflections')
          .select('id, week_start, learned_this_week, needs_work, team_dynamics, peer_appreciation, mentor_response, created_at')
          .eq('user_id', studentRow.student_user_id)
          .order('created_at', { ascending: false });
        setReflections(data || []);
      }
      setLoading(false);
    };
    if (studentId) load();
  }, [studentId, supabase]);

  const handleRespond = async (reflectionId: string) => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    const { error } = await supabase
      .from('student_reflections')
      .update({ mentor_response: responseText, responded_at: new Date().toISOString() })
      .eq('id', reflectionId);
    if (!error) {
      setReflections((prev) => prev.map((r) => r.id === reflectionId ? { ...r, mentor_response: responseText } : r));
      setRespondingId(null);
      setResponseText('');
    }
    setSubmittingResponse(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="ArrowPathIcon" size={22} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-700 text-foreground">Student Reflections</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
      </div>

      {reflections.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Icon name="PencilSquareIcon" size={36} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">No reflections submitted yet.</p>
        </div>
      ) : (
        reflections.map((r) => (
          <div key={r.id} className="card-elevated p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-600 text-muted-foreground">
                Week of {new Date(r.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.learned_this_week && (
              <div>
                <p className="text-xs font-700 text-primary mb-1">What I learned this week</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{r.learned_this_week}</p>
              </div>
            )}
            {r.needs_work && (
              <div>
                <p className="text-xs font-700 text-warning mb-1">Needs more work</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{r.needs_work}</p>
              </div>
            )}
            {r.team_dynamics && (
              <div>
                <p className="text-xs font-700 text-info mb-1">Team dynamics</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{r.team_dynamics}</p>
              </div>
            )}
            {r.peer_appreciation && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-700 text-amber-700 mb-1">🌟 Team Shoutout</p>
                <p className="text-sm text-amber-900 leading-relaxed">{r.peer_appreciation}</p>
              </div>
            )}
            {r.mentor_response ? (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-xs font-700 text-primary mb-1">Your Response</p>
                <p className="text-sm text-foreground/80">{r.mentor_response}</p>
              </div>
            ) : (
              <div>
                {respondingId === r.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-start">
                      <textarea
                        className="input-mystic resize-none text-sm flex-1"
                        rows={3}
                        placeholder="Write a response to this reflection..."
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                      />
                      <MicButton onResult={(text) => setResponseText((prev) => (prev ? prev + ' ' : '') + text)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRespond(r.id)} disabled={submittingResponse} className="btn-primary text-xs py-1.5 px-3">
                        {submittingResponse ? 'Sending...' : 'Send Response'}
                      </button>
                      <button onClick={() => { setRespondingId(null); setResponseText(''); }} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setRespondingId(r.id)} className="btn-ghost text-xs">
                    <Icon name="ChatBubbleLeftIcon" size={13} /> Respond
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── DB Session shape (from public.sessions) ──────────────────────────────────
interface DbSession {
  id: string;
  student_id: string;
  topic: string;
  score: number;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
  model: string;
  obs_offline_class: string;
  obs_online_task: string;
  obs_group_task: string;
  obs_mentor_call: string;
  obs_comprehensive: string;
  created_at: string;
}

// ─── DB Student shape ─────────────────────────────────────────────────────────
interface DbStudent {
  id: string;
  name: string;
  grade: string;
  age: number | null;
  gender: string | null;
  avg_score: number;
  sessions: number;
  trend: string;
  topics: string[];
  notes: string | null;
}

const AVATAR_COLORS = ['#7C6FCD', '#5BAD8F', '#D97BB6', '#5B8FD9', '#E8A020', '#C97B7B', '#7BA8C9', '#A594E8', '#8FBD8F', '#D9A05B'];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

// Map a DbSession to the legacy Session shape used by child components
function mapDbSessionToLegacy(s: DbSession): Session {
  return {
    id: s.id,
    studentId: s.student_id,
    date: s.session_date,
    topic: s.topic,
    score: s.score,
    observation: [s.obs_offline_class, s.obs_online_task, s.obs_group_task, s.obs_mentor_call, s.obs_comprehensive].filter(Boolean).join('\n\n'),
    observations: {
      offlineClass: s.obs_offline_class || '',
      onlineTask: s.obs_online_task || '',
      groupTask: s.obs_group_task || '',
      mentorCall: s.obs_mentor_call || '',
      comprehensive: s.obs_comprehensive || '',
    },
    analysis: {
      strengths: Array.isArray(s.strengths) ? s.strengths : [],
      weaknesses: Array.isArray(s.weaknesses) ? s.weaknesses : [],
      approachRequired: Array.isArray(s.approach) ? s.approach : [],
      taskList: Array.isArray(s.tasks) ? s.tasks : [],
    },
    modelUsed: s.model || 'Gemini',
    cacheHit: false,
  };
}

export default function StudentDetailView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = searchParams.get('studentId') || '';
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [taskHistoryLoading, setTaskHistoryLoading] = useState(false);
  const isNew = searchParams.get('newSession') === 'true';

  const [dbStudent, setDbStudent] = useState<DbStudent | null>(null);
  const [pickerStudents, setPickerStudents] = useState<{ id: string; name: string; grade: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [dbSessions, setDbSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'charts' | 'history' | 'attendance' | 'reflections' | 'taskHistory'>('analysis');

  useEffect(() => {
    if (!studentId || activeTab !== 'taskHistory') return;
    const loadTaskHistory = async () => {
      setTaskHistoryLoading(true);
      const { data: tasks } = await supabase
        .from('student_tasks')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (tasks && tasks.length > 0) {
        const { data: submissions } = await supabase
          .from('task_submissions')
          .select('*')
          .in('task_id', tasks.map((t) => t.id));

        const merged = tasks.map((t) => ({
          ...t,
          submission: (submissions || []).find((s) => s.task_id === t.id) || null,
        }));
        setTaskHistory(merged);
      } else {
        setTaskHistory([]);
      }
      setTaskHistoryLoading(false);
    };
    loadTaskHistory();
  }, [studentId, activeTab]);

  useEffect(() => {
    if (studentId) return; // only load the picker when no specific student was requested
    const loadPickerList = async () => {
      setPickerLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPickerLoading(false); return; }
      const { data } = await supabase
        .from('students')
        .select('id, name, grade')
        .eq('mentor_id', user.id)
        .order('name');
      setPickerStudents(data || []);
      setPickerLoading(false);
    };
    loadPickerList();
  }, [studentId]);
  
  // Load student + sessions from Supabase
  useEffect(() => {
    if (!studentId) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const [studentResult, sessionsResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, grade, age, gender, avg_score, sessions, trend, topics, notes, mentor_id')
          .eq('id', studentId)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('id, student_id, topic, score, session_date, strengths, weaknesses, approach, tasks, model, obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      ]);

      let resolvedStudent = studentResult.data;

      // Fallback: students who only exist in user_profiles (no students-table row yet)
      if (!resolvedStudent) {
        const { data: profileFallback } = await supabase
          .from('user_profiles')
          .select('id, full_name, mentor_id')
          .eq('id', studentId)
          .maybeSingle();
        if (profileFallback) {
          resolvedStudent = {
            id: profileFallback.id,
            name: profileFallback.full_name || 'Student',
            grade: '',
            age: null,
            gender: null,
            avg_score: 0,
            sessions: 0,
            trend: 'stable',
            topics: [],
            notes: '',
            mentor_id: profileFallback.mentor_id || null,
          } as DbStudent;
        }
      }

      if (resolvedStudent) setDbStudent(resolvedStudent);
      const sessions = sessionsResult.data || [];
      setDbSessions(sessions);
      if (sessions.length > 0) {
        setActiveSession(mapDbSessionToLegacy(sessions[0]));
      }
      setLoading(false);
    };
    load();
  }, [studentId]);

  // Derived legacy sessions list for child components
  const studentSessions = useMemo(() => dbSessions.map(mapDbSessionToLegacy), [dbSessions]);

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

  const scoreDelta = studentSessions.length >= 2
    ? studentSessions[0].score - studentSessions[studentSessions.length - 1].score
    : 0;

  const trendConfig = {
    up: { icon: 'ArrowTrendingUpIcon', color: 'text-positive', bg: 'bg-positive/10', label: 'Improving' },
    down: { icon: 'ArrowTrendingDownIcon', color: 'text-negative', bg: 'bg-negative/10', label: 'Declining' },
    stable: { icon: 'MinusIcon', color: 'text-info', bg: 'bg-info/10', label: 'Stable' },
  };
  const trend = trendConfig[(dbStudent?.trend as 'up' | 'down' | 'stable') || 'stable'];

  const tabs = [
    { id: 'analysis' as const, label: 'Current Analysis', icon: 'SparklesIcon' },
    { id: 'charts' as const, label: 'Progress Charts', icon: 'ChartBarIcon' },
    { id: 'history' as const, label: 'Session History', icon: 'ClockIcon' },
    { id: 'attendance' as const, label: 'Attendance', icon: 'CalendarDaysIcon' },
    { id: 'reflections' as const, label: 'Reflections', icon: 'PencilSquareIcon' },
    { id: 'taskHistory' as const, label: 'Task History', icon: 'ClipboardDocumentListIcon' },
  ];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`;
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon name="ArrowPathIcon" size={28} className="text-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading student data...</p>
      </div>
    );
  }

  // ─── No student selected — show a picker instead of a dead end ────────────
  if (!studentId) {
    return (
      <div className="max-w-lg mx-auto py-12 flex flex-col gap-4 animate-fade-in">
        <div className="text-center mb-2">
          <Icon name="ChartBarIcon" size={36} className="mx-auto mb-3 text-primary opacity-70" />
          <h2 className="font-700 text-foreground text-lg">Select a Student</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose a student to view their analysis history.</p>
        </div>
        {pickerLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : pickerStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No students linked yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pickerStudents.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/student-analysis-history?studentId=${s.id}`)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-secondary/40 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-600 text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.grade}</p>
                </div>
                <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Student ID was given but no record found ──────────────────────────────
  if (!dbStudent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Icon name="ExclamationCircleIcon" size={40} className="text-muted-foreground opacity-40" />
        <p className="font-600 text-foreground">Student not found</p>
        <p className="text-sm text-muted-foreground">This student may have been removed or you don&apos;t have access.</p>
        <button className="btn-primary mt-2" onClick={() => router.push('/student-dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const avatarColor = colorForId(dbStudent.id);
  const avatarInitials = getInitials(dbStudent.name);

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
                style={{ backgroundColor: avatarColor }}
              >
                {avatarInitials}
              </div>
              <div>
                <h1 className="text-2xl font-700 text-foreground leading-tight">{dbStudent.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {dbStudent.grade}
                  {dbStudent.age ? ` · Age ${dbStudent.age}` : ''}
                  {dbStudent.gender ? ` · ${dbStudent.gender}` : ''}
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
                onClick={() => router.push(`/new-session?studentId=${dbStudent.id}`)}
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
          { id: 'stat-sessions', label: 'Total Sessions', value: studentSessions.length, suffix: '', icon: 'ClipboardDocumentListIcon', color: 'text-primary', bg: 'bg-primary/10' },
          { id: 'stat-avg', label: 'Average Score', value: dbStudent.avg_score || 0, suffix: '', icon: 'ChartBarIcon', color: 'text-positive', bg: 'bg-positive/10' },
          { id: 'stat-topics', label: 'Pillars Covered', value: pieChartData.length, suffix: '', icon: 'BookOpenIcon', color: 'text-info', bg: 'bg-info/10' },
          { id: 'stat-delta', label: 'Score Change', value: scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`, suffix: ' pts', icon: scoreDelta >= 0 ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon', color: scoreDelta >= 0 ? 'text-positive' : 'text-negative', bg: scoreDelta >= 0 ? 'bg-positive/10' : 'bg-negative/10' },
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
      {activeSession && activeTab !== 'attendance' && (
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
          </div>
        </div>
      )}

      {/* No sessions yet */}
      {studentSessions.length === 0 && (
        <div className="card-elevated p-10 text-center mb-5">
          <Icon name="ClipboardDocumentListIcon" size={36} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-600 text-foreground">No sessions yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Start a new session to generate AI-powered analysis for this student.</p>
          <button className="btn-primary" onClick={() => router.push(`/new-session?studentId=${dbStudent.id}`)}>
            <Icon name="PlusCircleIcon" size={16} /> Start First Session
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-5 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 transition-all duration-150 flex-shrink-0 justify-center ${
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
      {activeTab === 'analysis' && activeSession && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-700 text-foreground">AI-Generated Analysis</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="SparklesIcon" size={13} className="text-primary" />
              Powered by {activeSession.modelUsed}
            </div>
          </div>

          {/* Observation Summary */}
          {activeSession.observations && (
            <div className="card-elevated p-4 mb-4">
              <p className="section-label mb-3">Mentor Observations (5 Areas)</p>
              <div className="flex flex-col gap-3">
                {[
                  { key: 'offlineClass', label: 'Offline Class', icon: 'BuildingLibraryIcon' },
                  { key: 'onlineTask', label: 'Online Task', icon: 'ComputerDesktopIcon' },
                  { key: 'groupTask', label: 'Group Task', icon: 'UserGroupIcon' },
                  { key: 'mentorCall', label: 'Mentor Call', icon: 'PhoneIcon' },
                  { key: 'comprehensive', label: 'Comprehensive', icon: 'ClipboardDocumentListIcon' },
                ].map((field) => {
                  const val = activeSession.observations?.[field.key as keyof typeof activeSession.observations];
                  if (!val) return null;
                  return (
                    <div key={field.key} className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name={field.icon as any} size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-700 text-muted-foreground mb-0.5">{field.label}</p>
                        <p className="text-sm text-foreground/80 leading-relaxed italic">&ldquo;{val}&rdquo;</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AnalysisCards analysis={activeSession.analysis} isNew={isNew} studentId={dbStudent.id} mentorId={dbStudent.mentor_id} />
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-700 text-foreground mb-4">Progress Visualizations</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className="font-700 text-foreground text-base">Score Progression</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Test scores across all sessions</p>
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
                  <p className="tabular-nums text-lg font-700 text-primary">{dbStudent.avg_score || '—'}</p>
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

            <div className="card-elevated p-5">
              <div className="mb-1">
                <h3 className="font-700 text-foreground text-base">Pillar Distribution</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sessions by core educational pillar</p>
              </div>
              {pieChartData.length > 0 ? (
                <TopicPieChart data={pieChartData} />
              ) : (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No pillar data yet</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="section-label mb-2">Pillar Performance Summary</p>
                <div className="flex flex-col gap-1.5">
                  {pieChartData.map((d, i) => (
                    <div key={`topic-summary-${i}`} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-foreground font-500 truncate max-w-[200px]">{d.topic}</p>
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
            activeSessionId={activeSession?.id || ''}
            onSelectSession={(session) => {
              setActiveSession(session);
              setActiveTab('analysis');
            }}
          />
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-700 text-foreground">Attendance Tracker</h2>
            <p className="text-sm text-muted-foreground">Click any date to mark attendance</p>
          </div>
          <AttendanceCalendar studentId={dbStudent.id} />
        </div>
      )}

      {activeTab === 'reflections' && (
        <StudentReflectionsView studentId={studentId} />
      )}

      {activeTab === 'taskHistory' && (
        <div className="card-mystic p-5">
          <h2 className="text-lg font-700 text-foreground mb-4">Task History</h2>
          {taskHistoryLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : taskHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks assigned to this student yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {taskHistory.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                      t.status === 'Completed' ? 'bg-positive/10 text-positive border-positive/20'
                        : t.status === 'In Progress' ? 'bg-info/10 text-info border-info/20' : 'bg-muted text-muted-foreground border-border'
                    }`}>{t.status}</span>
                    <span className="text-xs text-muted-foreground">
                      Assigned {formatDate(t.created_at)}
                      {t.deadline ? ` · Due ${formatDate(t.deadline)}` : ''}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-2">{t.task_description}</p>
                  {t.submission ? (
                    <div className="mt-2 p-2.5 rounded-lg bg-card border border-border">
                      <a href={t.submission.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5 mb-1">
                        <Icon name="DocumentIcon" size={13} /> {t.submission.file_name}
                      </a>
                      {t.submission.mentor_rating ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-amber-500 text-sm">{'⭐'.repeat(t.submission.mentor_rating)}</span>
                          {t.submission.mentor_comments && (
                            <p className="text-xs text-foreground/80 italic">"{t.submission.mentor_comments}"</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting your review</span>
                      )}
                    </div>
                  ) : t.requires_submission ? (
                    <p className="text-xs text-muted-foreground italic">File required — not yet submitted</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Notes */}
      {dbStudent.notes && (
        <div className="card-elevated p-4 mt-5 flex items-start gap-3">
          <Icon name="PencilSquareIcon" size={17} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="section-label mb-1">Mentor Notes</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{dbStudent.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}