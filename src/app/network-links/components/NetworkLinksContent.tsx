'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

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

// ─── Student Section ──────────────────────────────────────────────────────────
function StudentSection({ profile, onRefresh }: { profile: any; onRefresh: () => void }) {
  const supabase = createClient();
  const [mentorCode, setMentorCode] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [submittingMentor, setSubmittingMentor] = useState(false);
  const [submittingSchool, setSubmittingSchool] = useState(false);

  const handleLinkMentor = async () => {
    if (!mentorCode.trim()) return;
    setSubmittingMentor(true);
    try {
      // Find mentor by mentor_code
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

      // Update student's profile with mentor_id
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ mentor_id: mentorProfile.id })
        .eq('id', profile.id);

      if (updateError) {
        toast.error('Failed to link mentor: ' + updateError.message);
      } else {
        toast.success(`Linked to mentor: ${mentorProfile.full_name}`);
        setMentorCode('');
        onRefresh();
      }
    } finally {
      setSubmittingMentor(false);
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
        toast.error('Invalid school code. Please check and try again.');
        return;
      }
      if (codeRow.used_by) {
        toast.error('This school code has already been used.');
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

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <h2 className="text-lg font-700 text-foreground mb-1">Your Connections</h2>
        <p className="text-sm text-muted-foreground mb-5">Enter codes to link yourself to a mentor or school.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="AcademicCapIcon" size={16} className="text-primary" />
              <span className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked Mentor</span>
            </div>
            <p className="text-sm font-600 text-foreground">
              {profile?.mentor_id ? '✅ Linked' : '— Not linked yet'}
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
        </div>
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
      const { error } = await supabase
        .from('students')
        .update({ mentor_id: null })
        .eq('id', studentId);

      if (error) {
        toast.error('Failed to unlink student: ' + error.message);
      } else {
        toast.success(`${studentName} removed from your roster.`);
        setLinkedStudents((prev) => prev.filter((s) => s.id !== studentId));
      }
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NetworkLinksContent() {
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
      <Toaster position="top-right" />

      <div className="mb-6">
        <h1 className="text-2xl font-700 text-foreground">Network &amp; Links</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your connections and organizational links.
        </p>
      </div>

      {profile.role === 'student_parent' && (
        <StudentSection profile={profile} onRefresh={refreshProfile} />
      )}

      {profile.role === 'mentor' && (
        <MentorSection profile={profile} onRefresh={refreshProfile} />
      )}

      {(profile.role === 'counselor' || profile.role === 'school') && (
        <CounselorSchoolSection profile={profile} />
      )}
    </div>
  );
}
