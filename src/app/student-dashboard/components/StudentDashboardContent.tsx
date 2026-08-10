'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { Gender } from '@/lib/mockData';
import StudentCard from './StudentCard';
import DashboardStatsStrip from './DashboardStatsStrip';
import AddStudentModal from './AddStudentModal';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type SortOption = 'name' | 'score' | 'sessions' | 'lastSession';
type FilterOption = 'all' | 'up' | 'down' | 'stable';
type MentorTab = 'roster' | 'reflections' | 'surveys' | 'tasks' | 'calendar' | 'parent-queries';

// ─── DB Student type (from public.students) ───────────────────────────────────
interface DbStudent {
  id: string;
  name: string;
  grade: string;
  age: number | null;
  gender: string | null;
  mentor_id: string;
  avg_score: number;
  sessions: number;
  topics: string[];
  trend: string;
  alert_level: string | null;
  last_session: string | null;
  notes: string | null;
  avatar: string;
}

// ─── DB Student type from user_profiles ──────────────────────────────────────
interface DbUserProfileStudent {
  id: string;
  full_name: string;
  email: string;
  mentor_id: string;
  role: string;
  created_at: string | null;
}

// ─── UI Student shape (mapped from DbStudent) ─────────────────────────────────
interface UiStudent {
  id: string;
  name: string;
  grade: string;
  age?: number;
  gender?: Gender;
  mentorId: string;
  avatarColor: string;
  avatarInitials: string;
  enrolledDate: string;
  lastSessionDate: string;
  sessionCount: number;
  averageScore: number;
  scoreTrend: 'up' | 'down' | 'stable';
  primaryTopics: string[];
  notes: string;
}

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

