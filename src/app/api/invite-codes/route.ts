import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/invite-codes
 * Body: { action: 'generate_mentor' | 'generate_student_link' | 'generate_school' | 'redeem_parent', ...params }
 *
 * Requires Authorization: Bearer <access_token> header.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token and get the user
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'generate_mentor') {
      // Generate / refresh mentor invite code
      const { data, error } = await supabaseAdmin.rpc('generate_mentor_invite_code', {
        p_mentor_id: user.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ code: data });
    }

    if (action === 'generate_student_link') {
      const { studentId } = body;
      if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

      const { data, error } = await supabaseAdmin.rpc('generate_student_parent_link_code', {
        p_student_id: studentId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ code: data });
    }

    if (action === 'generate_school') {
      const { data, error } = await supabaseAdmin.rpc('generate_school_invite_code', {
        p_school_id: user.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ code: data });
    }

    if (action === 'redeem_parent') {
      const { linkCode } = body;
      if (!linkCode) return NextResponse.json({ error: 'linkCode required' }, { status: 400 });

      const { data, error } = await supabaseAdmin.rpc('redeem_parent_link_code', {
        p_parent_id: user.id,
        p_link_code: linkCode,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ studentId: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[invite-codes API]', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/invite-codes?role=mentor|school
 * Returns the current invite code(s) for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = req.nextUrl.searchParams.get('role');

    if (role === 'mentor') {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('mentor_code')
        .eq('id', user.id)
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ code: data?.mentor_code });
    }

    if (role === 'school') {
      const { data, error } = await supabaseAdmin
        .from('school_invite_codes')
        .select('invite_code, created_at, used_by')
        .eq('school_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ codes: data });
    }

    return NextResponse.json({ error: 'role param required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
