'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,  } from 'recharts';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MentorProfile {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
  counselor_id: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  avg_score: number;
  sessions: number;
  topics: string[];
  trend: string;
}

interface SessionRow {
  id: string;
  mentor_id: string;
  student_id: string;
  topic: string;
  score: number | null;
  created_at: string;
}

interface AttendanceRow {
  student_id: string;
  status: 'present' | 'absent';
}

interface FeedbackRow {
  student_id: string;
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
}

interface InviteCode {
  id: string;
  invite_code: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

const PILLARS = [
  'Relational Intelligence and Community Stewardship',
  'Digital Wisdom and Citizenship',
  'Psychological Fortitude and Mindfulness',
  'Bodily Integrity and Social Conscientiousness',
  'Authentic Identity and Purposeful Worth',
];

const PILLAR_COLORS = ['#c4b5fd', '#93c5fd', '#86efac', '#fcd34d', '#f9a8d4'];

type DashboardTab = 'overview' | 'mentors' | 'students' | 'invites' | 'programs' | 'suggestions';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon name={icon as any} size={20} className="text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-500">{label}</p>
        <p className="text-2xl font-800 text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mentor Analytics Card ────────────────────────────────────────────────────
function MentorAnalyticsCard({
  mentor,
  students,
  sessions,
  attendance,
  feedback,
  onViewStudents,
  onGenerateReport,
  isGenerating,
  report,
}: {
  mentor: MentorProfile;
  students: StudentRow[];
  sessions: SessionRow[];
  attendance: AttendanceRow[];
  feedback: FeedbackRow[];
  onViewStudents: () => void;
  onGenerateReport: () => void;
  isGenerating: boolean;
  report: string | null;
}) {
  const mentorSessions = sessions.filter((s) => s.mentor_id === mentor.id);
  const mentorStudents = students.filter((s) => s.mentor_id === mentor.id);
  const mentorStudentIds = new Set(mentorStudents.map((s) => s.id));
  const mentorAttendance = attendance.filter((a) => mentorStudentIds.has(a.student_id));
  const presentCount = mentorAttendance.filter((a) => a.status === 'present').length;
  const absentCount = mentorAttendance.filter((a) => a.status === 'absent').length;

  // Session volume per student (bar chart)
  const sessionBarData = mentorStudents.map((s) => ({
    name: s.name.split(' ')[0],
    sessions: mentorSessions.filter((sess) => sess.student_id === s.id).length,
  }));

  // Attendance per student (bar chart)
  const attendanceBarData = mentorStudents.map((s) => {
    const stuAtt = mentorAttendance.filter((a) => a.student_id === s.id);
    return {
      name: s.name.split(' ')[0],
      present: stuAtt.filter((a) => a.status === 'present').length,
      absent: stuAtt.filter((a) => a.status === 'absent').length,
    };
  });

  // Pillar distribution (pie chart)
  const pillarCounts: Record<string, number> = {};
  PILLARS.forEach((p) => { pillarCounts[p] = 0; });
  mentorSessions.forEach((s) => {
    if (s.topic && pillarCounts[s.topic] !== undefined) {
      pillarCounts[s.topic]++;
    }
  });
  const pillarPieData = PILLARS.map((p, i) => ({
    name: p.split(' ').slice(0, 2).join(' '),
    fullName: p,
    value: pillarCounts[p] || 0,
    color: PILLAR_COLORS[i],
  })).filter((d) => d.value > 0);

  const avgFeedback =
    feedback.length > 0
      ? (
          feedback.reduce(
            (s, f) => s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3,
            0
          ) / feedback.length
        ).toFixed(1)
      : 'N/A';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Icon name="AcademicCapIcon" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-700 text-foreground">{mentor.full_name}</h3>
            <p className="text-xs text-muted-foreground">{mentor.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            {mentorStudents.length} students
          </span>
          <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            {mentorSessions.length} sessions
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Session Volume Bar */}
        <div>
          <p className="text-xs font-600 text-muted-foreground mb-3 uppercase tracking-wide">Session Volume</p>
          {sessionBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={sessionBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">No session data</div>
          )}
        </div>

        {/* Attendance Bar */}
        <div>
          <p className="text-xs font-600 text-muted-foreground mb-3 uppercase tracking-wide">
            Attendance ({presentCount}P / {absentCount}A)
          </p>
          {attendanceBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={attendanceBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="present" fill="#86efac" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="#fca5a5" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">No attendance data</div>
          )}
        </div>

        {/* Pillar Pie */}
        <div>
          <p className="text-xs font-600 text-muted-foreground mb-3 uppercase tracking-wide">Pillar Distribution</p>
          {pillarPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={pillarPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pillarPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">No pillar data</div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon name="StarIcon" size={14} className="text-amber-400" variant="solid" />
          <span>Avg feedback: <strong className="text-foreground">{avgFeedback}</strong>/5</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={onViewStudents}
          className="btn-ghost text-sm"
        >
          <Icon name="UserGroupIcon" size={15} />
          View Students
        </button>
        <button
          onClick={onGenerateReport}
          disabled={isGenerating}
          className="btn-primary text-sm"
        >
          {isGenerating ? (
            <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Generating...</>
          ) : (
            <><Icon name="SparklesIcon" size={15} /> Generate Report</>
          )}
        </button>
      </div>

      {/* AI Report */}
      {report && (
        <div className="mx-5 mb-5 p-4 rounded-xl bg-violet-50 border border-violet-200 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="SparklesIcon" size={15} className="text-violet-600" />
            <span className="text-xs font-700 text-violet-700 uppercase tracking-wide">AI Performance Report</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{report}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CounselorDashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [counselorProfile, setCounselorProfile] = useState<MentorProfile | null>(null);
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [generatingReportFor, setGeneratingReportFor] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [generatingCode, setGeneratingCode] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t as DashboardTab);
  }, [searchParams]);
  const [globalSearch, setGlobalSearch] = useState(searchParams.get('q') || '');
  const [parentEngagementScores, setParentEngagementScores] = useState<Record<string, number>>({});
  const [programs, setPrograms] = useState<{ id: string; posted_by: string; posted_by_role: string; title: string; description: string; program_date: string | null; external_link: string | null; file_url: string | null; file_name: string | null }[]>([]);
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [programsLoading, setProgramsLoading] = useState(false);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      let { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        await new Promise((r) => setTimeout(r, 500));
        const retry = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        profile = retry.data;
      }

      if (!profile || profile.role !== 'counselor') {
        router.push('/sign-up-login');
        return;
      }
      setCounselorProfile(profile);

      // Load linked mentors — counselor_id in user_profiles stores the counselor's UUID
      // This is the deep relational link: user_profiles.counselor_id = auth.uid()
      const { data: mentorData, error: mentorErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, mentor_code, counselor_id')
        .eq('counselor_id', user.id)
        .eq('role', 'mentor');

      if (mentorErr) {
        console.error('[CounselorDashboard] Failed to load linked mentors:', mentorErr.message);
      }

      const linkedMentors = mentorData || [];
      setMentors(linkedMentors);

      if (linkedMentors.length > 0) {
        const mentorIds = linkedMentors.map((m) => m.id);

        // Fetch student IDs first for the feedback sub-query
        const { data: studentIdRows } = await supabase
          .from('students')
          .select('id')
          .in('mentor_id', mentorIds);
        const studentIds = (studentIdRows || []).map((s: any) => s.id);

        const [studResult, sessResult, attResult, fbResult] = await Promise.all([
          supabase.from('students').select('*').in('mentor_id', mentorIds),
          supabase.from('sessions').select('id, mentor_id, student_id, topic, score, created_at').in('mentor_id', mentorIds),
          supabase.from('attendance').select('student_id, status').in('mentor_id', mentorIds),
          studentIds.length > 0
            ? supabase.from('mentor_feedback').select('student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score, fruitful_comments').in('student_id', studentIds)
            : Promise.resolve({ data: [] }),
        ]);

        // Students found via their mentor's link to this counselor
        const mentorLinkedStudents = studResult.data || [];

        // ALSO check for students linked directly to this counselor (independent of any mentor)
        const { data: directStudents } = await supabase
          .from('user_profiles')
          .select('id, full_name, mentor_id')
          .eq('counselor_id', user.id)
          .eq('role', 'student');

        const seenIds = new Set(mentorLinkedStudents.map((s: any) => s.id));
        const extraStudents = (directStudents || [])
          .filter((p: any) => !seenIds.has(p.id))
          .map((p: any) => ({
            id: p.id,
            name: p.full_name || 'Student',
            grade: '',
            mentor_id: p.mentor_id || null,
            avg_score: 0,
            sessions: 0,
            trend: 'stable',
          }));

        const studentList = [...mentorLinkedStudents, ...extraStudents];
        setStudents(studentList);
        setSessions(sessResult.data || []);
        setAttendance(attResult.data || []);
        setFeedback((fbResult as any).data || []);

        // Load parent engagement scores
        if (studentList.length > 0) {
          const allStudentIds = studentList.map((s: any) => s.id);
          const { data: obsData } = await supabase
            .from('parent_observations')
            .select('student_id, submitted_by')
            .in('student_id', allStudentIds);

          const scoreMap: Record<string, number> = {};
          allStudentIds.forEach((id: string) => { scoreMap[id] = 0; });
          (obsData || []).forEach((o: any) => {
            if (scoreMap[o.student_id] !== undefined) scoreMap[o.student_id]++;
          });
          setParentEngagementScores(scoreMap);
        }
      }

      // Load invite codes
      const { data: inviteData } = await supabase
        .from('counselor_mentor_invites')
        .select('*')
        .eq('counselor_id', user.id)
        .order('created_at', { ascending: false });
      setInviteCodes(inviteData || []);
    } catch (err) {
      console.error('Error loading counselor data:', err);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtered data based on globalSearch ─────────────────────────────────
  const filteredMentors = mentors.filter((m) =>
    !globalSearch.trim() ||
    m.full_name.toLowerCase().includes(globalSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(globalSearch.toLowerCase())
  );

  const filteredStudents = students.filter((s) =>
    !globalSearch.trim() ||
    s.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
    s.grade?.toLowerCase().includes(globalSearch.toLowerCase())
  );

  const COUNSELOR_CAN_SEND_TO = ['mentor', 'parent', 'admin'];

  const loadSuggestionRecipients = useCallback(async (role: string) => {
    if (!role) { setSuggestionRecipientOptions([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let options: { id: string; name: string }[] = [];

    if (role === 'mentor') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('counselor_id', user.id).eq('role', 'mentor');
      options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Mentor' }));
    } else if (role === 'parent') {
      const { data: myStudents } = await supabase.from('user_profiles').select('id').eq('counselor_id', user.id).eq('role', 'student');
      const studentUserIds = (myStudents || []).map((s: any) => s.id);
      if (studentUserIds.length > 0) {
        const { data: studentRows } = await supabase.from('students').select('id').in('student_user_id', studentUserIds);
        const studentIds = (studentRows || []).map((s: any) => s.id);
        if (studentIds.length > 0) {
          const { data: links } = await supabase.from('parent_student_links').select('parent_id').in('student_id', studentIds);
          const parentIds = Array.from(new Set((links || []).map((l: any) => l.parent_id)));
          if (parentIds.length > 0) {
            const { data: people } = await supabase.from('user_profiles').select('id, full_name').in('id', parentIds);
            options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Parent' }));
          }
        }
      }
    } else if (role === 'admin') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'admin');
      options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Admin' }));
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
      sender_role: 'counselor',
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

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProgramsLoading(false); return; }

    const { data: myMentors } = await supabase.from('user_profiles').select('id, school_id').eq('counselor_id', user.id).eq('role', 'mentor');
    const mentorIds = (myMentors || []).map((m: any) => m.id);
    const schoolIds = Array.from(new Set((myMentors || []).map((m: any) => m.school_id).filter(Boolean)));
    const posterIds = [...mentorIds, ...schoolIds];

    if (posterIds.length === 0) { setPrograms([]); setProgramsLoading(false); return; }

    const { data } = await supabase
      .from('programs')
      .select('*')
      .in('posted_by', posterIds)
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
    if (activeTab === 'programs') loadPrograms();
  }, [activeTab, loadPrograms]);

  const handleGenerateCode = async () => {
    if (!counselorProfile) return;
    setGeneratingCode(true);
    try {
      // Check if a code already exists for this counselor
      const { data: existing } = await supabase
        .from('counselor_mentor_invites')
        .select('invite_code')
        .eq('counselor_id', counselorProfile.id)
        .limit(1)
        .maybeSingle();

      if (existing?.invite_code) {
        toast.success(`Your counselor code: ${existing.invite_code}`, { duration: 5000 });
      } else {
        // Generate a new code in LLL-DDDDDD format
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * 26)]).join('');
        const digits = String(Math.floor(Math.random() * 900000) + 100000);
        const code = `${prefix}-${digits}`;
        const { error } = await supabase
          .from('counselor_mentor_invites')
          .insert({ counselor_id: counselorProfile.id, invite_code: code });
        if (error) {
          toast.error('Failed to generate code. Please try again.');
        } else {
          toast.success(`Code generated: ${code}`);
          loadData();
        }
      }
    } catch {
      toast.error('Failed to get/generate code.');
    }
    setGeneratingCode(false);
  };

  const handleGenerateReport = async (mentor: MentorProfile) => {
    setGeneratingReportFor(mentor.id);
    try {
      const mentorStudents = students.filter((s) => s.mentor_id === mentor.id);
      const mentorSessions = sessions.filter((s) => s.mentor_id === mentor.id);
      const mentorStudentIds = new Set(mentorStudents.map((s) => s.id));
      const mentorFeedback = feedback.filter((f) => mentorStudentIds.has(f.student_id));
      const mentorAttendance = attendance.filter((a) => mentorStudentIds.has(a.student_id));

      const presentRate =
        mentorAttendance.length > 0
          ? Math.round((mentorAttendance.filter((a) => a.status === 'present').length / mentorAttendance.length) * 100)
          : 0;

      const avgFeedbackScore =
        mentorFeedback.length > 0
          ? (
              mentorFeedback.reduce(
                (s, f) => s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3,
                0
              ) / mentorFeedback.length
            ).toFixed(1)
          : 'N/A';

      const pillarCounts: Record<string, number> = {};
      PILLARS.forEach((p) => { pillarCounts[p] = 0; });
      mentorSessions.forEach((s) => {
        if (s.topic && pillarCounts[s.topic] !== undefined) pillarCounts[s.topic]++;
      });
      const topPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      const feedbackComments = mentorFeedback
        .map((f) => f.fruitful_comments)
        .filter(Boolean)
        .slice(0, 5)
        .join('\n- ');

      const prompt = `You are a senior educational program supervisor reviewing a mentor's performance data. Write a concise, qualitative performance summary (3-4 paragraphs) for the following mentor. Be specific, constructive, and professional.

Mentor: ${mentor.full_name}
Total Students: ${mentorStudents.length}
Total Sessions Conducted: ${mentorSessions.length}
Overall Attendance Rate: ${presentRate}%
Average Student Feedback Score: ${avgFeedbackScore}/5
Most Taught Pillar: ${topPillar}
Pillar Distribution: ${JSON.stringify(pillarCounts)}

Student Feedback Comments:
- ${feedbackComments || 'No comments yet'}

Please synthesize this data into a qualitative performance report covering: (1) Teaching effectiveness and student engagement, (2) Strengths observed from feedback, (3) Areas for growth, (4) Overall recommendation.`;

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-2.5-flash',
        [
          { role: 'system', content: 'You are an expert educational program supervisor. Write clear, professional, and constructive mentor performance reports.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7, max_tokens: 800 }
      );

      const reportText = response?.choices?.[0]?.message?.content || 'Unable to generate report at this time.';
      setReports((prev) => ({ ...prev, [mentor.id]: reportText }));
      toast.success('Performance report generated!');
    } catch (err) {
      toast.error('Failed to generate report. Please check your Gemini API key.');
    }
    setGeneratingReportFor(null);
  };

  const handleViewStudents = (mentorId: string) => {
    setActiveTab('students');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading counselor dashboard...</p>
        </div>
      </div>
    );
  }

  const totalStudents = students.length;
  const totalSessions = sessions.length;
  const overallAttendanceRate =
    attendance.length > 0
      ? Math.round((attendance.filter((a) => a.status === 'present').length / attendance.length) * 100)
      : 0;

  const tabs: { id: DashboardTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'ChartBarIcon' },
    { id: 'mentors', label: 'Mentor Directory', icon: 'AcademicCapIcon' },
    { id: 'students', label: 'Student Directory', icon: 'UserGroupIcon' },
    { id: 'invites', label: 'Invite Codes', icon: 'KeyIcon' },
    { id: 'programs', label: 'Programs & Events', icon: 'MegaphoneIcon' },
    { id: 'suggestions', label: 'Suggestion Portal', icon: 'ChatBubbleLeftEllipsisIcon' },
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Counselor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome, {counselorProfile?.full_name} — supervising {mentors.length} mentor{mentors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateCode}
            disabled={generatingCode}
            className="btn-primary"
          >
            {generatingCode ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Generating...</>
            ) : (
              <><Icon name="KeyIcon" size={16} /> Generate Counselor Code</>
            )}
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="AcademicCapIcon" label="Linked Mentors" value={mentors.length} />
            <StatCard icon="UserGroupIcon" label="Total Students" value={totalStudents} />
            <StatCard icon="BookOpenIcon" label="Total Sessions" value={totalSessions} />
            <StatCard icon="CheckCircleIcon" label="Attendance Rate" value={`${overallAttendanceRate}%`} sub="across all students" />
          </div>

