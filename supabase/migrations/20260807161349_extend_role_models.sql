-- ============================================================================
-- Migration: 20260807161349_extend_role_models.sql
-- Purpose:   Extend data models to fully support all 5 roles:
--            Mentor, Student, Parent, Counselor, School
--
-- Changes:
--   1. Fix user_profiles.mentor_id column type: text → uuid
--   2. Add school_id (uuid) to students table
--   3. Add counselor_id (uuid) to students table
--   4. Add parent_ids (uuid[]) to students table for multi-parent mapping
--   5. Add supporting indexes
--   6. Update RLS policies on students to respect new columns
-- ============================================================================

-- ── 1. Fix user_profiles.mentor_id: cast text → uuid ─────────────────────────
-- The column was created as TEXT but should be UUID to match the FK target.
-- We must drop any RLS policies that reference mentor_id before altering its type,
-- then recreate them after the ALTER completes.
DO $$
BEGIN
  -- Only migrate if the column is still text type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_profiles'
      AND column_name  = 'mentor_id'
      AND data_type    = 'text'
  ) THEN
    -- Drop all policies on user_profiles that reference mentor_id
    -- (PostgreSQL cannot alter a column type while policies depend on it)
    DROP POLICY IF EXISTS "up_mentor_read_linked"          ON public.user_profiles;
    DROP POLICY IF EXISTS "mentors_read_linked_profiles"   ON public.user_profiles;
    DROP POLICY IF EXISTS "users_read_mentor_profiles"     ON public.user_profiles;
    DROP POLICY IF EXISTS "counselors_read_linked_mentors" ON public.user_profiles;
    DROP POLICY IF EXISTS "users_manage_own_profile"       ON public.user_profiles;
    DROP POLICY IF EXISTS "users_insert_own_profile"       ON public.user_profiles;
    DROP POLICY IF EXISTS "users_update_own_profile"       ON public.user_profiles;

    -- Cast existing values to uuid (NULL-safe: invalid/empty values become NULL)
    ALTER TABLE public.user_profiles
      ALTER COLUMN mentor_id TYPE uuid
      USING CASE
        WHEN mentor_id IS NULL OR mentor_id = '' THEN NULL
        ELSE mentor_id::uuid
      END;

    -- Recreate all dropped policies
    CREATE POLICY "users_manage_own_profile"
      ON public.user_profiles
      FOR ALL
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());

    CREATE POLICY "users_read_mentor_profiles"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "counselors_read_linked_mentors"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (
        id = auth.uid()
        OR counselor_id = auth.uid()
        OR role = 'mentor'
      );

    CREATE POLICY "users_insert_own_profile"
      ON public.user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());

    CREATE POLICY "users_update_own_profile"
      ON public.user_profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());

    -- Recreate the mentor-read-linked policy (mentors can read profiles linked to them)
    CREATE POLICY "up_mentor_read_linked"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (
        id = auth.uid()
        OR mentor_id = auth.uid()
      );

  END IF;
END $$;

-- ── 2. Add school_id to students ──────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ── 3. Add counselor_id to students ──────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS counselor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ── 4. Add parent_ids array to students ──────────────────────────────────────
-- Stores an array of user_profile UUIDs for all parents linked to this student.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_school_id     ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_counselor_id  ON public.students(counselor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_mentor_id ON public.user_profiles(mentor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON public.user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_counselor_id ON public.user_profiles(counselor_id);

-- ── 6. RLS policies on students: allow school/counselor to read linked students ─

-- School: can read students linked to their school_id
DROP POLICY IF EXISTS "school_can_view_linked_students" ON public.students;
CREATE POLICY "school_can_view_linked_students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    school_id = auth.uid()
    OR mentor_id IN (
      SELECT id FROM public.user_profiles
      WHERE school_id = auth.uid()
    )
  );

-- Counselor: can read students linked to their counselor_id
DROP POLICY IF EXISTS "counselor_can_view_linked_students" ON public.students;
CREATE POLICY "counselor_can_view_linked_students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    counselor_id = auth.uid()
    OR mentor_id IN (
      SELECT id FROM public.user_profiles
      WHERE counselor_id = auth.uid()
    )
  );

-- Parent: can read students where their user id is in parent_ids
DROP POLICY IF EXISTS "parent_can_view_linked_student" ON public.students;
CREATE POLICY "parent_can_view_linked_student"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(parent_ids));

-- ── 7. Helper function: append a parent UUID to students.parent_ids ───────────
-- Called client-side after a parent signs up with a valid parent_link_code.
CREATE OR REPLACE FUNCTION public.link_parent_to_student(
  p_student_id uuid,
  p_parent_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.students
  SET parent_ids = array_append(
        COALESCE(parent_ids, ARRAY[]::uuid[]),
        p_parent_id
      )
  WHERE id = p_student_id
    AND NOT (p_parent_id = ANY(COALESCE(parent_ids, ARRAY[]::uuid[])));
END;
$$;
