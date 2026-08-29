'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import StudentCalendar from './StudentCalendar';
import SchoolEventsCalendar from '@/components/SchoolEventsCalendar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  invite_code: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  mentor_id: string | null;
  student_id: string | null;
}

interface Task {
  id: string;
  task_description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority_rating: number;
  deadline: string | null;
  requires_submission: boolean;
  student_id?: string;
  mentor_id?: string;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  mentor_rating: number | null;
  mentor_comments: string | null;
}


interface Survey {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_url: string;
  notes: string;
}

interface Session {
  id: string;
  topic: string;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
}

interface Reflection {
  id: string;
  week_start: string;
  learned_this_week: string;
  needs_work: string;
  team_dynamics: string;
  mentor_response: string | null;
  created_at: string;
}

interface MentorFeedback {
  id: string;
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
  created_at: string;
}

// ─── Quest Tier Logic ─────────────────────────────────────────────────────────
function getQuestTier(completedCount: number) {
  if (completedCount >= 15) {
    return {
      name: 'Trailblazer', icon: '🔥',
      color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200', glowClass: 'shadow-amber-200',
      nextAt: null, progress: 100,
    };
  }
  if (completedCount >= 5) {
    return {
      name: 'Pathfinder', icon: '🧭',
      color: 'from-violet-400 to-purple-500', textColor: 'text-violet-600',
      bgColor: 'bg-violet-50 border-violet-200', glowClass: 'shadow-violet-200',
      nextAt: 15, progress: Math.round(((completedCount - 5) / 10) * 100),
    };
  }
  return {
    name: 'Explorer', icon: '🌱',
    color: 'from-sky-400 to-blue-500', textColor: 'text-sky-600',
    bgColor: 'bg-sky-50 border-sky-200', glowClass: 'shadow-sky-200',
    nextAt: 5, progress: Math.round((completedCount / 5) * 100),
  };
}

