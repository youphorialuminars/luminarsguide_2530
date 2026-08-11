-- Migration: School Role, School Invite Codes, and RLS Policies
-- Timestamp: 20260805240000

-- ============================================================
-- Add school_id column to user_profiles
-- ============================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- Create school_invite_codes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.school_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  used_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Helper function: check if current user is a school
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_school()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'school'
  )
$$;

-- ============================================================
-- Helper function: get mentor IDs linked to current school
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_school_mentor_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.user_profiles
  WHERE school_id = auth.uid() AND role = 'mentor'
$$;

-- ============================================================
-- Helper function: get student IDs linked to current school
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_school_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id FROM public.students s
  WHERE s.mentor_id IN (
    SELECT id FROM public.user_profiles WHERE school_id = auth.uid() AND role = 'mentor'
  )
  UNION
  SELECT id FROM public.user_profiles
  WHERE school_id = auth.uid() AND role = 'student'
$$;

-- ============================================================
-- RLS: school_invite_codes — schools manage their own codes
-- ============================================================
ALTER TABLE public.school_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_manage_own_invite_codes" ON public.school_invite_codes;
CREATE POLICY "schools_manage_own_invite_codes"
ON public.school_invite_codes
FOR ALL
TO authenticated
USING (school_id = auth.uid())
WITH CHECK (school_id = auth.uid());

DROP POLICY IF EXISTS "anyone_read_school_invite_codes" ON public.school_invite_codes;
CREATE POLICY "anyone_read_school_invite_codes"
ON public.school_invite_codes
FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- RLS: user_profiles — schools can SELECT linked users
-- ============================================================
DROP POLICY IF EXISTS "schools_read_linked_profiles" ON public.user_profiles;
CREATE POLICY "schools_read_linked_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR school_id = auth.uid()
  OR role IN ('mentor', 'student', 'counselor')
);

-- ============================================================
-- RLS: students — schools can SELECT students of their mentors
-- ============================================================
DROP POLICY IF EXISTS "schools_read_linked_students" ON public.students;
CREATE POLICY "schools_read_linked_students"
ON public.students
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
  )
);

-- ============================================================
-- RLS: sessions — schools can SELECT sessions of their mentors
-- ============================================================
DROP POLICY IF EXISTS "schools_read_mentor_sessions" ON public.sessions;
CREATE POLICY "schools_read_mentor_sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
  )
);

-- ============================================================
-- RLS: attendance — schools can SELECT attendance of their students
-- ============================================================
DROP POLICY IF EXISTS "schools_read_student_attendance" ON public.attendance;
CREATE POLICY "schools_read_student_attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: student_tasks — schools can SELECT tasks (read-only)
-- ============================================================
DROP POLICY IF EXISTS "schools_read_student_tasks" ON public.student_tasks;
CREATE POLICY "schools_read_student_tasks"
ON public.student_tasks
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
  )
);

-- ============================================================
-- RLS: mentor_feedback — schools can SELECT feedback
-- ============================================================
DROP POLICY IF EXISTS "schools_read_mentor_feedback" ON public.mentor_feedback;
CREATE POLICY "schools_read_mentor_feedback"
ON public.mentor_feedback
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: student_reflections — schools can SELECT reflections
-- ============================================================
DROP POLICY IF EXISTS "schools_read_student_reflections" ON public.student_reflections;
CREATE POLICY "schools_read_student_reflections"
ON public.student_reflections
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: surveys — schools can SELECT surveys of their mentors
-- ============================================================
DROP POLICY IF EXISTS "schools_read_mentor_surveys" ON public.surveys;
CREATE POLICY "schools_read_mentor_surveys"
ON public.surveys
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE school_id = auth.uid()
  )
);
