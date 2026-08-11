-- ============================================================================
-- Migration: 20260807163000_phase3_invite_codes.sql
-- Purpose:   Phase 3 - Invite Code Mechanisms & parent_student_links
--
-- Changes:
--   1. Add parent_student_links mapping table (explicit parent↔student links)
--   2. Add generate_invite_code() helper function for all roles
--   3. Add generate_mentor_invite_code() for Mentors
--   4. Add generate_student_parent_link_code() for Students
--   5. Add redeem_parent_link_code() SECURITY DEFINER function
--   6. RLS policies for parent_student_links
-- ============================================================================

-- ── 1. parent_student_links mapping table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  linked_at   timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_psl_parent_id  ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_psl_student_id ON public.parent_student_links(student_id);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psl_parent_can_view_own"   ON public.parent_student_links;
DROP POLICY IF EXISTS "psl_mentor_can_view_linked" ON public.parent_student_links;
DROP POLICY IF EXISTS "psl_insert_own"             ON public.parent_student_links;

CREATE POLICY "psl_parent_can_view_own"
  ON public.parent_student_links
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "psl_mentor_can_view_linked"
  ON public.parent_student_links
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE mentor_id = auth.uid()
    )
  );

CREATE POLICY "psl_insert_own"
  ON public.parent_student_links
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

-- ── 2. Generic invite code generator (8-char alphanumeric) ───────────────────
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT upper(
    substring(
      replace(replace(encode(gen_random_bytes(6), 'base64'), '+', ''), '/', ''),
      1, 8
    )
  );
$$;

-- ── 3. Generate & persist a mentor invite code ────────────────────────────────
-- Generates an 8-char code, stores it in user_profiles.mentor_code, returns it.
CREATE OR REPLACE FUNCTION public.generate_mentor_invite_code(p_mentor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  -- Only the mentor themselves can generate their own code
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

-- ── 4. Generate & persist a student parent-link code ─────────────────────────
-- Generates a 6-digit numeric code, stores it in students.parent_link_code.
CREATE OR REPLACE FUNCTION public.generate_student_parent_link_code(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_mentor_id uuid;
BEGIN
  -- Only the student's mentor or the student themselves can generate
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

  -- 6-digit numeric code
  v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');

  UPDATE public.students
  SET parent_link_code = v_code, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_student_id;

  RETURN v_code;
END;
$$;

-- ── 5. Redeem a parent link code ──────────────────────────────────────────────
-- Called after a parent signs up. Links parent↔student in both tables.
CREATE OR REPLACE FUNCTION public.redeem_parent_link_code(
  p_parent_id  uuid,
  p_link_code  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  IF p_parent_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Find the student with this link code
  SELECT id INTO v_student_id
  FROM public.students
  WHERE parent_link_code = p_link_code
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parent link code';
  END IF;

  -- Insert into parent_student_links (idempotent)
  INSERT INTO public.parent_student_links (parent_id, student_id)
  VALUES (p_parent_id, v_student_id)
  ON CONFLICT (parent_id, student_id) DO NOTHING;

  -- Append parent UUID to students.parent_ids array (idempotent)
  UPDATE public.students
  SET parent_ids = array_append(
        COALESCE(parent_ids, ARRAY[]::uuid[]),
        p_parent_id
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_student_id
    AND NOT (p_parent_id = ANY(COALESCE(parent_ids, ARRAY[]::uuid[])));

  -- Update user_profiles.linked_student_id for the parent
  UPDATE public.user_profiles
  SET linked_student_id = v_student_id::text,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_parent_id;

  RETURN v_student_id;
END;
$$;

-- ── 6. School invite code generator ──────────────────────────────────────────
-- Generates a new school invite code and inserts it into school_invite_codes.
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
