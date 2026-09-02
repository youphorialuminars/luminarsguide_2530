'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LinkedSchool {
  school_id: string;
  school_name: string;
}

interface SchoolProfile {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  school_id: string | null;
  mentor_id: string | null;
  // Not currently returned by the user_profiles query below — grade lives on
  // the `students` table, not `user_profiles`. Kept optional so the "Grade"
  // column in the All Students tab renders "—" instead of throwing.
  grade?: string;
}

interface ProgramRow {
  id: string;
  posted_by: string;
  posted_by_role: string;
  title: string;
  description: string;
  program_date: string | null;
  external_link: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

type AdminTab = 'overview' | 'schools' | 'mentors' | 'students' | 'link' | 'programs' | 'suggestions';

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
export default function AdminDashboardContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<AdminTab>(
    (searchParams.get('tab') as AdminTab) || 'overview'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t as AdminTab);
  }, [searchParams]);

  const [receivedSuggestions, setReceivedSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>('Admin');
  const [linkedSchools, setLinkedSchools] = useState<LinkedSchool[]>([]);
  const [allProfiles, setAllProfiles] = useState<SchoolProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pending Approvals — global list, not limited to linked schools
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [pendingApprovalsLoading, setPendingApprovalsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Admin invite codes — generate a one-time code for a new admin
  const [adminInviteCode, setAdminInviteCode] = useState<string | null>(null);
  const [generatingAdminCode, setGeneratingAdminCode] = useState(false);

  // Schools tab — expandable rows
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);

  // Mentors tab
  const [mentorSearch, setMentorSearch] = useState('');

  // Students tab
  const [studentSearch, setStudentSearch] = useState('');

  // Link a School tab
  const [inviteCode, setInviteCode] = useState('');
  const [linkingSchool, setLinkingSchool] = useState(false);

  // Programs tab
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programForm, setProgramForm] = useState({ title: '', description: '', program_date: '', external_link: '' });
  const [programFile, setProgramFile] = useState<File | null>(null);
  const [postingProgram, setPostingProgram] = useState(false);

  // ─── Load Data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Fetch admin_school_links joined with school full_name
      const { data: linkRows, error: linkErr } = await supabase
        .from('admin_school_links')
        .select('school_id')
        .eq('admin_id', uid);

      if (linkErr) {
        console.error('[AdminDashboard] Failed to load school links:', linkErr.message);
      }

      const schoolIds = (linkRows || []).map((r: any) => r.school_id);

      if (schoolIds.length === 0) {
        setLinkedSchools([]);
        setAllProfiles([]);
        setIsLoading(false);
        return;
      }

      // Fetch school names
      const { data: schoolProfiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', schoolIds);

      const schools: LinkedSchool[] = (schoolProfiles || []).map((s: any) => ({
        school_id: s.id,
        school_name: s.full_name || 'Unknown School',
      }));
      setLinkedSchools(schools);

      // Fetch all user_profiles for these schools (mentors, students, parents, counselors)
      const { data: profiles, error: profileErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, school_id, mentor_id')
        .in('school_id', schoolIds);

      if (profileErr) {
        console.error('[AdminDashboard] Failed to load profiles:', profileErr.message);
      }
      setAllProfiles(profiles || []);
    } catch (err) {
      console.error('[AdminDashboard] Unexpected error:', err);
      toast.error('Failed to load admin data');
    }
    setIsLoading(false);
  }, [supabase]);

  // ─── Load Pending Approvals (global — every school/mentor waiting on Admin.
  // Students and Counselors are now approved by their own mentor instead, so
  // they're intentionally excluded here — see mentor dashboard for those.) ──
  const loadPendingApprovals = useCallback(async () => {
    setPendingApprovalsLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role, school_id, mentor_id, created_at')
      .eq('approval_status', 'pending')
      .in('role', ['mentor', 'school', 'admin'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[AdminDashboard] Failed to load pending approvals:', error.message);
    }
    setPendingApprovals(data || []);
    setPendingApprovalsLoading(false);
  }, [supabase]);

  // ─── Approve a pending account ────────────────────────────────────────────
  const handleApprove = async (userId: string, role: string) => {
    setApprovingId(userId);
    const { error } = await supabase.rpc('admin_approve_account', { p_user_id: userId });
    if (error) {
      toast.error('Failed to approve: ' + error.message);
    } else {
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} approved!`);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== userId));
      if (adminId) loadData(adminId);
    }
    setApprovingId(null);
  };

  // ─── Generate a one-time invite code for a new admin ───────────────────────
  const handleGenerateAdminInviteCode = async () => {
    setGeneratingAdminCode(true);
    const { data, error } = await supabase.rpc('generate_admin_invite_code');
    if (error) {
      toast.error('Failed to generate code: ' + error.message);
    } else {
      setAdminInviteCode(data as string);
      navigator.clipboard?.writeText(data as string);
      toast.success('Invite code generated and copied to clipboard!');
    }
    setGeneratingAdminCode(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/sign-up-login'); return; }
      setAdminId(user.id);
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
          if (profile?.role !== 'admin') { router.push('/sign-up-login'); return; }
          setAdminName(profile?.full_name || 'Admin');
          loadData(user.id);
          loadPendingApprovals();
        });
    });
  }, [router, supabase, loadData, loadPendingApprovals]);

  // ─── Programs ──────────────────────────────────────────────────────────────
  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false });
    setPrograms(data || []);

    if (data && data.length > 0) {
      const posterIds = Array.from(new Set(data.map((p: ProgramRow) => p.posted_by)));
      const { data: posters } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', posterIds);
      const names: Record<string, string> = {};
      (posters || []).forEach((p: any) => { names[p.id] = p.full_name || 'Unknown'; });
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
    if (!adminId) return;
    setPostingProgram(true);

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (programFile) {
      const filePath = `${adminId}/${Date.now()}_${programFile.name}`;
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
      posted_by: adminId,
      posted_by_role: 'admin',
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

  // ─── Link a School ─────────────────────────────────────────────────────────
  const handleLinkSchool = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;

    // Validate format ABC-123456
    const codePattern = /^[A-Z]{3}-\d{6}$/;
    if (!codePattern.test(code)) {
      toast.error('Invalid code format. Expected format: ABC-123456');
      return;
    }

    if (!adminId) return;
    setLinkingSchool(true);
    try {
      // Looking up a school's invite code directly isn't allowed until an
      // admin is already linked to that school (a chicken-and-egg problem),
      // so this goes through a dedicated function that does the lookup and
      // the link together, safely, in one step.
      const { data, error } = await supabase.rpc('admin_link_school', {
        p_invite_code: code,
      });

      if (error) {
        toast.error('Failed to link school: ' + error.message);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Invalid school invite code. Please check and try again.');
        return;
      }

      toast.success('School linked successfully!');
      setInviteCode('');
      loadData(adminId);
    } finally {
      setLinkingSchool(false);
    }
  };

  // ─── Derived Data ──────────────────────────────────────────────────────────
  const schoolIds = linkedSchools.map((s) => s.school_id);
  const mentors = allProfiles.filter((p) => p.role === 'mentor');
  const students = allProfiles.filter((p) => p.role === 'student' || p.role === 'student_parent');
  const parents = allProfiles.filter((p) => p.role === 'parent');
  const counselors = allProfiles.filter((p) => p.role === 'counselor');

  const filteredMentors = mentors.filter((m) =>
    m.full_name?.toLowerCase().includes(mentorSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  const filteredStudents = students.filter((s) =>
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const getSchoolName = (schoolId: string | null) => {
    if (!schoolId) return '—';
    return linkedSchools.find((s) => s.school_id === schoolId)?.school_name || '—';
  };

  const getMentorName = (mentorId: string | null) => {
    if (!mentorId) return '—';
    const mentor = mentors.find((m) => m.id === mentorId);
    return mentor?.full_name || '—';
  };

  const getStudentCountForSchool = (schoolId: string) =>
    students.filter((s) => s.school_id === schoolId).length;

  const getMentorCountForSchool = (schoolId: string) =>
    mentors.filter((m) => m.school_id === schoolId).length;

  const getMentorsForSchool = (schoolId: string) =>
    mentors.filter((m) => m.school_id === schoolId);

  const getStudentsForSchool = (schoolId: string) =>
    students.filter((s) => s.school_id === schoolId);

  const getStudentCountForMentor = (mentorId: string) =>
    students.filter((s) => s.mentor_id === mentorId).length;

  // ─── Tabs ──────────────────────────────────────────────────────────────────
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
  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'ChartBarIcon' },
    { id: 'schools', label: 'Schools', icon: 'BuildingLibraryIcon' },
    { id: 'mentors', label: 'All Mentors', icon: 'AcademicCapIcon' },
    { id: 'students', label: 'All Students', icon: 'UserGroupIcon' },
    { id: 'link', label: 'Link a School', icon: 'LinkIcon' },
    { id: 'programs', label: 'Programs & Events', icon: 'MegaphoneIcon' },
    { id: 'suggestions', label: 'Suggestion Portal', icon: 'ChatBubbleLeftEllipsisIcon' },
  ];

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="text-primary animate-spin" />
          <p className="text-muted-foreground font-500">Loading admin data…</p>
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
              <Icon name="ShieldCheckIcon" size={22} className="text-primary" />
            </div>
            <h1 className="text-2xl font-800 text-foreground">{adminName}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-13">
            Admin Dashboard · {linkedSchools.length} Linked Schools · {mentors.length} Mentors · {students.length} Students
          </p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/network-links')}>
          <Icon name="TableCellsIcon" size={16} />
          View Directory
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon="BuildingLibraryIcon" label="Linked Schools" value={linkedSchools.length} />
        <StatCard icon="AcademicCapIcon" label="Total Mentors" value={mentors.length} />
        <StatCard icon="UserGroupIcon" label="Total Students" value={students.length} />
        <StatCard icon="HomeIcon" label="Total Parents" value={parents.length} />
        <StatCard icon="ShieldCheckIcon" label="Total Counselors" value={counselors.length} />
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          {/* Pending Approvals — always visible, not limited to linked schools */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                Pending Approvals
              </h2>
              {pendingApprovals.length > 0 && (
                <span className="text-xs font-600 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                  {pendingApprovals.length} waiting
                </span>
              )}
            </div>

            {pendingApprovalsLoading ? (
              <div className="flex justify-center py-6">
                <Icon name="ArrowPathIcon" size={20} className="text-muted-foreground animate-spin" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No accounts waiting on approval right now.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingApprovals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-600 text-foreground truncate">{p.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.email} · <span className="capitalize">{p.role}</span>
                        {p.created_at ? ` · signed up ${new Date(p.created_at).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(p.id, p.role)}
                      disabled={approvingId === p.id}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 disabled:opacity-40 flex-shrink-0"
                    >
                      {approvingId === p.id ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Invite Another Admin ── */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                <Icon name="KeyIcon" size={18} className="text-primary" />
                Invite Another Admin
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Generate a one-time code and send it to the teammate you want to make an admin. They'll select
              "Admin" on the sign-up page and enter this code — their account is approved instantly, no extra
              approval step needed.
            </p>
            <button
              onClick={handleGenerateAdminInviteCode}
              disabled={generatingAdminCode}
              className="btn-primary disabled:opacity-40"
            >
              {generatingAdminCode ? 'Generating…' : 'Generate Admin Invite Code'}
            </button>
            {adminInviteCode && (
              <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <p className="text-sm font-mono tracking-widest text-foreground">{adminInviteCode}</p>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(adminInviteCode);
                    toast.success('Copied to clipboard!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {linkedSchools.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="BuildingLibraryIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No schools linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go to the "Link a School" tab and enter a school invite code to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {linkedSchools.map((school) => {
                const schoolMentors = getMentorCountForSchool(school.school_id);
                const schoolStudents = getStudentCountForSchool(school.school_id);
                const schoolParents = allProfiles.filter((p) => p.role === 'parent' && p.school_id === school.school_id).length;
                const schoolCounselors = allProfiles.filter((p) => p.role === 'counselor' && p.school_id === school.school_id).length;
                return (
                  <div key={school.school_id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon name="BuildingLibraryIcon" size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-700 text-foreground">{school.school_name}</p>
                        <p className="text-xs text-muted-foreground">Linked School</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{schoolMentors}</p>
                        <p className="text-xs text-muted-foreground">Mentors</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{schoolStudents}</p>
                        <p className="text-xs text-muted-foreground">Students</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{schoolParents}</p>
                        <p className="text-xs text-muted-foreground">Parents</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-2">
                        <p className="text-lg font-800 text-foreground">{schoolCounselors}</p>
                        <p className="text-xs text-muted-foreground">Counselors</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Schools Tab ── */}
      {activeTab === 'schools' && (
        <div className="animate-fade-in flex flex-col gap-3">
          {linkedSchools.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="BuildingLibraryIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No schools linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Use the "Link a School" tab to add schools to your oversight.</p>
            </div>
          ) : (
            linkedSchools.map((school) => {
              const isExpanded = expandedSchool === school.school_id;
              const schoolMentors = getMentorsForSchool(school.school_id);
              const schoolStudents = getStudentsForSchool(school.school_id);
              return (
                <div key={school.school_id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
                    onClick={() => setExpandedSchool(isExpanded ? null : school.school_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-700 text-foreground">{school.school_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getMentorCountForSchool(school.school_id)} mentors · {getStudentCountForSchool(school.school_id)} students
                        </p>
                      </div>
                    </div>
                    <Icon
                      name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                      size={18}
                      className="text-muted-foreground flex-shrink-0"
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-5 py-4 flex flex-col gap-5">
                      {/* Mentors nested list */}
                      <div>
                        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">
                          Mentors ({schoolMentors.length})
                        </p>
                        {schoolMentors.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No mentors linked to this school yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {schoolMentors.map((mentor) => (
                              <div key={mentor.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 border border-border">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-700 text-primary">{mentor.full_name?.charAt(0) || 'M'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-600 text-foreground truncate">{mentor.full_name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{mentor.email || '—'}</p>
                                </div>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {getStudentCountForMentor(mentor.id)} students
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Students nested list */}
                      <div>
                        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">
                          Students ({schoolStudents.length})
                        </p>
                        {schoolStudents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No students linked to this school yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {schoolStudents.map((student) => (
                              <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 border border-border">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-700 text-primary">{student.full_name?.charAt(0) || 'S'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-600 text-foreground truncate">{student.full_name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    Mentor: {getMentorName(student.mentor_id)}
                                  </p>
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
            })
          )}
        </div>
      )}

      {/* ── All Mentors Tab ── */}
      {activeTab === 'mentors' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-mystic pl-9"
                placeholder="Search mentors by name or email…"
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">{filteredMentors.length} mentors</span>
          </div>

          {filteredMentors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="AcademicCapIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-500">No mentors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mentors will appear here once linked to a school in your oversight.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Mentor</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Email</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">School</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMentors.map((mentor, i) => (
                    <tr
                      key={mentor.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-700 text-primary">{mentor.full_name?.charAt(0) || 'M'}</span>
                          </div>
                          <span className="text-sm font-600 text-foreground">{mentor.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{mentor.email || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{getSchoolName(mentor.school_id)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{getStudentCountForMentor(mentor.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── All Students Tab ── */}
      {activeTab === 'students' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-mystic pl-9"
                placeholder="Search students by name…"
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
              <p className="text-xs text-muted-foreground mt-1">
                Students will appear here once linked to a school in your oversight.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Student</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Mentor</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">School</th>
                    <th className="text-left text-xs font-600 text-muted-foreground px-5 py-3">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, i) => (
                    <tr
                      key={student.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-700 text-primary">{student.full_name?.charAt(0) || 'S'}</span>
                          </div>
                          <span className="text-sm font-600 text-foreground">{student.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{getMentorName(student.mentor_id)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{getSchoolName(student.school_id)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{student.grade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Link a School Tab ── */}
      {activeTab === 'link' && (
        <div className="animate-fade-in max-w-lg">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="LinkIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-700 text-foreground">Link a School</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter a school's invite code to add it to your oversight.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Invite codes follow the format <span className="font-mono font-700 text-foreground">ABC-123456</span>. Ask the school administrator for their code.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">School Invite Code</label>
                <div className="flex gap-2">
                  <input
                    className="input-mystic flex-1 font-mono tracking-widest uppercase"
                    placeholder="e.g. SCH-123456"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleLinkSchool()}
                    maxLength={10}
                  />
                  <button
                    className="btn-primary px-5"
                    onClick={handleLinkSchool}
                    disabled={linkingSchool || !inviteCode.trim()}
                  >
                    {linkingSchool ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name="LinkIcon" size={16} />
                    )}
                    Link
                  </button>
                </div>
              </div>
            </div>

            {linkedSchools.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">
                  Currently Linked Schools
                </p>
                <div className="flex flex-col gap-1.5">
                  {linkedSchools.map((school) => (
                    <div key={school.school_id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                      <Icon name="BuildingLibraryIcon" size={16} className="text-primary flex-shrink-0" />
                      <span className="text-sm font-600 text-foreground">{school.school_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Programs & Events Tab ── */}
      {activeTab === 'suggestions' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-700 text-foreground flex items-center gap-2 mb-4">
              <Icon name="InboxIcon" size={18} className="text-primary" />
              Received Suggestions, Feedback & Queries
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {receivedSuggestions.length} total
              </span>
            </h3>
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

      {activeTab === 'programs' && (
        <div className="animate-fade-in flex flex-col gap-6">
          {/* Post Program Form */}
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
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Title <span className="text-negative">*</span>
                </label>
                <input
                  className="input-mystic"
                  placeholder="e.g. Annual Science Fair"
                  value={programForm.title}
                  onChange={(e) => setProgramForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Description <span className="text-negative">*</span>
                </label>
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
                  <label className="block text-sm font-600 text-foreground mb-1.5">
                    Link (optional — e.g. for an online session)
                  </label>
                  <input
                    className="input-mystic"
                    placeholder="https://meet.jit.si/..."
                    value={programForm.external_link}
                    onChange={(e) => setProgramForm((f) => ({ ...f, external_link: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Attach a brochure/poster (optional)
                </label>
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
                    <button className="btn-ghost text-xs py-1.5 px-2" onClick={() => setProgramFile(null)}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <button className="btn-primary self-start" onClick={handlePostProgram} disabled={postingProgram}>
                {postingProgram ? (
                  <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Posting...</>
                ) : (
                  <><Icon name="MegaphoneIcon" size={15} /> Post Program</>
                )}
              </button>
            </div>
          </div>

          {/* Programs List */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              <h3 className="text-base font-700 text-foreground">All Programs & Events</h3>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                {programs.length} total
              </span>
            </div>
            {programsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : programs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No programs posted yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {programs.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-700 text-foreground">{p.title}</span>
                        <span
                          className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                            p.posted_by_role === 'admin'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : p.posted_by_role === 'school'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {p.posted_by_role === 'admin' ? 'Admin' : p.posted_by_role === 'school' ? 'School' : 'Mentor'}:{' '}
                          {posterNames[p.posted_by] || '...'}
                        </span>
                        {p.program_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.program_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
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