          {mentors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Icon name="AcademicCapIcon" size={32} className="text-primary" />
              </div>
              <h3 className="text-lg font-700 text-foreground mb-2">No Mentors Linked Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Generate a Counselor Code and share it with mentors during their sign-up to link them to your account.
              </p>
              <button onClick={handleGenerateCode} className="btn-primary mt-4">
                <Icon name="KeyIcon" size={16} /> Generate Counselor Code
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mentors.slice(0, 2).map((mentor) => (
                <MentorAnalyticsCard
                  key={mentor.id}
                  mentor={mentor}
                  students={students}
                  sessions={sessions}
                  attendance={attendance}
                  feedback={feedback}
                  onViewStudents={() => handleViewStudents(mentor.id)}
                  onGenerateReport={() => handleGenerateReport(mentor)}
                  isGenerating={generatingReportFor === mentor.id}
                  report={reports[mentor.id] || null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mentors Tab */}
      {activeTab === 'mentors' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {filteredMentors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="AcademicCapIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {globalSearch ? `No mentors match "${globalSearch}".` : 'No mentors linked yet. Share your counselor code with mentors.'}
              </p>
            </div>
          ) : (
            filteredMentors.map((mentor) => (
              <MentorAnalyticsCard
                key={mentor.id}
                mentor={mentor}
                students={students}
                sessions={sessions}
                attendance={attendance}
                feedback={feedback}
                onViewStudents={() => handleViewStudents(mentor.id)}
                onGenerateReport={() => handleGenerateReport(mentor)}
                isGenerating={generatingReportFor === mentor.id}
                report={reports[mentor.id] || null}
              />
            ))
          )}
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Read-only view of all students under your linked mentors. Click a student to view their full dashboard.
          </p>
          {filteredStudents.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="UserGroupIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {globalSearch ? `No students match "${globalSearch}".` : 'No students found under your linked mentors.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((student) => {
                const mentor = mentors.find((m) => m.id === student.mentor_id);
                const studentSessions = sessions.filter((s) => s.student_id === student.id).length;
                const studentAtt = attendance.filter((a) => a.student_id === student.id);
                const attRate =
                  studentAtt.length > 0
                    ? Math.round((studentAtt.filter((a) => a.status === 'present').length / studentAtt.length) * 100)
                    : 0;
                const parentEngScore = parentEngagementScores[student.id] || 0;
                const parentEngLabel = parentEngScore >= 5 ? 'High' : parentEngScore >= 2 ? 'Medium' : 'Low';
                const parentEngCls = parentEngScore >= 5 ? 'bg-green-50 text-green-700 border-green-200' : parentEngScore >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';

                return (
                  <button
                    key={student.id}
                    onClick={() => router.push(`/counselor-student-view?studentId=${student.id}`)}
                    className="bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon name="UserIcon" size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-700 text-foreground text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.grade}</p>
                        </div>
                      </div>
                      <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                        {studentSessions} sessions
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border font-600 ${
                        attRate >= 80 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {attRate}% attendance
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border font-600 ${parentEngCls}`}>
                        👨‍👩‍👧 {parentEngLabel}
                      </span>
                    </div>
                    {mentor && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Mentor: <span className="font-600 text-foreground">{mentor.full_name}</span>
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Programs & Events Tab */}
      {activeTab === 'programs' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="MegaphoneIcon" size={18} className="text-primary" />
              <h3 className="text-base font-700 text-foreground">Programs & Events</h3>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>
            {programsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : programs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No programs posted yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {programs.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-700 text-foreground">{p.title}</span>
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${p.posted_by_role === 'school' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                        {p.posted_by_role === 'school' ? 'School' : 'Mentor'}: {posterNames[p.posted_by] || '...'}
                      </span>
                      {p.program_date && (
                        <span className="text-xs text-muted-foreground">{new Date(p.program_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-2">{p.description}</p>
                    <div className="flex items-center gap-3">
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
                {COUNSELOR_CAN_SEND_TO.map((r) => (
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

      {/* Invite Codes Tab */}
      {activeTab === 'invites' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Share these 6-digit codes with mentors during sign-up to link them to your account.
            </p>
            <button onClick={handleGenerateCode} disabled={generatingCode} className="btn-primary text-sm">
              {generatingCode ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Generating...</>
              ) : (
                <><Icon name="PlusIcon" size={15} /> New Code</>
              )}
            </button>
          </div>

          {inviteCodes.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="KeyIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No invite codes generated yet.</p>
              <button onClick={handleGenerateCode} className="btn-primary mt-4">
                <Icon name="KeyIcon" size={16} /> Generate First Code
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Code</th>
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Created</th>
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Used At</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.map((code) => (
                    <tr key={code.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono font-700 text-lg tracking-widest text-primary">{code.invite_code}</span>
                      </td>
                      <td className="px-5 py-3">
                        {code.used_by ? (
                          <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">Used</span>
                        ) : (
                          <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Available</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {new Date(code.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {code.used_at ? new Date(code.used_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
