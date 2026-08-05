'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { mockStudents, mockSessions } from '@/lib/mockData';
import type { Student, Gender } from '@/lib/mockData';
import StudentCard from './StudentCard';
import DashboardStatsStrip from './DashboardStatsStrip';
import AddStudentModal from './AddStudentModal';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

type SortOption = 'name' | 'score' | 'sessions' | 'lastSession';
type FilterOption = 'all' | 'up' | 'down' | 'stable';
type MentorTab = 'roster' | 'reflections' | 'surveys' | 'tasks' | 'calendar';

interface Survey {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

interface StudentTask {
  id: string;
  student_id: string;
  task_description: string;
  priority_rating: number;
  deadline: string | null;
  status: 'Pending' | 'In Progress' | 'Completed';
  created_at: string;
}

interface MentorReflection {
  id: string;
  week_start: string;
  impact_score: number;
  reflection_text: string;
  created_at: string;
}

interface PeerStats {
  avgScore: number;
  myScore: number;
}

interface LiveSession {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_room: string;
  jitsi_url: string;
  student_id: string;
  notes: string | null;
}

// ─── Performance Score Calculator ────────────────────────────────────────────
function calcPerformanceScore(
  reflections: MentorReflection[],
  avgStudentScore: number,
  avgFeedbackScore: number
): number {
  const reflectionScore =
    reflections.length > 0
      ? Math.min(100, (reflections.reduce((s, r) => s + r.impact_score, 0) / reflections.length) * 10)
      : 0;
  const studentProgressScore = avgStudentScore;
  const feedbackScore = avgFeedbackScore * 20;
  return Math.round(reflectionScore * 0.3 + studentProgressScore * 0.4 + feedbackScore * 0.3);
}

// ─── Star Rating Display ──────────────────────────────────────────────────────
function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon
          key={s}
          name="StarIcon"
          size={14}
          variant={s <= value ? 'solid' : 'outline'}
          className={s <= value ? 'text-amber-400' : 'text-muted-foreground'}
        />
      ))}
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
  return (
    <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  );
}

