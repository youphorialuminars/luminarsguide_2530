'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import type { Gender } from '@/lib/mockData';
import StudentCard from './StudentCard';
import DashboardStatsStrip from './DashboardStatsStrip';
import AddStudentModal from './AddStudentModal';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type SortOption = 'name' | 'score' | 'sessions' | 'lastSession';
type FilterOption = 'all' | 'up' | 'down' | 'stable';
type MentorTab = 'roster' | 'attendance' | 'reflections' | 'surveys' | 'tasks' | 'calendar' | 'parent-queries' | 'parent-activities' | 'programs' | 'suggestions';

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
  requires_submission: boolean;
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
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterTrend, setFilterTrend] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [students, setStudents] = useState<UiStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [mentorCode, setMentorCode] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const searchParamsTab = useSearchParams();
  const [activeTab, setActiveTab] = useState<MentorTab>(
    (searchParamsTab.get('tab') as MentorTab) || 'roster'
  );
  const [reflectionFromDate, setReflectionFromDate] = useState<string>('');
  const [reflectionToDate, setReflectionToDate] = useState<string>('');
  const [reflectionViewMode, setReflectionViewMode] = useState<'calendar' | 'range'>('calendar');
  const [reflectionRangeSubmitted, setReflectionRangeSubmitted] = useState(false);

  // Pending Parent Approvals (parents linked to my students, awaiting my sign-off)
  const [pendingParentApprovals, setPendingParentApprovals] = useState<any[]>([]);
  const [pendingParentApprovalsLoading, setPendingParentApprovalsLoading] = useState(true);
  const [approvingParentId, setApprovingParentId] = useState<string | null>(null);

  // Pending Student Approvals (students who signed up with my invite code, awaiting my sign-off)
  const [pendingStudentApprovals, setPendingStudentApprovals] = useState<any[]>([]);
  const [pendingStudentApprovalsLoading, setPendingStudentApprovalsLoading] = useState(true);
  const [approvingStudentId, setApprovingStudentId] = useState<string | null>(null);

  // Pending Counselor Approvals (counselors who signed up with my invite code, awaiting my sign-off)
  const [pendingCounselorApprovals, setPendingCounselorApprovals] = useState<any[]>([]);
  const [pendingCounselorApprovalsLoading, setPendingCounselorApprovalsLoading] = useState(true);
  const [approvingCounselorId, setApprovingCounselorId] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParamsTab.get('tab');
    if (t) setActiveTab(t as MentorTab);
  }, [searchParamsTab]);

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
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, 'present' | 'absent'>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [parentActivities, setParentActivities] = useState<{ id: string; title: string; description: string; activity_type: string; created_at: string }[]>([]);
  const [activityResponseCounts, setActivityResponseCounts] = useState<Record<string, number>>({});
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityForm, setActivityForm] = useState({ title: '', description: '', activity_type: 'task' as 'task' | 'game' });
  const [postingActivity, setPostingActivity] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; posted_by: string; posted_by_role: string; title: string; description: string; program_date: string | null; external_link: string | null; file_url: string | null; file_name: string | null; created_at: string }[]>([]);
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programForm, setProgramForm] = useState({ title: '', description: '', program_date: '', external_link: '' });
  const [programFile, setProgramFile] = useState<File | null>(null);
  const [postingProgram, setPostingProgram] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [suggestionRecipientRole, setSuggestionRecipientRole] = useState('');
  const [suggestionRecipientOptions, setSuggestionRecipientOptions] = useState<{ id: string; name: string }[]>([]);
  const [suggestionRecipientId, setSuggestionRecipientId] = useState('');
  const [suggestionType, setSuggestionType] = useState<'suggestion' | 'feedback' | 'query'>('suggestion');
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [revealIdentity, setRevealIdentity] = useState(false);
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [receivedSuggestions, setReceivedSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [taskForm, setTaskForm] = useState({
    student_id: '',
    task_description: '',
    priority_rating: 1,
    deadline: '',
    requires_submission: false,
  });
  const [addingTask, setAddingTask] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [gradingForm, setGradingForm] = useState<Record<string, { rating: number; comments: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // Reflections / leaderboard state
  const [reflections, setReflections] = useState<MentorReflection[]>([]);
  const [reflectionForm, setReflectionForm] = useState({ impact_score: 7, students_helped_count: 0, confidence_score: 3, preparedness_score: 3, reflection_text: '' });
  const [submittingReflection, setSubmittingReflection] = useState(false);
  const [peerStats, setPeerStats] = useState<PeerStats | null>(null);
  const [avgFeedbackScore, setAvgFeedbackScore] = useState(0);
  const [studentFeedback, setStudentFeedback] = useState<any[]>([]);
  const [reflectionsLoading, setReflectionsLoading] = useState(false);
  const [selectedReflectionWeek, setSelectedReflectionWeek] = useState<string | null>(null);
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
        .from('students')
        .select('id, name, grade, age, gender, mentor_id, avg_score, sessions, topics, trend, alert_level, last_session, notes, avatar')
        .eq('mentor_id', user.id),
      supabase
        .from('user_profiles')
        .select('mentor_code')
        .eq('id', user.id)
        .single(),
    ]);

    const rawStudents: DbStudent[] = studentsResult.data || [];

    // Map the students table rows to the UI shape using the app's existing mapper
    const mappedStudents: UiStudent[] = rawStudents.map(mapDbStudentToUi);

    setStudents(mappedStudents);
    setDbStudents(rawStudents.map((s) => ({ id: s.id, name: s.name })));
    
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
    if (!confirm(`Remove ${studentName} from your roster? This only removes them from your roster — they remain linked to any other mentors they have.`)) return;
    setRemovingStudentId(studentId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRemovingStudentId(null); return; }

    // Get the student's user_profiles id before deleting, so we can clean up the link table too
    const { data: studentRow } = await supabase
      .from('students')
      .select('student_user_id')
      .eq('id', studentId)
      .maybeSingle();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)
      .eq('mentor_id', user.id);

    if (error) {
      toast.error('Failed to remove student: ' + error.message);
    } else {
      if (studentRow?.student_user_id) {
        await supabase
          .from('student_mentor_links')
          .delete()
          .eq('student_user_id', studentRow.student_user_id)
          .eq('mentor_id', user.id);
      }
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

    const [reflResult, feedbackResult, allReflResult, studentsResult] = await Promise.all([
      supabase.from('mentor_weekly_reflections').select('*').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('mentor_feedback').select('id, student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score, emotional_safety_score, independence_score, fruitful_comments, help_needed_comments, appreciation_note, created_at').eq('mentor_id', user.id).order('created_at', { ascending: false }),
      supabase.from('mentor_weekly_reflections').select('impact_score'),
      supabase.from('students').select('id, name').eq('mentor_id', user.id),
    ]);

    if (reflResult.error) {
      console.error('mentor_weekly_reflections load failed:', reflResult.error);
      toast.error('Could not load reflections: ' + reflResult.error.message);
    }
    if (feedbackResult.error) {
      console.error('mentor_feedback load failed:', feedbackResult.error);
    }

    const reflData = reflResult.data;
    const feedbackData = feedbackResult.data;
    const allReflData = allReflResult.data;
    setStudentFeedback(feedbackData || []);
    setDbStudents(studentsResult.data || []);

    setReflections(reflData || []);

    if (feedbackData && feedbackData.length > 0) {
      const total = feedbackData.reduce((s: number, f: any) =>
        s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score + (f.emotional_safety_score || 3) + (f.independence_score || 3)) / 5, 0);
      setAvgFeedbackScore(total / feedbackData.length);
    }

    const { data: peerAvgResult } = await supabase.rpc('get_mentor_peer_avg_score');
    setPeerStats((prev) => ({ ...prev, avgScore: Math.round(peerAvgResult || 0) }));

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
      requires_submission: taskForm.requires_submission,
    });
    if (error) {
      toast.error('Failed to assign task: ' + error.message);
    } else {
      toast.success('Task assigned!');
      setTaskForm((f) => ({ ...f, task_description: '', deadline: '', priority_rating: 1, requires_submission: false }));
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
      students_helped_count: reflectionForm.students_helped_count,
      confidence_score: reflectionForm.confidence_score,
      preparedness_score: reflectionForm.preparedness_score,
      reflection_text: reflectionForm.reflection_text.trim() || null,
    });
    if (error) {
      toast.error('Failed to submit reflection: ' + error.message);
    } else {
      toast.success('Reflection submitted!');
      setReflectionForm({ impact_score: 7, students_helped_count: 0, confidence_score: 3, preparedness_score: 3, reflection_text: '' });
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

  useEffect(() => {
    setPeerStats((prev) => ({ ...prev, myScore: myPerfScore }));
  }, [myPerfScore]);

  const filterOptions: { value: FilterOption; label: string; icon: string }[] = [
    { value: 'all', label: 'All Students', icon: 'UserGroupIcon' },
    { value: 'up', label: 'Improving', icon: 'ArrowTrendingUpIcon' },
    { value: 'stable', label: 'Stable', icon: 'MinusIcon' },
    { value: 'down', label: 'Declining', icon: 'ArrowTrendingDownIcon' },
  ];

  const getStudentName = (id: string) => dbStudents.find((s) => s.id === id)?.name || 'Unknown';

  const loadParentActivities = useCallback(async () => {
    setActivitiesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActivitiesLoading(false); return; }
    const { data } = await supabase
      .from('parent_activities')
      .select('id, title, description, activity_type, created_at')
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: false });
    setParentActivities(data || []);

    if (data && data.length > 0) {
      const { data: responses } = await supabase
        .from('parent_activity_responses')
        .select('activity_id')
        .in('activity_id', data.map((a) => a.id));
      const counts: Record<string, number> = {};
      (responses || []).forEach((r) => { counts[r.activity_id] = (counts[r.activity_id] || 0) + 1; });
      setActivityResponseCounts(counts);
    }
    setActivitiesLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'parent-activities') loadParentActivities();
  }, [activeTab, loadParentActivities]);

  const handlePostActivity = async () => {
    if (!activityForm.title.trim() || !activityForm.description.trim()) {
      toast.error('Please fill in both title and description.');
      return;
    }
    setPostingActivity(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPostingActivity(false); return; }
    const { error } = await supabase.from('parent_activities').insert({
      mentor_id: user.id,
      title: activityForm.title.trim(),
      description: activityForm.description.trim(),
      activity_type: activityForm.activity_type,
    });
    if (error) {
      toast.error('Failed to post activity: ' + error.message);
    } else {
      toast.success('Activity posted for parents!');
      setActivityForm({ title: '', description: '', activity_type: 'task' });
      loadParentActivities();
    }
    setPostingActivity(false);
  };

  const handleDeleteActivity = async (id: string) => {
    const { error } = await supabase.from('parent_activities').delete().eq('id', id);
    if (error) { toast.error('Failed to delete activity.'); }
    else { toast.success('Activity removed.'); loadParentActivities(); }
  };

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false });
    setPrograms(data || []);

    if (data && data.length > 0) {
      const posterIds = Array.from(new Set(data.map((p) => p.posted_by)));
      const { data: posters } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', posterIds);
      const names: Record<string, string> = {};
      (posters || []).forEach((p) => { names[p.id] = p.full_name || 'Unknown'; });
      setPosterNames(names);
    }
    setProgramsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'programs') {
      loadPrograms();
      supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null));
    }
  }, [activeTab, loadPrograms, supabase]);

  const handlePostProgram = async () => {
    if (!programForm.title.trim() || !programForm.description.trim()) {
      toast.error('Please fill in both title and description.');
      return;
    }
    setPostingProgram(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPostingProgram(false); return; }

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (programFile) {
      if (programFile.size > 2 * 1024 * 1024) {
        toast.error('File too large. Max size is 2MB.');
        setPostingProgram(false);
        return;
      }
      const filePath = `${user.id}/${Date.now()}_${programFile.name}`;
      const { error: uploadError } = await supabase.storage.from('program-files').upload(filePath, programFile);
      if (uploadError) {
        toast.error('File upload failed: ' + uploadError.message);
        setPostingProgram(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('program-files').getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
      fileName = programFile.name;
    }

    const { error } = await supabase.from('programs').insert({
      posted_by: user.id,
      posted_by_role: 'mentor',
      title: programForm.title.trim(),
      description: programForm.description.trim(),
      program_date: programForm.program_date || null,
      external_link: programForm.external_link.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
    });

    if (error) {
      toast.error('Failed to post program: ' + error.message);
    } else {
      toast.success('Program posted — visible to students, parents, counselors, and schools!');
      setProgramForm({ title: '', description: '', program_date: '', external_link: '' });
      setProgramFile(null);
      loadPrograms();
    }
    setPostingProgram(false);
  };

  const handleDeleteProgram = async (id: string) => {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) { toast.error('Failed to delete program.'); }
    else { toast.success('Program removed.'); loadPrograms(); }
  };

  const MENTOR_CAN_SEND_TO = ['parent', 'admin'];

  const loadSuggestionRecipients = useCallback(async (role: string) => {
    if (!role) { setSuggestionRecipientOptions([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let options: { id: string; name: string }[] = [];

    if (role === 'parent') {
      const { data: myStudents } = await supabase.from('students').select('id').eq('mentor_id', user.id);
      const studentIds = (myStudents || []).map((s) => s.id);
      if (studentIds.length > 0) {
        const { data: links } = await supabase.from('parent_student_links').select('parent_id').in('student_id', studentIds);
        const parentIds = Array.from(new Set((links || []).map((l) => l.parent_id)));
        if (parentIds.length > 0) {
          const { data: people } = await supabase.from('user_profiles').select('id, full_name').in('id', parentIds);
          options = (people || []).map((p) => ({ id: p.id, name: p.full_name || 'Parent' }));
        }
      }
    } else if (role === 'admin') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'admin');
      options = (people || []).map((p) => ({ id: p.id, name: p.full_name || 'Admin' }));
    }

    setSuggestionRecipientOptions(options);
    setSuggestionRecipientId('');
  }, [supabase]);

  useEffect(() => {
    loadSuggestionRecipients(suggestionRecipientRole);
  }, [suggestionRecipientRole, loadSuggestionRecipients]);

  const handleSendSuggestion = async () => {
    if (!suggestionRecipientId || !suggestionMessage.trim()) {
      toast.error('Please choose a recipient and write a message.');
      return;
    }
    setSendingSuggestion(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSendingSuggestion(false); return; }

    const { error } = await supabase.from('suggestions').insert({
      sender_id: user.id,
      sender_role: 'mentor',
      recipient_id: suggestionRecipientId,
      recipient_role: suggestionRecipientRole,
      type: suggestionType,
      message: suggestionMessage.trim(),
      is_anonymous: !revealIdentity,
    });

    if (error) {
      toast.error('Failed to send: ' + error.message);
    } else {
      toast.success('Sent!');
      setSuggestionMessage('');
      setSuggestionRecipientRole('');
      setSuggestionRecipientId('');
      setRevealIdentity(false);
    }
    setSendingSuggestion(false);
  };

  const loadReceivedSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSuggestionsLoading(false); return; }

    const { data } = await supabase
      .rpc('get_my_suggestions');

    setReceivedSuggestions(data || []);

    const revealedSenderIds = (data || []).filter((s: any) => !s.is_anonymous).map((s: any) => s.sender_id);
    if (revealedSenderIds.length > 0) {
      const { data: senders } = await supabase.from('user_profiles').select('id, full_name').in('id', revealedSenderIds);
      const names: Record<string, string> = {};
      (senders || []).forEach((p: any) => { names[p.id] = p.full_name || 'Unknown'; });
      setSenderNames(names);
    }
    setSuggestionsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'suggestions') loadReceivedSuggestions();
  }, [activeTab, loadReceivedSuggestions]);

  const handleMarkResolved = async (id: string) => {
    const { error } = await supabase.from('suggestions').update({ status: 'resolved' }).eq('id', id);
    if (!error) { loadReceivedSuggestions(); }
  };
  const loadAttendanceForDate = useCallback(async (date: string) => {
    setAttendanceLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAttendanceLoading(false); return; }
    const { data } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('mentor_id', user.id)
      .eq('attendance_date', date);
    const marks: Record<string, 'present' | 'absent'> = {};
    (data || []).forEach((row) => { marks[row.student_id] = row.status; });
    setAttendanceMarks(marks);
    setAttendanceLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendanceForDate(attendanceDate);
  }, [activeTab, attendanceDate, loadAttendanceForDate]);

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingAttendance(false); return; }

    const rows = Object.entries(attendanceMarks).map(([student_id, status]) => ({
      student_id,
      mentor_id: user.id,
      attendance_date: attendanceDate,
      status,
    }));

    if (rows.length === 0) {
      toast.error('Mark at least one student before saving.');
      setSavingAttendance(false);
      return;
    }

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,attendance_date' });

    if (error) {
      toast.error('Failed to save attendance: ' + error.message);
    } else {
      toast.success(`Attendance saved for ${formatDate(attendanceDate)}!`);
    }
    setSavingAttendance(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const loadPendingParentApprovals = useCallback(async () => {
    setPendingParentApprovalsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPendingParentApprovalsLoading(false); return; }

    const { data: myStudents } = await supabase
      .from('students')
      .select('id, name')
      .eq('mentor_id', user.id);

    const myStudentIds = (myStudents || []).map((s: any) => s.id);
    if (myStudentIds.length === 0) {
      setPendingParentApprovals([]);
      setPendingParentApprovalsLoading(false);
      return;
    }

    const { data: parents, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, linked_student_id, created_at')
      .eq('role', 'parent')
      .eq('approved_by_mentor', false)
      .in('linked_student_id', myStudentIds);

    if (error) {
      console.error('[MentorDashboard] Failed to load pending parent approvals:', error.message);
    }

    const nameByStudentId: Record<string, string> = {};
    (myStudents || []).forEach((s: any) => { nameByStudentId[s.id] = s.name; });

    setPendingParentApprovals(
      (parents || []).map((p: any) => ({ ...p, student_name: nameByStudentId[p.linked_student_id] || 'your student' }))
    );
    setPendingParentApprovalsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPendingParentApprovals();
  }, [loadPendingParentApprovals]);

  const handleApproveParent = async (parentId: string) => {
    setApprovingParentId(parentId);
    const { error } = await supabase.rpc('mentor_approve_parent', { p_parent_id: parentId });
    if (error) {
      toast.error('Failed to approve parent: ' + error.message);
    } else {
      toast.success('Parent approved! Their account is now active.');
      setPendingParentApprovals((prev) => prev.filter((p) => p.id !== parentId));
    }
    setApprovingParentId(null);
  };

  const loadPendingStudentApprovals = useCallback(async () => {
    setPendingStudentApprovalsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPendingStudentApprovalsLoading(false); return; }

    const { data: students, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'student')
      .eq('approval_status', 'pending')
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MentorDashboard] Failed to load pending student approvals:', error.message);
    }
    setPendingStudentApprovals(students || []);
    setPendingStudentApprovalsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPendingStudentApprovals();
  }, [loadPendingStudentApprovals]);

  const handleApproveStudent = async (studentId: string) => {
    setApprovingStudentId(studentId);
    const { error } = await supabase.rpc('mentor_approve_student', { p_student_id: studentId });
    if (error) {
      toast.error('Failed to approve student: ' + error.message);
    } else {
      toast.success('Student approved! Their account is now active.');
      setPendingStudentApprovals((prev) => prev.filter((s) => s.id !== studentId));
    }
    setApprovingStudentId(null);
  };

  const loadPendingCounselorApprovals = useCallback(async () => {
    setPendingCounselorApprovalsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPendingCounselorApprovalsLoading(false); return; }

    const { data: counselors, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'counselor')
      .eq('approval_status', 'pending')
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MentorDashboard] Failed to load pending counselor approvals:', error.message);
    }
    setPendingCounselorApprovals(counselors || []);
    setPendingCounselorApprovalsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPendingCounselorApprovals();
  }, [loadPendingCounselorApprovals]);

  const handleApproveCounselor = async (counselorId: string) => {
    setApprovingCounselorId(counselorId);
    const { error } = await supabase.rpc('mentor_approve_counselor', { p_counselor_id: counselorId });
    if (error) {
      toast.error('Failed to approve counselor: ' + error.message);
    } else {
      toast.success('Counselor approved! Their account is now active.');
      setPendingCounselorApprovals((prev) => prev.filter((c) => c.id !== counselorId));
    }
    setApprovingCounselorId(null);
  };

  return (
    <>
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

      {/* Parents awaiting your approval */}
      {pendingParentApprovals.length > 0 && (
        <div className="card-mystic p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2">
              <Icon name="UserGroupIcon" size={18} className="text-primary" />
              Parents Awaiting Your Approval
            </h2>
            <span className="text-xs font-600 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {pendingParentApprovals.length} waiting
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Approving activates the parent's account immediately — please confirm this is really your
            student's parent/guardian before approving.
          </p>
          <div className="flex flex-col gap-2">
            {pendingParentApprovals.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{p.full_name || 'Unnamed parent'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.email} · Parent of {p.student_name}
                  </p>
                </div>
                <button
                  onClick={() => handleApproveParent(p.id)}
                  disabled={approvingParentId === p.id}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 disabled:opacity-40 flex-shrink-0"
                >
                  {approvingParentId === p.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Students awaiting your approval */}
      {pendingStudentApprovals.length > 0 && (
        <div className="card-mystic p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2">
              <Icon name="UserGroupIcon" size={18} className="text-primary" />
              Students Awaiting Your Approval
            </h2>
            <span className="text-xs font-600 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {pendingStudentApprovals.length} waiting
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These students signed up using your invite code. Approving activates their account immediately.
          </p>
          <div className="flex flex-col gap-2">
            {pendingStudentApprovals.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{s.full_name || 'Unnamed student'}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
                <button
                  onClick={() => handleApproveStudent(s.id)}
                  disabled={approvingStudentId === s.id}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 disabled:opacity-40 flex-shrink-0"
                >
                  {approvingStudentId === s.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counselors awaiting your approval */}
      {pendingCounselorApprovals.length > 0 && (
        <div className="card-mystic p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2">
              <Icon name="UserGroupIcon" size={18} className="text-primary" />
              Counselors Awaiting Your Approval
            </h2>
            <span className="text-xs font-600 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {pendingCounselorApprovals.length} waiting
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These counselors signed up using your invite code. Approving activates their account immediately.
          </p>
          <div className="flex flex-col gap-2">
            {pendingCounselorApprovals.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{c.full_name || 'Unnamed counselor'}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
                <button
                  onClick={() => handleApproveCounselor(c.id)}
                  disabled={approvingCounselorId === c.id}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 disabled:opacity-40 flex-shrink-0"
                >
                  {approvingCounselorId === c.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        {getStudentName(session.student_id)} · {formatTime(session.meeting_time)}
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

      {/* ── ATTENDANCE TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="card-mystic p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Icon name="ClipboardDocumentCheckIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Daily Attendance Register</h2>
            </div>
            <input
              type="date"
              className="input-mystic w-auto"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>

          {dbStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No students linked yet.</p>
          ) : attendanceLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : (
            <div className="flex flex-col gap-2">
              {dbStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border">
                  <span className="text-sm font-600 text-foreground">{s.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAttendanceMarks((prev) => ({ ...prev, [s.id]: 'present' }))}
                      className={`text-xs font-600 px-3 py-1.5 rounded-full border transition-all ${
                        attendanceMarks[s.id] === 'present'
                          ? 'bg-positive text-white border-positive' : 'bg-card text-muted-foreground border-border hover:border-positive hover:text-positive'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => setAttendanceMarks((prev) => ({ ...prev, [s.id]: 'absent' }))}
                      className={`text-xs font-600 px-3 py-1.5 rounded-full border transition-all ${
                        attendanceMarks[s.id] === 'absent'
                          ? 'bg-negative text-white border-negative' : 'bg-card text-muted-foreground border-border hover:border-negative hover:text-negative'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn-primary self-start mt-3"
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
              >
                {savingAttendance ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Saving...</> : <><Icon name="CheckIcon" size={15} /> Save Attendance</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PARENT ACTIVITIES TAB ─────────────────────────────────────────── */}
      {activeTab === 'parent-activities' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="SparklesIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Post an Activity for Parents</h2>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Title <span className="text-negative">*</span></label>
                <input
                  className="input-mystic"
                  placeholder="e.g. 20-Minute Family Gratitude Game"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Description <span className="text-negative">*</span></label>
                <textarea
                  className="input-mystic min-h-[80px] resize-none"
                  placeholder="Describe the activity or game for the parent and child to do together..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Type</label>
                <select
                  className="input-mystic"
                  value={activityForm.activity_type}
                  onChange={(e) => setActivityForm((f) => ({ ...f, activity_type: e.target.value as 'task' | 'game' }))}
                >
                  <option value="task">Task</option>
                  <option value="game">Fun Game</option>
                </select>
              </div>
              <button className="btn-primary self-start" onClick={handlePostActivity} disabled={postingActivity}>
                {postingActivity ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Posting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Post Activity</>}
              </button>
            </div>
          </div>

          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Posted Activities</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {parentActivities.length} total
              </span>
            </div>
            {activitiesLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : parentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activities posted yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {parentActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-700 text-foreground">{a.title}</span>
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${a.activity_type === 'game' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                          {a.activity_type === 'game' ? 'Fun Game' : 'Task'}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activityResponseCounts[a.id] || 0} parent response(s)</p>
                    </div>
                    <button
                      onClick={() => handleDeleteActivity(a.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
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

      {/* ── PROGRAMS & EVENTS TAB ─────────────────────────────────────────── */}
      {activeTab === 'programs' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="MegaphoneIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Post a Program or Event</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Visible to students, parents, counselors, and schools. A link and a file are both optional.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Title <span className="text-negative">*</span></label>
                <input
                  className="input-mystic"
                  placeholder="e.g. Live Confidence-Building Session"
                  value={programForm.title}
                  onChange={(e) => setProgramForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Description <span className="text-negative">*</span></label>
                <textarea
                  className="input-mystic min-h-[80px] resize-none"
                  placeholder="Describe the program or event..."
                  value={programForm.description}
                  onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Date (optional)</label>
                  <input
                    type="date"
                    className="input-mystic"
                    value={programForm.program_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, program_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Link (optional — e.g. for an online session)</label>
                  <input
                    className="input-mystic"
                    placeholder="https://meet.jit.si/..."
                    value={programForm.external_link}
                    onChange={(e) => setProgramForm((f) => ({ ...f, external_link: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Attach a brochure/poster (optional)</label>
                <div className="flex items-center gap-2">
                  <label className="btn-ghost text-xs py-1.5 px-3 cursor-pointer">
                    <Icon name="PaperClipIcon" size={12} /> {programFile ? programFile.name : 'Choose File'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setProgramFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {programFile && (
                    <button className="btn-ghost text-xs py-1.5 px-2" onClick={() => setProgramFile(null)}>Clear</button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG · max 2MB</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG · max 2MB</p>
              </div>
              <button className="btn-primary self-start" onClick={handlePostProgram} disabled={postingProgram}>
                {postingProgram ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Posting...</> : <><Icon name="MegaphoneIcon" size={15} /> Post Program</>}
              </button>
            </div>
          </div>

          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">All Programs & Events</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {programs.length} total
              </span>
            </div>
            {programsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : programs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No programs posted yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {programs.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-700 text-foreground">{p.title}</span>
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${p.posted_by_role === 'school' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                          {p.posted_by_role === 'school' ? 'School' : 'Mentor'}: {posterNames[p.posted_by] || '...'}
                        </span>
                        {p.program_date && (
                          <span className="text-xs text-muted-foreground">{formatDate(p.program_date)}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{p.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {p.external_link && (
                          <a href={p.external_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Icon name="LinkIcon" size={12} /> Open Link
                          </a>
                        )}
                        {p.file_url && (
                          <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Icon name="DocumentIcon" size={12} /> {p.file_name}
                          </a>
                        )}
                      </div>
                    </div>
                    {p.posted_by === currentUserId && (
                      <button
                        onClick={() => handleDeleteProgram(p.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
                      >
                        <Icon name="TrashIcon" size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUGGESTION PORTAL TAB ─────────────────────────────────────────── */}
      {activeTab === 'suggestions' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="PaperAirplaneIcon" size={18} className="text-primary" />
              Send a Suggestion, Feedback, or Query
            </h2>
            <div className="flex flex-col gap-3">
              <select className="input-mystic" value={suggestionRecipientRole} onChange={(e) => setSuggestionRecipientRole(e.target.value)}>
                <option value="">Send to...</option>
                {MENTOR_CAN_SEND_TO.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              {suggestionRecipientRole && (
                <select className="input-mystic" value={suggestionRecipientId} onChange={(e) => setSuggestionRecipientId(e.target.value)}>
                  <option value="">Choose a specific person...</option>
                  {suggestionRecipientOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
              <select className="input-mystic" value={suggestionType} onChange={(e) => setSuggestionType(e.target.value as any)}>
                <option value="suggestion">Suggestion</option>
                <option value="feedback">Feedback</option>
                <option value="query">Query</option>
              </select>
              <textarea
                className="input-mystic min-h-[80px] resize-none"
                placeholder="Write your message..."
                value={suggestionMessage}
                onChange={(e) => setSuggestionMessage(e.target.value)}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={revealIdentity} onChange={(e) => setRevealIdentity(e.target.checked)} className="w-4 h-4 rounded border-border" />
                <span className="text-sm text-foreground">Reveal my identity to the recipient (otherwise sent anonymously)</span>
              </label>
              <button className="btn-primary self-start" onClick={handleSendSuggestion} disabled={sendingSuggestion}>
                {sendingSuggestion ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="InboxIcon" size={18} className="text-primary" />
              Received
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {receivedSuggestions.length} total
              </span>
            </h2>
            {suggestionsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : receivedSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing received yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {receivedSuggestions.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-600 text-primary">
                        {s.is_anonymous ? `Anonymous ${s.sender_role}` : (senderNames[s.sender_id] || s.sender_role)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{s.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.status === 'resolved' ? 'bg-positive/10 text-positive border-positive/20' : 'bg-muted text-muted-foreground border-border'}`}>{s.status}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{s.message}</p>
                    {s.status !== 'resolved' && (
                      <button className="btn-ghost text-xs py-1 px-3 mt-2" onClick={() => handleMarkResolved(s.id)}>
                        Mark as Resolved
                      </button>
                    )}
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
              <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none">
                <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
              </div>
              <input
                className="input-mystic !pl-10"
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

          {/* Appreciation Wall — student names ARE shown here, students opt into this when they write one */}
          {(() => {
            const appreciations = (studentFeedback as any[])
              .filter((f) => f.appreciation_note && f.appreciation_note.trim())
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return (
              <div className="card-mystic p-5">
                <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                  <Icon name="SparklesIcon" size={18} className="text-amber-400" />
                  Appreciation Wall
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                    {appreciations.length} total
                  </span>
                </h2>
                {appreciations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No shoutouts yet — when a student sends one, it'll show up here with their name.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {appreciations.map((a: any) => {
                      const student = dbStudents.find((s) => s.id === a.student_id);
                      return (
                        <div key={a.id} className="p-3 rounded-xl bg-amber-50/10 border border-amber-400/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-700 text-amber-400">{student ? student.name : 'A Student'}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed">"{a.appreciation_note}"</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Past Reflections & Student Feedback — nothing shown until a week or date range is picked */}
          {reflectionsLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : (() => {
            const getWeekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
            const recentWeeks = Array.from({ length: 12 }, (_, i) => {
              const ws = getWeekStart(new Date());
              ws.setDate(ws.getDate() - i * 7);
              return ws.toISOString().split('T')[0];
            });
            const weekRangeMs = (wk: string) => {
              const start = new Date(wk).getTime();
              return { start, end: start + 7 * 86400000 };
            };
            const avg = (arr: any[], key: string) => arr.length ? arr.reduce((s, x) => s + (Number(x[key]) || 0), 0) / arr.length : 0;

            const activeWeekRange = reflectionViewMode === 'calendar' && selectedReflectionWeek ? weekRangeMs(selectedReflectionWeek) : null;
            const fromTs = reflectionFromDate ? new Date(reflectionFromDate).getTime() : null;
            const toTs = reflectionToDate ? new Date(reflectionToDate).getTime() + 86400000 : null;
            const isActive = reflectionViewMode === 'calendar' ? !!activeWeekRange : reflectionRangeSubmitted;

            const reflectionsInScope = !isActive ? [] : (reflections as any[]).filter((r) => {
              const d = new Date(r.created_at).getTime();
              if (activeWeekRange) return d >= activeWeekRange.start && d < activeWeekRange.end;
              const fromOk = fromTs === null || d >= fromTs;
              const toOk = toTs === null || d <= toTs;
              return fromOk && toOk;
            });

            const feedbackInScope = !isActive ? [] : (studentFeedback as any[]).filter((f) => {
              const d = new Date(f.created_at).getTime();
              if (activeWeekRange) return d >= activeWeekRange.start && d < activeWeekRange.end;
              const fromOk = fromTs === null || d >= fromTs;
              const toOk = toTs === null || d <= toTs;
              return fromOk && toOk;
            });

            const avgImpact = avg(reflectionsInScope, 'impact_score');
            const avgConfidence = avg(reflectionsInScope, 'confidence_score');
            const avgPreparedness = avg(reflectionsInScope, 'preparedness_score');
            const avgHelped = avg(reflectionsInScope, 'students_helped_count');

            const avgInteraction = avg(feedbackInScope, 'mentor_interaction_score');
            const avgListening = avg(feedbackInScope, 'active_listening_score');
            const avgClarity = avg(feedbackInScope, 'teaching_clarity_score');
            const avgSafety = avg(feedbackInScope, 'emotional_safety_score');
            const avgIndependence = avg(feedbackInScope, 'independence_score');

            const writtenNotes = [
              ...reflectionsInScope.filter((r: any) => r.reflection_text).map((r: any) => ({ date: r.created_at, label: 'Your reflection', text: r.reflection_text })),
              ...feedbackInScope.filter((f: any) => f.fruitful_comments).map((f: any) => ({ date: f.created_at, label: 'Student comment', text: f.fruitful_comments })),
              ...feedbackInScope.filter((f: any) => f.help_needed_comments).map((f: any) => ({ date: f.created_at, label: 'Student — needs help with', text: f.help_needed_comments })),
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
              <div className="card-mystic p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                    <Icon name="ClockIcon" size={18} className="text-primary" />
                    Past Reflections &amp; Feedback
                  </h2>
                  <div className="flex gap-1 p-1 rounded-lg bg-secondary border border-border">
                    <button
                      onClick={() => setReflectionViewMode('calendar')}
                      className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${
                        reflectionViewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      By Week
                    </button>
                    <button
                      onClick={() => setReflectionViewMode('range')}
                      className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${
                        reflectionViewMode === 'range' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      By Date Range
                    </button>
                  </div>
                </div>

                {reflectionViewMode === 'calendar' ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                    {recentWeeks.map((wk) => (
                      <button
                        key={wk}
                        onClick={() => setSelectedReflectionWeek(wk)}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-600 transition-colors ${
                          wk === selectedReflectionWeek
                            ? 'bg-primary text-white border-primary'
                            : 'bg-secondary/40 text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        Week of {formatDate(wk)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div>
                      <label className="block text-xs font-600 text-muted-foreground mb-1">From</label>
                      <input
                        type="date"
                        className="input-mystic text-sm py-1.5"
                        value={reflectionFromDate}
                        onChange={(e) => setReflectionFromDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-600 text-muted-foreground mb-1">To</label>
                      <input
                        type="date"
                        className="input-mystic text-sm py-1.5"
                        value={reflectionToDate}
                        onChange={(e) => setReflectionToDate(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn-primary text-xs py-1.5 px-4"
                      disabled={!reflectionFromDate || !reflectionToDate}
                      onClick={() => setReflectionRangeSubmitted(true)}
                    >
                      Show Reflections
                    </button>
                    {(reflectionFromDate || reflectionToDate) && (
                      <button
                        className="btn-ghost text-xs py-1.5 px-3"
                        onClick={() => { setReflectionFromDate(''); setReflectionToDate(''); setReflectionRangeSubmitted(false); }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {!isActive ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {reflectionViewMode === 'calendar' ? 'Pick a week above to see reflections & feedback.' : 'Pick a "From" and "To" date, then click "Show Reflections."'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="text-sm font-700 text-foreground mb-1">Your Reflections</h3>
                      <p className="text-xs text-muted-foreground mb-2">Average across {reflectionsInScope.length} submission{reflectionsInScope.length !== 1 ? 's' : ''}</p>
                      {reflectionsInScope.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No reflections in this period.</p>
                      ) : (
                        <table className="w-full text-xs border-collapse max-w-sm">
                          <tbody>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Impact</td>
                              <td className="py-2 text-foreground/80">{avgImpact.toFixed(1)}/10</td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Confidence</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgConfidence))} <span className="text-muted-foreground">({avgConfidence.toFixed(1)})</span></td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Preparedness</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgPreparedness))} <span className="text-muted-foreground">({avgPreparedness.toFixed(1)})</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 pr-3 text-muted-foreground">Students Helped (avg)</td>
                              <td className="py-2 text-foreground/80">{avgHelped.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-700 text-foreground mb-1">Student Feedback</h3>
                      <p className="text-xs text-muted-foreground mb-2">Average across {feedbackInScope.length} response{feedbackInScope.length !== 1 ? 's' : ''}, all students</p>
                      {feedbackInScope.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No feedback in this period.</p>
                      ) : (
                        <table className="w-full text-xs border-collapse max-w-sm">
                          <tbody>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Interaction</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgInteraction))} <span className="text-muted-foreground">({avgInteraction.toFixed(1)})</span></td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Listening</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgListening))} <span className="text-muted-foreground">({avgListening.toFixed(1)})</span></td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Clarity</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgClarity))} <span className="text-muted-foreground">({avgClarity.toFixed(1)})</span></td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="py-2 pr-3 text-muted-foreground">Emotional Safety</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgSafety))} <span className="text-muted-foreground">({avgSafety.toFixed(1)})</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 pr-3 text-muted-foreground">Independence</td>
                              <td className="py-2 text-amber-400">{'⭐'.repeat(Math.round(avgIndependence))} <span className="text-muted-foreground">({avgIndependence.toFixed(1)})</span></td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>

                    {writtenNotes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-700 text-foreground mb-2">Written Comments</h3>
                        <div className="flex flex-col gap-2">
                          {writtenNotes.map((n, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-secondary/40 border border-border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-600 text-primary">{n.label}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(n.date)}</span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed">{n.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
                  How many students did you actively help this week?
                </label>
                <input
                  type="number"
                  min={0}
                  className="input-mystic w-32"
                  value={reflectionForm.students_helped_count}
                  onChange={(e) => setReflectionForm((f) => ({ ...f, students_helped_count: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  How confident did you feel in this week's sessions?
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReflectionForm((f) => ({ ...f, confidence_score: s }))}
                    >
                      <Icon name="StarIcon" size={22} variant={s <= reflectionForm.confidence_score ? 'solid' : 'outline'} className={s <= reflectionForm.confidence_score ? 'text-amber-400' : 'text-muted-foreground'} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  How prepared did you feel for this week's sessions?
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReflectionForm((f) => ({ ...f, preparedness_score: s }))}
                    >
                      <Icon name="StarIcon" size={22} variant={s <= reflectionForm.preparedness_score ? 'solid' : 'outline'} className={s <= reflectionForm.preparedness_score ? 'text-amber-400' : 'text-muted-foreground'} />
                    </button>
                  ))}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskForm.requires_submission}
                  onChange={(e) => setTaskForm((f) => ({ ...f, requires_submission: e.target.checked }))}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm text-foreground">Require a file submission for this task</span>
              </label>
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
              </div>
            )}
          </div>
        </div>
      )}

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
  </>  
  );
}