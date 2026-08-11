-- Migration: Counselor Role RLS Policies
-- Timestamp: 20260805220000

-- ============================================================
-- Helper function: check if current user is a counselor
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_counselor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'counselor'
  )
$$;

-- ============================================================
-- Helper function: get mentor IDs linked to current counselor
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_counselor_mentor_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.user_profiles
  WHERE counselor_id = auth.uid()
$$;

-- ============================================================
-- Helper function: get student IDs under counselor's mentors
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_counselor_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id FROM public.students s
  WHERE s.mentor_id IN (
    SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
  )
$$;

-- ============================================================
-- RLS: counselor_mentor_invites — counselors manage their own
-- ============================================================
ALTER TABLE public.counselor_mentor_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counselors_manage_own_invites" ON public.counselor_mentor_invites;
CREATE POLICY "counselors_manage_own_invites"
ON public.counselor_mentor_invites
FOR ALL
TO authenticated
USING (counselor_id = auth.uid())
WITH CHECK (counselor_id = auth.uid());

DROP POLICY IF EXISTS "mentors_read_invite_codes" ON public.counselor_mentor_invites;
CREATE POLICY "mentors_read_invite_codes"
ON public.counselor_mentor_invites
FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- RLS: user_profiles — counselors can SELECT linked mentors
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_linked_mentors" ON public.user_profiles;
CREATE POLICY "counselors_read_linked_mentors"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR counselor_id = auth.uid()
  OR role = 'mentor'
);

-- ============================================================
-- RLS: students — counselors can SELECT students of their mentors
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_linked_students" ON public.students;
CREATE POLICY "counselors_read_linked_students"
ON public.students
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
  )
);

-- ============================================================
-- RLS: sessions — counselors can SELECT sessions of their mentors
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_mentor_sessions" ON public.sessions;
CREATE POLICY "counselors_read_mentor_sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
  )
);

-- ============================================================
-- RLS: attendance — counselors can SELECT attendance of their students
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_student_attendance" ON public.attendance;
CREATE POLICY "counselors_read_student_attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: mentor_feedback — counselors can SELECT feedback for their mentors
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_mentor_feedback" ON public.mentor_feedback;
CREATE POLICY "counselors_read_mentor_feedback"
ON public.mentor_feedback
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: student_reflections — counselors can SELECT reflections
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_student_reflections" ON public.student_reflections;
CREATE POLICY "counselors_read_student_reflections"
ON public.student_reflections
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.mentor_id IN (
      SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
    )
  )
);

-- ============================================================
-- RLS: student_tasks — counselors can SELECT tasks
-- ============================================================
DROP POLICY IF EXISTS "counselors_read_student_tasks" ON public.student_tasks;
CREATE POLICY "counselors_read_student_tasks"
ON public.student_tasks
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT id FROM public.user_profiles WHERE counselor_id = auth.uid()
  )
);

-- ============================================================
-- Ensure counselor_invite_code column exists on user_profiles
-- ============================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS counselor_invite_code TEXT;
