-- ============================================================================
-- Migration: 20260807190000_standardize_invite_codes.sql
-- Purpose:   Standardize ALL invite code generation to LLL-DDDDDD format
--            (3 uppercase letters, hyphen, 6 digits — e.g. ABC-123456)
-- ============================================================================

-- ── 1. Update generic invite code helper to LLL-DDDDDD format ────────────────
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_prefix  text := '';
  v_digits  text;
  i         int;
BEGIN
  -- Generate 3 random uppercase letters
  FOR i IN 1..3 LOOP
    v_prefix := v_prefix || substr(v_letters, floor(random() * 26)::int + 1, 1);
  END LOOP;
  -- Generate 6-digit number (100000–999999)
  v_digits := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
  RETURN v_prefix || '-' || v_digits;
END;
$$;

-- ── 2. Update generate_mentor_invite_code to use new format ──────────────────
CREATE OR REPLACE FUNCTION public.generate_mentor_invite_code(p_mentor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_mentor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_code := public.generate_invite_code();

  UPDATE public.user_profiles
  SET mentor_code = v_code, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_mentor_id;

  RETURN v_code;
END;
$$;

-- ── 3. Update generate_student_parent_link_code to use LLL-DDDDDD format ─────
CREATE OR REPLACE FUNCTION public.generate_student_parent_link_code(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code      text;
  v_mentor_id uuid;
BEGIN
  SELECT mentor_id INTO v_mentor_id
  FROM public.students
  WHERE id = p_student_id;

  IF v_mentor_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles
       WHERE id = auth.uid() AND student_id = p_student_id
     )
  THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_code := public.generate_invite_code();

  UPDATE public.students
  SET parent_link_code = v_code, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_student_id;

  RETURN v_code;
END;
$$;

-- ── 4. Update generate_school_invite_code to use LLL-DDDDDD format ───────────
CREATE OR REPLACE FUNCTION public.generate_school_invite_code(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_school_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.school_invite_codes (school_id, invite_code)
  VALUES (p_school_id, v_code)
  ON CONFLICT DO NOTHING;

  RETURN v_code;
END;
$$;
