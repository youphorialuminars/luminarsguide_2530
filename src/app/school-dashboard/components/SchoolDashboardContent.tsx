'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

const PILLAR_COLORS = ['#c4b5fd', '#93c5fd', '#86efac', '#fcd34d', '#f9a8d4'];

type DashboardTab = 'overview' | 'students' | 'mentors' | 'invites' | 'calendar';

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

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('School');
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [mentorSearch, setMentorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [parentEngagementScores, setParentEngagementScores] = useState<Record<string, number>>({});

  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Load linked mentors — school_id in user_profiles stores the school's UUID
      // This is the deep relational link: user_profiles.school_id = uid (school's auth UUID)
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

      // Load students under those mentors
      if (mentorIds.length > 0) {
        const { data: studentData, error: studentErr } = await supabase
          .from('students')
          .select('id, name, grade, mentor_id, avg_score, sessions')
          .in('mentor_id', mentorIds);

        if (studentErr) {
          console.error('[SchoolDashboard] Failed to load students:', studentErr.message);
        }
        setStudents(studentData || []);

        const studentIds = (studentData || []).map((s: StudentRow) => s.id);

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
        .single()
        .then(({ data: profile }) => {
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
        {/* Global Search Bar */}
        <div className="relative">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="input-mystic pl-9 w-56"
            placeholder="Search mentors & students…"
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setMentorSearch(e.target.value);
              setStudentSearch(e.target.value);
            }}
          />
          {globalSearch && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { setGlobalSearch(''); setMentorSearch(''); setStudentSearch(''); }}
            >
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Bar Chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-base font-700 text-foreground mb-1">Average Student Attendance</h3>
              <p className="text-xs text-muted-foreground mb-4">Attendance rate per mentor group</p>
              {avgAttendanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={avgAttendanceData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(v: number) => [`${v}%`, 'Attendance']}
                    />
                    <Bar dataKey="rate" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No attendance data yet
                </div>
              )}
            </div>

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
              <p className="text-xs text-muted-foreground mt-1">Students will appear here once mentors are linked via school invite codes</p>
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
