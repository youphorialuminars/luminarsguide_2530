'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface StudentData {
  id: string;
  name: string;
  grade: string;
  avg_score: number;
  sessions: number;
  topics: string[];
  trend: string;
}

interface TaskRow {
  id: string;
  task_description: string;
  priority: string;
  deadline: string | null;
  status: string;
}

interface AttendanceRow {
  id: string;
  date: string;
  status: 'present' | 'absent';
  topic: string | null;
}

interface SessionRow {
  id: string;
  topic: string;
  score: number | null;
  created_at: string;
}

export default function SchoolStudentViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const mentorId = searchParams.get('mentorId');
  const supabase = createClient();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { router.push('/school-dashboard'); return; }
    const load = async () => {
      setIsLoading(true);

      // Try the full `students` table first (students linked via a mentor)
      let studentData: any = null;
      const primaryResult = await supabase
        .from('students')
        .select('id, name, grade, avg_score, sessions, topics, trend')
        .eq('id', studentId)
        .maybeSingle();
      studentData = primaryResult.data;

      // Fallback: school-linked students with no mentor only exist in user_profiles
      if (!studentData) {
        const fallbackResult = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('id', studentId)
          .maybeSingle();
        if (fallbackResult.data) {
          studentData = {
            id: fallbackResult.data.id,
            name: fallbackResult.data.full_name || 'Student',
            grade: '—',
            avg_score: 0,
            sessions: 0,
            topics: [],
            trend: 'stable',
          };
        }
      }

      const [taskResult, attResult, sessResult] = await Promise.all([
        supabase.from('student_tasks').select('id, task_description, priority, deadline, status').eq('student_id', studentId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('id, attendance_date, status').eq('student_id', studentId).order('attendance_date', { ascending: false }).limit(20),
        supabase.from('sessions').select('id, topic, score, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(10),
      ]);

      setStudent(studentData);
      setTasks(taskResult.data || []);
      setAttendance(attResult.data || []);
      setSessions(sessResult.data || []);
      setIsLoading(false);
    };
    load();
  }, [studentId, router, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Icon name="ArrowPathIcon" size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Icon name="ExclamationCircleIcon" size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground">Student not found</p>
        <button className="btn-ghost" onClick={() => router.push('/school-dashboard')}>
          <Icon name="ArrowLeftIcon" size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const priorityColor: Record<string, string> = {
    High: 'text-negative bg-negative/10',
    Medium: 'text-warning bg-warning/10',
    Low: 'text-positive bg-positive/10',
  };

  const statusColor: Record<string, string> = {
    Completed: 'text-positive bg-positive/10',
    'In Progress': 'text-info bg-info/10',
    Pending: 'text-muted-foreground bg-secondary',
  };

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Read-Only Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
        <Icon name="EyeIcon" size={18} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-600 font-600">
          Read-Only View — You are viewing this student&apos;s profile as a school administrator. No edits can be made.
        </p>
      </div>

      {/* Back Button */}
      <button
        className="btn-ghost mb-6"
        onClick={() => router.push('/school-dashboard?tab=students')}
      >
        <Icon name="ArrowLeftIcon" size={14} />
        Back to Student Directory
      </button>

      {/* Student Header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-800 text-primary">{student.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-xl font-800 text-foreground">{student.name}</h1>
            <p className="text-sm text-muted-foreground">Grade {student.grade} · {student.sessions || 0} Sessions</p>
          </div>
          <div className="ml-auto flex gap-3">
            <div className="text-center">
              <p className="text-2xl font-800 text-foreground">{student.avg_score || 0}%</p>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks (Read-Only) */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
            <h3 className="text-base font-700 text-foreground">Assigned Tasks</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tasks assigned yet</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm text-foreground font-500 leading-snug">{task.task_description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${priorityColor[task.priority] || 'text-muted-foreground bg-secondary'}`}>
                      {task.priority}
                    </span>
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${statusColor[task.status] || 'text-muted-foreground bg-secondary'}`}>
                      {task.status}
                    </span>
                    {task.deadline && (
                      <span className="text-xs text-muted-foreground">Due: {new Date(task.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance (Read-Only) */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
            <h3 className="text-base font-700 text-foreground">Attendance Log</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{attendance.length} records</span>
          </div>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No attendance records yet</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                  <span className="text-sm text-foreground">{a.attendance_date ? new Date(a.attendance_date).toLocaleDateString() : '—'}</span>
                  <span className={`text-xs font-600 px-2.5 py-0.5 rounded-full ${a.status === 'present' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>
                    {a.status === 'present' ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session History (Read-Only) */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="BookOpenIcon" size={18} className="text-primary" />
            <h3 className="text-base font-700 text-foreground">Session History</h3>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sessions recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-600 text-muted-foreground pb-2">Date</th>
                    <th className="text-left text-xs font-600 text-muted-foreground pb-2">Topic</th>
                    <th className="text-right text-xs font-600 text-muted-foreground pb-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-sm text-foreground">{s.topic}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-sm font-600 ${(s.score || 0) >= 70 ? 'text-positive' : 'text-warning'}`}>
                          {s.score ? `${s.score}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
