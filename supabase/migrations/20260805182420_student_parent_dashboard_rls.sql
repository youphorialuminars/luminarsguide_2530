-- Migration: Student & Parent Dashboard RLS Policies
-- Timestamp: 20260805182420

-- ============================================================
-- RLS Policies for student_reflections
-- ============================================================
ALTER TABLE public.student_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_manage_own_reflections" ON public.student_reflections;
CREATE POLICY "students_manage_own_reflections"
ON public.student_reflections
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mentors_read_student_reflections" ON public.student_reflections;
CREATE POLICY "mentors_read_student_reflections"
ON public.student_reflections
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE mentor_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for mentor_feedback
-- ============================================================
ALTER TABLE public.mentor_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_manage_own_mentor_feedback" ON public.mentor_feedback;
CREATE POLICY "students_manage_own_mentor_feedback"
ON public.mentor_feedback
FOR ALL
TO authenticated
USING (submitted_by = auth.uid())
WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "mentors_read_their_feedback" ON public.mentor_feedback;
CREATE POLICY "mentors_read_their_feedback"
ON public.mentor_feedback
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE mentor_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for parent_observations
-- ============================================================
ALTER TABLE public.parent_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_manage_own_observations" ON public.parent_observations;
CREATE POLICY "parents_manage_own_observations"
ON public.parent_observations
FOR ALL
TO authenticated
USING (submitted_by = auth.uid())
WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "mentors_read_parent_observations" ON public.parent_observations;
CREATE POLICY "mentors_read_parent_observations"
ON public.parent_observations
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE mentor_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for student_tasks (students can update status)
-- ============================================================
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_student_tasks" ON public.student_tasks;
CREATE POLICY "mentors_manage_student_tasks"
ON public.student_tasks
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_update_own_tasks" ON public.student_tasks;
CREATE POLICY "students_read_update_own_tasks"
ON public.student_tasks
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "students_update_task_status" ON public.student_tasks;
CREATE POLICY "students_update_task_status"
ON public.student_tasks
FOR UPDATE
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
)
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for attendance (read-only for students)
-- ============================================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_attendance" ON public.attendance;
CREATE POLICY "mentors_manage_attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_own_attendance" ON public.attendance;
CREATE POLICY "students_read_own_attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for meetings (read-only for students)
-- ============================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_meetings" ON public.meetings;
CREATE POLICY "mentors_manage_meetings"
ON public.meetings
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_own_meetings" ON public.meetings;
CREATE POLICY "students_read_own_meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for sessions (read-only for students)
-- ============================================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_sessions" ON public.sessions;
CREATE POLICY "mentors_manage_sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_own_sessions" ON public.sessions;
CREATE POLICY "students_read_own_sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for students table
-- ============================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_own_students" ON public.students;
CREATE POLICY "mentors_manage_own_students"
ON public.students
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_own_profile" ON public.students;
CREATE POLICY "students_read_own_profile"
ON public.students
FOR SELECT
TO authenticated
USING (student_user_id = auth.uid());

DROP POLICY IF EXISTS "students_update_own_user_id" ON public.students;
CREATE POLICY "students_update_own_user_id"
ON public.students
FOR UPDATE
TO authenticated
USING (invite_code IS NOT NULL)
WITH CHECK (student_user_id = auth.uid());

-- ============================================================
-- RLS Policies for user_profiles
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_read_mentor_profiles" ON public.user_profiles;
CREATE POLICY "users_read_mentor_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- Trigger: auto-create user_profiles on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, mentor_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mentor'),
    COALESCE(NEW.raw_user_meta_data->>'mentor_code', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.user_profiles.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
