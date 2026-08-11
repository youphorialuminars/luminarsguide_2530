import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// POST /api/register — register a new user and create their profile
// This is a server-side fallback for profile creation if the DB trigger fails.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      email,
      full_name,
      role,
      mentor_id,
      student_id,
      linked_student_id,
      counselor_id,
      school_id,
      mentor_code,
    } = body;

    if (!user_id || !email || !role) {
      return NextResponse.json({ error: 'user_id, email, and role are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Upsert the user profile — safe to call even if trigger already created it
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user_id,
          email,
          full_name: full_name || '',
          role,
          mentor_id: mentor_id || null,
          student_id: student_id || null,
          linked_student_id: linked_student_id || null,
          counselor_id: counselor_id || null,
          school_id: school_id || null,
          mentor_code: mentor_code || null,
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

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (err: any) {
    console.error('[API /register] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
