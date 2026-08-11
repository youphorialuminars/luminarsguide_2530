-- Migration: Parent Role, Parent Link Code, Parent Queries Table + RLS
-- Timestamp: 20260806100000

-- ============================================================
-- 1. Add parent_link_code to students table
-- ============================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_link_code TEXT UNIQUE;

-- ============================================================
-- 2. Add linked_student_id to user_profiles for parent role
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS linked_student_id TEXT;

-- ============================================================
-- 3. Create parent_queries table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parent_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('mentor', 'counselor')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  reply TEXT,
  replied_by UUID REFERENCES auth.users(id),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. RLS for parent_queries
-- ============================================================
ALTER TABLE public.parent_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_manage_own_queries" ON public.parent_queries;
CREATE POLICY "parents_manage_own_queries"
ON public.parent_queries
FOR ALL
TO authenticated
USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid());

DROP POLICY IF EXISTS "mentors_read_reply_parent_queries" ON public.parent_queries;
CREATE POLICY "mentors_read_reply_parent_queries"
ON public.parent_queries
FOR ALL
TO authenticated
USING (
  recipient_role = 'mentor'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'mentor'
  )
);

DROP POLICY IF EXISTS "counselors_read_reply_parent_queries" ON public.parent_queries;
CREATE POLICY "counselors_read_reply_parent_queries"
ON public.parent_queries
FOR ALL
TO authenticated
USING (
  recipient_role = 'counselor'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'counselor'
  )
);

-- ============================================================
-- 5. RLS: Parents can SELECT their linked student's data
-- ============================================================

-- Parents read their linked student row
DROP POLICY IF EXISTS "parents_read_linked_student" ON public.students;
CREATE POLICY "parents_read_linked_student"
ON public.students
FOR SELECT
TO authenticated
USING (
  id::TEXT IN (
    SELECT linked_student_id FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'parent'
  )
);

-- Parents read tasks for their linked student
DROP POLICY IF EXISTS "parents_read_linked_student_tasks" ON public.student_tasks;
CREATE POLICY "parents_read_linked_student_tasks"
ON public.student_tasks
FOR SELECT
TO authenticated
USING (
  student_id::TEXT IN (
    SELECT linked_student_id FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'parent'
  )
);

-- Parents read attendance for their linked student
DROP POLICY IF EXISTS "parents_read_linked_student_attendance" ON public.attendance;
CREATE POLICY "parents_read_linked_student_attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  student_id::TEXT IN (
    SELECT linked_student_id FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'parent'
  )
);

-- Parents read sessions for their linked student
DROP POLICY IF EXISTS "parents_read_linked_student_sessions" ON public.sessions;
CREATE POLICY "parents_read_linked_student_sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  student_id::TEXT IN (
    SELECT linked_student_id FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'parent'
  )
);

-- Parents read meetings for their linked student
DROP POLICY IF EXISTS "parents_read_linked_student_meetings" ON public.meetings;
CREATE POLICY "parents_read_linked_student_meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  student_id::TEXT IN (
    SELECT linked_student_id FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'parent'
  )
);

-- ============================================================
-- 6. RLS: Mentors/Counselors/Schools can SELECT parent engagement
-- ============================================================

-- Mentors can read parent_observations for their students
DROP POLICY IF EXISTS "mentors_read_parent_observations_v2" ON public.parent_observations;
CREATE POLICY "mentors_read_parent_observations_v2"
ON public.parent_observations
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE mentor_id = auth.uid()
  )
);

-- Mentors can read parent queries directed to them
-- (already covered by mentors_read_reply_parent_queries above)

-- ============================================================
-- 7. Update handle_new_user trigger to support 'parent' role
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, mentor_code, linked_student_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mentor'),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'mentor') = 'mentor'
      THEN UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8))
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'linked_student_id'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.user_profiles.role),
    mentor_code = COALESCE(EXCLUDED.mentor_code, public.user_profiles.mentor_code),
    linked_student_id = COALESCE(EXCLUDED.linked_student_id, public.user_profiles.linked_student_id);
  RETURN NEW;
END;
$$;
