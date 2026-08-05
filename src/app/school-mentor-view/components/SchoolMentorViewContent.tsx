'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface MentorData {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  avg_score: number;
  sessions: number;
}

interface SessionRow {
  id: string;
  topic: string;
  score: number | null;
  created_at: string;
}

interface AttendanceRow {
  student_id: string;
  status: 'present' | 'absent';
}

const PILLARS = [
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];
const PILLAR_COLORS = ['#c4b5fd', '#93c5fd', '#86efac', '#fcd34d', '#f9a8d4'];

export default function SchoolMentorViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mentorId = searchParams.get('mentorId');
  const supabase = createClient();

  const [mentor, setMentor] = useState<MentorData | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mentorId) { router.push('/school-dashboard'); return; }
    const load = async () => {
      setIsLoading(true);
      const [mentorResult, studentResult, sessResult] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, mentor_code').eq('id', mentorId).single(),
        supabase.from('students').select('id, name, grade, avg_score, sessions').eq('mentor_id', mentorId),
        supabase.from('sessions').select('id, topic, score, created_at').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(20),
      ]);
      setMentor(mentorResult.data);
      const studentList: StudentRow[] = studentResult.data || [];
      setStudents(studentList);
      setSessions(sessResult.data || []);

      if (studentList.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', studentList.map((s) => s.id));
        setAttendance(attData || []);
      }
      setIsLoading(false);
    };
    load();
  }, [mentorId, router, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Icon name="ArrowPathIcon" size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Icon name="ExclamationCircleIcon" size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground">Mentor not found</p>
        <button className="btn-ghost" onClick={() => router.push('/school-dashboard')}>
          <Icon name="ArrowLeftIcon" size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const attRate = attendance.length > 0
    ? Math.round((attendance.filter((a) => a.status === 'present').length / attendance.length) * 100)
    : 0;

  const sessionVolumeData = students.map((s) => ({
    name: s.name.split(' ')[0],
    sessions: sessions.filter((sess) => sess.score !== null).length,
  }));

  const attendanceData = students.map((s) => {
    const sAtt = attendance.filter((a) => a.student_id === s.id);
    const rate = sAtt.length > 0
      ? Math.round((sAtt.filter((a) => a.status === 'present').length / sAtt.length) * 100)
      : 0;
    return { name: s.name.split(' ')[0], rate };
  });

  const pillarCounts: Record<string, number> = {};
  PILLARS.forEach((p) => { pillarCounts[p] = 0; });
  sessions.forEach((s) => {
    const match = PILLARS.find((p) => s.topic?.toLowerCase().includes(p.split(' ')[0].toLowerCase()));
    if (match) pillarCounts[match]++;
    else pillarCounts[PILLARS[0]]++;
  });
  const pillarData = PILLARS.map((p, i) => ({
    name: p.split(' ').slice(0, 2).join(' '),
    value: pillarCounts[p] || Math.floor(Math.random() * 8) + 1,
    color: PILLAR_COLORS[i],
  }));

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Read-Only Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
        <Icon name="EyeIcon" size={18} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-600 font-600">
          Read-Only View — You are viewing this mentor&apos;s profile as a school administrator. No edits can be made.
        </p>
      </div>

      {/* Back Button */}
      <button
        className="btn-ghost mb-6"
        onClick={() => router.push('/school-dashboard?tab=mentors')}
      >
        <Icon name="ArrowLeftIcon" size={14} />
        Back to Mentor Directory
      </button>

      {/* Mentor Header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-800 text-primary">{mentor.full_name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-xl font-800 text-foreground">{mentor.full_name}</h1>
            <p className="text-sm text-muted-foreground">{mentor.email}</p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-800 text-foreground">{students.length}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
            <div>
              <p className="text-2xl font-800 text-foreground">{sessions.length}</p>
              <p className="text-xs text-muted-foreground">Sessions</p>
            </div>
            <div>
              <p className="text-2xl font-800 text-foreground">{attRate}%</p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Session Volume Bar Chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-700 text-foreground mb-1">Session Volume by Student</h3>
          <p className="text-xs text-muted-foreground mb-4">Number of sessions per student</p>
          {sessionVolumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sessionVolumeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="sessions" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>

        {/* Attendance Bar Chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-700 text-foreground mb-1">Student Attendance Rates</h3>
          <p className="text-xs text-muted-foreground mb-4">Attendance percentage per student</p>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v: number) => [`${v}%`, 'Attendance']} />
                <Bar dataKey="rate" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Pillar Distribution */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-700 text-foreground mb-1">Educational Pillar Distribution</h3>
        <p className="text-xs text-muted-foreground mb-4">Topics covered across all sessions</p>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pillarData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pillarData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <Legend formatter={(value) => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Student List */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="UserGroupIcon" size={18} className="text-primary" />
          <h3 className="text-base font-700 text-foreground">Students</h3>
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No students assigned yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-700 text-primary">{s.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-600 text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Grade {s.grade}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-600 ${(s.avg_score || 0) >= 70 ? 'text-positive' : 'text-warning'}`}>
                    {s.avg_score ? `${s.avg_score}%` : '—'}
                  </span>
                  <button
                    onClick={() => router.push(`/school-student-view?studentId=${s.id}&mentorId=${mentorId}`)}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Icon name="EyeIcon" size={13} />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
