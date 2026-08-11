-- Migration: Live Sessions Scheduling & Network Linking
-- Timestamp: 20260805300000

-- ============================================================
-- Ensure meetings table has all needed columns
-- ============================================================
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS attendance_status text DEFAULT NULL;

-- ============================================================
-- RLS: Allow mentors to read linked students for network page
-- ============================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Mentors can unlink students (set mentor_id to null) via UPDATE
DROP POLICY IF EXISTS "mentors_unlink_students" ON public.students;
CREATE POLICY "mentors_unlink_students"
ON public.students
FOR UPDATE
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (true);

-- ============================================================
-- RLS: user_profiles - allow mentors to update their own mentor_id
-- Allow students to update their own mentor_id and school_id via code
-- ============================================================
DROP POLICY IF EXISTS "users_update_own_linking_fields" ON public.user_profiles;
CREATE POLICY "users_update_own_linking_fields"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================
-- RLS: counselor_mentor_invites - mentors can read to link
-- ============================================================
ALTER TABLE public.counselor_mentor_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counselors_manage_own_invites" ON public.counselor_mentor_invites;
CREATE POLICY "counselors_manage_own_invites"
ON public.counselor_mentor_invites
FOR ALL
TO authenticated
USING (counselor_id = auth.uid())
WITH CHECK (counselor_id = auth.uid());

DROP POLICY IF EXISTS "mentors_read_counselor_invites" ON public.counselor_mentor_invites;
CREATE POLICY "mentors_read_counselor_invites"
ON public.counselor_mentor_invites
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "mentors_use_counselor_invite" ON public.counselor_mentor_invites;
CREATE POLICY "mentors_use_counselor_invite"
ON public.counselor_mentor_invites
FOR UPDATE
TO authenticated
USING (used_by IS NULL)
WITH CHECK (used_by = auth.uid());

-- ============================================================
-- RLS: school_invite_codes - mentors/students can read to link
-- ============================================================
ALTER TABLE public.school_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_manage_own_codes" ON public.school_invite_codes;
CREATE POLICY "schools_manage_own_codes"
ON public.school_invite_codes
FOR ALL
TO authenticated
USING (school_id = auth.uid())
WITH CHECK (school_id = auth.uid());

DROP POLICY IF EXISTS "anyone_read_school_codes" ON public.school_invite_codes;
CREATE POLICY "anyone_read_school_codes"
ON public.school_invite_codes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "anyone_use_school_code" ON public.school_invite_codes;
CREATE POLICY "anyone_use_school_code"
ON public.school_invite_codes
FOR UPDATE
TO authenticated
USING (used_by IS NULL)
WITH CHECK (used_by = auth.uid());

-- ============================================================
-- RLS: meetings - students can read meetings linked to them
-- ============================================================
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

DROP POLICY IF EXISTS "mentors_manage_meetings" ON public.meetings;
CREATE POLICY "mentors_manage_meetings"
ON public.meetings
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());
