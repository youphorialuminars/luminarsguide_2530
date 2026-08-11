import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role for API routes
function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// GET /api/students — fetch students for the authenticated mentor
// Accepts: ?mentor_id=<uuid>  (passed from client after auth.getUser())
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentor_id');

    if (!mentorId) {
      return NextResponse.json({ error: 'mentor_id is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('students')
      .select('id, name, grade, age, gender, avg_score, sessions, last_session, topics, trend, alert_level, notes, avatar')
      .eq('mentor_id', mentorId)
      .order('name');

    if (error) {
      console.error('[API /students] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ students: data || [] });
  } catch (err: any) {
    console.error('[API /students] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/students — create a new student record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mentor_id,
      name,
      grade,
      age,
      gender,
      notes,
      primary_topic,
      school_id,
      counselor_id,
    } = body;

    if (!mentor_id || !name) {
      return NextResponse.json({ error: 'mentor_id and name are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Generate a unique student code
    const student_code = `STU-${Date.now().toString(36).toUpperCase()}`;
    // Generate a parent link code
    const parent_link_code = `PLK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data, error } = await supabase
      .from('students')
      .insert({
        mentor_id,
        name,
        grade: grade || '',
        age: age || null,
        gender: gender || null,
        notes: notes || '',
        primary_topic: primary_topic || '',
        student_code,
        parent_link_code,
        avatar: '',
        avg_score: 0,
        sessions: 0,
        topics: [],
        trend: 'stable',
        school_id: school_id || null,
        counselor_id: counselor_id || null,
      })
      .select('id, name, grade, age, gender, avg_score, sessions, last_session, topics, trend, alert_level, notes, avatar, student_code, parent_link_code')
      .single();

    if (error) {
      console.error('[API /students POST] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ student: data }, { status: 201 });
  } catch (err: any) {
    console.error('[API /students POST] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