interface TaskSubmission {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  mentor_rating: number | null;
  mentor_comments: string | null;
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

// ─── Parent Engagement Badge ──────────────────────────────────────────────────
function ParentEngagementBadge({ score }: { score: number }) {
  if (score >= 5) return <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">High</span>;
  if (score >= 2) return <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Medium</span>;
  return <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Low</span>;
}

const AVATAR_COLORS = ['#7C6FCD', '#5BAD8F', '#D97BB6', '#5B8FD9', '#E8A020', '#C97B7B', '#7BA8C9', '#A594E8', '#8FBD8F', '#D9A05B'];

function mapDbStudentToUi(s: DbStudent, index: number): UiStudent {
  const nameParts = s.name.split(' ');
  const initials = nameParts.slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return {
    id: s.id,
    name: s.name,
    grade: s.grade || '',
    age: s.age ?? undefined,
    gender: (s.gender as Gender) || undefined,
    mentorId: s.mentor_id,
    avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    avatarInitials: initials,
    enrolledDate: '',
    lastSessionDate: s.last_session || '—',
    sessionCount: s.sessions || 0,
    averageScore: s.avg_score || 0,
    scoreTrend: (s.trend as 'up' | 'down' | 'stable') || 'stable',
    primaryTopics: s.topics || [],
    notes: s.notes || '',
  };
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

// ─── Needs Attention Modal ────────────────────────────────────────────────────
function NeedsAttentionModal({
  students,
  onClose,
}: {
  students: UiStudent[];
  onClose: () => void;
}) {
  const atRisk = students.filter((s) => s.scoreTrend === 'down' || s.averageScore < 65);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
              <Icon name="ExclamationTriangleIcon" size={18} className="text-warning" />
            </div>
            <div>
              <h2 className="font-700 text-foreground text-base">Students Needing Attention</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Declining trend or score below 65</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {atRisk.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="CheckCircleIcon" size={36} className="text-positive mx-auto mb-3 opacity-60" />
              <p className="font-600 text-foreground">All students are on track!</p>
              <p className="text-sm text-muted-foreground mt-1">No students currently need attention.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {atRisk.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                    style={{ backgroundColor: s.avatarColor }}
                  >
                    {s.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-700 text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.grade}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-700 text-foreground">{s.averageScore}%</span>
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${
                      s.scoreTrend === 'down'
                        ? 'bg-negative/10 text-negative' :'bg-warning/10 text-warning'
                    }`}>
                      {s.scoreTrend === 'down' ? '↓ Declining' : 'Low Score'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboardContent() {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterTrend, setFilterTrend] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [students, setStudents] = useState<UiStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [mentorCode, setMentorCode] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MentorTab>('roster');

  // Parent engagement scores per student (studentId -> score)
  const [parentEngagementScores, setParentEngagementScores] = useState<Record<string, number>>({});

  // Parent queries
  const [parentQueries, setParentQueries] = useState<{
    id: string;
    parent_id: string;
    recipient_role: string;
    message: string;
    status: string;
    reply: string | null;
    created_at: string;
  }[]>([]);
  const [parentQueriesLoading, setParentQueriesLoading] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

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
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [gradingForm, setGradingForm] = useState<Record<string, { rating: number; comments: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // Reflections / leaderboard state
  const [reflections, setReflections] = useState<MentorReflection[]>([]);
  const [reflectionForm, setReflectionForm] = useState({ impact_score: 7, reflection_text: '' });
  const [submittingReflection, setSubmittingReflection] = useState(false);
  const [peerStats, setPeerStats] = useState<PeerStats | null>(null);
  const [avgFeedbackScore, setAvgFeedbackScore] = useState(0);
  const [studentFeedback, setStudentFeedback] = useState<any[]>([]);
  const [reflectionsLoading, setReflectionsLoading] = useState(false);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);

  const avgScore = useMemo(() => {
    if (students.length === 0) return 0;
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

  // ─── Load Parent Engagement Scores ────────────────────────────────────────
  const loadParentEngagement = useCallback(async (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    const { data: obsData } = await supabase
      .from('parent_observations')
      .select('student_id, submitted_by')
      .in('student_id', studentIds);

    const scoreMap: Record<string, Set<string>> = {};
    studentIds.forEach((id) => { scoreMap[id] = new Set(); });
    (obsData || []).forEach((o) => {
      if (scoreMap[o.student_id]) scoreMap[o.student_id].add(o.submitted_by);
    });

    const scores: Record<string, number> = {};
    Object.entries(scoreMap).forEach(([id, parents]) => {
      scores[id] = parents.size;
    });
    setParentEngagementScores(scores);
  }, [supabase]);

  // ─── Load Parent Queries ───────────────────────────────────────────────────
  const loadParentQueries = useCallback(async () => {
    setParentQueriesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setParentQueriesLoading(false); return; }
    const { data } = await supabase
      .from('parent_queries')
      .select('*')
      .eq('recipient_role', 'mentor')
      .order('created_at', { ascending: false });
    setParentQueries(data || []);
    setParentQueriesLoading(false);
  }, [supabase]);

  const handleReplyToQuery = async (queryId: string) => {
    if (!replyText.trim()) { toast.error('Please enter a reply.'); return; }
    setSubmittingReply(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('parent_queries')
      .update({ reply: replyText, status: 'replied', replied_by: user.id, replied_at: new Date().toISOString() })
      .eq('id', queryId);
    if (error) { toast.error('Failed to send reply.'); } else {
      toast.success('Reply sent!');
      setReplyingToId(null);
      setReplyText('');
      loadParentQueries();
    }
    setSubmittingReply(false);
  };

  // ─── Load Students from Supabase ──────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStudentsLoading(false); return; }

    const [studentsResult, profileResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, email, mentor_id, role, created_at, student_id')
        .eq('role', 'student')
        .eq('mentor_id', user.id),
      supabase
        .from('user_profiles')
        .select('mentor_code')
        .eq('id', user.id)
        .single(),
    ]);

    const rawProfiles: DbUserProfileStudent[] = studentsResult.data || [];

    // Map user_profiles students to UiStudent shape
    const mappedStudents: UiStudent[] = rawProfiles.map((p, i) => {
      const nameParts = (p.full_name || p.email || 'Student').split(' ');
      const initials = nameParts.slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
      return {
        id: p.student_id || p.id,
        name: p.full_name || p.email || 'Student',
        grade: '',
        age: undefined,
        gender: undefined,
        mentorId: p.mentor_id,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        avatarInitials: initials,
        enrolledDate: p.created_at ? p.created_at.split('T')[0] : '',
        lastSessionDate: '—',
        sessionCount: 0,
        averageScore: 0,
        scoreTrend: 'stable',
        primaryTopics: [],
        notes: '',
      };
    });

    setStudents(mappedStudents);
    setDbStudents(rawProfiles.map((p) => ({ id: p.id, name: p.full_name || p.email || 'Student' })));

    if (profileResult.data?.mentor_code) {
      setMentorCode(profileResult.data.mentor_code);
    }

    // Load sessions this week from Supabase
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const { data: sessData } = await supabase
      .from('sessions')
      .select('id')
      .eq('mentor_id', user.id)
      .gte('session_date', weekAgoStr);
    setSessionsThisWeek(sessData?.length || 0);

    setStudentsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // ─── Remove Student (set mentor_id to null in user_profiles) ─────────────
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Remove ${studentName} from your roster? They will be unlinked but their data will be preserved.`)) return;
    setRemovingStudentId(studentId);
    const { error } = await supabase
      .from('user_profiles')
      .update({ mentor_id: null })
      .eq('id', studentId);
    if (error) {
      toast.error('Failed to remove student: ' + error.message);
    } else {
      toast.success(`${studentName} removed from your roster.`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setDbStudents((prev) => prev.filter((s) => s.id !== studentId));
    }
    setRemovingStudentId(null);
  };

  const handleAddStudent = (data: { name: string; grade: string; age: string; gender: Gender | ''; notes: string }) => {
    // This modal adds locally; for full DB integration the AddStudentModal would insert to Supabase
    const initials = data.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
    const newStudent: UiStudent = {
      id: `student-${Date.now()}`,
      name: data.name,
      grade: data.grade,
      age: data.age ? parseInt(data.age) : undefined,
      gender: (data.gender as Gender) || undefined,
      mentorId: 'mentor-101',
      avatarColor: AVATAR_COLORS[students.length % AVATAR_COLORS.length],
      avatarInitials: initials,
      enrolledDate: new Date().toISOString().split('T')[0],
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
    const [taskResult, studentResult, submissionResult] = await Promise.all([
      supabase.from('student_tasks').select('*').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('students').select('id, name').eq('mentor_id', user.id),
      supabase.from('task_submissions').select('*').eq('mentor_id', user.id),
    ]);
    const taskData = taskResult.data;
    const studentData = studentResult.data;
    setTasks(taskData || []);
    setDbStudents(studentData || []);
    setTaskSubmissions(submissionResult.data || []);
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
      supabase.from('mentor_feedback').select('student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score, fruitful_comments, help_needed_comments, created_at').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('mentor_weekly_reflections').select('impact_score'),
    ]);

    const reflData = reflResult.data;
    const feedbackData = feedbackResult.data;
    const allReflData = allReflResult.data;
    setStudentFeedback(feedbackData || []);

    setReflections(reflData || []);

    if (feedbackData && feedbackData.length > 0) {
      const total = feedbackData.reduce((s: number, f: any) =>
        s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3, 0);
      setAvgFeedbackScore(total / feedbackData.length);
    }

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
      loadTasks();
    }
    if (activeTab === 'parent-queries') loadParentQueries();
  }, [activeTab, loadSurveys, loadTasks, loadReflections, loadLiveSessions, loadParentQueries]);

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

  const handleSaveGrade = async (submissionId: string) => {
    const form = gradingForm[submissionId];
    if (!form || !form.rating) {
      toast.error('Please select a rating first.');
      return;
    }
    setSavingGradeId(submissionId);
    const { error } = await supabase
      .from('task_submissions')
      .update({ mentor_rating: form.rating, mentor_comments: form.comments || null, graded_at: new Date().toISOString() })
      .eq('id', submissionId);
    if (error) {
      toast.error('Failed to save review: ' + error.message);
    } else {
      toast.success('Review saved!');
      loadTasks();
    }
    setSavingGradeId(null);
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
    { id: 'parent-queries', label: 'Parent Queries', icon: 'ChatBubbleLeftRightIcon' },
  ];

  const getStudentName = (id: string) => dbStudents.find((s) => s.id === id)?.name || 'Unknown';

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="animate-fade-in">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Mentor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your mentorship memory — all students, all sessions, all progress.
          </p>
        </div>
        {activeTab === 'roster' && mentorCode && (
          <button
            className="btn-primary self-start sm:self-auto"
            onClick={() => {
              navigator.clipboard?.writeText(mentorCode);
              toast.success('Invite code copied to clipboard!');
            }}
          >
            <Icon name="KeyIcon" size={17} />
            Generate / View Invite Code
          </button>
        )}
      </div>

      {/* Stats Strip — Needs Attention card is now clickable */}
      <DashboardStatsStrip
        totalStudents={students.length}
        sessionsThisWeek={sessionsThisWeek}
        averageScore={avgScore}
        studentsNeedingAttention={needAttention}
        onNeedsAttentionClick={() => setShowAttentionModal(true)}
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
          {/* Invite Code Banner */}
          {mentorCode && (
            <div className="mb-5 p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon name="KeyIcon" size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Your Mentor Invite Code</p>
                  <p className="text-lg font-800 text-primary tracking-widest font-mono">{mentorCode}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:max-w-xs">
                <Icon name="InformationCircleIcon" size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Share this code with students. They enter it during sign-up to link to your roster automatically.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(mentorCode);
                  toast.success('Invite code copied!');
                }}
                className="btn-ghost text-xs flex-shrink-0"
              >
                <Icon name="ClipboardDocumentIcon" size={14} />
                Copy
              </button>
            </div>
          )}

          {/* Search + Filter + Sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="input-mystic pl-10"
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

          {studentsLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-elevated flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Icon name="UserGroupIcon" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="font-700 text-foreground text-lg mb-2">
                {students.length === 0 ? 'No students linked yet' : 'No students found'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-5">
                {students.length === 0
                  ? 'Share your invite code above with students so they can link to your roster upon sign-up.'
                  : search
                  ? `No students match "${search}".`
                  : 'No students match the current filter.'}
              </p>
              {students.length === 0 && mentorCode && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Icon name="KeyIcon" size={16} className="text-primary" />
                  <span className="text-sm font-700 text-primary font-mono tracking-widest">{mentorCode}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((student) => (
                <div key={student.id} className="relative group">
                  <StudentCard student={student} />
                  {/* Parent Engagement Badge */}
                  <div className="absolute top-2 left-2">
                    <ParentEngagementBadge score={parentEngagementScores[student.id] || 0} />
                  </div>
                  {/* Remove Student Button */}
                  <button
                    onClick={() => handleRemoveStudent(student.id, student.name)}
                    disabled={removingStudentId === student.id}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-negative/90 hover:bg-negative text-white text-xs font-600 shadow-md"
                    title={`Remove ${student.name} from roster`}
                  >
                    {removingStudentId === student.id ? (
                      <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                    ) : (
                      <Icon name="UserMinusIcon" size={12} />
                    )}
                    Remove
                  </button>
                </div>
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

          {/* Feedback from Students */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-primary" />
              Feedback from Students
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {studentFeedback.length} total
              </span>
            </h2>
            {studentFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No student feedback yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {studentFeedback.map((fb, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{getStudentName(fb.student_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {fb.created_at ? formatDate(fb.created_at) : ''}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mb-1.5">
                      <span>Interaction: {'⭐'.repeat(fb.mentor_interaction_score || 0)}</span>
                      <span>Listening: {'⭐'.repeat(fb.active_listening_score || 0)}</span>
                      <span>Clarity: {'⭐'.repeat(fb.teaching_clarity_score || 0)}</span>
                    </div>
                    {fb.fruitful_comments && (
                      <p className="text-sm text-foreground/80 leading-relaxed">{fb.fruitful_comments}</p>
                    )}
                    {fb.help_needed_comments && (
                      <p className="text-xs text-warning mt-1">Needs help with: {fb.help_needed_comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                    <a href={survey.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-2.5 flex-shrink-0" title="Preview">
                      <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                    </a>
                    <button onClick={() => handleDeleteSurvey(survey.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0" title="Delete survey">
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
                {tasks.map((task) => {
                  const submissions = taskSubmissions.filter((s) => s.task_id === task.id);
                  return (
                  <div key={task.id} className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-600 text-primary">{getStudentName(task.student_id)}</span>
                          <PriorityBadge priority={task.priority_rating} />
                          <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                            task.status === 'Completed' ? 'bg-positive/10 text-positive border-positive/20'
                              : task.status === 'In Progress' ? 'bg-info/10 text-info border-info/20' : 'bg-muted text-muted-foreground border-border'
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

                    {submissions.length > 0 && (
                      <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                        {submissions.map((s) => {
                          const current = gradingForm[s.id] || { rating: s.mentor_rating || 0, comments: s.mentor_comments || '' };
                          return (
                            <div key={s.id} className="p-2.5 rounded-lg bg-card border border-border">
                              <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5 mb-2">
                                <Icon name="DocumentIcon" size={13} />
                                {s.file_name}
                              </a>
                              {s.mentor_rating ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-amber-500">{'⭐'.repeat(s.mentor_rating)}</span>
                                  {s.mentor_comments && <span className="text-muted-foreground">{s.mentor_comments}</span>}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setGradingForm((f) => ({ ...f, [s.id]: { ...current, rating: star } }))}
                                      >
                                        <Icon name="StarIcon" size={16} variant={star <= current.rating ? 'solid' : 'outline'} className={star <= current.rating ? 'text-amber-400' : 'text-muted-foreground'} />
                                      </button>
                                    ))}
                                  </div>
                                  <textarea
                                    className="input-mystic text-xs min-h-[50px] resize-none"
                                    placeholder="Optional comments for the student..."
                                    value={current.comments}
                                    onChange={(e) => setGradingForm((f) => ({ ...f, [s.id]: { ...current, comments: e.target.value } }))}
                                  />
                                  <button
                                    className="btn-primary text-xs py-1 px-3 self-start"
                                    onClick={() => handleSaveGrade(s.id)}
                                    disabled={savingGradeId === s.id}
                                  >
                                    {savingGradeId === s.id ? 'Saving...' : 'Save Review'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}

      {/* ── PARENT QUERIES TAB ────────────────────────────────────────────── */}
      {activeTab === 'parent-queries' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Parent Queries</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {parentQueries.filter((q) => q.status === 'open').length} open
              </span>
            </div>
            {parentQueriesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : parentQueries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No parent queries yet.</p>
                <p className="text-xs mt-1">When parents send you queries, they will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {parentQueries.map((query) => (
                  <div key={query.id} className={`p-4 rounded-xl border ${
                    query.status === 'open' ? 'bg-info/5 border-info/20' : 'bg-secondary/40 border-border'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name="HomeIcon" size={14} className="text-primary" />
                        <span className="text-xs font-600 text-muted-foreground">From Parent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                          query.status === 'replied' ? 'bg-positive/10 text-positive border-positive/20'
                            : query.status === 'closed' ? 'bg-muted text-muted-foreground border-border'
                            : 'bg-info/10 text-info border-info/20'
                        }`}>{query.status}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(query.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-3">{query.message}</p>

                    {query.reply && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3">
                        <p className="text-xs font-600 text-primary mb-1">Your Reply:</p>
                        <p className="text-xs text-foreground/80">{query.reply}</p>
                      </div>
                    )}

                    {query.status === 'open' && (
                      replyingToId === query.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            className="input-mystic min-h-[80px] resize-none text-sm"
                            placeholder="Type your reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-xs py-1.5 px-4"
                              onClick={() => handleReplyToQuery(query.id)}
                              disabled={submittingReply}
                            >
                              {submittingReply ? <><Icon name="ArrowPathIcon" size={12} className="animate-spin" /> Sending...</> : <><Icon name="PaperAirplaneIcon" size={12} /> Send Reply</>}
                            </button>
                            <button
                              className="btn-ghost text-xs py-1.5 px-4"
                              onClick={() => { setReplyingToId(null); setReplyText(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn-ghost text-xs py-1.5 px-4"
                          onClick={() => { setReplyingToId(query.id); setReplyText(''); }}
                        >
                          <Icon name="ChatBubbleLeftIcon" size={13} />
                          Reply
                        </button>
                      )
                    )}
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

      {/* Needs Attention Modal */}
      {showAttentionModal && (
        <NeedsAttentionModal
          students={students}
          onClose={() => setShowAttentionModal(false)}
        />
      )}
    </div>
  );
}