import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, token
    ? { global: { headers: { Authorization: `Bearer ${token}` } } }
    : undefined);
}

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  const supabase = getServerSupabase(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { user, supabase };
}

// GET /api/students — fetch students for the authenticated mentor
// SECURITY: mentor_id must match the logged-in caller — a mentor can only see
// their own roster this way, never anyone else's.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, supabase } = auth;

    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentor_id');

    if (!mentorId) {
      return NextResponse.json({ error: 'mentor_id is required' }, { status: 400 });
    }
    if (mentorId !== user.id) {
      return NextResponse.json({ error: 'You may only view your own students.' }, { status: 403 });
    }

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
// SECURITY: mentor_id must match the logged-in caller.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, supabase } = auth;

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
    if (mentor_id !== user.id) {
      return NextResponse.json({ error: 'You may only add students to your own roster.' }, { status: 403 });
    }

    const student_code = `STU-${Date.now().toString(36).toUpperCase()}`;
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