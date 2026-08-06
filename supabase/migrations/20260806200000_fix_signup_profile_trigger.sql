-- Migration: Fix sign-up profile creation trigger
-- Timestamp: 20260806200000
-- Purpose: Update handle_new_user trigger to read all metadata fields
-- so the profile row is fully populated at sign-up time (SECURITY DEFINER bypasses RLS).
-- This fixes the silent failure where UPDATE calls after auth.signUp had no active session.

-- ============================================================
-- Update handle_new_user to read all metadata fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'mentor'),
    COALESCE(NEW.raw_user_meta_data->>'mentor_code', NULL),
    CASE
      WHEN NEW.raw_user_meta_data->>'mentor_id' IS NOT NULL
        AND NEW.raw_user_meta_data->>'mentor_id' != ''
      THEN (NEW.raw_user_meta_data->>'mentor_id')::UUID
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'student_id' IS NOT NULL
        AND NEW.raw_user_meta_data->>'student_id' != ''
      THEN (NEW.raw_user_meta_data->>'student_id')::UUID
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'linked_student_id', NULL),
    CASE
      WHEN NEW.raw_user_meta_data->>'counselor_id' IS NOT NULL
        AND NEW.raw_user_meta_data->>'counselor_id' != ''
      THEN (NEW.raw_user_meta_data->>'counselor_id')::UUID
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'school_id' IS NOT NULL
        AND NEW.raw_user_meta_data->>'school_id' != ''
      THEN (NEW.raw_user_meta_data->>'school_id')::UUID
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.user_profiles.role),
    mentor_code = COALESCE(EXCLUDED.mentor_code, public.user_profiles.mentor_code),
    mentor_id = COALESCE(EXCLUDED.mentor_id, public.user_profiles.mentor_id),
    student_id = COALESCE(EXCLUDED.student_id, public.user_profiles.student_id),
    linked_student_id = COALESCE(EXCLUDED.linked_student_id, public.user_profiles.linked_student_id),
    counselor_id = COALESCE(EXCLUDED.counselor_id, public.user_profiles.counselor_id),
    school_id = COALESCE(EXCLUDED.school_id, public.user_profiles.school_id);
  RETURN NEW;
END;
$$;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Ensure user_profiles INSERT policy exists for authenticated users
-- (needed for the frontend upsert fallback when trigger hasn't fired yet)
-- ============================================================
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
