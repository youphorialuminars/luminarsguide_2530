'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LinkedStudent {
  id: string;
  name: string;
  grade: string;
  student_user_id: string | null;
}

interface InviteCode {
  id: string;
  invite_code: string;
  used_by: string | null;
  created_at: string;
}
function StudentSection({ profile, onRefresh }: { profile: any; onRefresh: () => void }) {
  const supabase = createClient();
  const [mentorCode, setMentorCode] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [counselorCode, setCounselorCode] = useState('');
  const [submittingMentor, setSubmittingMentor] = useState(false);
  const [submittingSchool, setSubmittingSchool] = useState(false);
  const [submittingCounselor, setSubmittingCounselor] = useState(false);
  const [parentLinkCode, setParentLinkCode] = useState<string | null>(null);
  const [generatingParentCode, setGeneratingParentCode] = useState(false);
  const [copiedParentCode, setCopiedParentCode] = useState(false);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [allMentorNames, setAllMentorNames] = useState<string[]>([]);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [counselorName, setCounselorName] = useState<string | null>(null);

  useEffect(() => {
    // Load existing parent_link_code for this student
    if (profile?.student_id) {
      supabase
        .from('students')
        .select('parent_link_code')
        .eq('id', profile.student_id)
        .single()
        .then(({ data }) => {
          if (data?.parent_link_code) setParentLinkCode(data.parent_link_code);
        });
    }
  }, [profile?.student_id, supabase]);

  useEffect(() => {
    const loadLinkedNames = async () => {
      if (profile?.mentor_id) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', profile.mentor_id)
          .single();
        setMentorName(data?.full_name || null);
      }

      // Load ALL linked mentors, not just the primary one
      const { data: linkRows } = await supabase
        .from('student_mentor_links')
        .select('mentor_id')
        .eq('student_user_id', profile.id);

      if (linkRows && linkRows.length > 0) {
        const mentorIds = linkRows.map((r) => r.mentor_id);
        const { data: mentorProfiles } = await supabase
          .from('user_profiles')
          .select('full_name')
          .in('id', mentorIds);
        setAllMentorNames((mentorProfiles || []).map((m) => m.full_name).filter(Boolean));
      }
      if (profile?.school_id) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', profile.school_id)
          .single();
        setSchoolName(data?.full_name || null);
      }
      if (profile?.counselor_id) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', profile.counselor_id)
          .single();
        setCounselorName(data?.full_name || null);
      }
    };
    loadLinkedNames();
  }, [profile?.mentor_id, profile?.school_id, profile?.counselor_id, supabase]);

  const handleGenerateParentCode = async () => {
    if (!profile?.student_id) {
      toast.error('No student profile linked. Please contact your mentor.');
      return;
    }
    setGeneratingParentCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate_student_link', studentId: profile.student_id }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Fallback: direct Supabase update if RPC fails (e.g. mentor calling for student)
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * 26)]).join('');
        const digits = String(Math.floor(Math.random() * 900000) + 100000);
        const code = `${prefix}-${digits}`;
        const { error } = await supabase
          .from('students')
          .update({ parent_link_code: code })
          .eq('id', profile.student_id);
        if (error) { toast.error('Failed to generate code: ' + error.message); return; }
        setParentLinkCode(code);
        toast.success('Parent Link Code generated!');
        return;
      }
      setParentLinkCode(json.code);
      toast.success('Parent Link Code generated!');
    } catch (err: any) {
      toast.error(err?.message || 'Error generating code');
    } finally {
      setGeneratingParentCode(false);
    }
  };

  const handleCopyParentCode = () => {
    if (!parentLinkCode) return;
    navigator.clipboard?.writeText(parentLinkCode);
    setCopiedParentCode(true);
    setTimeout(() => setCopiedParentCode(false), 2000);
    toast.success('Parent Link Code copied!');
  };

 const handleLinkMentor = async () => {
    if (!mentorCode.trim()) return;
    setSubmittingMentor(true);
    try {
      const { data: mentorProfile, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, mentor_code')
        .eq('mentor_code', mentorCode.trim().toUpperCase())
        .eq('role', 'mentor')
        .single();

      if (error || !mentorProfile) {
        toast.error('Invalid mentor code. Please check and try again.');
        return;
      }

      // Add this mentor to the student's list of linked mentors (does not overwrite existing links)
      const { error: linkError } = await supabase
        .from('student_mentor_links')
        .insert({ student_user_id: profile.id, mentor_id: mentorProfile.id });

      const alreadyLinked = linkError && linkError.code === '23505';
      if (linkError && !alreadyLinked) {
        toast.error('Failed to link mentor: ' + linkError.message);
        return;
      }

      // Keep the original single mentor_id field set too, for backward compatibility
      if (!profile.mentor_id) {
        await supabase
          .from('user_profiles')
          .update({ mentor_id: mentorProfile.id })
          .eq('id', profile.id);
      }

      // Every mentor relationship needs its own proper record in the `students` table —
      // this is what tasks, attendance, and sessions actually depend on. Without this,
      // a second/third mentor can "see" the student in their roster but nothing else works.
      if (!alreadyLinked) {
        const { data: existingForThisMentor } = await supabase
          .from('students')
          .select('id')
          .eq('student_user_id', profile.id)
          .eq('mentor_id', mentorProfile.id)
          .maybeSingle();

        if (!existingForThisMentor) {
          const generatedStudentCode = `STU-${Math.floor(100000 + Math.random() * 900000)}`;
          const { data: newRow } = await supabase
            .from('students')
            .insert({
              mentor_id: mentorProfile.id,
              name: profile.full_name || profile.email || 'Student',
              student_email: profile.email || null,
              student_user_id: profile.id,
              student_code: generatedStudentCode,
            })
            .select('id')
            .single();

          // Keep student_id pointing at *a* valid students row for backward compatibility
          if (newRow && !profile.student_id) {
            await supabase
              .from('user_profiles')
              .update({ student_id: newRow.id })
              .eq('id', profile.id);
          }
        }
      }

      // Ensure a matching row exists in the `students` table for this account
      if (!profile.student_id) {
        const { data: existingRow } = await supabase
          .from('students')
          .select('id')
          .eq('student_user_id', profile.id)
          .maybeSingle();

        let studentRecordId = existingRow?.id;

        if (!studentRecordId) {
          const generatedStudentCode = `STU-${Math.floor(100000 + Math.random() * 900000)}`;
          const { data: newRow, error: insertError } = await supabase
            .from('students')
            .insert({
              mentor_id: mentorProfile.id,
              name: profile.full_name || profile.email || 'Student',
              student_email: profile.email || null,
              student_user_id: profile.id,
              student_code: generatedStudentCode,
            })
            .select('id')
            .single();

          if (insertError) {
            toast.error('Linked to mentor, but failed to create student record: ' + insertError.message);
          } else {
            studentRecordId = newRow.id;
          }
        } else {
          // Row already existed (e.g. from a previous partial link) — just update mentor_id
          await supabase
            .from('students')
            .update({ mentor_id: mentorProfile.id })
            .eq('id', studentRecordId);
        }

        if (studentRecordId) {
          await supabase
            .from('user_profiles')
            .update({ student_id: studentRecordId })
            .eq('id', profile.id);
        }
      }

      toast.success(`Linked to mentor: ${mentorProfile.full_name}`);
      setMentorCode('');
      onRefresh();
    } finally {
      setSubmittingMentor(false);
    }
  };

  const handleLinkSchool = async () => {
    if (!schoolCode.trim()) return;
    setSubmittingSchool(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      const { data: codeRow, error } = await supabase
        .from('school_invite_codes')
        .select('id, school_id, used_by')
        .eq('invite_code', schoolCode.trim().toUpperCase())
        .single();

      if (error || !codeRow) {
        toast.error('Invalid school code. Please check and try again.');
        return;
      }
      if (codeRow.used_by) {
        toast.error('This school code has already been used.');
        return;
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('user_profiles')
        .update({ school_id: codeRow.school_id })
        .eq('id', user.id)
        .select();

      if (updateError) {
        toast.error('Failed to link school: ' + updateError.message);
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        toast.error('Link failed: no matching profile found. Please contact support.');
        return;
      }

      await supabase
        .from('school_invite_codes')
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq('id', codeRow.id);

      toast.success('Linked to school successfully!');
      setSchoolCode('');
      onRefresh();
    } finally {
      setSubmittingSchool(false);
    }
  };

  const handleLinkCounselor = async () => {
    if (!counselorCode.trim()) return;
    setSubmittingCounselor(true);
    try {
      const { data: codeRow, error } = await supabase
        .from('counselor_mentor_invites')
        .select('id, counselor_id, used_by')
        .eq('invite_code', counselorCode.trim().toUpperCase())
        .single();

      if (error || !codeRow) {
        toast.error('Invalid counselor code. Please check and try again.');
        return;
      }
      if (codeRow.used_by) {
        toast.error('This counselor code has already been used.');
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ counselor_id: codeRow.counselor_id })
        .eq('id', profile.id);

      if (updateError) {
        toast.error('Failed to link counselor: ' + updateError.message);
        return;
      }

      await supabase
        .from('counselor_mentor_invites')
        .update({ used_by: profile.id, used_at: new Date().toISOString() })
        .eq('id', codeRow.id);

      toast.success('Linked to counselor successfully!');
      setCounselorCode('');
      onRefresh();
    } finally {
      setSubmittingCounselor(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <h2 className="text-lg font-700 text-foreground mb-1">Your Connections</h2>
        <p className="text-sm text-muted-foreground mb-5">Enter codes to link yourself to a mentor, school, or counselor.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="AcademicCapIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Linked Mentor{allMentorNames.length > 1 ? 's' : ''}
              </span>
            </div>
            {allMentorNames.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {allMentorNames.map((name, i) => (
                  <p key={i} className="text-sm font-600 text-foreground">{name}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm font-600 text-foreground">
                {profile?.mentor_id ? (mentorName || '✅ Linked') : '— Not linked yet'}
              </p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="BuildingLibraryIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked School</span>
            </div>
            <p className="text-sm font-600 text-foreground">
              {profile?.school_id ? (schoolName || '✅ Linked') : '— Not linked yet'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked Counselor</span>
            </div>
            <p className="text-sm font-600 text-foreground">
              {profile?.counselor_id ? (counselorName || '✅ Linked') : '— Not linked yet'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Enter Mentor Code</label>
            <div className="flex gap-2">
              <input
                className="input-mystic flex-1"
                placeholder="e.g. MTR-ABCD12"
                value={mentorCode}
                onChange={(e) => setMentorCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkMentor()}
              />
              <button
                className="btn-primary px-5"
                onClick={handleLinkMentor}
                disabled={submittingMentor || !mentorCode.trim()}
              >
                {submittingMentor ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="LinkIcon" size={16} />
                )}
                Link
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Enter School Code</label>
            <div className="flex gap-2">
              <input
                className="input-mystic flex-1"
                placeholder="e.g. SCH-XYZ789"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkSchool()}
              />
              <button
                className="btn-primary px-5"
                onClick={handleLinkSchool}
                disabled={submittingSchool || !schoolCode.trim()}
              >
                {submittingSchool ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="LinkIcon" size={16} />
                )}
                Link
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Enter Counselor Code</label>
            <div className="flex gap-2">
              <input
                className="input-mystic flex-1"
                placeholder="e.g. CNS-ABCD12"
                value={counselorCode}
                onChange={(e) => setCounselorCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkCounselor()}
              />
              <button
                className="btn-primary px-5"
                onClick={handleLinkCounselor}
                disabled={submittingCounselor || !counselorCode.trim()}
              >
                {submittingCounselor ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="LinkIcon" size={16} />
                )}
                Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Parent Link Code Section */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Icon name="HomeIcon" size={18} className="text-violet-500" />
          </div>
          <div>
            <h2 className="text-base font-700 text-foreground">Parent Link Code</h2>
            <p className="text-xs text-muted-foreground">Share this code with your parent so they can link to your account.</p>
          </div>
        </div>

        {parentLinkCode ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Your Parent Link Code</p>
              <p className="text-2xl font-800 text-violet-600 font-mono tracking-widest">{parentLinkCode}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your parent enters this during sign-up under the "Parent" role.
              </p>
            </div>
            <button
              onClick={handleCopyParentCode}
              className="btn-ghost text-xs flex-shrink-0"
            >
              <Icon name={copiedParentCode ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={14} className={copiedParentCode ? 'text-positive' : ''} />
              {copiedParentCode ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-xl bg-secondary/60 border border-border text-center">
              <Icon name="HomeIcon" size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No parent link code generated yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Generate one to allow your parent to link their account.</p>
            </div>
            <button
              className="btn-primary self-start"
              onClick={handleGenerateParentCode}
              disabled={generatingParentCode}
            >
              {generatingParentCode ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Generating...</>
              ) : (
                <><Icon name="KeyIcon" size={15} /> Generate Parent Code</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Counselor / School Section ───────────────────────────────────────────────
function CounselorSchoolSection({ profile }: { profile: any }) {
  const supabase = createClient();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Team sheet state — one section per mentor, plus Parents/Counselors sections for a school
  const [sheetGroups, setSheetGroups] = useState<SheetGroup[]>([]);
  const [sheetLoading, setSheetLoading] = useState(true);

  useEffect(() => {
    const loadSheet = async () => {
      setSheetLoading(true);
      try {
        let mentorProfiles: any[] = [];
        let studentTableRows: any[] = [];
        let otherProfiles: any[] = [];

        if (profile?.role === 'counselor') {
          const { data: mentors } = await supabase
            .from('user_profiles')
            .select('id, full_name, codename, role, email')
            .eq('role', 'mentor')
            .eq('counselor_id', profile.id);
          mentorProfiles = mentors || [];

          const mentorIds = mentorProfiles.map((m: any) => m.id);
          if (mentorIds.length > 0) {
            const { data: students } = await supabase
              .from('students')
              .select('id, name, mentor_id, student_user_id')
              .in('mentor_id', mentorIds);
            studentTableRows = students || [];
          }
        } else {
          const { data: people } = await supabase
            .from('user_profiles')
            .select('id, full_name, codename, role, email, mentor_id, counselor_id, linked_student_id')
            .eq('school_id', profile.id);
          otherProfiles = people || [];
          mentorProfiles = otherProfiles.filter((p: any) => p.role === 'mentor');

          const { data: students } = await supabase
            .from('students')
            .select('id, name, mentor_id, student_user_id')
            .eq('school_id', profile.id);
          studentTableRows = students || [];
        }

        const studentUserIds = studentTableRows.map((s: any) => s.student_user_id).filter(Boolean);
        const studentTableIds = studentTableRows.map((s: any) => s.id);

        const [{ data: studentProfiles }, extras] = await Promise.all([
          studentUserIds.length > 0
            ? supabase.from('user_profiles').select('id, codename, email').in('id', studentUserIds)
            : Promise.resolve({ data: [] }),
          fetchStudentExtras(supabase, studentTableIds),
        ]);
        const studentProfileByUserId: Record<string, any> = {};
        (studentProfiles || []).forEach((p: any) => { studentProfileByUserId[p.id] = p; });

        const studentRowFor = (s: any): SheetRow => {
          const linkedProfile = s.student_user_id ? studentProfileByUserId[s.student_user_id] : null;
          const att = extras.attendanceById[s.id];
          return {
            id: s.id,
            name: s.name,
            codename: linkedProfile?.codename || '—',
            role: 'student',
            email: linkedProfile?.email || '—',
            school: '—',
            parentName: extras.parentNamesById[s.id] || '—',
            attendanceRate: att?.rate || '—',
            lastStatus: att?.lastStatus || '—',
            linkedTo: '—',
          };
        };

        // One section per mentor — their own students grouped underneath them.
        const mentorGroups: SheetGroup[] = mentorProfiles.map((m: any) => {
          const theirStudents = studentTableRows.filter((s: any) => s.mentor_id === m.id).map(studentRowFor);
          return {
            key: m.id,
            label: m.full_name || 'Unnamed Mentor',
            sublabel: `Codename: ${m.codename || '—'} · ${m.email || '—'}`,
            rows: theirStudents,
          };
        });

        const extraGroups: SheetGroup[] = [];
        if (profile?.role === 'school') {
          const parentRows: SheetRow[] = otherProfiles
            .filter((p: any) => p.role === 'parent')
            .map((p: any) => {
              const studentRow = studentTableRows.find((s: any) => s.id === p.linked_student_id);
              return {
                id: p.id,
                name: p.full_name || 'Unnamed',
                codename: p.codename || '—',
                role: 'parent',
                email: p.email || '—',
                school: '—',
                parentName: '—',
                attendanceRate: '—',
                lastStatus: '—',
                linkedTo: studentRow ? `Parent of: ${studentRow.name}` : 'Not linked to a student',
              };
            });
          const counselorRows: SheetRow[] = otherProfiles
            .filter((p: any) => p.role === 'counselor')
            .map((p: any) => ({
              id: p.id,
              name: p.full_name || 'Unnamed',
              codename: p.codename || '—',
              role: 'counselor',
              email: p.email || '—',
              school: '—',
              parentName: '—',
              attendanceRate: '—',
              lastStatus: '—',
              linkedTo: '—',
            }));
          extraGroups.push(
            { key: 'parents', label: 'Parents', rows: parentRows },
            { key: 'counselors', label: 'Counselors', rows: counselorRows }
          );
        }

        setSheetGroups([...mentorGroups, ...extraGroups]);
      } catch (err) {
        console.error('[NetworkLinks] Failed to load team sheet:', err);
      }
      setSheetLoading(false);
    };
    loadSheet();
  }, [profile?.id, profile?.role, supabase]);

  const table = profile?.role === 'school' ? 'school_invite_codes' : 'counselor_mentor_invites';
  const idField = profile?.role === 'school' ? 'school_id' : 'counselor_id';

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq(idField, profile.id)
      .order('created_at', { ascending: false });
    setInviteCodes(data || []);
    setLoading(false);
  }, [supabase, table, idField, profile?.id]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      // Check if a code already exists for this user
      const { data: existing } = await supabase
        .from(table)
        .select('invite_code')
        .eq(idField, profile.id)
        .limit(1)
        .maybeSingle();

      if (existing?.invite_code) {
        toast.success(`Your existing code: ${existing.invite_code}`, { duration: 5000 });
        loadCodes();
      } else {
        // Only generate a new code if none exists
        const prefix = profile?.role === 'school' ? 'SCH' : 'CNS';
        const code = `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const { error } = await supabase.from(table).insert({
          [idField]: profile.id,
          invite_code: code,
        });
        if (error) {
          toast.error('Failed to generate code: ' + error.message);
        } else {
          toast.success('Invite code generated!');
          loadCodes();
        }
      }
    } catch {
      toast.error('Failed to get/generate code.');
    }
    setGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Code copied to clipboard!');
  };

  return (
    <div className="space-y-6">
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-700 text-foreground">Your Invite Codes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share these codes with {profile?.role === 'school' ? 'mentors and students' : 'mentors'} to link them to your {profile?.role === 'school' ? 'school' : 'counselor group'}.
          </p>
        </div>
        <button className="btn-primary" onClick={generateCode} disabled={generating}>
          {generating ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="PlusIcon" size={16} />
          )}
          Generate Code
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inviteCodes.length === 0 ? (
        <div className="text-center py-10">
          <Icon name="QrCodeIcon" size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No invite codes yet. Generate your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inviteCodes.map((code) => (
            <div
              key={code.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border ${
                code.used_by ? 'bg-muted/50 border-border opacity-60' : 'bg-secondary border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="KeyIcon" size={14} className="text-primary" />
                </div>
                <div>
                  <p className="font-700 text-foreground font-mono tracking-widest text-sm">{code.invite_code}</p>
                  <p className="text-xs text-muted-foreground">
                    {code.used_by ? '✅ Used' : '⏳ Available'} · {new Date(code.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {!code.used_by && (
                <button
                  onClick={() => copyCode(code.invite_code)}
                  className="btn-ghost text-xs"
                >
                  <Icon name={copied === code.invite_code ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={14} />
                  {copied === code.invite_code ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

      {/* Team Sheet — one section per mentor, plus Parents/Counselors sections for a school */}
      <SectionedSheet
        groups={sheetGroups}
        loading={sheetLoading}
        title="Team Sheet"
        subtitle={
          profile?.role === 'school'
            ? "One section per mentor at your school (with their students underneath), plus separate sections for Parents and Counselors — codenames and live attendance included."
            : "One section per mentor under you, with their students listed underneath — codenames and live attendance included."
        }
        hideRoleColumnInGroups
        emptyMessage="No one linked yet."
      />
    </div>
  );
}

// ─── Mentor Section ───────────────────────────────────────────────────────────
function MentorSection({ profile, onRefresh }: { profile: any; onRefresh: () => void }) {
  const supabase = createClient();
  const [counselorCode, setCounselorCode] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [submittingCounselor, setSubmittingCounselor] = useState(false);
  const [submittingSchool, setSubmittingSchool] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  // Mentor invite code state
  const [mentorInviteCode, setMentorInviteCode] = useState<string | null>(profile?.mentor_code || null);
  const [generatingMentorCode, setGeneratingMentorCode] = useState(false);
  const [copiedMentorCode, setCopiedMentorCode] = useState(false);
  // Student sheet state — codename, parent, and live attendance per student
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(true);

  const loadLinkedStudents = useCallback(async () => {
    setStudentsLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, name, grade, student_user_id')
      .eq('mentor_id', profile.id);
    setLinkedStudents(data || []);
    setStudentsLoading(false);
  }, [supabase, profile?.id]);

  useEffect(() => { loadLinkedStudents(); }, [loadLinkedStudents]);

  const loadStudentSheet = useCallback(async () => {
    setSheetLoading(true);
    try {
      const { data: studentTableRows } = await supabase
        .from('students')
        .select('id, name, student_user_id')
        .eq('mentor_id', profile.id);

      const rows = studentTableRows || [];
      const studentIds = rows.map((s: any) => s.id);
      const userIds = rows.map((s: any) => s.student_user_id).filter(Boolean);

      const [{ data: studentProfiles }, extras] = await Promise.all([
        userIds.length > 0
          ? supabase.from('user_profiles').select('id, codename, email').in('id', userIds)
          : Promise.resolve({ data: [] }),
        fetchStudentExtras(supabase, studentIds),
      ]);

      const profileByUserId: Record<string, any> = {};
      (studentProfiles || []).forEach((p: any) => { profileByUserId[p.id] = p; });

      const builtRows: SheetRow[] = rows.map((s: any) => {
        const linkedProfile = s.student_user_id ? profileByUserId[s.student_user_id] : null;
        const att = extras.attendanceById[s.id];
        const academic = extras.academicById[s.id];
        return {
          id: s.id,
          name: s.name,
          codename: linkedProfile?.codename || '—',
          role: 'student',
          email: linkedProfile?.email || '—',
          school: '—',
          parentName: extras.parentNamesById[s.id] || '—',
          attendanceRate: att?.rate || '—',
          lastStatus: att?.lastStatus || '—',
          linkedTo: linkedProfile ? 'Account linked' : 'No app account yet',
          grade: academic?.grade || '—',
          avgScore: academic?.avgScore || '—',
          sessionsCount: academic?.sessionsCount || '—',
          trend: academic?.trend || '—',
          primaryTopic: academic?.primaryTopic || '—',
        };
      });
      setSheetRows(builtRows);
    } catch (err) {
      console.error('[NetworkLinks] Failed to load student sheet:', err);
    }
    setSheetLoading(false);
  }, [supabase, profile?.id]);

  useEffect(() => { loadStudentSheet(); }, [loadStudentSheet]);

  const handleGenerateMentorCode = async () => {
    if (mentorInviteCode) {
      const confirmed = window.confirm(
        "This will invalidate your current code. Anyone who hasn't linked yet using it won't be able to. Continue?"
      );
      if (!confirmed) return;
    }
    setGeneratingMentorCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate_mentor' }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed to generate code'); return; }
      setMentorInviteCode(json.code);
      toast.success('New mentor invite code generated!');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Error generating code');
    } finally {
      setGeneratingMentorCode(false);
    }
  };

  const handleCopyMentorCode = () => {
    if (!mentorInviteCode) return;
    navigator.clipboard?.writeText(mentorInviteCode);
    setCopiedMentorCode(true);
    setTimeout(() => setCopiedMentorCode(false), 2000);
    toast.success('Invite code copied!');
  };

  const handleLinkCounselor = async () => {
    if (!counselorCode.trim()) return;
    setSubmittingCounselor(true);
    try {
      const { data: codeRow, error } = await supabase
        .from('counselor_mentor_invites')
        .select('id, counselor_id, used_by')
        .eq('invite_code', counselorCode.trim().toUpperCase())
        .single();

      if (error || !codeRow) {
        toast.error('Invalid counselor code.');
        return;
      }
      if (codeRow.used_by) {
        toast.error('This code has already been used.');
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ counselor_id: codeRow.counselor_id })
        .eq('id', profile.id);

      if (updateError) {
        toast.error('Failed to link counselor: ' + updateError.message);
        return;
      }

      await supabase
        .from('counselor_mentor_invites')
        .update({ used_by: profile.id, used_at: new Date().toISOString() })
        .eq('id', codeRow.id);

      toast.success('Linked to counselor successfully!');
      setCounselorCode('');
      onRefresh();
    } finally {
      setSubmittingCounselor(false);
    }
  };

  const handleLinkSchool = async () => {
    if (!schoolCode.trim()) return;
    setSubmittingSchool(true);
    try {
      const { data: codeRow, error } = await supabase
        .from('school_invite_codes')
        .select('id, school_id, used_by')
        .eq('invite_code', schoolCode.trim().toUpperCase())
        .single();

      if (error || !codeRow) {
        toast.error('Invalid school code.');
        return;
      }
      if (codeRow.used_by) {
        toast.error('This code has already been used.');
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ school_id: codeRow.school_id })
        .eq('id', profile.id);

      if (updateError) {
        toast.error('Failed to link school: ' + updateError.message);
        return;
      }

      await supabase
        .from('school_invite_codes')
        .update({ used_by: profile.id, used_at: new Date().toISOString() })
        .eq('id', codeRow.id);

      toast.success('Linked to school successfully!');
      setSchoolCode('');
      onRefresh();
    } finally {
      setSubmittingSchool(false);
    }
  };

  const handleUnlinkStudent = async (studentId: string, studentName: string) => {
    setUnlinking(studentId);
    try {
      const { data: studentRow } = await supabase
        .from('students')
        .select('student_user_id')
        .eq('id', studentId)
        .maybeSingle();

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)
        .eq('mentor_id', profile.id);

      if (error) {
        toast.error('Failed to unlink student: ' + error.message);
      } else {
        if (studentRow?.student_user_id) {
          await supabase
            .from('student_mentor_links')
            .delete()
            .eq('student_user_id', studentRow.student_user_id)
            .eq('mentor_id', profile.id);
        }
        toast.success(`${studentName} removed from your roster.`);
        setLinkedStudents((prev) => prev.filter((s) => s.id !== studentId));
      }
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mentor Invite Code */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-700 text-foreground">Your Mentor Invite Code</h2>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="KeyIcon" size={17} className="text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Share this 8-character code with students so they can link to you during sign-up.
        </p>
        {mentorInviteCode ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <span className="font-mono text-xl font-800 text-primary tracking-widest flex-1">
              {mentorInviteCode}
            </span>
            <button
              type="button"
              onClick={handleCopyMentorCode}
              className="btn-ghost text-xs gap-1.5"
            >
              <Icon name={copiedMentorCode ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={14} />
              {copiedMentorCode ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleGenerateMentorCode}
              disabled={generatingMentorCode}
              className="btn-ghost text-xs gap-1.5"
              title="Generate a new code (invalidates the old one)"
            >
              <Icon name="ArrowPathIcon" size={14} className={generatingMentorCode ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerateMentorCode}
            disabled={generatingMentorCode}
            className="btn-primary"
          >
            {generatingMentorCode ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Generating…</>
            ) : (
              <><Icon name="KeyIcon" size={16} /> Generate Invite Code</>
            )}
          </button>
        )}
      </div>

      {/* Link Codes */}
      <div className="card-elevated p-6">
        <h2 className="text-lg font-700 text-foreground mb-1">Link to Organization</h2>
        <p className="text-sm text-muted-foreground mb-5">Enter codes to connect with a counselor or school.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked Counselor</span>
            </div>
            <p className="text-sm font-600 text-foreground">
              {profile?.counselor_id ? '✅ Linked' : '— Not linked yet'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="BuildingLibraryIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked School</span>
            </div>
            <p className="text-sm font-600 text-foreground">
              {profile?.school_id ? '✅ Linked' : '— Not linked yet'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Enter Counselor Code</label>
            <div className="flex gap-2">
              <input
                className="input-mystic flex-1"
                placeholder="e.g. CNS-ABCD12"
                value={counselorCode}
                onChange={(e) => setCounselorCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkCounselor()}
              />
              <button
                className="btn-primary px-5"
                onClick={handleLinkCounselor}
                disabled={submittingCounselor || !counselorCode.trim()}
              >
                {submittingCounselor ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="LinkIcon" size={16} />
                )}
                Link
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Enter School Code</label>
            <div className="flex gap-2">
              <input
                className="input-mystic flex-1"
                placeholder="e.g. SCH-XYZ789"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkSchool()}
              />
              <button
                className="btn-primary px-5"
                onClick={handleLinkSchool}
                disabled={submittingSchool || !schoolCode.trim()}
              >
                {submittingSchool ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="LinkIcon" size={16} />
                )}
                Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student Roster */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-700 text-foreground">Linked Student Roster</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {linkedStudents.length} student{linkedStudents.length !== 1 ? 's' : ''} currently linked to you
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="UserGroupIcon" size={18} className="text-primary" />
          </div>
        </div>

        {studentsLoading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : linkedStudents.length === 0 ? (
          <div className="text-center py-10">
            <Icon name="UserGroupIcon" size={36} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No students linked yet. Students can link to you using your mentor code.</p>
            {profile?.mentor_code && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                <Icon name="KeyIcon" size={14} className="text-primary" />
                <span className="text-sm font-700 text-primary font-mono tracking-widest">{profile.mentor_code}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {linkedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-secondary border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-700 text-primary">
                      {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-600 text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">Grade {student.grade}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnlinkStudent(student.id, student.name)}
                  disabled={unlinking === student.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 text-negative bg-negative/10 hover:bg-negative/20 transition-colors border border-negative/20"
                >
                  {unlinking === student.id ? (
                    <span className="w-3 h-3 border border-negative border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="UserMinusIcon" size={13} />
                  )}
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Sheet — codename, parent, academics, and live attendance, always current */}
      <RelationshipSheet
        rows={sheetRows}
        loading={sheetLoading}
        title="Student Sheet"
        subtitle="Every student on your roster with their codename, parent, grade, scores, and attendance — updates automatically as attendance is marked."
        roleOptions={[]}
        emptyMessage="No students linked yet."
        showAcademicColumns
        hideRoleColumn
        hideSchoolColumn
      />
    </div>
  );
}

// ─── Shared: relationship sheet row + data helpers ─────────────────────────────
interface SheetRow {
  id: string;
  name: string;
  codename: string;
  role: string;
  email: string;
  school: string;
  parentName: string;
  attendanceRate: string;
  lastStatus: string;
  linkedTo: string;
  grade?: string;
  avgScore?: string;
  sessionsCount?: string;
  trend?: string;
  primaryTopic?: string;
}

interface SheetGroup {
  key: string;
  label: string;
  sublabel?: string;
  rows: SheetRow[];
}

// Given a list of `students` table ids, returns each student's parent name(s)
// (via students.parent_ids -> user_profiles.full_name), their live attendance
// summary, and their academic snapshot (grade, average score, sessions, trend,
// primary topic) — all keyed by the students.id.
async function fetchStudentExtras(supabase: any, studentIds: string[]) {
  const parentNamesById: Record<string, string> = {};
  const attendanceById: Record<string, { rate: string; lastStatus: string }> = {};
  const academicById: Record<string, { grade: string; avgScore: string; sessionsCount: string; trend: string; primaryTopic: string }> = {};
  if (studentIds.length === 0) return { parentNamesById, attendanceById, academicById };

  const [{ data: studentRows }, { data: attRows }] = await Promise.all([
    supabase.from('students').select('id, parent_ids, grade, avg_score, sessions, trend, primary_topic').in('id', studentIds),
    supabase
      .from('attendance')
      .select('student_id, status, attendance_date')
      .in('student_id', studentIds)
      .order('attendance_date', { ascending: false }),
  ]);

  const allParentIds: string[] = Array.from(
    new Set((studentRows || []).flatMap((s: any) => s.parent_ids || []))
  );
  const parentNameById: Record<string, string> = {};
  if (allParentIds.length > 0) {
    const { data: parentProfiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', allParentIds);
    (parentProfiles || []).forEach((p: any) => { parentNameById[p.id] = p.full_name || 'Unnamed'; });
  }
  (studentRows || []).forEach((s: any) => {
    const names = (s.parent_ids || []).map((pid: string) => parentNameById[pid]).filter(Boolean);
    parentNamesById[s.id] = names.length > 0 ? names.join(', ') : '—';
    academicById[s.id] = {
      grade: s.grade != null && s.grade !== '' ? String(s.grade) : '—',
      avgScore: s.avg_score != null ? String(s.avg_score) : '—',
      sessionsCount: s.sessions != null ? String(s.sessions) : '—',
      trend: s.trend || '—',
      primaryTopic: s.primary_topic || '—',
    };
  });

  studentIds.forEach((id) => {
    const records = (attRows || []).filter((a: any) => a.student_id === id);
    if (records.length === 0) {
      attendanceById[id] = { rate: '—', lastStatus: '—' };
    } else {
      const presentCount = records.filter((r: any) => r.status === 'present').length;
      const rate = Math.round((presentCount / records.length) * 100);
      const latest = records[0];
      attendanceById[id] = {
        rate: `${rate}% (${presentCount}/${records.length})`,
        lastStatus: latest.status === 'present' ? 'Present' : latest.status === 'absent' ? 'Absent' : (latest.status || '—'),
      };
    }
  });

  return { parentNamesById, attendanceById, academicById };
}

const SHEET_ROLE_BADGE: Record<string, string> = {
  mentor: 'bg-primary/10 text-primary border-primary/20',
  student: 'bg-sky-50 text-sky-700 border-sky-200',
  parent: 'bg-violet-50 text-violet-700 border-violet-200',
  counselor: 'bg-amber-50 text-amber-700 border-amber-200',
  school: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ─── Shared: the actual <table> — reused by both the flat and sectioned sheets ─
function SheetTable({
  rows,
  showAcademicColumns = false,
  hideRoleColumn = false,
  hideSchoolColumn = false,
}: {
  rows: SheetRow[];
  showAcademicColumns?: boolean;
  hideRoleColumn?: boolean;
  hideSchoolColumn?: boolean;
}) {
  const roleBadgeClass = (role: string) => SHEET_ROLE_BADGE[role] || 'bg-secondary text-muted-foreground border-border';
  const statusBadgeClass = (status: string) => {
    if (status === 'Present') return 'bg-positive/10 text-positive border-positive/20';
    if (status === 'Absent') return 'bg-negative/10 text-negative border-negative/20';
    return 'bg-secondary text-muted-foreground border-border';
  };
  const th = "text-left font-600 text-xs text-muted-foreground uppercase tracking-wide px-4 py-3";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/60 border-b border-border">
            <th className={th}>Name</th>
            <th className={th}>Codename</th>
            {!hideRoleColumn && <th className={th}>Role</th>}
            {showAcademicColumns && <th className={th}>Grade</th>}
            {showAcademicColumns && <th className={th}>Avg Score</th>}
            {showAcademicColumns && <th className={th}>Sessions</th>}
            {showAcademicColumns && <th className={th}>Trend</th>}
            {showAcademicColumns && <th className={th}>Primary Topic</th>}
            <th className={th}>Parent</th>
            <th className={th}>Attendance</th>
            <th className={th}>Email</th>
            {!hideSchoolColumn && <th className={th}>School</th>}
            <th className={th}>Linked To</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
              <td className="px-4 py-3 font-600 text-foreground whitespace-nowrap">{r.name}</td>
              <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.codename}</td>
              {!hideRoleColumn && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-xs font-600 px-2 py-0.5 rounded-full border capitalize ${roleBadgeClass(r.role)}`}>
                    {r.role}
                  </span>
                </td>
              )}
              {showAcademicColumns && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.grade || '—'}</td>}
              {showAcademicColumns && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.avgScore || '—'}</td>}
              {showAcademicColumns && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.sessionsCount || '—'}</td>}
              {showAcademicColumns && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.trend || '—'}</td>}
              {showAcademicColumns && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.primaryTopic || '—'}</td>}
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.parentName}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {r.lastStatus !== '—' ? (
                  <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${statusBadgeClass(r.lastStatus)}`}>
                    {r.lastStatus}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
                {r.attendanceRate !== '—' && (
                  <span className="text-xs text-muted-foreground ml-1.5">{r.attendanceRate}</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.email}</td>
              {!hideSchoolColumn && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.school}</td>}
              <td className="px-4 py-3 text-foreground/80">{r.linkedTo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared: flat searchable/filterable relationship sheet ─────────────────────
function RelationshipSheet({
  rows,
  loading,
  title,
  subtitle,
  roleOptions,
  emptyMessage,
  showAcademicColumns = false,
  hideRoleColumn = false,
  hideSchoolColumn = false,
}: {
  rows: SheetRow[];
  loading: boolean;
  title: string;
  subtitle: string;
  roleOptions: { value: string; label: string }[];
  emptyMessage: string;
  showAcademicColumns?: boolean;
  hideRoleColumn?: boolean;
  hideSchoolColumn?: boolean;
}) {
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredRows = rows.filter((r) => {
    if (roleFilter !== 'all' && r.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.codename.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.parentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-700 text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{filteredRows.length} of {rows.length}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input-mystic flex-1"
          placeholder="Search by name, codename, email, or parent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {roleOptions.length > 1 && (
          <select
            className="input-mystic sm:w-48"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{emptyMessage}</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <SheetTable
            rows={filteredRows}
            showAcademicColumns={showAcademicColumns}
            hideRoleColumn={hideRoleColumn}
            hideSchoolColumn={hideSchoolColumn}
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared: grouped-into-sections relationship sheet ──────────────────────────
function SectionedSheet({
  groups,
  loading,
  title,
  subtitle,
  emptyMessage,
  showAcademicColumns = false,
  hideRoleColumnInGroups = false,
}: {
  groups: SheetGroup[];
  loading: boolean;
  title: string;
  subtitle: string;
  emptyMessage: string;
  showAcademicColumns?: boolean;
  hideRoleColumnInGroups?: boolean;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const matches = (r: SheetRow) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    r.codename.toLowerCase().includes(q) ||
    r.email.toLowerCase().includes(q) ||
    r.parentName.toLowerCase().includes(q);

  const filteredGroups = groups
    .map((g) => ({ ...g, rows: g.rows.filter(matches) }))
    .filter((g) => !q || g.rows.length > 0);

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-700 text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{groups.length} section{groups.length === 1 ? '' : 's'} · {totalRows} total</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

      <input
        className="input-mystic w-full mb-5"
        placeholder="Search by name, codename, email, or parent..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {filteredGroups.map((g) => (
            <div key={g.key} className="rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary/60 px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="font-700 text-foreground text-sm">{g.label}</p>
                  {g.sublabel && <p className="text-xs text-muted-foreground mt-0.5">{g.sublabel}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{g.rows.length}</span>
              </div>
              {g.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nothing here yet.</p>
              ) : (
                <SheetTable
                  rows={g.rows}
                  showAcademicColumns={showAcademicColumns}
                  hideRoleColumn={hideRoleColumnInGroups}
                  hideSchoolColumn
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin Section — master relationship directory, grouped by school ─────────
function AdminSection({ profile }: { profile: any }) {
  const supabase = createClient();
  const [groups, setGroups] = useState<SheetGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: linkRows } = await supabase
          .from('admin_school_links')
          .select('school_id')
          .eq('admin_id', profile.id);

        const schoolIds = (linkRows || []).map((r: any) => r.school_id);
        if (schoolIds.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, codename, role, email, school_id, mentor_id, counselor_id, linked_student_id')
          .in('school_id', schoolIds);

        const { data: schoolProfiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, codename, role, email, school_id, mentor_id, counselor_id, linked_student_id')
          .in('id', schoolIds);

        const { data: studentTableRows } = await supabase
          .from('students')
          .select('id, name, mentor_id, student_user_id')
          .in('school_id', schoolIds);

        const allProfiles = [...(profiles || []), ...(schoolProfiles || [])];
        const profileById: Record<string, any> = {};
        allProfiles.forEach((p: any) => { profileById[p.id] = p; });

        const studentRowById: Record<string, any> = {};
        const studentRowByUserId: Record<string, any> = {};
        (studentTableRows || []).forEach((s: any) => {
          studentRowById[s.id] = s;
          if (s.student_user_id) studentRowByUserId[s.student_user_id] = s;
        });

        const studentTableIds = (studentTableRows || []).map((s: any) => s.id);
        const { parentNamesById, attendanceById } = await fetchStudentExtras(supabase, studentTableIds);

        const studentCountByMentorId: Record<string, number> = {};
        const mentorNamesByCounselorId: Record<string, string[]> = {};
        allProfiles.forEach((p: any) => {
          if (p.role === 'student' && p.mentor_id) {
            studentCountByMentorId[p.mentor_id] = (studentCountByMentorId[p.mentor_id] || 0) + 1;
          }
          if (p.role === 'mentor' && p.counselor_id) {
            const list = mentorNamesByCounselorId[p.counselor_id] || [];
            list.push(p.full_name || 'Unnamed mentor');
            mentorNamesByCounselorId[p.counselor_id] = list;
          }
        });

        const nameOf = (id: string | null) => (id && profileById[id]) ? (profileById[id].full_name || 'Unnamed') : null;

        const describeLinks = (p: any): string => {
          if (p.role === 'mentor') {
            const counselorName = nameOf(p.counselor_id);
            const studentCount = studentCountByMentorId[p.id] || 0;
            return `${studentCount} student${studentCount === 1 ? '' : 's'}${counselorName ? ` · Counselor: ${counselorName}` : ''}`;
          }
          if (p.role === 'student') {
            const mentorName = nameOf(p.mentor_id);
            return mentorName ? `Mentor: ${mentorName}` : 'No mentor linked';
          }
          if (p.role === 'parent') {
            const studentRow = p.linked_student_id ? studentRowById[p.linked_student_id] : null;
            return studentRow ? `Parent of: ${studentRow.name}` : 'Not linked to a student';
          }
          if (p.role === 'counselor') {
            const mentors = mentorNamesByCounselorId[p.id] || [];
            return mentors.length > 0 ? `Oversees: ${mentors.join(', ')}` : 'No mentors linked yet';
          }
          return '—';
        };

        const rowFor = (p: any): SheetRow => {
          const studentRow = p.role === 'student' ? studentRowByUserId[p.id] : null;
          const parentName = p.role === 'student' && studentRow ? (parentNamesById[studentRow.id] || '—') : '—';
          const att = p.role === 'student' && studentRow ? attendanceById[studentRow.id] : null;
          return {
            id: p.id,
            name: p.full_name || 'Unnamed',
            codename: p.codename || '—',
            role: p.role,
            email: p.email || '—',
            school: '—',
            parentName,
            attendanceRate: att?.rate || '—',
            lastStatus: att?.lastStatus || '—',
            linkedTo: describeLinks(p),
          };
        };

        // One section per linked school — everyone who belongs to that school lives inside it.
        const builtGroups: SheetGroup[] = schoolIds.map((schoolId: string) => {
          const schoolProfile = profileById[schoolId];
          const memberRows = allProfiles
            .filter((p: any) => p.role !== 'admin' && p.role !== 'school' && p.school_id === schoolId)
            .map(rowFor)
            .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
          return {
            key: schoolId,
            label: schoolProfile?.full_name || 'Unnamed School',
            sublabel: schoolProfile?.email ? `Contact: ${schoolProfile.email}` : undefined,
            rows: memberRows,
          };
        });

        setGroups(builtGroups);
      } catch (err) {
        console.error('[NetworkLinks] Failed to load admin directory:', err);
        toast.error('Failed to load the directory.');
      }
      setLoading(false);
    };
    load();
  }, [profile.id, supabase]);

  return (
    <SectionedSheet
      groups={groups}
      loading={loading}
      title="Directory"
      subtitle="One section per linked school — mentors, students, parents, and counselors at each, with who's connected to whom and their live attendance."
      emptyMessage="No schools linked yet. Link a school from your Admin Dashboard to see it here."
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NetworkLinksContent() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-700 text-foreground">Network &amp; Links</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your connections and organizational links.
        </p>
      </div>

      {profile.role === 'student' && (
        <StudentSection profile={profile} onRefresh={refreshProfile} />
      )}

      {profile.role === 'mentor' && (
        <MentorSection profile={profile} onRefresh={refreshProfile} />
      )}

      {(profile.role === 'counselor' || profile.role === 'school') && (
        <CounselorSchoolSection profile={profile} />
      )}

      {profile.role === 'admin' && (
        <AdminSection profile={profile} />
      )}
    </div>
  );
}