export default function StudentDashboardContent() {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterTrend, setFilterTrend] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [activeTab, setActiveTab] = useState<MentorTab>('roster');

  // Live Sessions state
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    student_id: '',
    title: 'Live Mentorship Session',
    meeting_date: '',
    meeting_time: '10:00',
    notes: '',
  });
  const [schedulingSession, setSchedulingSession] = useState(false);

  // Surveys state
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyForm, setSurveyForm] = useState({ title: '', url: '' });
  const [addingSurvey, setAddingSurvey] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);

  // Tasks state
  const [dbStudents, setDbStudents] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [taskForm, setTaskForm] = useState({
    student_id: '',
    task_description: '',
    priority_rating: 1,
    deadline: '',
  });
  const [addingTask, setAddingTask] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Reflections / leaderboard state
  const [reflections, setReflections] = useState<MentorReflection[]>([]);
  const [reflectionForm, setReflectionForm] = useState({ impact_score: 7, reflection_text: '' });
  const [submittingReflection, setSubmittingReflection] = useState(false);
  const [peerStats, setPeerStats] = useState<PeerStats | null>(null);
  const [avgFeedbackScore, setAvgFeedbackScore] = useState(0);
  const [reflectionsLoading, setReflectionsLoading] = useState(false);

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = new Date('2026-07-29');
    return mockSessions.filter((s) => new Date(s.date) >= weekAgo).length;
  }, []);

  const avgScore = useMemo(() => {
    const total = students.reduce((sum, s) => sum + s.averageScore, 0);
    return Math.round(total / students.length);
  }, [students]);

  const needAttention = useMemo(
    () => students.filter((s) => s.scoreTrend === 'down' || s.averageScore < 65).length,
    [students]
  );

  const filtered = useMemo(() => {
    let result = [...students];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.primaryTopics.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterTrend !== 'all') {
      result = result.filter((s) => s.scoreTrend === filterTrend);
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'score') return b.averageScore - a.averageScore;
      if (sortBy === 'sessions') return b.sessionCount - a.sessionCount;
      if (sortBy === 'lastSession') return b.lastSessionDate.localeCompare(a.lastSessionDate);
      return 0;
    });
    return result;
  }, [students, search, filterTrend, sortBy]);

  const handleAddStudent = (data: { name: string; grade: string; age: string; gender: Gender | ''; notes: string }) => {
    const initials = data.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
    const colors = ['#7C6FCD', '#5BAD8F', '#D97BB6', '#5B8FD9', '#E8A020', '#C97B7B'];
    const newStudent: Student = {
      id: `student-${Date.now()}`,
      name: data.name,
      grade: data.grade,
      age: data.age ? parseInt(data.age) : undefined,
      gender: (data.gender as Gender) || undefined,
      mentorId: 'mentor-101',
      avatarColor: colors[students.length % colors.length],
      avatarInitials: initials,
      enrolledDate: '2026-08-05',
      lastSessionDate: '—',
      sessionCount: 0,
      averageScore: 0,
      scoreTrend: 'stable',
      primaryTopics: [],
      notes: data.notes,
    };
    setStudents((prev) => [...prev, newStudent]);
  };

  // ─── Load Surveys ──────────────────────────────────────────────────────────
  const loadSurveys = useCallback(async () => {
    setSurveyLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSurveyLoading(false); return; }
    const { data } = await supabase
      .from('surveys')
      .select('*')
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: false });
    setSurveys(data || []);
    setSurveyLoading(false);
  }, [supabase]);

  // ─── Load Tasks ────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTasksLoading(false); return; }
    const [taskResult, studentResult] = await Promise.all([
      supabase.from('student_tasks').select('*').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('students').select('id, name').eq('mentor_id', user.id),
    ]);
    const taskData = taskResult.data;
    const studentData = studentResult.data;
    setTasks(taskData || []);
    setDbStudents(studentData || []);
    if (studentData && studentData.length > 0 && !taskForm.student_id) {
      setTaskForm((f) => ({ ...f, student_id: studentData[0].id }));
    }
    setTasksLoading(false);
  }, [supabase]);

  // ─── Load Reflections ──────────────────────────────────────────────────────
  const loadReflections = useCallback(async () => {
    setReflectionsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReflectionsLoading(false); return; }

    const [reflResult, feedbackResult, allReflResult] = await Promise.all([
      supabase.from('mentor_weekly_reflections').select('*').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('mentor_feedback').select('mentor_interaction_score, active_listening_score, teaching_clarity_score').eq('mentor_id', user.id),
      supabase.from('mentor_weekly_reflections').select('impact_score'),
    ]);

    const reflData = reflResult.data;
    const feedbackData = feedbackResult.data;
    const allReflData = allReflResult.data;

    setReflections(reflData || []);

    // Avg feedback score for this mentor
    if (feedbackData && feedbackData.length > 0) {
      const total = feedbackData.reduce((s: number, f: any) =>
        s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3, 0);
      setAvgFeedbackScore(total / feedbackData.length);
    }

    // Peer stats: average impact_score across all mentors
    if (allReflData && allReflData.length > 0) {
      const globalAvg = allReflData.reduce((s: number, r: any) => s + r.impact_score, 0) / allReflData.length;
      const myAvg = reflData && reflData.length > 0
        ? reflData.reduce((s: number, r: any) => s + r.impact_score, 0) / reflData.length
        : 0;
      setPeerStats({ avgScore: Math.round(globalAvg * 10), myScore: Math.round(myAvg * 10) });
    }

    setReflectionsLoading(false);
  }, [supabase]);

  // ─── Load Live Sessions ────────────────────────────────────────────────────
  const loadLiveSessions = useCallback(async () => {
    setSessionsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSessionsLoading(false); return; }
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('mentor_id', user.id)
      .order('meeting_date', { ascending: true });
    setLiveSessions(data || []);
    setSessionsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'surveys') loadSurveys();
    if (activeTab === 'tasks') loadTasks();
    if (activeTab === 'reflections') loadReflections();
    if (activeTab === 'calendar') {
      loadLiveSessions();
      loadTasks(); // to get dbStudents
    }
  }, [activeTab, loadSurveys, loadTasks, loadReflections, loadLiveSessions]);

  // ─── Survey Handlers ───────────────────────────────────────────────────────
  const handleAddSurvey = async () => {
    if (!surveyForm.title.trim() || !surveyForm.url.trim()) {
      toast.error('Please enter both a title and a URL.');
      return;
    }
    setAddingSurvey(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingSurvey(false); return; }
    const { error } = await supabase.from('surveys').insert({
      mentor_id: user.id,
      title: surveyForm.title.trim(),
      url: surveyForm.url.trim(),
    });
    if (error) {
      toast.error('Failed to add survey: ' + error.message);
    } else {
      toast.success('Survey added!');
      setSurveyForm({ title: '', url: '' });
      loadSurveys();
    }
    setAddingSurvey(false);
  };

  const handleDeleteSurvey = async (id: string) => {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete survey.');
    } else {
      toast.success('Survey removed.');
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // ─── Task Handlers ─────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!taskForm.task_description.trim() || !taskForm.student_id) {
      toast.error('Please select a student and enter a task description.');
      return;
    }
    setAddingTask(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingTask(false); return; }
    const { error } = await supabase.from('student_tasks').insert({
      mentor_id: user.id,
      student_id: taskForm.student_id,
      task_description: taskForm.task_description.trim(),
      priority_rating: taskForm.priority_rating,
      deadline: taskForm.deadline || null,
      status: 'Pending',
    });
    if (error) {
      toast.error('Failed to assign task: ' + error.message);
    } else {
      toast.success('Task assigned!');
      setTaskForm((f) => ({ ...f, task_description: '', deadline: '', priority_rating: 1 }));
      loadTasks();
    }
    setAddingTask(false);
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('student_tasks').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete task.');
    } else {
      toast.success('Task deleted.');
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // ─── Reflection Handlers ───────────────────────────────────────────────────
  const handleSubmitReflection = async () => {
    if (!reflectionForm.reflection_text.trim()) {
      toast.error('Please write your reflection.');
      return;
    }
    setSubmittingReflection(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmittingReflection(false); return; }
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const { error } = await supabase.from('mentor_weekly_reflections').insert({
      mentor_id: user.id,
      week_start: weekStart.toISOString().split('T')[0],
      impact_score: reflectionForm.impact_score,
      reflection_text: reflectionForm.reflection_text.trim(),
    });
    if (error) {
      toast.error('Failed to submit reflection: ' + error.message);
    } else {
      toast.success('Reflection submitted!');
      setReflectionForm({ impact_score: 7, reflection_text: '' });
      loadReflections();
    }
    setSubmittingReflection(false);
  };

  // ─── Schedule Live Session ─────────────────────────────────────────────────
  const handleScheduleSession = async () => {
    if (!sessionForm.student_id || !sessionForm.meeting_date || !sessionForm.meeting_time) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSchedulingSession(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSchedulingSession(false); return; }

    // Auto-generate unique Jitsi room ID
    const roomId = `luminar-${user.id.slice(0, 8)}-${Date.now()}`;
    const jitsiUrl = `https://meet.jit.si/${roomId}`;

    const { error } = await supabase.from('meetings').insert({
      mentor_id: user.id,
      student_id: sessionForm.student_id,
      title: sessionForm.title.trim() || 'Live Mentorship Session',
      meeting_date: sessionForm.meeting_date,
      meeting_time: sessionForm.meeting_time,
      jitsi_room: roomId,
      jitsi_url: jitsiUrl,
      notes: sessionForm.notes.trim() || null,
    });

    if (error) {
      toast.error('Failed to schedule session: ' + error.message);
    } else {
      toast.success('Live session scheduled! Jitsi room auto-generated.');
      setSessionForm((f) => ({ ...f, meeting_date: '', meeting_time: '10:00', notes: '', title: 'Live Mentorship Session' }));
      loadLiveSessions();
    }
    setSchedulingSession(false);
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete session.');
    } else {
      toast.success('Session removed.');
      setLiveSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const myPerfScore = calcPerformanceScore(reflections, avgScore, avgFeedbackScore);

  const filterOptions: { value: FilterOption; label: string; icon: string }[] = [
    { value: 'all', label: 'All Students', icon: 'UserGroupIcon' },
    { value: 'up', label: 'Improving', icon: 'ArrowTrendingUpIcon' },
    { value: 'stable', label: 'Stable', icon: 'MinusIcon' },
    { value: 'down', label: 'Declining', icon: 'ArrowTrendingDownIcon' },
  ];

  const mentorTabs: { id: MentorTab; label: string; icon: string }[] = [
    { id: 'roster', label: 'Student Roster', icon: 'UserGroupIcon' },
    { id: 'calendar', label: 'Schedule Sessions', icon: 'CalendarDaysIcon' },
    { id: 'reflections', label: 'Self-Reflection & Peer Ranking', icon: 'SparklesIcon' },
    { id: 'surveys', label: 'Manage Surveys', icon: 'ClipboardDocumentListIcon' },
    { id: 'tasks', label: 'Assign Tasks', icon: 'CheckCircleIcon' },
  ];

  const getStudentName = (id: string) => dbStudents.find((s) => s.id === id)?.name || 'Unknown';

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="animate-fade-in">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Mentor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your mentorship memory — all students, all sessions, all progress.
          </p>
        </div>
        {activeTab === 'roster' && (
          <button className="btn-primary self-start sm:self-auto" onClick={() => setShowAddModal(true)}>
            <Icon name="UserPlusIcon" size={17} />
            Add Student
          </button>
        )}
      </div>

      {/* Stats Strip */}
      <DashboardStatsStrip
        totalStudents={students.length}
        sessionsThisWeek={sessionsThisWeek}
        averageScore={avgScore}
        studentsNeedingAttention={needAttention}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-6 overflow-x-auto">
        {mentorTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-600 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} variant={activeTab === tab.id ? 'solid' : 'outline'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE SESSIONS TAB ─────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col gap-6">
          {/* Schedule Form */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="VideoCameraIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Schedule Live Session</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              A unique Jitsi Meet room will be auto-generated. Students will see a "Join Meeting" button on their calendar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Student <span className="text-negative">*</span></label>
                {dbStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No students linked yet.</p>
                ) : (
                  <select
                    className="input-mystic"
                    value={sessionForm.student_id}
                    onChange={(e) => setSessionForm((f) => ({ ...f, student_id: e.target.value }))}
                  >
                    <option value="">Select student…</option>
                    {dbStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Session Title</label>
                <input
                  className="input-mystic"
                  placeholder="Live Mentorship Session"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Date <span className="text-negative">*</span></label>
                <input
                  type="date"
                  className="input-mystic"
                  value={sessionForm.meeting_date}
                  onChange={(e) => setSessionForm((f) => ({ ...f, meeting_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Time <span className="text-negative">*</span></label>
                <input
                  type="time"
                  className="input-mystic"
                  value={sessionForm.meeting_time}
                  onChange={(e) => setSessionForm((f) => ({ ...f, meeting_time: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-600 text-foreground mb-1.5">Notes (optional)</label>
                <textarea
                  className="input-mystic resize-none min-h-[72px]"
                  placeholder="Agenda, topics to cover, preparation notes…"
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={15} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                A unique <span className="font-600 text-foreground">Jitsi Meet room ID</span> will be auto-generated when you schedule. No external URL needed.
              </p>
            </div>
            <button
              className="btn-primary mt-4"
              onClick={handleScheduleSession}
              disabled={schedulingSession || !sessionForm.student_id || !sessionForm.meeting_date}
            >
              {schedulingSession ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Scheduling…</>
              ) : (
                <><Icon name="VideoCameraIcon" size={15} /> Schedule Live Session</>
              )}
            </button>
          </div>

          {/* Scheduled Sessions List */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Scheduled Sessions</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {liveSessions.length} total
              </span>
            </div>
            {sessionsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : liveSessions.length === 0 ? (
              <div className="text-center py-10">
                <Icon name="CalendarDaysIcon" size={36} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {liveSessions.map((session) => (
                  <div key={session.id} className="flex items-start gap-4 p-4 rounded-xl bg-secondary border border-border">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-700 text-primary">
                        {new Date(session.meeting_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-800 text-primary leading-none">
                        {new Date(session.meeting_date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-700 text-foreground">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getStudentName(session.student_id)} · {session.meeting_time}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Icon name="VideoCameraIcon" size={11} className="text-primary" />
                        <span className="text-xs text-primary font-mono truncate">{session.jitsi_room}</span>
                      </div>
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{session.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={session.jitsi_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        <Icon name="VideoCameraIcon" size={13} />
                        Join
                      </a>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors"
                      >
                        <Icon name="TrashIcon" size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROSTER TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'roster' && (
        <>
          {/* Search + Filter + Sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="input-mystic pl-9"
                placeholder="Search by name, grade, or pillar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')} aria-label="Clear search">
                  <Icon name="XMarkIcon" size={15} />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border">
                {filterOptions.map((f) => (
                  <button
                    key={`filter-${f.value}`}
                    onClick={() => setFilterTrend(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all ${
                      filterTrend === f.value ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name={f.icon as any} size={13} />
                    <span className="hidden sm:inline">{f.label}</span>
                  </button>
                ))}
              </div>
              <select className="input-mystic text-sm py-1.5 px-3 w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                <option value="name">Sort: Name</option>
                <option value="score">Sort: Score ↓</option>
                <option value="sessions">Sort: Sessions ↓</option>
                <option value="lastSession">Sort: Recent First</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-600 text-foreground">{filtered.length}</span> of{' '}
              <span className="font-600 text-foreground">{students.length}</span> students
            </p>
            {search && (
              <button className="btn-ghost text-xs" onClick={() => setSearch('')}>
                <Icon name="XMarkIcon" size={13} /> Clear search
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card-elevated flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Icon name="UserGroupIcon" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="font-700 text-foreground text-lg mb-2">No students found</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-5">
                {search ? `No students match "${search}".` : 'No students match the current filter.'}
              </p>
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <Icon name="UserPlusIcon" size={16} /> Add First Student
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SELF-REFLECTION & PEER RANKING TAB ────────────────────────────── */}
      {activeTab === 'reflections' && (
        <div className="flex flex-col gap-6">
          {/* Performance Score Card */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="TrophyIcon" size={18} className="text-amber-400" />
              <h2 className="text-base font-700 text-foreground">Your Performance Score</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* My Score */}
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                    <circle
                      cx="48" cy="48" r="40" fill="none"
                      stroke="url(#scoreGrad)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - myPerfScore / 100)}`}
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7C6FCD" />
                        <stop offset="100%" stopColor="#B8A9E8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-800 text-foreground">{myPerfScore}</span>
                  </div>
                </div>
                <p className="text-xs font-600 text-foreground">Your Score</p>
              </div>

              {/* Comparison */}
              <div className="flex-1">
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Your Score</span>
                      <span className="font-700 text-foreground">{myPerfScore}/100</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-700" style={{ width: `${myPerfScore}%` }} />
                    </div>
                  </div>
                  {peerStats && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Anonymous Peer Average</span>
                        <span className="font-700 text-foreground">{peerStats.avgScore}/100</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-blue-400 transition-all duration-700" style={{ width: `${peerStats.avgScore}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-600 text-foreground">Score breakdown:</span> 40% student progress · 30% self-reflection impact · 30% student feedback ratings
                  </p>
                  {peerStats && myPerfScore >= peerStats.avgScore ? (
                    <p className="text-xs text-positive font-600 mt-1">✨ You are above the peer average!</p>
                  ) : peerStats ? (
                    <p className="text-xs text-warning font-600 mt-1">📈 Keep reflecting — you are close to the peer average.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Reflection */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="PencilSquareIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Submit Weekly Reflection</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-2">
                  Self-Assessed Impact Score: <span className="text-primary font-800">{reflectionForm.impact_score}/10</span>
                </label>
                <input
                  type="range" min={1} max={10} step={1}
                  value={reflectionForm.impact_score}
                  onChange={(e) => setReflectionForm((f) => ({ ...f, impact_score: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 — Minimal</span><span>10 — Exceptional</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Reflection Notes <span className="text-negative">*</span>
                </label>
                <textarea
                  className="input-mystic min-h-[100px] resize-none"
                  placeholder="What went well this week? What would you do differently? How did your students respond?"
                  value={reflectionForm.reflection_text}
                  onChange={(e) => setReflectionForm((f) => ({ ...f, reflection_text: e.target.value }))}
                />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitReflection} disabled={submittingReflection}>
                {submittingReflection ? (
                  <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</>
                ) : (
                  <><Icon name="PaperAirplaneIcon" size={15} /> Submit Reflection</>
                )}
              </button>
            </div>
          </div>

          {/* Past Reflections */}
          {reflectionsLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : reflections.length > 0 ? (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                Past Reflections
              </h2>
              <div className="flex flex-col gap-3">
                {reflections.slice(0, 5).map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground">Week of {formatDate(r.week_start)}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-600 text-primary">Impact: {r.impact_score}/10</span>
                        <StarDisplay value={Math.round(r.impact_score / 2)} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{r.reflection_text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── MANAGE SURVEYS TAB ────────────────────────────────────────────── */}
      {activeTab === 'surveys' && (
        <div className="flex flex-col gap-6">
          {/* Add Survey Form */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="PlusCircleIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Add New Survey</h2>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Survey Title <span className="text-negative">*</span></label>
                <input
                  className="input-mystic"
                  placeholder="e.g. Weekly Check-In Survey"
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Survey URL <span className="text-negative">*</span></label>
                <input
                  className="input-mystic"
                  placeholder="https://forms.google.com/..."
                  value={surveyForm.url}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
              <button className="btn-primary self-start" onClick={handleAddSurvey} disabled={addingSurvey}>
                {addingSurvey ? (
                  <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Adding...</>
                ) : (
                  <><Icon name="PlusIcon" size={15} /> Add Survey</>
                )}
              </button>
            </div>
          </div>

          {/* Active Surveys List */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Active Surveys</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {surveys.length} total
              </span>
            </div>
            {surveyLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : surveys.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No surveys yet. Add one above.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {surveys.map((survey) => (
                  <div key={survey.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border group">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="LinkIcon" size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-foreground truncate">{survey.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{survey.url}</p>
                    </div>
                    <a
                      href={survey.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost text-xs py-1.5 px-2.5 flex-shrink-0"
                      title="Preview"
                    >
                      <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                    </a>
                    <button
                      onClick={() => handleDeleteSurvey(survey.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
                      title="Delete survey"
                    >
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGN TASKS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-6">
          {/* Assign Task Form */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="PlusCircleIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Assign New Task</h2>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Student <span className="text-negative">*</span></label>
                {dbStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No students linked yet. Add students first.</p>
                ) : (
                  <select
                    className="input-mystic"
                    value={taskForm.student_id}
                    onChange={(e) => setTaskForm((f) => ({ ...f, student_id: e.target.value }))}
                  >
                    {dbStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Task Description <span className="text-negative">*</span></label>
                <textarea
                  className="input-mystic min-h-[80px] resize-none"
                  placeholder="Describe the individual, home-based or online task for the student..."
                  value={taskForm.task_description}
                  onChange={(e) => setTaskForm((f) => ({ ...f, task_description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Priority</label>
                  <select
                    className="input-mystic"
                    value={taskForm.priority_rating}
                    onChange={(e) => setTaskForm((f) => ({ ...f, priority_rating: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={3}>High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Deadline</label>
                  <input
                    type="date"
                    className="input-mystic"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm((f) => ({ ...f, deadline: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn-primary self-start" onClick={handleAddTask} disabled={addingTask || dbStudents.length === 0}>
                {addingTask ? (
                  <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Assigning...</>
                ) : (
                  <><Icon name="CheckCircleIcon" size={15} /> Assign Task</>
                )}
              </button>
            </div>
          </div>

          {/* Tasks List */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Assigned Tasks</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {tasks.length} total
              </span>
            </div>
            {tasksLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks assigned yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-600 text-primary">{getStudentName(task.student_id)}</span>
                        <PriorityBadge priority={task.priority_rating} />
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                          task.status === 'Completed' ? 'bg-positive/10 text-positive border-positive/20'
                            : task.status === 'In Progress'? 'bg-info/10 text-info border-info/20' :'bg-muted text-muted-foreground border-border'
                        }`}>{task.status}</span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{task.task_description}</p>
                      {task.deadline && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Icon name="CalendarDaysIcon" size={11} className="inline mr-1" />
                          Due: {formatDate(task.deadline)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
                      title="Delete task"
                    >
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal onClose={() => setShowAddModal(false)} onAdd={handleAddStudent} />
      )}
    </div>
  );
}