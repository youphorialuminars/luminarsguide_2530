'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParentProfile {
  id: string;
  full_name: string;
  role: string;
  linked_student_id: string | null;
}

interface LinkedStudent {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  avg_score: number;
  sessions: number;
  trend: string;
  topics: string[];
}

interface MentorProfile {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
}

interface Task {
  id: string;
  task_description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority_rating: number;
  deadline: string | null;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface Session {
  id: string;
  topic: string;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
}

interface MentorFeedback {
  id: string;
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
  created_at: string;
}

interface ParentObservation {
  id: string;
  observation_text: string;
  program_experience: string;
  created_at: string;
}

interface ParentQuery {
  id: string;
  parent_id: string;
  recipient_role: 'mentor' | 'counselor';
  message: string;
  status: 'open' | 'replied' | 'closed';
  reply: string | null;
  created_at: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  userId: string;
}

// ─── Quest Tier Logic ─────────────────────────────────────────────────────────
function getQuestTier(completedCount: number) {
  if (completedCount >= 15) return { name: 'Trailblazer', icon: '🔥', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', nextAt: null, progress: 100 };
  if (completedCount >= 5) return { name: 'Pathfinder', icon: '🧭', color: 'from-violet-400 to-purple-500', textColor: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200', nextAt: 15, progress: Math.round(((completedCount - 5) / 10) * 100) };
  return { name: 'Explorer', icon: '🌱', color: 'from-sky-400 to-blue-500', textColor: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-200', nextAt: 5, progress: Math.round((completedCount / 5) * 100) };
}

// ─── Attendance Calendar ──────────────────────────────────────────────────────
function AttendanceCalendarView({ records }: { records: AttendanceRecord[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const recordMap = new Map(records.map((r) => [r.attendance_date, r.status]));
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <Icon name="ChevronLeftIcon" size={15} />
        </button>
        <span className="text-sm font-700 text-foreground">{monthNames[month]} {year}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <Icon name="ChevronRightIcon" size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
          <div key={d} className="text-center text-xs font-600 text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = recordMap.get(dateStr);
          return (
            <div key={dateStr} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-600 transition-colors ${
              status === 'present' ? 'bg-[#C8F0D8] text-green-800 border border-green-200'
                : status === 'absent' ? 'bg-[#F5C6C9] text-red-800 border border-red-200'
                : 'text-foreground hover:bg-secondary'
            }`}>{day}</div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#C8F0D8] border border-green-200" />Present ({presentCount})</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#F5C6C9] border border-red-200" />Absent ({absentCount})</div>
      </div>
    </div>
  );
}

// ─── Main Parents Hub Dashboard ───────────────────────────────────────────────
export default function ParentsHubContent() {
  const router = useRouter();
  const supabase = createClient();

  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [linkedStudent, setLinkedStudent] = useState<LinkedStudent | null>(null);
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mentorFeedbacks, setMentorFeedbacks] = useState<MentorFeedback[]>([]);
  const [parentObservations, setParentObservations] = useState<ParentObservation[]>([]);
  const [parentQueries, setParentQueries] = useState<ParentQuery[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'mentor' | 'action' | 'leaderboard'>('overview');

  // Observation form
  const [obsForm, setObsForm] = useState({ observation_text: '', program_experience: '' });
  const [submittingObs, setSubmittingObs] = useState(false);

  // Suggestion box
  const [suggestionText, setSuggestionText] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  // Query form
  const [queryForm, setQueryForm] = useState({ recipient_role: 'mentor\' as \'mentor\' | \'counselor', message: '' });
  const [submittingQuery, setSubmittingQuery] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (!profile || profile.role !== 'parent') { router.push('/sign-up-login'); return; }
      setParentProfile(profile);

      if (!profile.linked_student_id) {
        setLoading(false);
        return;
      }

      // Load linked student
      const { data: student } = await supabase
        .from('students')
        .select('id, name, grade, mentor_id, avg_score, sessions, trend, topics')
        .eq('id', profile.linked_student_id)
        .single();
      setLinkedStudent(student);

      if (student) {
        // Load mentor profile
        if (student.mentor_id) {
          const { data: mentor } = await supabase
            .from('user_profiles')
            .select('id, full_name, email, mentor_code')
            .eq('id', student.mentor_id)
            .single();
          setMentorProfile(mentor);
        }

        const [taskResult, attResult, sessResult, mfResult] = await Promise.all([
          supabase.from('student_tasks').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
          supabase.from('attendance').select('attendance_date, status').eq('student_id', student.id).order('attendance_date', { ascending: false }),
          supabase.from('sessions').select('id, topic, session_date, strengths, weaknesses').eq('student_id', student.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('mentor_feedback').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
        ]);

        setTasks(taskResult.data || []);
        setAttendance(attResult.data || []);
        setSessions(sessResult.data || []);
        setMentorFeedbacks(mfResult.data || []);
      }

      // Load parent's own observations and queries
      const [obsResult, queriesResult] = await Promise.all([
        supabase.from('parent_observations').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
        supabase.from('parent_queries').select('*').eq('parent_id', user.id).order('created_at', { ascending: false }),
      ]);
      setParentObservations(obsResult.data || []);
      setParentQueries(queriesResult.data || []);

      // Build leaderboard from parent_observations for this student
      if (profile.linked_student_id) {
        const { data: allObs } = await supabase
          .from('parent_observations')
          .select('submitted_by')
          .eq('student_id', profile.linked_student_id);

        const { data: allQueries } = await supabase
          .from('parent_queries')
          .select('parent_id');

        if (allObs) {
          const scoreMap = new Map<string, number>();
          allObs.forEach((o) => { scoreMap.set(o.submitted_by, (scoreMap.get(o.submitted_by) || 0) + 1); });
          if (allQueries) {
            allQueries.forEach((q) => { scoreMap.set(q.parent_id, (scoreMap.get(q.parent_id) || 0) + 1); });
          }
          const userIds = Array.from(scoreMap.keys());
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
            const lb = (profiles || []).map((p) => ({ name: p.full_name || 'Parent', score: scoreMap.get(p.id) || 0, userId: p.id }));
            lb.sort((a, b) => b.score - a.score);
            setLeaderboard(lb);
          }
        }
      }
    } catch (err) {
      console.error('Error loading parents hub:', err);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitObservation = async () => {
    if (!obsForm.observation_text.trim()) { toast.error('Please add your observation notes.'); return; }
    if (!linkedStudent) { toast.error('No linked student found.'); return; }
    setSubmittingObs(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('parent_observations').insert({
      student_id: linkedStudent.id,
      submitted_by: user.id,
      observation_text: obsForm.observation_text,
      program_experience: obsForm.program_experience,
    });
    if (error) { toast.error('Failed to submit observation.'); } else {
      toast.success('Observation submitted!');
      setObsForm({ observation_text: '', program_experience: '' });
      loadData();
    }
    setSubmittingObs(false);
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionText.trim()) { toast.error('Please enter your suggestion.'); return; }
    if (!linkedStudent) { toast.error('No linked student found.'); return; }
    setSubmittingSuggestion(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Store suggestions as parent_observations with a special prefix
    const { error } = await supabase.from('parent_observations').insert({
      student_id: linkedStudent.id,
      submitted_by: user.id,
      observation_text: `[SUGGESTION] ${suggestionText}`,
      program_experience: '',
    });
    if (error) { toast.error('Failed to submit suggestion.'); } else {
      toast.success('Suggestion submitted!');
      setSuggestionText('');
      loadData();
    }
    setSubmittingSuggestion(false);
  };

  const handleSubmitQuery = async () => {
    if (!queryForm.message.trim()) { toast.error('Please enter your message.'); return; }
    setSubmittingQuery(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('parent_queries').insert({
      parent_id: user.id,
      recipient_role: queryForm.recipient_role,
      message: queryForm.message,
      status: 'open',
    });
    if (error) { toast.error('Failed to send query.'); } else {
      toast.success('Query sent successfully!');
      setQueryForm({ recipient_role: 'mentor', message: '' });
      loadData();
    }
    setSubmittingQuery(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Parents Hub...</p>
        </div>
      </div>
    );
  }

  if (!parentProfile?.linked_student_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
          <Icon name="HomeIcon" size={28} className="text-violet-500" />
        </div>
        <h2 className="text-xl font-700 text-foreground mb-2">No Student Linked</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your account is not linked to a student yet. Ask your child to generate a Parent Link Code from their Network &amp; Links page, then contact support to link your account.
        </p>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const tier = getQuestTier(completedTasks);
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const tabs = [
    { id: 'overview' as const, label: "Child's Overview", icon: 'UserIcon' },
    { id: 'mentor' as const, label: 'Mentor Overview', icon: 'AcademicCapIcon' },
    { id: 'action' as const, label: 'Action Center', icon: 'BoltIcon' },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: 'TrophyIcon' },
  ];

  return (
    <div className="animate-fade-in">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">
            Parents Hub 🏠
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {linkedStudent ? `Monitoring: ${linkedStudent.name}` : 'Your child\'s progress at a glance'}
          </p>
        </div>
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-lg ${tier.bgColor}`}>
          <span className="text-2xl">{tier.icon}</span>
          <div>
            <p className="text-xs text-muted-foreground font-500">Child&apos;s Quest Tier</p>
            <p className={`text-base font-800 ${tier.textColor}`}>{tier.name}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-600 whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} variant={activeTab === tab.id ? 'solid' : 'outline'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CHILD'S OVERVIEW TAB ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Read-Only Banner */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/5 border border-info/20">
            <Icon name="EyeIcon" size={15} className="text-info flex-shrink-0" />
            <p className="text-xs text-muted-foreground">This section is <span className="font-600 text-foreground">read-only</span>. You can view your child&apos;s progress but cannot make changes.</p>
          </div>

          {/* Quest Tier & Task Completion */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border-2 ${tier.bgColor} flex flex-col gap-2`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tier.icon}</span>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Quest Tier</p>
              </div>
              <p className={`text-xl font-800 ${tier.textColor}`}>{tier.name}</p>
              <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${tier.color}`} style={{ width: `${tier.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{tier.progress}% to next tier</p>
            </div>
            <div className="card-mystic p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={16} className="text-primary" />
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Task Completion</p>
              </div>
              <p className="text-3xl font-800 text-foreground">{taskCompletionRate}%</p>
              <p className="text-xs text-muted-foreground">{completedTasks} of {tasks.length} tasks done</p>
            </div>
            <div className="card-mystic p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="CalendarDaysIcon" size={16} className="text-primary" />
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Attendance</p>
              </div>
              <p className="text-3xl font-800 text-foreground">
                {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">{attendance.filter(a => a.status === 'present').length} present days</p>
            </div>
          </div>

          {/* Attendance Calendar */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              Attendance Calendar
            </h2>
            <AttendanceCalendarView records={attendance} />
          </div>

          {/* Report Card — Mentor's Feedback */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="DocumentTextIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Report Card — Mentor&apos;s Insights</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No session feedback available yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-700 text-foreground">{s.topic}</span>
                      <span className="text-xs text-muted-foreground">{s.session_date}</span>
                    </div>
                    {Array.isArray(s.strengths) && s.strengths.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-600 text-positive mb-1">✅ Strengths</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.strengths.map((item, i) => <li key={i} className="flex gap-1.5"><span className="text-positive">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-600 text-warning mb-1">🔧 Areas to Improve</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.weaknesses.map((item, i) => <li key={i} className="flex gap-1.5"><span className="text-warning">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MENTOR OVERVIEW TAB ──────────────────────────────────────────────── */}
      {activeTab === 'mentor' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/5 border border-info/20">
            <Icon name="EyeIcon" size={15} className="text-info flex-shrink-0" />
            <p className="text-xs text-muted-foreground">Read-only view of your child&apos;s assigned mentor.</p>
          </div>

          {!mentorProfile ? (
            <div className="card-mystic p-8 text-center">
              <Icon name="AcademicCapIcon" size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-600 text-foreground">No mentor linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your child has not been linked to a mentor.</p>
            </div>
          ) : (
            <>
              <div className="card-mystic p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Icon name="AcademicCapIcon" size={26} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-700 text-foreground">{mentorProfile.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{mentorProfile.email}</p>
                    <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 mt-1 inline-block">Mentor</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">{linkedStudent?.sessions || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">{linkedStudent?.avg_score || 0}%</p>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">
                      {mentorFeedbacks.length > 0
                        ? (mentorFeedbacks.reduce((s, f) => s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3, 0) / mentorFeedbacks.length).toFixed(1)
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Feedback</p>
                  </div>
                </div>
              </div>

              {/* Interaction Style */}
              {mentorFeedbacks.length > 0 && (
                <div className="card-mystic p-5">
                  <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                    <Icon name="StarIcon" size={18} className="text-amber-400" variant="solid" />
                    Interaction Style (from student feedback)
                  </h2>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Fun & Helpful', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.mentor_interaction_score, 0) / mentorFeedbacks.length) },
                      { label: 'Active Listening', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.active_listening_score, 0) / mentorFeedbacks.length) },
                      { label: 'Teaching Clarity', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.teaching_clarity_score, 0) / mentorFeedbacks.length) },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{metric.label}</span>
                          <span className="font-700 text-foreground">{metric.value}/5</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${(metric.value / 5) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics covered */}
              {linkedStudent?.topics && linkedStudent.topics.length > 0 && (
                <div className="card-mystic p-5">
                  <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-3">
                    <Icon name="BookOpenIcon" size={18} className="text-primary" />
                    Topics Covered
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {linkedStudent.topics.map((topic, i) => (
                      <span key={i} className="text-xs font-600 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACTION CENTER TAB ────────────────────────────────────────────────── */}
      {activeTab === 'action' && (
        <div className="flex flex-col gap-6">
          {/* Parent Observation Form */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="HomeIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Parent Observation</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Home Progress Notes <span className="text-negative">*</span></label>
                <textarea className="input-mystic min-h-[100px] resize-none" placeholder="Share observations about your child's progress at home..." value={obsForm.observation_text} onChange={(e) => setObsForm((f) => ({ ...f, observation_text: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Program Experience</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="How has the Luminar's Guide program impacted your child?" value={obsForm.program_experience} onChange={(e) => setObsForm((f) => ({ ...f, program_experience: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitObservation} disabled={submittingObs}>
                {submittingObs ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Observation</>}
              </button>
            </div>
          </div>

          {/* Suggestion Box */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="LightBulbIcon" size={18} className="text-amber-400" />
              <h2 className="text-base font-700 text-foreground">Suggestion Box</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Your Suggestion</label>
                <textarea className="input-mystic min-h-[100px] resize-none" placeholder="Share ideas or suggestions to improve the program for your child..." value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitSuggestion} disabled={submittingSuggestion}>
                {submittingSuggestion ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Suggestion</>}
              </button>
            </div>
          </div>

          {/* Raise a Query */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-info" />
              <h2 className="text-base font-700 text-foreground">Raise a Query</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Send To</label>
                <div className="flex gap-2">
                  {(['mentor', 'counselor'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setQueryForm((f) => ({ ...f, recipient_role: role }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-600 transition-all ${
                        queryForm.recipient_role === role ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <Icon name={role === 'mentor' ? 'AcademicCapIcon' : 'ShieldCheckIcon'} size={15} />
                      {role === 'mentor' ? 'Mentor' : 'Counselor'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Your Message <span className="text-negative">*</span></label>
                <textarea className="input-mystic min-h-[100px] resize-none" placeholder={`Write your message to the ${queryForm.recipient_role}...`} value={queryForm.message} onChange={(e) => setQueryForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitQuery} disabled={submittingQuery}>
                {submittingQuery ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Sending...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Send Query</>}
              </button>
            </div>
          </div>

          {/* Past Queries */}
          {parentQueries.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                My Queries
              </h2>
              <div className="flex flex-col gap-3">
                {parentQueries.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name={q.recipient_role === 'mentor' ? 'AcademicCapIcon' : 'ShieldCheckIcon'} size={14} className="text-primary" />
                        <span className="text-xs font-600 text-primary capitalize">To: {q.recipient_role}</span>
                      </div>
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                        q.status === 'replied' ? 'bg-positive/10 text-positive border-positive/20'
                          : q.status === 'closed' ? 'bg-muted text-muted-foreground border-border'
                          : 'bg-info/10 text-info border-info/20'
                      }`}>{q.status}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{q.message}</p>
                    {q.reply && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs font-600 text-primary mb-1">Reply:</p>
                        <p className="text-xs text-foreground/80">{q.reply}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(q.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="TrophyIcon" size={18} className="text-amber-400" variant="solid" />
              <h2 className="text-base font-700 text-foreground">Parent Engagement Leaderboard</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Engagement Score = total observations + suggestions + queries submitted. Stay active to climb the ranks!
            </p>
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="TrophyIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No engagement data yet.</p>
                <p className="text-xs mt-1">Submit observations, suggestions, or queries to appear here!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.map((entry, idx) => (
                  <div key={entry.userId} className={`flex items-center gap-3 p-4 rounded-xl border ${
                    idx === 0 ? 'bg-amber-50 border-amber-200' : idx === 1 ? 'bg-slate-50 border-slate-200' : idx === 2 ? 'bg-orange-50 border-orange-200' : 'bg-secondary/40 border-border'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-800 flex-shrink-0 ${
                      idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-700 text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">Engagement Score: {entry.score}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(entry.score, 5) }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Engagement Stats */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="ChartBarIcon" size={18} className="text-primary" />
              My Engagement Stats
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentObservations.filter(o => !o.observation_text.startsWith('[SUGGESTION]')).length}</p>
                <p className="text-xs text-muted-foreground">Observations</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentObservations.filter(o => o.observation_text.startsWith('[SUGGESTION]')).length}</p>
                <p className="text-xs text-muted-foreground">Suggestions</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentQueries.length}</p>
                <p className="text-xs text-muted-foreground">Queries</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
