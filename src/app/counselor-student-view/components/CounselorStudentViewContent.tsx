'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { Toaster } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  avg_score: number;
  sessions: number;
  topics: string[];
  trend: string;
  age: number | null;
  gender: string | null;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface Session {
  id: string;
  topic: string;
  session_date: string;
  score: number | null;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
}

interface Task {
  id: string;
  task_description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority_rating: number;
  deadline: string | null;
}

interface Reflection {
  id: string;
  week_start: string;
  learned_this_week: string;
  needs_work: string;
  team_dynamics: string;
  created_at: string;
}

// ─── Quest Tier Logic ─────────────────────────────────────────────────────────
function getQuestTier(completedCount: number) {
  if (completedCount >= 15) {
    return { name: 'Trailblazer', icon: '🔥', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' };
  }
  if (completedCount >= 5) {
    return { name: 'Pathfinder', icon: '🧭', color: 'from-violet-400 to-purple-500', textColor: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200' };
  }
  return { name: 'Explorer', icon: '🌱', color: 'from-sky-400 to-blue-500', textColor: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-200' };
}

// ─── Read-Only Attendance Calendar ───────────────────────────────────────────
function ReadOnlyCalendar({ records }: { records: AttendanceRecord[] }) {
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
  const attRate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

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
            <div key={dateStr} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-600 ${
              status === 'present' ? 'bg-[#C8F0D8] text-green-800 border border-green-200'
                : status === 'absent' ? 'bg-[#F5C6C9] text-red-800 border border-red-200'
                : 'text-foreground'
            }`}>{day}</div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#C8F0D8] border border-green-200" />Present ({presentCount})</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#F5C6C9] border border-red-200" />Absent ({absentCount})</div>
        <div className="ml-auto font-600 text-foreground">{attRate}% rate</div>
      </div>
    </div>
  );
}

type ViewTab = 'quest' | 'attendance' | 'report';

export default function CounselorStudentViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>('quest');

  const loadData = useCallback(async () => {
    if (!studentId) { router.push('/counselor-dashboard'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'counselor') { router.push('/student-dashboard'); return; }

      const [studResult, attResult, sessResult, taskResult, reflResult] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('attendance').select('attendance_date, status').eq('student_id', studentId).order('attendance_date', { ascending: false }),
        supabase.from('sessions').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(10),
        supabase.from('student_tasks').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
        supabase.from('student_reflections').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(5),
      ]);

      setStudent(studResult.data);
      setAttendance(attResult.data || []);
      setSessions(sessResult.data || []);
      setTasks(taskResult.data || []);
      setReflections(reflResult.data || []);
    } catch (err) {
      console.error('Error loading student data:', err);
    }
    setLoading(false);
  }, [supabase, router, studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="ExclamationCircleIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Student not found or access denied.</p>
          <button onClick={() => router.push('/counselor-dashboard')} className="btn-ghost mt-4">
            <Icon name="ArrowLeftIcon" size={14} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const tier = getQuestTier(completedTasks);

  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: 'quest', label: 'Quest & Tasks', icon: 'TrophyIcon' },
    { id: 'attendance', label: 'Attendance', icon: 'CalendarIcon' },
    { id: 'report', label: 'Report Card', icon: 'DocumentTextIcon' },
  ];

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />

      {/* Read-Only Banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-6">
        <Icon name="EyeIcon" size={16} className="text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800 font-500">
          <strong>Read-Only View</strong> — You are viewing this student's dashboard as a counselor. No edits can be made.
        </p>
      </div>

      {/* Back Button */}
      <button
        onClick={() => router.push('/counselor-dashboard')}
        className="btn-ghost text-sm mb-6"
      >
        <Icon name="ArrowLeftIcon" size={14} />
        Back to Counselor Dashboard
      </button>

      {/* Student Header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Icon name="UserIcon" size={26} className="text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-800 text-foreground">{student.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                {student.grade}
              </span>
              {student.age && (
                <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                  Age {student.age}
                </span>
              )}
              {student.gender && (
                <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                  {student.gender}
                </span>
              )}
              <span className={`text-xs font-600 px-2.5 py-1 rounded-full border ${tier.bgColor} ${tier.textColor}`}>
                {tier.icon} {tier.name}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-800 text-foreground">{student.avg_score}</p>
            <p className="text-xs text-muted-foreground">avg score</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-600 transition-all ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} variant={activeTab === tab.id ? 'solid' : 'outline'} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Quest & Tasks Tab */}
      {activeTab === 'quest' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Tier Badge */}
          <div className={`p-5 rounded-2xl border ${tier.bgColor} flex items-center gap-4`}>
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center text-2xl shadow-md`}>
              {tier.icon}
            </div>
            <div>
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Current Quest Tier</p>
              <p className={`text-xl font-800 ${tier.textColor}`}>{tier.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{completedTasks} tasks completed</p>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-700 text-foreground">Assigned Tasks</h3>
            </div>
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No tasks assigned yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task) => {
                  const priorityMap: Record<number, { label: string; cls: string }> = {
                    1: { label: 'Low', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
                    2: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                    3: { label: 'High', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
                  };
                  const statusMap: Record<string, string> = {
                    'Pending': 'bg-secondary text-muted-foreground border-border',
                    'In Progress': 'bg-sky-50 text-sky-700 border-sky-200',
                    'Completed': 'bg-green-50 text-green-700 border-green-200',
                  };
                  const { label: pLabel, cls: pCls } = priorityMap[task.priority_rating] || priorityMap[1];
                  return (
                    <div key={task.id} className="px-5 py-4 flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-600 text-foreground">{task.task_description}</p>
                        {task.deadline && (
                          <p className="text-xs text-muted-foreground mt-1">Due: {new Date(task.deadline).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${pCls}`}>{pLabel}</span>
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${statusMap[task.status]}`}>{task.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in">
          <h3 className="font-700 text-foreground mb-5">Attendance Record</h3>
          <ReadOnlyCalendar records={attendance} />
        </div>
      )}

      {/* Report Card Tab */}
      {activeTab === 'report' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Session Insights */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-700 text-foreground">Recent Session Insights</h3>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No sessions recorded yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-700 text-foreground">{session.topic}</p>
                      <div className="flex items-center gap-2">
                        {session.score !== null && (
                          <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Score: {session.score}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{session.session_date}</span>
                      </div>
                    </div>
                    {session.strengths?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-600 text-positive mb-1">Strengths</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {session.strengths.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-positive mt-0.5">•</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {session.weaknesses?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-600 text-warning mb-1">Areas to Improve</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {session.weaknesses.slice(0, 2).map((w, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-warning mt-0.5">•</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Reflections */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-700 text-foreground">Student Reflections</h3>
            </div>
            {reflections.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No reflections submitted yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {reflections.map((r) => (
                  <div key={r.id} className="px-5 py-4">
                    <p className="text-xs font-600 text-muted-foreground mb-3">
                      Week of {new Date(r.week_start).toLocaleDateString()}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xs font-700 text-foreground mb-0.5">What I learned</p>
                        <p className="text-sm text-muted-foreground">{r.learned_this_week}</p>
                      </div>
                      {r.needs_work && (
                        <div>
                          <p className="text-xs font-700 text-foreground mb-0.5">Needs work</p>
                          <p className="text-sm text-muted-foreground">{r.needs_work}</p>
                        </div>
                      )}
                      {r.team_dynamics && (
                        <div>
                          <p className="text-xs font-700 text-foreground mb-0.5">Team dynamics</p>
                          <p className="text-sm text-muted-foreground">{r.team_dynamics}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
