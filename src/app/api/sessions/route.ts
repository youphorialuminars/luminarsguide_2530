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

// GET /api/sessions — fetch sessions for a student or mentor
// SECURITY: caller must be logged in. mentor_id must be the caller's own id;
// if student_id is used instead, we verify that student actually belongs to
// the caller before returning anything.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, supabase } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id');
    const mentorId = searchParams.get('mentor_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!studentId && !mentorId) {
      return NextResponse.json({ error: 'student_id or mentor_id is required' }, { status: 400 });
    }

    if (mentorId && mentorId !== user.id) {
      return NextResponse.json({ error: 'You may only view your own sessions.' }, { status: 403 });
    }

    if (studentId) {
      const { data: studentRow } = await supabase
        .from('students')
        .select('mentor_id')
        .eq('id', studentId)
        .maybeSingle();
      if (!studentRow || studentRow.mentor_id !== user.id) {
        return NextResponse.json({ error: 'You may only view sessions for your own students.' }, { status: 403 });
      }
    }

    let query = supabase
      .from('sessions')
      .select('id, mentor_id, student_id, topic, score, session_date, strengths, weaknesses, approach, tasks, model, obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (mentorId) {
      query = query.eq('mentor_id', mentorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API /sessions GET] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error('[API /sessions GET] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sessions — create a new session record (after AI analysis)
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
      student_id,
      topic,
      score,
      session_date,
      obs_offline_class,
      obs_online_task,
      obs_group_task,
      obs_mentor_call,
      obs_comprehensive,
      strengths,
      weaknesses,
      approach,
      tasks,
      model,
    } = body;

    if (!mentor_id || !student_id || !topic) {
      return NextResponse.json({ error: 'mentor_id, student_id, and topic are required' }, { status: 400 });
    }
    if (mentor_id !== user.id) {
      return NextResponse.json({ error: 'You may only create sessions under your own account.' }, { status: 403 });
    }

    const observations = [obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive]
      .filter(Boolean)
      .join('\n\n');

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        mentor_id,
        student_id,
        topic,
        score: score || 0,
        session_date: session_date || new Date().toISOString().split('T')[0],
        obs_offline_class: obs_offline_class || '',
        obs_online_task: obs_online_task || '',
        obs_group_task: obs_group_task || '',
        obs_mentor_call: obs_mentor_call || '',
        obs_comprehensive: obs_comprehensive || '',
        observations,
        strengths: strengths || [],
        weaknesses: weaknesses || [],
        approach: approach || [],
        tasks: tasks || [],
        model: model || 'Gemini',
      })
      .select('id, topic, score, session_date, strengths, weaknesses, approach, tasks, model, created_at')
      .single();

    if (error) {
      console.error('[API /sessions POST] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (err: any) {
    console.error('[API /sessions POST] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}