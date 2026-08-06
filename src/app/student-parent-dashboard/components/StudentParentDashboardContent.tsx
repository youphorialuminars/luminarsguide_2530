'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import StudentCalendar from './StudentCalendar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  invite_code: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  mentor_id: string | null;
  student_id: string | null;
}

interface Task {
  id: string;
  task_description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority_rating: number;
  deadline: string | null;
}

interface Survey {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_url: string;
  notes: string;
}

interface Session {
  id: string;
  topic: string;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
}

interface Reflection {
  id: string;
  week_start: string;
  learned_this_week: string;
  needs_work: string;
  team_dynamics: string;
  mentor_response: string | null;
  created_at: string;
}

interface ParentObservation {
  id: string;
  observation_text: string;
  program_experience: string;
  created_at: string;
  submitted_by: string;
}

interface MentorFeedback {
  id: string;
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
  created_at: string;
}

// ─── Quest Tier Logic ─────────────────────────────────────────────────────────
function getQuestTier(completedCount: number) {
  if (completedCount >= 15) {
    return {
      name: 'Trailblazer', icon: '🔥',
      color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200', glowClass: 'shadow-amber-200',
      nextAt: null, progress: 100,
    };
  }
  if (completedCount >= 5) {
    return {
      name: 'Pathfinder', icon: '🧭',
      color: 'from-violet-400 to-purple-500', textColor: 'text-violet-600',
      bgColor: 'bg-violet-50 border-violet-200', glowClass: 'shadow-violet-200',
      nextAt: 15, progress: Math.round(((completedCount - 5) / 10) * 100),
    };
  }
  return {
    name: 'Explorer', icon: '🌱',
    color: 'from-sky-400 to-blue-500', textColor: 'text-sky-600',
    bgColor: 'bg-sky-50 border-sky-200', glowClass: 'shadow-sky-200',
    nextAt: 5, progress: Math.round((completedCount / 5) * 100),
  };
}

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-600 text-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)} className="transition-transform hover:scale-110">
            <Icon name="StarIcon" size={22} variant={star <= value ? 'solid' : 'outline'} className={star <= value ? 'text-amber-400' : 'text-muted-foreground'} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: number }) {
  const map: Record<number, { label: string; cls: string }> = {
    1: { label: 'Low', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    2: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    3: { label: 'High', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };
  const { label, cls } = map[priority] || map[1];
  return <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StudentParentDashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [parentObservations, setParentObservations] = useState<ParentObservation[]>([]);
  const [mentorFeedbacks, setMentorFeedbacks] = useState<MentorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'surveys' | 'calendar' | 'report' | 'feedback' | 'parent'>('overview');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // Reflection form state
  const [reflectionForm, setReflectionForm] = useState({ learned_this_week: '', needs_work: '', team_dynamics: '', peer_appreciation: '' });
  const [submittingReflection, setSubmittingReflection] = useState(false);

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({ mentor_interaction_score: 5, active_listening_score: 5, teaching_clarity_score: 5, fruitful_comments: '' });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Parent observation form
  const [parentForm, setParentForm] = useState({ observation_text: '', program_experience: '' });
  const [submittingParent, setSubmittingParent] = useState(false);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<{ name: string; count: number; userId: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (!profile) { router.push('/sign-up-login'); return; }
      setUserProfile(profile);

      // Middleware handles role-based redirects; no manual redirect needed here

      if (profile.student_id) {
        const { data: student } = await supabase.from('students').select('*').eq('id', profile.student_id).single();
        setStudentProfile(student);

        if (student) {
          const [
            taskResult,
            surveyResult,
            attResult,
            meetResult,
            sessResult,
            allObsResult,
          ] = await Promise.all([
            supabase.from('student_tasks').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
            supabase.from('surveys').select('*').eq('mentor_id', student.mentor_id).order('created_at', { ascending: false }),
            supabase.from('attendance').select('attendance_date, status').eq('student_id', student.id).order('attendance_date', { ascending: false }),
            supabase.from('meetings').select('*').eq('student_id', student.id).order('meeting_date', { ascending: false }),
            supabase.from('sessions').select('*').eq('student_id', student.id).order('created_at', { ascending: false }).limit(5),
            supabase.from('parent_observations').select('submitted_by').eq('student_id', student.id),
          ]);

          const taskData = taskResult.data;
          const surveyData = surveyResult.data;
          const attData = attResult.data;
          const meetData = meetResult.data;
          const sessData = sessResult.data;
          const allObs = allObsResult.data;

          setTasks(taskData || []);
          setSurveys(surveyData || []);
          setAttendance(attData || []);
          setMeetings(meetData || []);
          setSessions(sessData || []);

          if (allObs) {
            const countMap = new Map<string, number>();
            allObs.forEach((o) => { countMap.set(o.submitted_by, (countMap.get(o.submitted_by) || 0) + 1); });
            const userIds = Array.from(countMap.keys());
            if (userIds.length > 0) {
              const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
              const lb = (profiles || []).map((p) => ({ name: p.full_name || 'Parent', count: countMap.get(p.id) || 0, userId: p.id }));
              lb.sort((a, b) => b.count - a.count);
              setLeaderboard(lb);
            }
          }
        }
      }

      const [reflResult, parentObsResult, mfResult] = await Promise.all([
        supabase.from('student_reflections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('parent_observations').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
        supabase.from('mentor_feedback').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
      ]);
      const reflData = reflResult.data;
      const parentObs = parentObsResult.data;
      const mfData = mfResult.data;
      setReflections(reflData || []);
      setParentObservations(parentObs || []);
      setMentorFeedbacks(mfData || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const tier = getQuestTier(completedTasks);

  // ─── Update Task Status ────────────────────────────────────────────────────
  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    setUpdatingTaskId(taskId);
    const { error } = await supabase.from('student_tasks').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      toast.error('Failed to update task status.');
    } else {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success(`Task marked as "${newStatus}"`);
    }
    setUpdatingTaskId(null);
  };

  const handleSubmitReflection = async () => {
    if (!reflectionForm.learned_this_week.trim()) { toast.error('Please fill in what you learned this week.'); return; }
    if (!reflectionForm.peer_appreciation.trim()) { toast.error('Please fill in the Team Shoutout field.'); return; }
    setSubmittingReflection(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const { error } = await supabase.from('student_reflections').insert({
      user_id: user.id,
      student_id: studentProfile?.id || null,
      week_start: weekStart.toISOString().split('T')[0],
      learned_this_week: reflectionForm.learned_this_week,
      needs_work: reflectionForm.needs_work,
      team_dynamics: reflectionForm.team_dynamics,
      peer_appreciation: reflectionForm.peer_appreciation,
    });
    if (error) { toast.error('Failed to submit reflection.'); } else {
      toast.success('Reflection submitted!');
      setReflectionForm({ learned_this_week: '', needs_work: '', team_dynamics: '', peer_appreciation: '' });
      loadData();
    }
    setSubmittingReflection(false);
  };

  const handleSubmitFeedback = async () => {
    if (!studentProfile) { toast.error('No student profile linked.'); return; }
    setSubmittingFeedback(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('mentor_feedback').insert({
      student_id: studentProfile.id,
      submitted_by: user.id,
      mentor_interaction_score: feedbackForm.mentor_interaction_score,
      active_listening_score: feedbackForm.active_listening_score,
      teaching_clarity_score: feedbackForm.teaching_clarity_score,
      fruitful_comments: feedbackForm.fruitful_comments,
    });
    if (error) { toast.error('Failed to submit feedback.'); } else {
      toast.success('Feedback submitted! Thank you.');
      setFeedbackForm({ mentor_interaction_score: 5, active_listening_score: 5, teaching_clarity_score: 5, fruitful_comments: '' });
      loadData();
    }
    setSubmittingFeedback(false);
  };

  const handleSubmitParentObservation = async () => {
    if (!parentForm.observation_text.trim()) { toast.error('Please add your observation notes.'); return; }
    if (!studentProfile) { toast.error('No student profile linked.'); return; }
    setSubmittingParent(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('parent_observations').insert({
      student_id: studentProfile.id,
      submitted_by: user.id,
      observation_text: parentForm.observation_text,
      program_experience: parentForm.program_experience,
    });
    if (error) { toast.error('Failed to submit observation.'); } else {
      toast.success('Observation submitted!');
      setParentForm({ observation_text: '', program_experience: '' });
      loadData();
    }
    setSubmittingParent(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: typeof activeTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'My Quest', icon: 'SparklesIcon' },
    { id: 'tasks', label: 'My Tasks', icon: 'ClipboardDocumentListIcon' },
    { id: 'surveys', label: 'Surveys', icon: 'LinkIcon' },
    { id: 'calendar', label: 'Calendar', icon: 'CalendarDaysIcon' },
    { id: 'report', label: 'Report Card', icon: 'DocumentTextIcon' },
    { id: 'feedback', label: 'Mentor Feedback', icon: 'StarIcon' },
  ];

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const statusOptions: Task['status'][] = ['Pending', 'In Progress', 'Completed'];

  return (
    <div className="animate-fade-in">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">
            Welcome, {userProfile?.full_name?.split(' ')[0] || 'Explorer'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentProfile ? `Linked to: ${studentProfile.name}` : 'Your personal learning dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Global Search Bar */}
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              className="input-mystic pl-9 w-48"
              placeholder="Search tasks…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            {globalSearch && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setGlobalSearch('')}
              >
                <Icon name="XMarkIcon" size={14} />
              </button>
            )}
          </div>
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-lg ${tier.bgColor} ${tier.glowClass}`}>
            <span className="text-2xl">{tier.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground font-500">Quest Tier</p>
              <p className={`text-base font-800 ${tier.textColor}`}>{tier.name}</p>
            </div>
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center text-white text-xs font-700 shadow-md`}>
              {completedTasks}
            </div>
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

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Quest Progress */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{tier.icon}</span>
              <h2 className="text-base font-700 text-foreground">The Quest — {tier.name}</h2>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{completedTasks} tasks completed</span>
                  {tier.nextAt && <span>Next tier at {tier.nextAt}</span>}
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`} style={{ width: `${tier.progress}%` }} />
                </div>
              </div>
              <span className={`text-sm font-700 ${tier.textColor}`}>{tier.progress}%</span>
            </div>
            {tier.nextAt ? (
              <p className="text-xs text-muted-foreground">Complete {tier.nextAt - completedTasks} more tasks to reach the next tier!</p>
            ) : (
              <p className="text-xs text-muted-foreground">🎉 You have reached the highest tier — Trailblazer!</p>
            )}
          </div>

          {/* Quick Task Summary */}
          <div className="card-mystic p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                Task Summary
              </h2>
              <button onClick={() => setActiveTab('tasks')} className="text-xs text-primary font-600 hover:underline">View All →</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['Pending', 'In Progress', 'Completed'] as Task['status'][]).map((s) => {
                const count = tasks.filter((t) => t.status === s).length;
                const cls = s === 'Completed' ? 'bg-positive/10 text-positive border-positive/20'
                  : s === 'In Progress'? 'bg-info/10 text-info border-info/20' :'bg-muted text-muted-foreground border-border';
                return (
                  <div key={s} className={`p-3 rounded-xl border text-center ${cls}`}>
                    <p className="text-xl font-800">{count}</p>
                    <p className="text-xs font-600 mt-0.5">{s}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Meetings */}
          {meetings.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="VideoCameraIcon" size={18} className="text-primary" />
                Upcoming Sessions
              </h2>
              <div className="flex flex-col gap-3">
                {meetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-foreground">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.meeting_date)} at {m.meeting_time}</p>
                    </div>
                    {m.jitsi_url && (
                      <a href={m.jitsi_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
                        <Icon name="VideoCameraIcon" size={13} /> Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY TASKS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-4">
          <div className="card-mystic p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                My Tasks Board
              </h2>
              <span className="text-xs text-muted-foreground">{completedTasks}/{tasks.length} completed</span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No tasks assigned yet.</p>
                <p className="text-xs mt-1">Your mentor will assign tasks here soon.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks
                  .filter((task) =>
                    !globalSearch.trim() ||
                    task.task_description.toLowerCase().includes(globalSearch.toLowerCase())
                  )
                  .map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all ${
                      task.status === 'Completed' ? 'bg-positive/5 border-positive/20'
                        : task.status === 'In Progress'? 'bg-info/5 border-info/20' :'bg-secondary/40 border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        task.status === 'Completed' ? 'bg-positive text-white'
                          : task.status === 'In Progress'? 'bg-info text-white' :'bg-muted border border-border'
                      }`}>
                        {task.status === 'Completed' && <Icon name="CheckIcon" size={11} />}
                        {task.status === 'In Progress' && <Icon name="ClockIcon" size={11} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PriorityBadge priority={task.priority_rating} />
                          {task.deadline && (
                            <span className="text-xs text-muted-foreground">
                              <Icon name="CalendarDaysIcon" size={11} className="inline mr-0.5" />
                              Due: {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-500 leading-relaxed ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.task_description}
                        </p>
                      </div>
                    </div>

                    {/* Status Selector */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-600">Update status:</span>
                      {statusOptions.map((s) => (
                        <button
                          key={s}
                          disabled={task.status === s || updatingTaskId === task.id}
                          onClick={() => handleUpdateTaskStatus(task.id, s)}
                          className={`text-xs font-600 px-3 py-1 rounded-full border transition-all ${
                            task.status === s
                              ? s === 'Completed' ? 'bg-positive text-white border-positive'
                                : s === 'In Progress'? 'bg-info text-white border-info' :'bg-muted text-muted-foreground border-border' :'bg-card text-muted-foreground border-border hover:border-primary hover:text-primary'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {updatingTaskId === task.id && task.status !== s ? (
                            <Icon name="ArrowPathIcon" size={11} className="animate-spin inline mr-1" />
                          ) : null}
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {globalSearch.trim() && tasks.filter((t) => t.task_description.toLowerCase().includes(globalSearch.toLowerCase())).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="MagnifyingGlassIcon" size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tasks match &quot;{globalSearch}&quot;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SURVEYS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'surveys' && (
        <div className="flex flex-col gap-4">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="LinkIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Surveys from Your Mentor</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>

            {surveys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No surveys available yet.</p>
                <p className="text-xs mt-1">Your mentor will share surveys here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {surveys.map((survey) => (
                  <a
                    key={survey.id}
                    href={survey.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon name="LinkIcon" size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-700 text-foreground group-hover:text-primary transition-colors">{survey.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{survey.url}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary font-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <Icon name="ArrowTopRightOnSquareIcon" size={13} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CALENDAR TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col gap-6">
          <StudentCalendar />
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              Attendance Record
            </h2>
            <AttendanceCalendarView records={attendance} />
          </div>
        </div>
      )}

      {/* ── REPORT CARD TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="AcademicCapIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Mentor&apos;s Insights</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No mentor feedback available yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.slice(0, 2).map((s) => (
                  <div key={s.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-700 text-foreground">{s.topic}</span>
                      <span className="text-xs text-muted-foreground">{s.session_date}</span>
                    </div>
                    {Array.isArray(s.strengths) && s.strengths.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-600 text-positive mb-1">✅ Strengths</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.strengths.map((item: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-positive">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-600 text-warning mb-1">🔧 Areas to Improve</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.weaknesses.map((item: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-warning">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="PencilSquareIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">My Weekly Reflection</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">What did I learn this week? <span className="text-negative">*</span></label>
                <textarea className="input-mystic min-h-[90px] resize-none" placeholder="Share your key learnings..." value={reflectionForm.learned_this_week} onChange={(e) => setReflectionForm((f) => ({ ...f, learned_this_week: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Which aspects do I need to work on further?</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="Identify areas needing more practice..." value={reflectionForm.needs_work} onChange={(e) => setReflectionForm((f) => ({ ...f, needs_work: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">How was my team dynamics, and what was the best thing about my team?</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="Reflect on your teamwork experience..." value={reflectionForm.team_dynamics} onChange={(e) => setReflectionForm((f) => ({ ...f, team_dynamics: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  🌟 Team Shoutout <span className="text-negative">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Observe one team member and write something positive they did today!</p>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="e.g. Priya helped everyone understand the activity by explaining it step by step..." value={reflectionForm.peer_appreciation} onChange={(e) => setReflectionForm((f) => ({ ...f, peer_appreciation: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitReflection} disabled={submittingReflection}>
                {submittingReflection ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Reflection</>}
              </button>
            </div>
          </div>

          {reflections.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                Past Reflections
              </h2>
              <div className="flex flex-col gap-3">
                {reflections.slice(0, 3).map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">Week of {formatDate(r.week_start)}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{r.learned_this_week}</p>
                    {r.mentor_response && (
                      <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs font-600 text-primary mb-0.5">Mentor Response:</p>
                        <p className="text-xs text-foreground/80">{r.mentor_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FEEDBACK TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="StarIcon" size={18} className="text-amber-400" variant="solid" />
              <h2 className="text-base font-700 text-foreground">Rate Your Mentor</h2>
            </div>
            <div className="flex flex-col gap-5">
              <StarRating label="Was my mentor fun and helpful?" value={feedbackForm.mentor_interaction_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, mentor_interaction_score: v }))} />
              <StarRating label="Did my mentor listen to me carefully?" value={feedbackForm.active_listening_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, active_listening_score: v }))} />
              <StarRating label="Did I understand the activities clearly?" value={feedbackForm.teaching_clarity_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, teaching_clarity_score: v }))} />
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Additional Comments</label>
                <textarea className="input-mystic min-h-[100px] resize-none" placeholder="Share any specific feedback..." value={feedbackForm.fruitful_comments} onChange={(e) => setFeedbackForm((f) => ({ ...f, fruitful_comments: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                {submittingFeedback ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Feedback</>}
              </button>
            </div>
          </div>
          {mentorFeedbacks.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                My Previous Feedback
              </h2>
              <div className="flex flex-col gap-3">
                {mentorFeedbacks.slice(0, 3).map((fb) => (
                  <div key={fb.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">{formatDate(fb.created_at)}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Interaction: {'⭐'.repeat(fb.mentor_interaction_score)}</span>
                      <span>Listening: {'⭐'.repeat(fb.active_listening_score)}</span>
                      <span>Clarity: {'⭐'.repeat(fb.teaching_clarity_score)}</span>
                    </div>
                    {fb.fruitful_comments && <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{fb.fruitful_comments}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PARENT HUB TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'parent' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="HomeIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Parent Observation</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Home Progress Notes <span className="text-negative">*</span></label>
                <textarea className="input-mystic min-h-[100px] resize-none" placeholder="Share observations about your child's progress at home..." value={parentForm.observation_text} onChange={(e) => setParentForm((f) => ({ ...f, observation_text: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Program Experience</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="How has the Luminar's Guide program impacted your child?" value={parentForm.program_experience} onChange={(e) => setParentForm((f) => ({ ...f, program_experience: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitParentObservation} disabled={submittingParent}>
                {submittingParent ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Observation</>}
              </button>
            </div>
          </div>

          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="TrophyIcon" size={18} className="text-amber-400" />
              <h2 className="text-base font-700 text-foreground">Parent Engagement Leaderboard</h2>
            </div>
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="TrophyIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No parent observations yet. Be the first!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.map((entry, idx) => (
                  <div key={entry.userId} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    idx === 0 ? 'bg-amber-50 border-amber-200' : idx === 1 ? 'bg-slate-50 border-slate-200' : idx === 2 ? 'bg-orange-50 border-orange-200' : 'bg-secondary/40 border-border'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-800 flex-shrink-0 ${
                      idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-600 text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.count} observation{entry.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(entry.count, 5) }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-primary/60" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {parentObservations.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                My Past Observations
              </h2>
              <div className="flex flex-col gap-3">
                {parentObservations.slice(0, 3).map((obs) => (
                  <div key={obs.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs text-muted-foreground mb-1.5">{formatDate(obs.created_at)}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{obs.observation_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
