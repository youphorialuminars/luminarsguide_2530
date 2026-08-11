-- Migration: Deep Relational Link — resolve invite codes to UUIDs in trigger
-- Timestamp: 20260806210000
-- Purpose: Update handle_new_user trigger to resolve invite codes to actual UUIDs
-- server-side, ensuring all 5 stakeholder roles are deeply linked at sign-up time.
-- Also adds RLS policies so linked profiles are readable across roles.

-- ============================================================
-- 1. Update handle_new_user to resolve invite codes → UUIDs
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentor_id UUID;
  v_student_id UUID;
  v_linked_student_id TEXT;
  v_counselor_id UUID;
  v_school_id UUID;
  v_mentor_code TEXT;
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mentor');
  v_mentor_code := COALESCE(NEW.raw_user_meta_data->>'mentor_code', NULL);

  -- ── Resolve mentor_id ──────────────────────────────────────────────────────
  -- Priority 1: direct UUID passed from frontend (already resolved)
  IF NEW.raw_user_meta_data->>'mentor_id' IS NOT NULL
     AND NEW.raw_user_meta_data->>'mentor_id' != ''
  THEN
    BEGIN
      v_mentor_id := (NEW.raw_user_meta_data->>'mentor_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_mentor_id := NULL;
    END;
  -- Priority 2: resolve from inviteCode (student signs up with mentor's 8-char code)
  ELSIF NEW.raw_user_meta_data->>'inviteCode' IS NOT NULL
     AND NEW.raw_user_meta_data->>'inviteCode' != ''
  THEN
    SELECT id INTO v_mentor_id
    FROM public.user_profiles
    WHERE mentor_code = UPPER(NEW.raw_user_meta_data->>'inviteCode')
      AND role = 'mentor'
    LIMIT 1;
  END IF;

  -- ── Resolve student_id ─────────────────────────────────────────────────────
  IF NEW.raw_user_meta_data->>'student_id' IS NOT NULL
     AND NEW.raw_user_meta_data->>'student_id' != ''
  THEN
    BEGIN
      v_student_id := (NEW.raw_user_meta_data->>'student_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_student_id := NULL;
    END;
  END IF;

  -- ── Resolve linked_student_id (for parent role) ────────────────────────────
  -- Stored as TEXT (UUID string) to match the column type in user_profiles
  IF NEW.raw_user_meta_data->>'linked_student_id' IS NOT NULL
     AND NEW.raw_user_meta_data->>'linked_student_id' != ''
  THEN
    v_linked_student_id := NEW.raw_user_meta_data->>'linked_student_id';
  -- Priority 2: resolve from parentLinkCode
  ELSIF NEW.raw_user_meta_data->>'parentLinkCode' IS NOT NULL
     AND NEW.raw_user_meta_data->>'parentLinkCode' != ''
  THEN
    SELECT id::TEXT INTO v_linked_student_id
    FROM public.students
    WHERE parent_link_code = NEW.raw_user_meta_data->>'parentLinkCode'
    LIMIT 1;
  END IF;

  -- ── Resolve counselor_id ───────────────────────────────────────────────────
  IF NEW.raw_user_meta_data->>'counselor_id' IS NOT NULL
     AND NEW.raw_user_meta_data->>'counselor_id' != ''
  THEN
    BEGIN
      v_counselor_id := (NEW.raw_user_meta_data->>'counselor_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_counselor_id := NULL;
    END;
  -- Priority 2: resolve from counselorInviteCode
  ELSIF NEW.raw_user_meta_data->>'counselorInviteCode' IS NOT NULL
     AND NEW.raw_user_meta_data->>'counselorInviteCode' != ''
  THEN
    SELECT counselor_id INTO v_counselor_id
    FROM public.counselor_mentor_invites
    WHERE invite_code = NEW.raw_user_meta_data->>'counselorInviteCode'
      AND used_by IS NULL
    LIMIT 1;
  END IF;

  -- ── Resolve school_id ──────────────────────────────────────────────────────
  IF NEW.raw_user_meta_data->>'school_id' IS NOT NULL
     AND NEW.raw_user_meta_data->>'school_id' != ''
  THEN
    BEGIN
      v_school_id := (NEW.raw_user_meta_data->>'school_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_school_id := NULL;
    END;
  -- Priority 2: resolve from schoolInviteCode
  ELSIF NEW.raw_user_meta_data->>'schoolInviteCode' IS NOT NULL
     AND NEW.raw_user_meta_data->>'schoolInviteCode' != ''
  THEN
    SELECT school_id INTO v_school_id
    FROM public.school_invite_codes
    WHERE invite_code = NEW.raw_user_meta_data->>'schoolInviteCode'
      AND used_by IS NULL
    LIMIT 1;
  END IF;

  -- ── Upsert the profile row ─────────────────────────────────────────────────
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    mentor_code,
    mentor_id,
    student_id,
    linked_student_id,
    counselor_id,
    school_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_mentor_code,
    v_mentor_id::TEXT,
    v_student_id,
    v_linked_student_id,
    v_counselor_id,
    v_school_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email             = EXCLUDED.email,
    full_name         = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role              = COALESCE(EXCLUDED.role, public.user_profiles.role),
    mentor_code       = COALESCE(EXCLUDED.mentor_code, public.user_profiles.mentor_code),
    mentor_id         = COALESCE(EXCLUDED.mentor_id, public.user_profiles.mentor_id),
    student_id        = COALESCE(EXCLUDED.student_id, public.user_profiles.student_id),
    linked_student_id = COALESCE(EXCLUDED.linked_student_id, public.user_profiles.linked_student_id),
    counselor_id      = COALESCE(EXCLUDED.counselor_id, public.user_profiles.counselor_id),
    school_id         = COALESCE(EXCLUDED.school_id, public.user_profiles.school_id);

  RETURN NEW;
END;
$$;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Ensure INSERT policy exists for authenticated users
-- ============================================================
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================
-- 3. Ensure UPDATE policy exists for own profile
-- ============================================================
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================
-- 4. RLS on students: ensure all role-based access is covered
-- ============================================================

-- Mentors can manage their own students
DROP POLICY IF EXISTS "mentors_manage_own_students" ON public.students;
CREATE POLICY "mentors_manage_own_students"
ON public.students
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

-- Students can read their own row (via student_user_id)
DROP POLICY IF EXISTS "students_read_own_row" ON public.students;
CREATE POLICY "students_read_own_row"
ON public.students
FOR SELECT
TO authenticated
USING (student_user_id = auth.uid());

-- Parents can read their linked student's row
-- Uses a subquery on user_profiles to find the parent's linked_student_id
DROP POLICY IF EXISTS "parents_read_linked_student_row" ON public.students;
CREATE POLICY "parents_read_linked_student_row"
ON public.students
FOR SELECT
TO authenticated
USING (
  id::TEXT IN (
    SELECT up.linked_student_id
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.linked_student_id IS NOT NULL
  )
);

-- Counselors can read students under their linked mentors
DROP POLICY IF EXISTS "counselors_read_students_via_mentors" ON public.students;
CREATE POLICY "counselors_read_students_via_mentors"
ON public.students
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT up.id
    FROM public.user_profiles up
    WHERE up.counselor_id = auth.uid()
      AND up.role = 'mentor'
  )
);

-- Schools can read students under their linked mentors
DROP POLICY IF EXISTS "schools_read_students_via_mentors" ON public.students;
CREATE POLICY "schools_read_students_via_mentors"
ON public.students
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT up.id
    FROM public.user_profiles up
    WHERE up.school_id = auth.uid()
      AND up.role = 'mentor'
  )
);
