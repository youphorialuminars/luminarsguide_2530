'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

const PILLAR_COLORS = ['#c4b5fd', '#93c5fd', '#86efac', '#fcd34d', '#f9a8d4'];

type DashboardTab = 'overview' | 'mentors' | 'students' | 'invites';

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'counselor') {
        router.push('/student-dashboard');
        return;
      }
      setCounselorProfile(profile);

      // Load linked mentors
      const { data: mentorData } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, mentor_code, counselor_id')
        .eq('counselor_id', user.id)
        .eq('role', 'mentor');

      const linkedMentors = mentorData || [];
      setMentors(linkedMentors);

      if (linkedMentors.length > 0) {
        const mentorIds = linkedMentors.map((m) => m.id);

        const [studResult, sessResult, attResult, fbResult] = await Promise.all([
          supabase.from('students').select('*').in('mentor_id', mentorIds),
          supabase.from('sessions').select('id, mentor_id, student_id, topic, score, created_at').in('mentor_id', mentorIds),
          supabase.from('attendance').select('student_id, status').in('mentor_id', mentorIds),
          supabase.from('mentor_feedback').select('student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score, fruitful_comments').in('student_id',
            (await supabase.from('students').select('id').in('mentor_id', mentorIds)).data?.map((s: any) => s.id) || []
          ),
        ]);

        setStudents(studResult.data || []);
        setSessions(sessResult.data || []);
        setAttendance(attResult.data || []);
        setFeedback(fbResult.data || []);
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
        // Generate a new code only if none exists
        const code = Math.floor(100000 + Math.random() * 900000).toString();
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 transition-all whitespace-nowrap ${
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
          {mentors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="AcademicCapIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No mentors linked yet. Share your counselor code with mentors.</p>
            </div>
          ) : (
            mentors.map((mentor) => (
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
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="UserGroupIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No students found under your linked mentors.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => {
                const mentor = mentors.find((m) => m.id === student.mentor_id);
                const studentSessions = sessions.filter((s) => s.student_id === student.id).length;
                const studentAtt = attendance.filter((a) => a.student_id === student.id);
                const attRate =
                  studentAtt.length > 0
                    ? Math.round((studentAtt.filter((a) => a.status === 'present').length / studentAtt.length) * 100)
                    : 0;

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
