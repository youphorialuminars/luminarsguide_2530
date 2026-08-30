import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(
    url,
    key,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}

// POST /api/register — register a new user and create their profile
// This is a server-side fallback for profile creation, used only if the
// database trigger that normally does this on sign-up did not fire.
// SECURITY: the caller must be logged in, and may only create/update THEIR
// OWN profile (user_id must match the authenticated user's id). Any link to
// a mentor, counselor, school, or parent-linked student is resolved here
// ONLY from a real, unused invite code — never trusted directly from the
// request body — matching the same rule the database trigger enforces.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase(token);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      user_id,
      email,
      full_name,
      role,
      mentor_code,
      inviteCode,
      parentLinkCode,
      counselorInviteCode,
      schoolInviteCode,
    } = body;

    if (!user_id || !email || !role) {
      return NextResponse.json({ error: 'user_id, email, and role are required' }, { status: 400 });
    }

    if (user_id !== user.id) {
      return NextResponse.json({ error: 'You may only create or update your own profile.' }, { status: 403 });
    }

    // Every link below is resolved from its code — never from a client-supplied id.
    let mentorId: string | null = null;
    if (inviteCode) {
      const { data: mentorRow } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('mentor_code', String(inviteCode).trim().toUpperCase())
        .eq('role', 'mentor')
        .maybeSingle();
      mentorId = mentorRow?.id || null;
    }

    let linkedStudentId: string | null = null;
    if (parentLinkCode) {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('parent_link_code', String(parentLinkCode).trim().toUpperCase())
        .maybeSingle();
      linkedStudentId = studentRow?.id || null;
    }

    let counselorId: string | null = null;
    if (counselorInviteCode) {
      const { data: codeRow } = await supabase
        .from('counselor_mentor_invites')
        .select('counselor_id, used_by')
        .eq('invite_code', String(counselorInviteCode).trim().toUpperCase())
        .maybeSingle();
      if (codeRow && !codeRow.used_by) counselorId = codeRow.counselor_id;
    }

    let schoolId: string | null = null;
    if (schoolInviteCode) {
      const { data: codeRow } = await supabase
        .from('school_invite_codes')
        .select('school_id, used_by')
        .eq('invite_code', String(schoolInviteCode).trim().toUpperCase())
        .maybeSingle();
      if (codeRow && !codeRow.used_by) schoolId = codeRow.school_id;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user_id,
          email,
          full_name: full_name || '',
          role,
          mentor_code: mentor_code || null,
          mentor_id: mentorId,
          linked_student_id: linkedStudentId,
          counselor_id: counselorId,
          school_id: schoolId,
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role')
      .single();

    if (error) {
      console.error('[API /register] Supabase upsert error:', error.message, 'Code:', error.code);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    if (counselorId && counselorInviteCode) {
      await supabase
        .from('counselor_mentor_invites')
        .update({ used_by: user_id })
        .eq('invite_code', String(counselorInviteCode).trim().toUpperCase());
    }
    if (schoolId && schoolInviteCode) {
      await supabase
        .from('school_invite_codes')
        .update({ used_by: user_id, used_at: new Date().toISOString() })
        .eq('invite_code', String(schoolInviteCode).trim().toUpperCase());
    }

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (err: any) {
    console.error('[API /register] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}