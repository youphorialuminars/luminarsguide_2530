-- ============================================================
-- Migration: Seed demo users for all 4 roles
-- Demo accounts for testing the application
-- ============================================================

DO $$
DECLARE
  mentor_uuid   UUID;
  student_uuid  UUID;
  counselor_uuid UUID;
  school_uuid   UUID;
BEGIN

  -- --------------------------------------------------------
  -- 1. Generate stable UUIDs (deterministic via email check)
  -- --------------------------------------------------------
  SELECT id INTO mentor_uuid
    FROM auth.users WHERE email = 'demo.mentor@luminarsguide.com' LIMIT 1;
  IF mentor_uuid IS NULL THEN
    mentor_uuid := gen_random_uuid();
  END IF;

  SELECT id INTO student_uuid
    FROM auth.users WHERE email = 'demo.student@luminarsguide.com' LIMIT 1;
  IF student_uuid IS NULL THEN
    student_uuid := gen_random_uuid();
  END IF;

  SELECT id INTO counselor_uuid
    FROM auth.users WHERE email = 'demo.counselor@luminarsguide.com' LIMIT 1;
  IF counselor_uuid IS NULL THEN
    counselor_uuid := gen_random_uuid();
  END IF;

  SELECT id INTO school_uuid
    FROM auth.users WHERE email = 'demo.school@luminarsguide.com' LIMIT 1;
  IF school_uuid IS NULL THEN
    school_uuid := gen_random_uuid();
  END IF;

  -- --------------------------------------------------------
  -- 2. Insert into auth.users (trigger creates user_profiles)
  -- --------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous,
    confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at,
    phone, phone_change, phone_change_token, phone_change_sent_at
  ) VALUES
    -- Demo Mentor
    (
      mentor_uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'demo.mentor@luminarsguide.com',
      crypt('Demo@Mentor2025', gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('full_name', 'Demo Mentor', 'role', 'mentor'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    ),
    -- Demo Student/Parent
    (
      student_uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'demo.student@luminarsguide.com',
      crypt('Demo@Student2025', gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('full_name', 'Demo Student', 'role', 'student_parent'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    ),
    -- Demo Counselor
    (
      counselor_uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'demo.counselor@luminarsguide.com',
      crypt('Demo@Counselor2025', gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('full_name', 'Demo Counselor', 'role', 'counselor'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    ),
    -- Demo School
    (
      school_uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'demo.school@luminarsguide.com',
      crypt('Demo@School2025', gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('full_name', 'Demo School', 'role', 'school'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    )
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------
  -- 3. Ensure user_profiles rows exist with correct roles
  --    (handles cases where trigger may have already run
  --     or profile needs role correction)
  -- --------------------------------------------------------
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES
    (mentor_uuid,   'demo.mentor@luminarsguide.com',    'Demo Mentor',    'mentor'),
    (student_uuid,  'demo.student@luminarsguide.com',   'Demo Student',   'student_parent'),
    (counselor_uuid,'demo.counselor@luminarsguide.com', 'Demo Counselor', 'counselor'),
    (school_uuid,   'demo.school@luminarsguide.com',    'Demo School',    'school')
  ON CONFLICT (id) DO UPDATE SET
    role      = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    email     = EXCLUDED.email;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo user seeding failed: %', SQLERRM;
END $$;