// ─── Mic Button ────────────────────────────────────────────────────────────
function MicButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      onResult(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('Voice input error. Please try again.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
        listening ? 'bg-negative text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'
      }`}
      title={listening ? 'Stop recording' : 'Start voice input'}
    >
      <Icon name={listening ? 'StopIcon' : 'MicrophoneIcon'} size={15} />
    </button>
  );
}

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-600 text-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)} className="transition-transform hover:scale-110">
            <Icon name="StarIcon" size={22} variant={star <= value ? 'solid' : 'outline'} className={star <= value ? 'text-amber-400' : 'text-muted-foreground'} />
          </button>
        ))}
      </div>
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
  return <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

// ─── Attendance Calendar ──────────────────────────────────────────────────────
function AttendanceCalendarView({ records }: { records: AttendanceRecord[] }) {
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
            <div key={dateStr} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-600 transition-colors ${
              status === 'present' ? 'bg-[#C8F0D8] text-green-800 border border-green-200'
                : status === 'absent' ? 'bg-[#F5C6C9] text-red-800 border border-red-200'
                : 'text-foreground hover:bg-secondary'
            }`}>{day}</div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#C8F0D8] border border-green-200" />Present ({presentCount})</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#F5C6C9] border border-red-200" />Absent ({absentCount})</div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StudentParentDashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [mentorFeedbacks, setMentorFeedbacks] = useState<MentorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParamsTab = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'surveys' | 'calendar' | 'report' | 'feedback' | 'programs' | 'suggestions'>(
    (searchParamsTab.get('tab') as any) || 'overview'
  );

  useEffect(() => {
    const t = searchParamsTab.get('tab');
    if (t) setActiveTab(t as any);
  }, [searchParamsTab]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [globalSearch, setGlobalSearch] = useState('');

  // Link to Mentor state
  const [mentorInviteCode, setMentorInviteCode] = useState('');
  const [linkingMentor, setLinkingMentor] = useState(false);
  const [linkedMentorName, setLinkedMentorName] = useState<string | null>(null);

  // Reflection form state
  const [reflectionForm, setReflectionForm] = useState({ learned_this_week: '', needs_work: '', team_dynamics: '', peer_appreciation: '' });
  const [submittingReflection, setSubmittingReflection] = useState(false);

  // Feedback form state
  const [linkedMentors, setLinkedMentors] = useState<{ id: string; name: string }[]>([]);
  const [mySchoolId, setMySchoolId] = useState<string | null>(null);
  const [suggestionRecipientRole, setSuggestionRecipientRole] = useState('');
  const [suggestionRecipientOptions, setSuggestionRecipientOptions] = useState<{ id: string; name: string }[]>([]);
  const [suggestionRecipientId, setSuggestionRecipientId] = useState('');
  const [suggestionType, setSuggestionType] = useState<'suggestion' | 'feedback' | 'query'>('suggestion');
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [revealIdentity, setRevealIdentity] = useState(false);
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ mentor_id: '', mentor_interaction_score: 5, active_listening_score: 5, teaching_clarity_score: 5, emotional_safety_score: 5, independence_score: 5, fruitful_comments: '', appreciation_note: '' });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; posted_by_role: string; title: string; description: string; program_date: string | null; external_link: string | null; file_url: string | null; file_name: string | null }[]>([]);
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [programsLoading, setProgramsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-up-login'); return; }

      let { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      if (!profile) {
        await new Promise((r) => setTimeout(r, 500));
        const retry = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        profile = retry.data;
      }
      if (!profile) { router.push('/sign-up-login'); return; }
      setUserProfile(profile);

      // Middleware handles role-based redirects; no manual redirect needed here

      // Find every `students` row that belongs to this person — one per linked mentor,
      // not just the single one saved on their profile. This is what lets a student see
      // tasks/attendance from ALL their mentors, not just their very first one.
      const { data: allMyStudentRows } = await supabase
        .from('students')
        .select('*')
        .eq('student_user_id', user.id);

      const studentRows = allMyStudentRows || [];

      if (studentRows.length > 0) {
        // Use the profile's primary student record for display (name/grade shown at top),
        // falling back to the first one found if that specific link is missing for any reason
        const primaryStudent = studentRows.find((s) => s.id === profile.student_id) || studentRows[0];
        setStudentProfile(primaryStudent);

        const allStudentIds = studentRows.map((s) => s.id);
        const allMentorIds = Array.from(new Set(studentRows.map((s) => s.mentor_id).filter(Boolean)));

        if (allMentorIds.length > 0) {
          const { data: mentorProfiles } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', allMentorIds);
          setLinkedMentors((mentorProfiles || []).map((m) => ({ id: m.id, name: m.full_name || 'Mentor' })));
        }

        const [
          taskResult,
          surveyResult,
          attResult,
          meetResult,
          sessResult,
          submissionResult,
        ] = await Promise.all([
          supabase.from('student_tasks').select('*').in('student_id', allStudentIds).order('created_at', { ascending: false }),
          supabase.from('surveys').select('*').in('mentor_id', allMentorIds).order('created_at', { ascending: false }),
          supabase.from('attendance').select('attendance_date, status').in('student_id', allStudentIds).order('attendance_date', { ascending: false }),
          supabase.from('meetings').select('*').in('student_id', allStudentIds).order('meeting_date', { ascending: false }),
          supabase.from('sessions').select('*').in('student_id', allStudentIds).order('created_at', { ascending: false }).limit(5),
          supabase.from('task_submissions').select('*').in('student_id', allStudentIds),
        ]);

        setTasks(taskResult.data || []);
        setSurveys(surveyResult.data || []);
        setAttendance(attResult.data || []);
        setMeetings(meetResult.data || []);
        setSessions(sessResult.data || []);
        setTaskSubmissions(submissionResult.data || []);

        // Parent leaderboard is strictly in Parent Hub — not shown in student view
      }

      const [reflResult, mfResult] = await Promise.all([
        supabase.from('student_reflections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('mentor_feedback').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
      ]);
      const reflData = reflResult.data;
      const mfData = mfResult.data;
      setReflections(reflData || []);
      setMentorFeedbacks(mfData || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load linked mentor name if mentor_id exists
  useEffect(() => {
    const fetchMentorName = async () => {
      if (!userProfile?.mentor_id) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', userProfile.mentor_id)
        .single();
      if (data?.full_name) setLinkedMentorName(data.full_name);
    };
    fetchMentorName();
  }, [userProfile?.mentor_id, supabase]);

  // ─── Link to Mentor Handler ────────────────────────────────────────────────
  const handleLinkToMentor = async () => {
    const code = mentorInviteCode.trim().toUpperCase();
    if (!code) { toast.error('Please enter a Mentor Invite Code.'); return; }
    const INVITE_CODE_REGEX = /^[A-Z]{3}-\d{6}$/;
    if (!INVITE_CODE_REGEX.test(code)) {
      toast.error('Code must be in format ABC-123456 (3 letters, hyphen, 6 digits).');
      return;
    }
    setLinkingMentor(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated.'); setLinkingMentor(false); return; }

      // Look up mentor by mentor_code
      const { data: mentorRow, error: lookupErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('mentor_code', code)
        .eq('role', 'mentor')
        .maybeSingle();

      if (lookupErr) { toast.error('Lookup failed: ' + lookupErr.message); setLinkingMentor(false); return; }
      if (!mentorRow) { toast.error('Invalid invite code. Please check with your mentor.'); setLinkingMentor(false); return; }

      // Update the student's mentor_id in user_profiles
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ mentor_id: mentorRow.id })
        .eq('id', user.id);

      if (updateErr) {
        toast.error('Failed to link mentor: ' + updateErr.message);
      } else {
        toast.success(`Successfully linked to mentor: ${mentorRow.full_name}!`);
        setLinkedMentorName(mentorRow.full_name);
        setMentorInviteCode('');
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred.');
    }
    setLinkingMentor(false);
  };

  useEffect(() => {
    if (linkedMentors.length > 0 && !feedbackForm.mentor_id) {
      setFeedbackForm((f) => ({ ...f, mentor_id: linkedMentors[0].id }));
    }
  }, [linkedMentors]);

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProgramsLoading(false); return; }

    const { data: myProfile } = await supabase.from('user_profiles').select('school_id').eq('id', user.id).maybeSingle();
    setMySchoolId(myProfile?.school_id || null);
    const posterIds = [...linkedMentors.map((m) => m.id), myProfile?.school_id].filter(Boolean);

    if (posterIds.length === 0) { setPrograms([]); setProgramsLoading(false); return; }

    const { data } = await supabase
      .from('programs')
      .select('*')
      .in('posted_by', posterIds)
      .order('created_at', { ascending: false });
    setPrograms(data || []);
    if (data && data.length > 0) {
      const posterIds = Array.from(new Set(data.map((p: any) => p.posted_by)));
      const { data: posters } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', posterIds);
      const names: Record<string, string> = {};
      (posters || []).forEach((p) => { names[p.id] = p.full_name || 'Unknown'; });
      setPosterNames(names);
    }
    setProgramsLoading(false);
  }, [supabase, linkedMentors]);

  useEffect(() => {
    if (activeTab === 'programs') loadPrograms();
  }, [activeTab, loadPrograms]);

  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const tier = getQuestTier(completedTasks);

  // ─── Update Task Status ────────────────────────────────────────────────────
  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    setUpdatingTaskId(taskId);
    const { error } = await supabase.from('student_tasks').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      toast.error('Failed to update task status.');
    } else {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success(`Task marked as "${newStatus}"`);
    }
    setUpdatingTaskId(null);
  };

  const handleFileSelect = (task: Task, file: File) => {
    const maxSizeMB = 20;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Max size is ${maxSizeMB}MB.`);
      return;
    }
    setPendingFiles((prev) => ({ ...prev, [task.id]: file }));
  };

  const handleCancelUpload = (taskId: string) => {
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const handleFileUpload = async (task: Task, file: File) => {
    setUploadingTaskId(task.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingTaskId(null); return; }

    const filePath = `${user.id}/${task.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('task-submissions').upload(filePath, file);

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setUploadingTaskId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('task-submissions').getPublicUrl(filePath);

    // Use this specific task's own student_id/mentor_id, not the "primary" one —
    // the task being submitted for might belong to any of the student's linked mentors
    const { error: insertError } = await supabase.from('task_submissions').insert({
      task_id: task.id,
      student_id: (task as any).student_id,
      mentor_id: (task as any).mentor_id,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_type: file.type,
    });

    if (insertError) {
      toast.error('Failed to record submission: ' + insertError.message);
    } else {
      toast.success('File submitted!');
      loadData();
    }
    setUploadingTaskId(null);
  };

  const handleSubmitReflection = async () => {
    if (!reflectionForm.learned_this_week.trim()) { toast.error('Please fill in what you learned this week.'); return; }
    if (!reflectionForm.peer_appreciation.trim()) { toast.error('Please fill in the Team Shoutout field.'); return; }
    setSubmittingReflection(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const { error } = await supabase.from('student_reflections').insert({
      user_id: user.id,
      student_id: studentProfile?.id || null,
      week_start: weekStart.toISOString().split('T')[0],
      learned_this_week: reflectionForm.learned_this_week,
      needs_work: reflectionForm.needs_work,
      team_dynamics: reflectionForm.team_dynamics,
      peer_appreciation: reflectionForm.peer_appreciation,
    });
    if (error) { toast.error('Failed to submit reflection.'); } else {
      toast.success('Reflection submitted!');
      setReflectionForm({ learned_this_week: '', needs_work: '', team_dynamics: '', peer_appreciation: '' });
      loadData();
    }
    setSubmittingReflection(false);
  };

  const STUDENT_CAN_SEND_TO = ['mentor', 'counselor', 'admin'];

  const loadSuggestionRecipients = useCallback(async (role: string) => {
    if (!role) { setSuggestionRecipientOptions([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let options: { id: string; name: string }[] = [];

    if (role === 'mentor') {
      options = linkedMentors;
    } else if (role === 'counselor') {
      const { data: myProfile } = await supabase.from('user_profiles').select('counselor_id').eq('id', user.id).maybeSingle();
      if (myProfile?.counselor_id) {
        const { data: counselor } = await supabase.from('user_profiles').select('id, full_name').eq('id', myProfile.counselor_id).maybeSingle();
        if (counselor) options = [{ id: counselor.id, name: counselor.full_name || 'Counselor' }];
      }
    } else if (role === 'admin') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'admin');
      options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Admin' }));
    }

    setSuggestionRecipientOptions(options);
    setSuggestionRecipientId('');
  }, [supabase, linkedMentors]);

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
      sender_role: 'student',
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

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.mentor_id) { toast.error('Please select which mentor this feedback is about.'); return; }
    setSubmittingFeedback(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Find this specific mentor's own `students` row for this student, since feedback
    // is stored against a particular mentor relationship, not just "the student" in general
    const matchingStudentRow = tasks.length > 0
      ? null
      : null;
    const { data: studentRowForMentor } = await supabase
      .from('students')
      .select('id')
      .eq('student_user_id', user.id)
      .eq('mentor_id', feedbackForm.mentor_id)
      .maybeSingle();
    const { error } = await supabase.from('mentor_feedback').insert({
      student_id: studentRowForMentor?.id || studentProfile?.id,
      mentor_id: feedbackForm.mentor_id,
      submitted_by: user.id,
      mentor_interaction_score: feedbackForm.mentor_interaction_score,
      active_listening_score: feedbackForm.active_listening_score,
      teaching_clarity_score: feedbackForm.teaching_clarity_score,
      emotional_safety_score: feedbackForm.emotional_safety_score,
      independence_score: feedbackForm.independence_score,
      fruitful_comments: feedbackForm.fruitful_comments,
      appreciation_note: feedbackForm.appreciation_note.trim() || null,
    });

    if (error) { toast.error('Failed to submit feedback.'); } else {
      toast.success('Feedback submitted! Thank you.');
      setFeedbackForm({ mentor_id: linkedMentors[0]?.id || '', mentor_interaction_score: 5, active_listening_score: 5, teaching_clarity_score: 5, emotional_safety_score: 5, independence_score: 5, fruitful_comments: '', appreciation_note: '' });
      loadData();
    }
    setSubmittingFeedback(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: typeof activeTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'My Quest', icon: 'SparklesIcon' },
    { id: 'tasks', label: 'My Tasks', icon: 'ClipboardDocumentListIcon' },
    { id: 'surveys', label: 'Surveys', icon: 'LinkIcon' },
    { id: 'calendar', label: 'Calendar', icon: 'CalendarDaysIcon' },
    { id: 'report', label: 'Report Card', icon: 'DocumentTextIcon' },
    { id: 'feedback', label: 'Mentor Feedback', icon: 'StarIcon' },
    { id: 'programs', label: 'Programs & Events', icon: 'MegaphoneIcon' },
    { id: 'suggestions', label: 'Suggestion Portal', icon: 'ChatBubbleLeftEllipsisIcon' },
  ];

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const statusOptions: Task['status'][] = ['Pending', 'In Progress', 'Completed'];

  return (
    <div className="animate-fade-in">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">
            Welcome, {userProfile?.full_name?.split(' ')[0] || 'Explorer'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentProfile ? `Linked to: ${studentProfile.name}` : 'Your personal learning dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-lg ${tier.bgColor} ${tier.glowClass}`}>
            <span className="text-2xl">{tier.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground font-500">Quest Tier</p>
              <p className={`text-base font-800 ${tier.textColor}`}>{tier.name}</p>
            </div>
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center text-white text-xs font-700 shadow-md`}>
              {completedTasks}
            </div>
          </div>
        </div>
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">

          {/* ── LINK TO MENTOR SECTION ─────────────────────────────────────── */}
         <div className="p-4 rounded-xl bg-info/5 border border-info/20 flex items-center gap-3">
            <Icon name="InformationCircleIcon" size={18} className="text-info flex-shrink-0" />
            <p className="text-sm text-foreground/80">
              To link a new mentor, use the <strong>Network & Links</strong> page.
            </p>
          </div>

          {/* Quest Progress */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{tier.icon}</span>
              <h2 className="text-base font-700 text-foreground">The Quest — {tier.name}</h2>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{completedTasks} tasks completed</span>
                  {tier.nextAt && <span>Next tier at {tier.nextAt}</span>}
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`} style={{ width: `${tier.progress}%` }} />
                </div>
              </div>
              <span className={`text-sm font-700 ${tier.textColor}`}>{tier.progress}%</span>
            </div>
            {tier.nextAt ? (
              <p className="text-xs text-muted-foreground">Complete {tier.nextAt - completedTasks} more tasks to reach the next tier!</p>
            ) : (
              <p className="text-xs text-muted-foreground">🎉 You have reached the highest tier — Trailblazer!</p>
            )}
          </div>

          {/* Quick Task Summary */}
          <div className="card-mystic p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                Task Summary
              </h2>
              <button onClick={() => setActiveTab('tasks')} className="text-xs text-primary font-600 hover:underline">View All →</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['Pending', 'In Progress', 'Completed'] as Task['status'][]).map((s) => {
                const count = tasks.filter((t) => t.status === s).length;
                const cls = s === 'Completed' ? 'bg-positive/10 text-positive border-positive/20'
                  : s === 'In Progress'? 'bg-info/10 text-info border-info/20' :'bg-muted text-muted-foreground border-border';
                return (
                  <div key={s} className={`p-3 rounded-xl border text-center ${cls}`}>
                    <p className="text-xl font-800">{count}</p>
                    <p className="text-xs font-600 mt-0.5">{s}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Meetings */}
          {meetings.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="VideoCameraIcon" size={18} className="text-primary" />
                Upcoming Sessions
              </h2>
              <div className="flex flex-col gap-3">
                {meetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-foreground">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.meeting_date)} at {formatTime(m.meeting_time)}</p>
                    </div>
                    {m.jitsi_url && (
                      <a href={m.jitsi_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
                        <Icon name="VideoCameraIcon" size={13} /> Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY TASKS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-4">
          <div className="card-mystic p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                My Tasks Board
              </h2>
              <span className="text-xs text-muted-foreground">{completedTasks}/{tasks.length} completed</span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No tasks assigned yet.</p>
                <p className="text-xs mt-1">Your mentor will assign tasks here soon.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks
                  .filter((task) =>
                    !globalSearch.trim() ||
                    task.task_description.toLowerCase().includes(globalSearch.toLowerCase())
                  )
                  .map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all ${
                      task.status === 'Completed' ? 'bg-positive/5 border-positive/20'
                        : task.status === 'In Progress'? 'bg-info/5 border-info/20' :'bg-secondary/40 border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        task.status === 'Completed' ? 'bg-positive text-white'
                          : task.status === 'In Progress'? 'bg-info text-white' :'bg-muted border border-border'
                      }`}>
                        {task.status === 'Completed' && <Icon name="CheckIcon" size={11} />}
                        {task.status === 'In Progress' && <Icon name="ClockIcon" size={11} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PriorityBadge priority={task.priority_rating} />
                          {task.deadline && (
                            <span className="text-xs text-muted-foreground">
                              <Icon name="CalendarDaysIcon" size={11} className="inline mr-0.5" />
                              Due: {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-500 leading-relaxed ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.task_description}
                        </p>
                      </div>
                     </div>

                    {/* Status Selector */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-600">Update status:</span>
                      {statusOptions.map((s) => (
                        <button
                          key={s}
                          disabled={task.status === s || updatingTaskId === task.id}
                          onClick={() => handleUpdateTaskStatus(task.id, s)}
                          className={`text-xs font-600 px-3 py-1 rounded-full border transition-all ${
                            task.status === s
                              ? s === 'Completed' ? 'bg-positive text-white border-positive'
                                : s === 'In Progress'? 'bg-info text-white border-info' :'bg-muted text-muted-foreground border-border' :'bg-card text-muted-foreground border-border hover:border-primary hover:text-primary'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {updatingTaskId === task.id && task.status !== s ? (
                            <Icon name="ArrowPathIcon" size={11} className="animate-spin inline mr-1" />
                          ) : null}
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* File Submission */}
                    {task.requires_submission && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      {pendingFiles[task.id] ? (
                        <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-primary/5 border border-primary/20">
                          <Icon name="DocumentIcon" size={14} className="text-primary flex-shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{pendingFiles[task.id].name}</span>
                          <button
                            className="btn-primary text-xs py-1 px-3"
                            disabled={uploadingTaskId === task.id}
                            onClick={() => {
                              const file = pendingFiles[task.id];
                              handleFileUpload(task, file);
                              handleCancelUpload(task.id);
                            }}
                          >
                            {uploadingTaskId === task.id ? (
                              <><Icon name="ArrowPathIcon" size={12} className="animate-spin" /> Submitting...</>
                            ) : 'Confirm Submit'}
                          </button>
                          <button
                            className="btn-ghost text-xs py-1 px-3"
                            disabled={uploadingTaskId === task.id}
                            onClick={() => handleCancelUpload(task.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="btn-ghost text-xs py-1.5 px-3 cursor-pointer">
                            <Icon name="PaperClipIcon" size={12} /> Attach File
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.mp4,.mov"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(task, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <span className="text-xs text-muted-foreground">PDF, image, or video · max 20MB</span>
                        </div>
                      )}
                      {taskSubmissions.filter((s) => s.task_id === task.id).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-secondary/40 text-xs">
                          <Icon name="DocumentIcon" size={13} className="text-primary flex-shrink-0" />
                          <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-primary truncate flex-1 hover:underline">
                            {s.file_name}
                          </a>
                          {s.mentor_rating ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-amber-500">{'⭐'.repeat(s.mentor_rating)}</span>
                              {s.mentor_comments && (
                                <p className="text-xs text-foreground/80 italic">"{s.mentor_comments}"</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground flex-shrink-0">Awaiting review</span>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                ))}
                
                {globalSearch.trim() && tasks.filter((t) => t.task_description.toLowerCase().includes(globalSearch.toLowerCase())).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="MagnifyingGlassIcon" size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tasks match &quot;{globalSearch}&quot;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SURVEYS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'surveys' && (
        <div className="flex flex-col gap-4">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="LinkIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Surveys from Your Mentor</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>

            {surveys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="ClipboardDocumentListIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No surveys available yet.</p>
                <p className="text-xs mt-1">Your mentor will share surveys here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {surveys.map((survey) => (
                  <a
                    key={survey.id}
                    href={survey.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon name="LinkIcon" size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-700 text-foreground group-hover:text-primary transition-colors">{survey.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{survey.url}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary font-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <Icon name="ArrowTopRightOnSquareIcon" size={13} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CALENDAR TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col gap-6">
          <StudentCalendar />
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              Attendance Record
            </h2>
            <AttendanceCalendarView records={attendance} />
          </div>
          {/* School Events Calendar — synced from School Dashboard */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-violet-500" />
              School Calendar
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">Performance &amp; Holidays</span>
            </h2>
            <SchoolEventsCalendar schoolId={studentProfile?.school_id || null} />
          </div>
        </div>
      )}

      {/* ── REPORT CARD TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="AcademicCapIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Mentor&apos;s Insights</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No mentor feedback available yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.slice(0, 2).map((s) => (
                  <div key={s.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-700 text-foreground">{s.topic}</span>
                      <span className="text-xs text-muted-foreground">{s.session_date}</span>
                    </div>
                    {Array.isArray(s.strengths) && s.strengths.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-600 text-positive mb-1">✅ Strengths</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.strengths.map((item: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-positive">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-600 text-warning mb-1">🔧 Areas to Improve</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.weaknesses.map((item: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-warning">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="PencilSquareIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">My Weekly Reflection</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">What did I learn this week? <span className="text-negative">*</span></label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[90px] resize-none flex-1" placeholder="Share your key learnings..." value={reflectionForm.learned_this_week} onChange={(e) => setReflectionForm((f) => ({ ...f, learned_this_week: e.target.value }))} />
                  <MicButton onResult={(text) => setReflectionForm((f) => ({ ...f, learned_this_week: (f.learned_this_week ? f.learned_this_week + ' ' : '') + text }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Which aspects do I need to work on further?</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="Identify areas needing more practice..." value={reflectionForm.needs_work} onChange={(e) => setReflectionForm((f) => ({ ...f, needs_work: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">How was my team dynamics, and what was the best thing about my team?</label>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="Reflect on your teamwork experience..." value={reflectionForm.team_dynamics} onChange={(e) => setReflectionForm((f) => ({ ...f, team_dynamics: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  🌟 Team Shoutout <span className="text-negative">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Observe one team member and write something positive they did today!</p>
                <textarea className="input-mystic min-h-[80px] resize-none" placeholder="e.g. Priya helped everyone understand the activity by explaining it step by step..." value={reflectionForm.peer_appreciation} onChange={(e) => setReflectionForm((f) => ({ ...f, peer_appreciation: e.target.value }))} />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitReflection} disabled={submittingReflection}>
                {submittingReflection ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Reflection</>}
              </button>
            </div>
          </div>

          {reflections.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                Past Reflections
              </h2>
              <div className="flex flex-col gap-3">
                {reflections.slice(0, 3).map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">{formatDate(r.created_at)}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{r.learned_this_week}</p>
                    {r.mentor_response && (
                      <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs font-600 text-primary mb-0.5">Mentor Response:</p>
                        <p className="text-xs text-foreground/80">{r.mentor_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROGRAMS & EVENTS TAB (read-only) ───────────────────────────────── */}
      {activeTab === 'programs' && (
        <div className="card-mystic p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="MegaphoneIcon" size={18} className="text-primary" />
            <h2 className="text-base font-700 text-foreground">Programs & Events</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
          </div>
          {programsLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : programs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No programs posted yet. Check back soon!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {programs.map((p: any) => (
                <div key={p.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-700 text-foreground">{p.title}</span>
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${p.posted_by_role === 'school' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                      {p.posted_by_role === 'school' ? 'School' : 'Mentor'}: {posterNames[p.posted_by] || '...'}
                    </span>
                    {p.program_date && (
                      <span className="text-xs text-muted-foreground">{formatDate(p.program_date)}</span>
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
      )}

      {/* ── SUGGESTION PORTAL TAB (send-only) ───────────────────────────────── */}
      {activeTab === 'suggestions' && (
        <div className="card-mystic p-5">
          <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
            <Icon name="PaperAirplaneIcon" size={18} className="text-primary" />
            Send a Suggestion, Feedback, or Query
          </h2>
          <div className="flex flex-col gap-3">
            <select className="input-mystic" value={suggestionRecipientRole} onChange={(e) => setSuggestionRecipientRole(e.target.value)}>
              <option value="">Send to...</option>
              {STUDENT_CAN_SEND_TO.map((r) => (
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
      )}

      {/* ── FEEDBACK TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="StarIcon" size={18} className="text-amber-400" variant="solid" />
              <h2 className="text-base font-700 text-foreground">Rate Your Mentor</h2>
            </div>
            <div className="flex flex-col gap-5">
              {linkedMentors.length > 1 && (
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Which mentor is this feedback about?</label>
                  <select
                    className="input-mystic"
                    value={feedbackForm.mentor_id}
                    onChange={(e) => setFeedbackForm((f) => ({ ...f, mentor_id: e.target.value }))}
                  >
                    {linkedMentors.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <StarRating label="Was my mentor fun and helpful?" value={feedbackForm.mentor_interaction_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, mentor_interaction_score: v }))} />
              <StarRating label="Did my mentor make me feel safe and supported?" value={feedbackForm.emotional_safety_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, emotional_safety_score: v }))} />
              <StarRating label="Did my mentor encourage me to think and act on my own?" value={feedbackForm.independence_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, independence_score: v }))} />
              <StarRating label="Did my mentor listen to me carefully?" value={feedbackForm.active_listening_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, active_listening_score: v }))} />
              <StarRating label="Did I understand the activities clearly?" value={feedbackForm.teaching_clarity_score} onChange={(v) => setFeedbackForm((f) => ({ ...f, teaching_clarity_score: v }))} />
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Additional Comments</label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[100px] resize-none flex-1" placeholder="Share any specific feedback..." value={feedbackForm.fruitful_comments} onChange={(e) => setFeedbackForm((f) => ({ ...f, fruitful_comments: e.target.value }))} />
                  <MicButton onResult={(text) => setFeedbackForm((f) => ({ ...f, fruitful_comments: (f.fruitful_comments ? f.fruitful_comments + ' ' : '') + text }))} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/10 border border-amber-400/30">
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  🌟 Send Your Mentor a Shoutout <span className="text-xs font-400 text-muted-foreground">(OPTIONAL - You Mentor Needs A Healthy Motivation)</span>
                </label>
                <textarea
                  className="input-mystic min-h-[80px] resize-none"
                  placeholder="e.g. Thank you for always explaining things patiently..."
                  value={feedbackForm.appreciation_note}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, appreciation_note: e.target.value }))}
                />
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                {submittingFeedback ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Feedback</>}
              </button>
            </div>
          </div>
          {mentorFeedbacks.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                My Previous Feedback
              </h2>
              <div className="flex flex-col gap-3">
                {mentorFeedbacks.slice(0, 3).map((fb) => (
                  <div key={fb.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">{formatDate(fb.created_at)}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Interaction: {'⭐'.repeat(fb.mentor_interaction_score)}</span>
                      <span>Listening: {'⭐'.repeat(fb.active_listening_score)}</span>
                      <span>Clarity: {'⭐'.repeat(fb.teaching_clarity_score)}</span>
                    </div>
                    {fb.fruitful_comments && <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{fb.fruitful_comments}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
