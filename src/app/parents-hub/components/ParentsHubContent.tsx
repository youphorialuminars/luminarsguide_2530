'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import Link from 'next/link';
import SchoolEventsCalendar from '@/components/SchoolEventsCalendar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParentProfile {
  id: string;
  full_name: string;
  role: string;
  linked_student_id: string | null;
}

interface LinkedStudent {
  id: string;
  name: string;
  grade: string;
  mentor_id: string;
  avg_score: number;
  sessions: number;
  trend: string;
  topics: string[];
}

interface MentorProfile {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
}

interface Task {
  id: string;
  task_description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority_rating: number;
  deadline: string | null;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface Session {
  id: string;
  topic: string;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
}

interface MentorFeedback {
  id: string;
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
  created_at: string;
}

interface ParentObservation {
  id: string;
  observation_text: string;
  program_experience: string;
  created_at: string;
}

interface ParentQuery {
  id: string;
  parent_id: string;
  recipient_role: 'mentor' | 'counselor';
  message: string;
  status: 'open' | 'replied' | 'closed';
  reply: string | null;
  created_at: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  userId: string;
}

// ─── Quest Tier Logic ─────────────────────────────────────────────────────────
function getQuestTier(completedCount: number) {
  if (completedCount >= 15) return { name: 'Trailblazer', icon: '🔥', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', nextAt: null, progress: 100 };
  if (completedCount >= 5) return { name: 'Pathfinder', icon: '🧭', color: 'from-violet-400 to-purple-500', textColor: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200', nextAt: 15, progress: Math.round(((completedCount - 5) / 10) * 100) };
  return { name: 'Explorer', icon: '🌱', color: 'from-sky-400 to-blue-500', textColor: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-200', nextAt: 5, progress: Math.round((completedCount / 5) * 100) };
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

// ─── Main Parents Hub Dashboard ───────────────────────────────────────────────
export default function ParentsHubContent() {
  const router = useRouter();
  const supabase = createClient();

  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [linkedStudent, setLinkedStudent] = useState<LinkedStudent | null>(null);
  const [linkedStudentSchoolId, setLinkedStudentSchoolId] = useState<string | null>(null);
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [allMentors, setAllMentors] = useState<MentorProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mentorFeedbacks, setMentorFeedbacks] = useState<MentorFeedback[]>([]);
  const [parentObservations, setParentObservations] = useState<ParentObservation[]>([]);
  const [parentQueries, setParentQueries] = useState<ParentQuery[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [parentActivities, setParentActivities] = useState<{ id: string; title: string; description: string; activity_type: string; created_at: string }[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, string>>({});
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [respondingActivityId, setRespondingActivityId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState('');
  const [submittingActivityResponse, setSubmittingActivityResponse] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'mentor' | 'action' | 'leaderboard' | 'activities' | 'programs' | 'suggestions'>(
    (searchParams.get('tab') as any) || 'overview'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t as any);
  }, [searchParams]);

  // Observation form
  const [obsForm, setObsForm] = useState({ observation_text: '', program_experience: '' });
  const [submittingObs, setSubmittingObs] = useState(false);

  // Suggestion box
  const [suggestionText, setSuggestionText] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  // Query form
  const [queryForm, setQueryForm] = useState<{ recipient_role: 'mentor' | 'counselor'; message: string }>({ recipient_role: 'mentor', message: '' });
const [submittingQuery, setSubmittingQuery] = useState(false);
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

      let { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      if (!profile) {
        await new Promise((r) => setTimeout(r, 500));
        const retry = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        profile = retry.data;
      }
      if (!profile || profile.role !== 'parent') { router.push('/sign-up-login'); return; }
      setParentProfile(profile);

      if (!profile.linked_student_id) {
        setLoading(false);
        return;
      }

      // Step 1: find the child's identity via the parent's one known link
      const { data: primaryRow, error: studentErr } = await supabase
        .from('students')
        .select('id, name, grade, mentor_id, avg_score, sessions, trend, topics, student_user_id')
        .eq('id', profile.linked_student_id)
        .maybeSingle();

      if (studentErr) {
        console.error('[ParentsHub] Failed to load linked student:', studentErr.message);
      }
      setLinkedStudent(primaryRow ?? null);

      if (primaryRow) {
        // Step 2: find EVERY students row for this same child, across all their mentors —
        // not just the one mentor the parent's code happened to be generated under
        const { data: allRows } = await supabase
          .from('students')
          .select('id, name, grade, mentor_id, avg_score, sessions, trend, topics')
          .eq('student_user_id', primaryRow.student_user_id);

        const studentRows = allRows && allRows.length > 0 ? allRows : [primaryRow];
        const allStudentIds = studentRows.map((s) => s.id);
        const allMentorIds = Array.from(new Set(studentRows.map((s) => s.mentor_id).filter(Boolean)));

        if (allMentorIds.length > 0) {
          const { data: mentors, error: mentorErr } = await supabase
            .from('user_profiles')
            .select('id, full_name, email, mentor_code')
            .in('id', allMentorIds);
          if (mentorErr) {
            console.error('[ParentsHub] Failed to load mentor profiles:', mentorErr.message);
          }
          setAllMentors(mentors || []);
          // Keep mentorProfile as the "primary" one for the summary card at the top
          setMentorProfile((mentors || []).find((m) => m.id === primaryRow.mentor_id) || mentors?.[0] || null);
        }

        const [taskResult, attResult, sessResult, mfResult] = await Promise.all([
          supabase.from('student_tasks').select('*').in('student_id', allStudentIds).order('created_at', { ascending: false }),
          supabase.from('attendance').select('attendance_date, status').in('student_id', allStudentIds).order('attendance_date', { ascending: false }),
          supabase.from('sessions').select('id, topic, session_date, strengths, weaknesses').in('student_id', allStudentIds).order('created_at', { ascending: false }).limit(5),
          supabase.from('mentor_feedback').select('*').in('student_id', allStudentIds).order('created_at', { ascending: false }),
        ]);

        setTasks(taskResult.data || []);
        setAttendance(attResult.data || []);
        setSessions(sessResult.data || []);
        setMentorFeedbacks(mfResult.data || []);
      }

      // Load parent's own observations and queries
      const [obsResult, queriesResult] = await Promise.all([
        supabase.from('parent_observations').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
        supabase.from('parent_queries').select('*').eq('parent_id', user.id).order('created_at', { ascending: false }),
      ]);
      setParentObservations(obsResult.data || []);
      setParentQueries(queriesResult.data || []);

      // Build leaderboard from parent_observations for this student
      if (profile.linked_student_id) {
        const { data: allObs } = await supabase
          .from('parent_observations')
          .select('submitted_by')
          .eq('student_id', profile.linked_student_id);

        const { data: allQueries } = await supabase
          .from('parent_queries')
          .select('parent_id');

        if (allObs) {
          const scoreMap = new Map<string, number>();
          allObs.forEach((o) => { scoreMap.set(o.submitted_by, (scoreMap.get(o.submitted_by) || 0) + 1); });
          if (allQueries) {
            allQueries.forEach((q) => { scoreMap.set(q.parent_id, (scoreMap.get(q.parent_id) || 0) + 1); });
          }
          const userIds = Array.from(scoreMap.keys());
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
            const lb = (profiles || []).map((p) => ({ name: p.full_name || 'Parent', score: scoreMap.get(p.id) || 0, userId: p.id }));
            lb.sort((a, b) => b.score - a.score);
            setLeaderboard(lb);
          }
        }
      }
    } catch (err) {
      console.error('Error loading parents hub:', err);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadParentActivities = useCallback(async () => {
    if (allMentors.length === 0) return;
    setActivitiesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActivitiesLoading(false); return; }

    const mentorIds = allMentors.map((m) => m.id);
    const { data } = await supabase
      .from('parent_activities')
      .select('id, title, description, activity_type, created_at')
      .in('mentor_id', mentorIds)
      .order('created_at', { ascending: false });
    setParentActivities(data || []);

    const { data: myResp } = await supabase
      .from('parent_activity_responses')
      .select('activity_id, response_text')
      .eq('parent_id', user.id);
    const respMap: Record<string, string> = {};
    (myResp || []).forEach((r) => { respMap[r.activity_id] = r.response_text || 'Done'; });
    setMyResponses(respMap);

    setActivitiesLoading(false);
  }, [supabase, allMentors]);

  useEffect(() => {
    if (activeTab === 'activities') loadParentActivities();
  }, [activeTab, loadParentActivities]);

  const handleSubmitActivityResponse = async (activityId: string) => {
    setSubmittingActivityResponse(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmittingActivityResponse(false); return; }
    const { error } = await supabase.from('parent_activity_responses').insert({
      activity_id: activityId,
      parent_id: user.id,
      response_text: responseDraft.trim() || 'Done',
    });
    if (error) {
      toast.error('Failed to submit: ' + error.message);
    } else {
      toast.success('Response submitted!');
      setRespondingActivityId(null);
      setResponseDraft('');
      loadParentActivities();
    }
    setSubmittingActivityResponse(false);
  };

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    let schoolId: string | null = null;
    if (linkedStudent?.student_user_id) {
      const { data: studentProfile } = await supabase.from('user_profiles').select('school_id').eq('id', linkedStudent.student_user_id).maybeSingle();
      schoolId = studentProfile?.school_id || null;
    }
    setLinkedStudentSchoolId(schoolId);
    const posterIds = [...allMentors.map((m: any) => m.id), schoolId].filter(Boolean);

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

  const PARENT_CAN_SEND_TO = ['mentor', 'counselor', 'admin'];

  const loadSuggestionRecipients = useCallback(async (role: string) => {
    if (!role) { setSuggestionRecipientOptions([]); return; }

    let options: { id: string; name: string }[] = [];

    if (role === 'mentor') {
      options = allMentors.map((m: any) => ({ id: m.id, name: m.full_name || 'Mentor' }));
    } else if (role === 'counselor') {
      if (linkedStudent?.student_user_id) {
        const { data: studentProfile } = await supabase.from('user_profiles').select('counselor_id').eq('id', linkedStudent.student_user_id).maybeSingle();
        if (studentProfile?.counselor_id) {
          const { data: counselor } = await supabase.from('user_profiles').select('id, full_name').eq('id', studentProfile.counselor_id).maybeSingle();
          if (counselor) options = [{ id: counselor.id, name: counselor.full_name || 'Counselor' }];
        }
      }
    } else if (role === 'admin') {
      const { data: people } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'admin');
      options = (people || []).map((p: any) => ({ id: p.id, name: p.full_name || 'Admin' }));
    }

    setSuggestionRecipientOptions(options);
    setSuggestionRecipientId('');
  }, [supabase, allMentors, linkedStudent]);

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
      sender_role: 'parent',
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

  const handleSubmitObservation = async () => {
    if (!obsForm.observation_text.trim()) { toast.error('Please add your observation notes.'); return; }
    if (!linkedStudent) { toast.error('No linked student found.'); return; }
    setSubmittingObs(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('parent_observations').insert({
      student_id: linkedStudent.id,
      submitted_by: user.id,
      observation_text: obsForm.observation_text,
      program_experience: obsForm.program_experience,
    });
    if (error) { toast.error('Failed to submit observation.'); } else {
      toast.success('Observation submitted!');
      setObsForm({ observation_text: '', program_experience: '' });
      loadData();
    }
    setSubmittingObs(false);
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionText.trim()) { toast.error('Please enter your suggestion.'); return; }
    if (!linkedStudent) { toast.error('No linked student found.'); return; }
    setSubmittingSuggestion(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Store suggestions as parent_observations with a special prefix
    const { error } = await supabase.from('parent_observations').insert({
      student_id: linkedStudent.id,
      submitted_by: user.id,
      observation_text: `[SUGGESTION] ${suggestionText}`,
      program_experience: '',
    });
    if (error) { toast.error('Failed to submit suggestion.'); } else {
      toast.success('Suggestion submitted!');
      setSuggestionText('');
      loadData();
    }
    setSubmittingSuggestion(false);
  };

  const handleSubmitQuery = async () => {
    if (!queryForm.message.trim()) { toast.error('Please enter your message.'); return; }
    setSubmittingQuery(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('parent_queries').insert({
      parent_id: user.id,
      recipient_role: queryForm.recipient_role,
      message: queryForm.message,
      status: 'open',
    });
    if (error) { toast.error('Failed to send query.'); } else {
      toast.success('Query sent successfully!');
      setQueryForm({ recipient_role: 'mentor', message: '' });
      loadData();
    }
    setSubmittingQuery(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Parents Hub...</p>
        </div>
      </div>
    );
  }

  if (!parentProfile?.linked_student_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
          <Icon name="HomeIcon" size={28} className="text-violet-500" />
        </div>
        <h2 className="text-xl font-700 text-foreground mb-2">No Student Linked</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your account is not linked to a student yet. Ask your child to generate a Parent Link Code from their Network &amp; Links page, then contact support to link your account.
        </p>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const tier = getQuestTier(completedTasks);
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const tabs = [
    { id: 'overview' as const, label: "Child's Overview", icon: 'UserIcon' },
    { id: 'mentor' as const, label: 'Mentor Overview', icon: 'AcademicCapIcon' },
    { id: 'action' as const, label: 'Action Center', icon: 'BoltIcon' },
    { id: 'activities' as const, label: 'Activities', icon: 'SparklesIcon' },
    { id: 'programs' as const, label: 'Programs & Events', icon: 'MegaphoneIcon' },
    { id: 'suggestions' as const, label: 'Suggestion Portal', icon: 'ChatBubbleLeftEllipsisIcon' },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: 'TrophyIcon' },
  ];

  return (
    <div className="animate-fade-in">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">
            Parents Hub 🏠
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {linkedStudent ? `Monitoring: ${linkedStudent.name}` : 'Your child\'s progress at a glance'}
          </p>
        </div>
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-lg ${tier.bgColor}`}>
          <span className="text-2xl">{tier.icon}</span>
          <div>
            <p className="text-xs text-muted-foreground font-500">Child&apos;s Quest Tier</p>
            <p className={`text-base font-800 ${tier.textColor}`}>{tier.name}</p>
          </div>
        </div>
      </div>

      {/* ── CHILD'S OVERVIEW TAB ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Read-Only Banner */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/5 border border-info/20">
            <Icon name="EyeIcon" size={15} className="text-info flex-shrink-0" />
            <p className="text-xs text-muted-foreground">This section is <span className="font-600 text-foreground">read-only</span>. You can view your child&apos;s progress but cannot make changes.</p>
          </div>

          {/* Quest Tier & Task Completion */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border-2 ${tier.bgColor} flex flex-col gap-2`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tier.icon}</span>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Quest Tier</p>
              </div>
              <p className={`text-xl font-800 ${tier.textColor}`}>{tier.name}</p>
              <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${tier.color}`} style={{ width: `${tier.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{tier.progress}% to next tier</p>
            </div>
            <div className="card-mystic p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={16} className="text-primary" />
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Task Completion</p>
              </div>
              <p className="text-3xl font-800 text-foreground">{taskCompletionRate}%</p>
              <p className="text-xs text-muted-foreground">{completedTasks} of {tasks.length} tasks done</p>
            </div>
            <div className="card-mystic p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="CalendarDaysIcon" size={16} className="text-primary" />
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Attendance</p>
              </div>
              <p className="text-3xl font-800 text-foreground">
                {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">{attendance.filter(a => a.status === 'present').length} present days</p>
            </div>
          </div>

          {/* Attendance Calendar */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
              Attendance Calendar
            </h2>
            <AttendanceCalendarView records={attendance} />
          </div>

          {/* School Events Calendar */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="CalendarDaysIcon" size={18} className="text-violet-500" />
              School Calendar
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">Performance &amp; Holidays</span>
            </h2>
            <SchoolEventsCalendar schoolId={linkedStudentSchoolId || null} />
          </div>

          {/* Report Card — Mentor's Feedback */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="DocumentTextIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Report Card — Mentor&apos;s Insights</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">Read Only</span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No session feedback available yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-700 text-foreground">{s.topic}</span>
                      <span className="text-xs text-muted-foreground">{s.session_date}</span>
                    </div>
                    {Array.isArray(s.strengths) && s.strengths.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-600 text-positive mb-1">✅ Strengths</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.strengths.map((item, i) => <li key={i} className="flex gap-1.5"><span className="text-positive">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-600 text-warning mb-1">🔧 Areas to Improve</p>
                        <ul className="text-xs text-foreground/80 space-y-0.5">
                          {s.weaknesses.map((item, i) => <li key={i} className="flex gap-1.5"><span className="text-warning">•</span> {item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MENTOR OVERVIEW TAB ──────────────────────────────────────────────── */}
      {activeTab === 'mentor' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/5 border border-info/20">
            <Icon name="EyeIcon" size={15} className="text-info flex-shrink-0" />
            <p className="text-xs text-muted-foreground">Read-only view of your child&apos;s assigned mentor.</p>
          </div>

          {allMentors.length > 1 && (
            <div className="p-3 rounded-xl bg-secondary/40 border border-border">
              <p className="text-xs font-600 text-muted-foreground mb-2">Your child has {allMentors.length} mentors:</p>
              <div className="flex flex-wrap gap-2">
                {allMentors.map((m) => (
                  <span key={m.id} className="text-xs font-600 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{m.full_name}</span>
                ))}
              </div>
            </div>
          )}
          {!mentorProfile ? (
            <div className="card-mystic p-8 text-center">
              <Icon name="AcademicCapIcon" size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-600 text-foreground">No mentor linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your child has not been linked to a mentor.</p>
            </div>
          ) : (
            <>
              <div className="card-mystic p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Icon name="AcademicCapIcon" size={26} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-700 text-foreground">{mentorProfile.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{mentorProfile.email}</p>
                    <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 mt-1 inline-block">Mentor</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">{linkedStudent?.sessions || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">{linkedStudent?.avg_score || 0}%</p>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                    <p className="text-xl font-800 text-foreground">
                      {mentorFeedbacks.length > 0
                        ? (mentorFeedbacks.reduce((s, f) => s + (f.mentor_interaction_score + f.active_listening_score + f.teaching_clarity_score) / 3, 0) / mentorFeedbacks.length).toFixed(1)
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Feedback</p>
                  </div>
                </div>
              </div>

              {/* Interaction Style */}
              {mentorFeedbacks.length > 0 && (
                <div className="card-mystic p-5">
                  <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                    <Icon name="StarIcon" size={18} className="text-amber-400" variant="solid" />
                    Interaction Style (from student feedback)
                  </h2>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Fun & Helpful', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.mentor_interaction_score, 0) / mentorFeedbacks.length) },
                      { label: 'Active Listening', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.active_listening_score, 0) / mentorFeedbacks.length) },
                      { label: 'Teaching Clarity', value: Math.round(mentorFeedbacks.reduce((s, f) => s + f.teaching_clarity_score, 0) / mentorFeedbacks.length) },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{metric.label}</span>
                          <span className="font-700 text-foreground">{metric.value}/5</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${(metric.value / 5) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics covered */}
              {linkedStudent?.topics && linkedStudent.topics.length > 0 && (
                <div className="card-mystic p-5">
                  <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-3">
                    <Icon name="BookOpenIcon" size={18} className="text-primary" />
                    Topics Covered
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {linkedStudent.topics.map((topic, i) => (
                      <span key={i} className="text-xs font-600 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACTION CENTER TAB ────────────────────────────────────────────────── */}
      {activeTab === 'action' && (
        <div className="flex flex-col gap-6">
          {/* Parent Observation Form */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="HomeIcon" size={18} className="text-primary" />
              <h2 className="text-base font-700 text-foreground">Parent Observation</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Home Progress Notes <span className="text-negative">*</span></label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[100px] resize-none flex-1" placeholder="Share observations about your child's progress at home..." value={obsForm.observation_text} onChange={(e) => setObsForm((f) => ({ ...f, observation_text: e.target.value }))} />
                  <MicButton onResult={(text) => setObsForm((f) => ({ ...f, observation_text: (f.observation_text ? f.observation_text + ' ' : '') + text }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Program Experience</label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[80px] resize-none flex-1" placeholder="How has the Luminar's Guide program impacted your child?" value={obsForm.program_experience} onChange={(e) => setObsForm((f) => ({ ...f, program_experience: e.target.value }))} />
                  <MicButton onResult={(text) => setObsForm((f) => ({ ...f, program_experience: (f.program_experience ? f.program_experience + ' ' : '') + text }))} />
                </div>
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitObservation} disabled={submittingObs}>
                {submittingObs ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Observation</>}
              </button>
            </div>
          </div>

          {/* Suggestion Box */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="LightBulbIcon" size={18} className="text-amber-400" />
              <h2 className="text-base font-700 text-foreground">Suggestion Box</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Your Suggestion</label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[100px] resize-none flex-1" placeholder="Share ideas or suggestions to improve the program for your child..." value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} />
                  <MicButton onResult={(text) => setSuggestionText((prev) => (prev ? prev + ' ' : '') + text)} />
                </div>
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitSuggestion} disabled={submittingSuggestion}>
                {submittingSuggestion ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Submitting...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Submit Suggestion</>}
              </button>
            </div>
          </div>

          {/* Raise a Query */}
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-info" />
              <h2 className="text-base font-700 text-foreground">Raise a Query</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Send To</label>
                <div className="flex gap-2">
                  {(['mentor', 'counselor'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setQueryForm((f) => ({ ...f, recipient_role: role }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-600 transition-all ${
                        queryForm.recipient_role === role ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <Icon name={role === 'mentor' ? 'AcademicCapIcon' : 'ShieldCheckIcon'} size={15} />
                      {role === 'mentor' ? 'Mentor' : 'Counselor'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Your Message <span className="text-negative">*</span></label>
                <div className="flex gap-2 items-start">
                  <textarea className="input-mystic min-h-[100px] resize-none flex-1" placeholder={`Write your message to the ${queryForm.recipient_role}...`} value={queryForm.message} onChange={(e) => setQueryForm((f) => ({ ...f, message: e.target.value }))} />
                  <MicButton onResult={(text) => setQueryForm((f) => ({ ...f, message: (f.message ? f.message + ' ' : '') + text }))} />
                </div>
              </div>
              <button className="btn-primary self-start" onClick={handleSubmitQuery} disabled={submittingQuery}>
                {submittingQuery ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Sending...</> : <><Icon name="PaperAirplaneIcon" size={15} /> Send Query</>}
              </button>
            </div>
          </div>

          {/* Past Queries */}
          {parentQueries.length > 0 && (
            <div className="card-mystic p-5">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                My Queries
              </h2>
              <div className="flex flex-col gap-3">
                {parentQueries.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name={q.recipient_role === 'mentor' ? 'AcademicCapIcon' : 'ShieldCheckIcon'} size={14} className="text-primary" />
                        <span className="text-xs font-600 text-primary capitalize">To: {q.recipient_role}</span>
                      </div>
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                        q.status === 'replied' ? 'bg-positive/10 text-positive border-positive/20'
                          : q.status === 'closed' ? 'bg-muted text-muted-foreground border-border'
                          : 'bg-info/10 text-info border-info/20'
                      }`}>{q.status}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{q.message}</p>
                    {q.reply && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs font-600 text-primary mb-1">Reply:</p>
                        <p className="text-xs text-foreground/80">{q.reply}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(q.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'activities' && (
        <div className="card-mystic p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="SparklesIcon" size={18} className="text-primary" />
            <h2 className="text-base font-700 text-foreground">Activities from Your Mentor</h2>
          </div>
          {activitiesLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : parentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activities posted yet. Check back soon!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {parentActivities.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-700 text-foreground">{a.title}</span>
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${a.activity_type === 'game' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                      {a.activity_type === 'game' ? '🎲 Fun Game' : '📋 Task'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-3">{a.description}</p>

                  {myResponses[a.id] ? (
                    <div className="p-2.5 rounded-lg bg-positive/5 border border-positive/20 flex items-center gap-2">
                      <Icon name="CheckCircleIcon" size={14} className="text-positive" />
                      <span className="text-xs text-positive font-600">Completed — {myResponses[a.id]}</span>
                    </div>
                  ) : respondingActivityId === a.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="input-mystic text-sm min-h-[60px] resize-none"
                        placeholder="Optional: share how it went..."
                        value={responseDraft}
                        onChange={(e) => setResponseDraft(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-xs py-1.5 px-4"
                          onClick={() => handleSubmitActivityResponse(a.id)}
                          disabled={submittingActivityResponse}
                        >
                          {submittingActivityResponse ? 'Saving...' : 'Mark as Done'}
                        </button>
                        <button
                          className="btn-ghost text-xs py-1.5 px-4"
                          onClick={() => { setRespondingActivityId(null); setResponseDraft(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-ghost text-xs py-1.5 px-4"
                      onClick={() => { setRespondingActivityId(a.id); setResponseDraft(''); }}
                    >
                      <Icon name="CheckIcon" size={13} /> Mark as Done
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'programs' && (
        <div className="card-mystic p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="MegaphoneIcon" size={18} className="text-primary" />
            <h2 className="text-base font-700 text-foreground">Programs & Events</h2>
          </div>
          {programsLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : programs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No programs posted yet. Check back soon!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {programs.map((p) => (
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
                {PARENT_CAN_SEND_TO.map((r) => (
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

      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6">
          <div className="card-mystic p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="TrophyIcon" size={18} className="text-amber-400" variant="solid" />
              <h2 className="text-base font-700 text-foreground">Parent Engagement Leaderboard</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Engagement Score = total observations + suggestions + queries submitted. Stay active to climb the ranks!
            </p>
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="TrophyIcon" size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-600">No engagement data yet.</p>
                <p className="text-xs mt-1">Submit observations, suggestions, or queries to appear here!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.map((entry, idx) => (
                  <div key={entry.userId} className={`flex items-center gap-3 p-4 rounded-xl border ${
                    idx === 0 ? 'bg-amber-50 border-amber-200' : idx === 1 ? 'bg-slate-50 border-slate-200' : idx === 2 ? 'bg-orange-50 border-orange-200' : 'bg-secondary/40 border-border'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-800 flex-shrink-0 ${
                      idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-700 text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">Engagement Score: {entry.score}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(entry.score, 5) }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Engagement Stats */}
          <div className="card-mystic p-5">
            <h2 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="ChartBarIcon" size={18} className="text-primary" />
              My Engagement Stats
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentObservations.filter(o => !o.observation_text.startsWith('[SUGGESTION]')).length}</p>
                <p className="text-xs text-muted-foreground">Observations</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentObservations.filter(o => o.observation_text.startsWith('[SUGGESTION]')).length}</p>
                <p className="text-xs text-muted-foreground">Suggestions</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/60 border border-border text-center">
                <p className="text-2xl font-800 text-foreground">{parentQueries.length}</p>
                <p className="text-xs text-muted-foreground">Queries</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
