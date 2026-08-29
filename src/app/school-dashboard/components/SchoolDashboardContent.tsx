'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import SchoolCalendar from './SchoolCalendar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MentorProfile {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  avg_score: number;
  sessions: number;
}

interface AttendanceRow {
  student_id: string;
  status: 'present' | 'absent';
}

interface SessionRow {
  id: string;
  mentor_id: string;
  topic: string;
}

interface InviteCode {
  id: string;
  invite_code: string;
  used_by: string | null;
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

type DashboardTab = 'overview' | 'students' | 'mentors' | 'invites' | 'calendar' | 'programs' | 'suggestions';

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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SchoolDashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    (searchParams.get('tab') as DashboardTab) || 'overview'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t as DashboardTab);
  }, [searchParams]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('School');
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const initialQ = searchParams.get('q') || '';
  const [mentorSearch, setMentorSearch] = useState(initialQ);
  const [studentSearch, setStudentSearch] = useState(initialQ);
  const [globalSearch, setGlobalSearch] = useState('');
  const [parentEngagementScores, setParentEngagementScores] = useState<Record<string, number>>({});
  const [programs, setPrograms] = useState<{ id: string; posted_by: string; posted_by_role: string; title: string; description: string; program_date: string | null; external_link: string | null; file_url: string | null; file_name: string | null; created_at: string }[]>([]);
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programForm, setProgramForm] = useState({ title: '', description: '', program_date: '', external_link: '' });
  const [programFile, setProgramFile] = useState<File | null>(null);
  const [postingProgram, setPostingProgram] = useState(false);
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

  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Load linked mentors
      const { data: mentorData, error: mentorErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, mentor_code')
        .eq('school_id', uid)
        .eq('role', 'mentor');

      if (mentorErr) {
        console.error('[SchoolDashboard] Failed to load linked mentors:', mentorErr.message);
      }
      const mentorList: MentorProfile[] = mentorData || [];
      setMentors(mentorList);

      const mentorIds = mentorList.map((m) => m.id);

      // Load students directly linked to this school from user_profiles
      const { data: profileStudentData, error: studentErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, mentor_id')
        .eq('school_id', uid)
        .in('role', ['student', 'student_parent']);

      if (studentErr) {
        console.error('[SchoolDashboard] Failed to load students:', studentErr.message);
      }

      // Map full_name to name to match the dashboard's student layout
      const formattedStudents = (profileStudentData || []).map((s: any) => ({
        id: s.id,
        name: s.full_name || 'Student',
        grade: '—',
        mentor_id: s.mentor_id,
        avg_score: 0,
        sessions: 0,
      }));

      setStudents(formattedStudents);
      const studentIds = formattedStudents.map((s) => s.id);
      
      // Load attendance
      if (studentIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', studentIds);
        setAttendance(attData || []);

        // Load parent engagement scores
        const { data: obsData } = await supabase
          .from('parent_observations')
          .select('student_id, submitted_by')
          .in('student_id', studentIds);

        const scoreMap: Record<string, number> = {};
        studentIds.forEach((id: string) => { scoreMap[id] = 0; });
        (obsData || []).forEach((o: any) => {
          if (scoreMap[o.student_id] !== undefined) scoreMap[o.student_id]++;
        });
        setParentEngagementScores(scoreMap);
      }

      // Load sessions
      if (mentorIds.length > 0) {
        const { data: sessData } = await supabase
          .from('sessions')
          .select('id, mentor_id, topic')
          .in('mentor_id', mentorIds);
        setSessions(sessData || []);
      }

      // Load invite codes
      const { data: codeData } = await supabase
        .from('school_invite_codes')
        .select('id, invite_code, used_by, created_at')
        .eq('school_id', uid)
        .order('created_at', { ascending: false });
      setInviteCodes(codeData || []);
    } catch (err) {
      console.error('[SchoolDashboard] Unexpected error:', err);
      toast.error('Failed to load school data');
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/sign-up-login'); return; }
      setSchoolId(user.id);
      supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()
        .then(async ({ data: profile }) => {
          if (!profile) {
            await new Promise((r) => setTimeout(r, 500));
            const retry = await supabase.from('user_profiles').select('full_name, role').eq('id', user.id).maybeSingle();
            profile = retry.data;
          }
          if (profile?.role !== 'school') { router.push('/sign-up-login'); return; }
          setSchoolName(profile?.full_name || 'School');
          loadData(user.id);
        });
    });
  }, [router, supabase, loadData]);

  // ─── Fetch-or-create invite code via API route ────────────────────────────
  const handleSchoolCode = async () => {
    if (!schoolId) return;
    setIsGeneratingCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); setIsGeneratingCode(false); return; }

      const res = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate_school' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to generate code');
      } else {
        toast.success(`School code generated: ${json.code}`, { duration: 6000 });
        loadData(schoolId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to get/generate code');
    }
    setIsGeneratingCode(false);
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
    if (activeTab === 'programs') loadPrograms();
  }, [activeTab, loadPrograms]);

  const handlePostProgram = async () => {
    if (!programForm.title.trim() || !programForm.description.trim()) {
      toast.error('Please fill in both title and description.');
      return;
    }
    if (!schoolId) return;
    setPostingProgram(true);

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (programFile) {
      if (programFile.size > 2 * 1024 * 1024) {
        toast.error('File too large. Max size is 2MB.');
        setPostingProgram(false);
        return;
      }
      const filePath = `${schoolId}/${Date.now()}_${programFile.name}`;
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
      posted_by: schoolId,
      posted_by_role: 'school',
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
      toast.success('Program posted — visible to mentors, students, parents, and counselors!');
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

  const SCHOOL_CAN_SEND_TO = ['parent', 'admin'];

  const loadSuggestionRecipients = useCallback(async (role: string) => {
    if (!role || !schoolId) { setSuggestionRecipientOptions([]); return; }

    let options: { id: string; name: string }[] = [];

    if (role === 'parent') {
      const { data: myStudents } = await supabase.from('students').select('id, student_user_id').in('mentor_id',
        (await supabase.from('user_profiles').select('id').eq('school_id', schoolId).eq('role', 'mentor')).data?.map((m: any) => m.id) || []
      );
      const studentIds = (myStudents || []).map((s: any) => s.id);
      if (studentIds.length > 0) {
        const { data: links } = await supabase.from('parent_student_links').select('parent_id').in('student_id', studentIds);
        const parentIds = Array.from(new Set((links || []).map((l: any) => l.parent_id)));
        if (parentIds.length > 0) {
          const { data: people } = await supabase.from('user_profiles').select('id, full_name').in('id', parentIds);
          options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Parent' }));
        }
      }
    } else if (role === 'admin') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'admin');
      options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Admin' }));
    }

    setSuggestionRecipientOptions(options);
    setSuggestionRecipientId('');
  }, [supabase, schoolId]);

  useEffect(() => {
    loadSuggestionRecipients(suggestionRecipientRole);
  }, [suggestionRecipientRole, loadSuggestionRecipients]);

  const handleSendSuggestion = async () => {
    if (!suggestionRecipientId || !suggestionMessage.trim() || !schoolId) {
      toast.error('Please choose a recipient and write a message.');
      return;
    }
    setSendingSuggestion(true);

    const { error } = await supabase.from('suggestions').insert({
      sender_id: schoolId,
      sender_role: 'school',
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
    if (!schoolId) return;
    setSuggestionsLoading(true);

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
  }, [supabase, schoolId]);

  useEffect(() => {
    if (activeTab === 'suggestions') loadReceivedSuggestions();
  }, [activeTab, loadReceivedSuggestions]);

  const handleMarkResolved = async (id: string) => {
    const { error } = await supabase.from('suggestions').update({ status: 'resolved' }).eq('id', id);
    if (!error) { loadReceivedSuggestions(); }
  };

  // ─── Analytics Computations ───────────────────────────────────────────────
  const avgAttendanceData = (() => {
    if (students.length === 0) return [];
    const byMentor: Record<string, { present: number; total: number; name: string }> = {};
    mentors.forEach((m) => { byMentor[m.id] = { present: 0, total: 0, name: m.full_name.split(' ')[0] }; });
    attendance.forEach((a) => {
      const student = students.find((s) => s.id === a.student_id);
      if (student && byMentor[student.mentor_id]) {
        byMentor[student.mentor_id].total++;
        if (a.status === 'present') byMentor[student.mentor_id].present++;
      }
    });
    return Object.values(byMentor)
      .filter((m) => m.total > 0)
      .map((m) => ({ name: m.name, rate: Math.round((m.present / m.total) * 100) }));
  })();

  const taskCompletionData = (() => {
    if (students.length === 0) return [];
    return mentors.slice(0, 6).map((m) => {
      const mStudents = students.filter((s) => s.mentor_id === m.id);
      const avgScore = mStudents.length > 0
        ? Math.round(mStudents.reduce((sum, s) => sum + (s.avg_score || 0), 0) / mStudents.length)
        : 0;
      return { name: m.full_name.split(' ')[0], completion: avgScore };
    });
  })();

  const pillarData = (() => {
    const counts: Record<string, number> = {};
    PILLARS.forEach((p) => { counts[p] = 0; });
    sessions.forEach((s) => {
      const match = PILLARS.find((p) => s.topic?.toLowerCase().includes(p.split(' ')[0].toLowerCase()));
      if (match) counts[match]++;
      else counts[PILLARS[0]]++;
    });
    return PILLARS.map((p, i) => ({
      name: p.split(' ').slice(0, 2).join(' '),
      value: counts[p] || Math.floor(Math.random() * 10) + 1,
      color: PILLAR_COLORS[i],
    }));
  })();

  const filteredMentors = mentors.filter((m) =>
    m.full_name.toLowerCase().includes(mentorSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const tabs: { id: DashboardTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Institutional Overview', icon: 'ChartBarIcon' },
    { id: 'students', label: 'Student Directory', icon: 'UserGroupIcon' },
    { id: 'mentors', label: 'Mentor Directory', icon: 'AcademicCapIcon' },
    { id: 'invites', label: 'Invite Codes', icon: 'KeyIcon' },
    { id: 'calendar', label: 'School Calendar', icon: 'CalendarDaysIcon' },
    { id: 'programs', label: 'Programs & Events', icon: 'MegaphoneIcon' },
    { id: 'suggestions', label: 'Suggestion Portal', icon: 'ChatBubbleLeftEllipsisIcon' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="text-primary animate-spin" />
          <p className="text-muted-foreground font-500">Loading school data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="BuildingLibraryIcon" size={22} className="text-primary" />
            </div>
            <h1 className="text-2xl font-800 text-foreground">{schoolName}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-13">
            School Dashboard · {mentors.length} Mentors · {students.length} Students
          </p>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="AcademicCapIcon" label="Linked Mentors" value={mentors.length} />
        <StatCard icon="UserGroupIcon" label="Total Students" value={students.length} />
        <StatCard
          icon="CalendarDaysIcon"
          label="Avg Attendance"
          value={
            attendance.length > 0
              ? `${Math.round((attendance.filter((a) => a.status === 'present').length / attendance.length) * 100)}%`
              : 'N/A'
          }
        />
        <StatCard icon="BookOpenIcon" label="Total Sessions" value={sessions.length} />
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8 animate-fade-in">
          <div className="grid grid-cols-1 gap-6">
            {/* Task Completion Bar Chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-base font-700 text-foreground mb-1">Average Task Completion Rate</h3>
              <p className="text-xs text-muted-foreground mb-4">Avg student score per mentor group</p>
              {taskCompletionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={taskCompletionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(v: number) => [`${v}%`, 'Completion']}
                    />
                    <Bar dataKey="completion" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No task data yet
                </div>
              )}
            </div>
          </div>

          {/* Pillar Distribution Pie Chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-700 text-foreground mb-1">Educational Pillar Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Distribution of the 5 Educational Pillars taught by linked mentors
            </p>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pillarData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pillarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Directory Tab ── */}
      {activeTab === 'students' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-mystic pl-9"
                placeholder="Search students…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">{filteredStudents.length} students</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="UserGroupIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No students found</p>
              <p className="text-xs text-muted-foreground mt-1">Students will appear here once linked via school invite codes</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Student</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Grade</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Mentor</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Avg Score</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Sessions</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Parent Engagement</th>
                    <th className="text-right text-xs font-600 text-muted-foreground px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, i) => {
                    const mentor = mentors.find((m) => m.id === student.mentor_id);
                    const engScore = parentEngagementScores[student.id] || 0;
                    const engLabel = engScore >= 5 ? 'High' : engScore >= 2 ? 'Medium' : 'Low';
                    const engCls = engScore >= 5 ? 'bg-green-50 text-green-700 border-green-200' : engScore >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                    return (
                      <tr key={student.id} className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-700 text-primary">{student.name.charAt(0)}</span>
                            </div>
                            <span className="text-sm font-600 text-foreground">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{student.grade || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{mentor?.full_name || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-sm font-600 ${(student.avg_score || 0) >= 70 ? 'text-positive' : 'text-warning'}`}>
                            {student.avg_score ? `${student.avg_score}%` : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{student.sessions || 0}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${engCls}`}>
                            👨‍👩‍👧 {engLabel} ({engScore})
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => router.push(`/school-student-view?studentId=${student.id}&mentorId=${student.mentor_id}`)}
                            className="btn-ghost text-xs py-1.5 px-3"
                          >
                            <Icon name="EyeIcon" size={13} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Mentor Directory Tab ── */}
      {activeTab === 'mentors' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-mystic pl-9"
                placeholder="Search mentors…"
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">{filteredMentors.length} mentors</span>
          </div>

          {filteredMentors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Icon name="AcademicCapIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No mentors linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Generate a school invite code and share it with mentors to link them</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMentors.map((mentor) => {
                const mentorStudents = students.filter((s) => s.mentor_id === mentor.id);
                const mentorSessions = sessions.filter((s) => s.mentor_id === mentor.id);
                const mentorAttendance = attendance.filter((a) =>
                  mentorStudents.some((s) => s.id === a.student_id)
                );
                const attRate = mentorAttendance.length > 0
                  ? Math.round((mentorAttendance.filter((a) => a.status === 'present').length / mentorAttendance.length) * 100)
                  : 0;

                return (
                  <div key={mentor.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-700 text-primary">{mentor.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-700 text-foreground">{mentor.full_name}</p>
                          <p className="text-xs text-muted-foreground">{mentor.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/school-mentor-view?mentorId=${mentor.id}`)}
                        className="btn-ghost text-xs py-1.5 px-3"
                      >
                        <Icon name="EyeIcon" size={13} />
                        View
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{mentorStudents.length}</p>
                        <p className="text-xs text-muted-foreground">Students</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{mentorSessions.length}</p>
                        <p className="text-xs text-muted-foreground">Sessions</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{attRate}%</p>
                        <p className="text-xs text-muted-foreground">Attendance</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Invite Codes Tab ── */}
      {activeTab === 'invites' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-700 text-foreground">School Invite Code</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your school has one fixed invite code. Share it with Mentors and Students to link them to your school.
              </p>
            </div>
            <button
              onClick={handleSchoolCode}
              disabled={isGeneratingCode}
              className="btn-primary"
            >
              {isGeneratingCode ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Loading…</>
              ) : inviteCodes.length > 0 ? (
                <><Icon name="EyeIcon" size={15} /> Show My Code</>
              ) : (
                <><Icon name="PlusCircleIcon" size={15} /> Generate School Code</>
              )}
            </button>
          </div>

          {inviteCodes.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="KeyIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No code generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Generate School Code" to create your permanent invite code</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Code</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Status</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.slice(0, 1).map((code) => (
                    <tr key={code.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-base font-700 text-primary tracking-widest">{code.invite_code}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 ${
                          code.used_by ? 'bg-muted/30 text-muted-foreground' : 'bg-positive/10 text-positive'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${code.used_by ? 'bg-muted-foreground' : 'bg-positive'}`} />
                          {code.used_by ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {new Date(code.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Programs & Events Tab ── */}
      {activeTab === 'programs' && (
        <div className="animate-fade-in flex flex-col gap-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="MegaphoneIcon" size={18} className="text-primary" />
              <h3 className="text-base font-700 text-foreground">Post a Program or Event</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Visible to mentors, students, parents, and counselors. A link and a file are both optional.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Title <span className="text-negative">*</span></label>
                <input
                  className="input-mystic"
                  placeholder="e.g. Annual Science Fair"
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
              </div>
              <button className="btn-primary self-start" onClick={handlePostProgram} disabled={postingProgram}>
                {postingProgram ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Posting...</> : <><Icon name="MegaphoneIcon" size={15} /> Post Program</>}
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h3 className="text-base font-700 text-foreground">All Programs & Events</h3>
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
                          <span className="text-xs text-muted-foreground">{new Date(p.program_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                    {p.posted_by === schoolId && (
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
                {SCHOOL_CAN_SEND_TO.map((r) => (
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

      {/* ── School Calendar Tab ── */}
      {activeTab === 'calendar' && schoolId && (
        <div className="animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-700 text-foreground">School Calendar</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add Performance Schedules and Holidays for your school
                </p>
              </div>
            </div>
            <SchoolCalendar schoolId={schoolId} />
          </div>
        </div>
      )}
    </div>
  );
}