-- ============================================================
-- Phase 4 Test Fixtures: Two Distinct Mentors + Separate Students
-- Purpose: Verify that RLS / mentor_id filtering prevents
--          Mentor A from seeing Mentor B's students.
-- Login credentials:
--   Mentor Alpha: mentor.alpha@luminarsguide.test / TestPass123!
--   Mentor Beta:  mentor.beta@luminarsguide.test  / TestPass123!
-- ============================================================

DO $$
DECLARE
    mentor_alpha_uuid UUID := gen_random_uuid();
    mentor_beta_uuid  UUID := gen_random_uuid();

    student_a1_uuid UUID := gen_random_uuid();
    student_a2_uuid UUID := gen_random_uuid();
    student_b1_uuid UUID := gen_random_uuid();
    student_b2_uuid UUID := gen_random_uuid();
BEGIN

    -- ── 1. Create auth.users for both test mentors ──────────────

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
        (
            mentor_alpha_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            'mentor.alpha@luminarsguide.test',
            crypt('TestPass123!', gen_salt('bf', 10)),
            now(), now(), now(),
            jsonb_build_object('full_name', 'Mentor Alpha', 'role', 'mentor'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            null, '', '', null
        ),
        (
            mentor_beta_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            'mentor.beta@luminarsguide.test',
            crypt('TestPass123!', gen_salt('bf', 10)),
            now(), now(), now(),
            jsonb_build_object('full_name', 'Mentor Beta', 'role', 'mentor'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            null, '', '', null
        )
    ON CONFLICT (id) DO NOTHING;

    -- ── 2. Upsert user_profiles (trigger may have already fired) ─

    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES
        (mentor_alpha_uuid, 'mentor.alpha@luminarsguide.test', 'Mentor Alpha', 'mentor'),
        (mentor_beta_uuid,  'mentor.beta@luminarsguide.test',  'Mentor Beta',  'mentor')
    ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            role      = EXCLUDED.role;

    -- ── 3. Assign two students exclusively to Mentor Alpha ───────

    INSERT INTO public.students (
        id, mentor_id, name, grade, age, gender,
        primary_topic, avg_score, sessions, trend, alert_level,
        student_code, student_email
    ) VALUES
        (
            student_a1_uuid, mentor_alpha_uuid,
            'Alice Nguyen', 'Grade 9', 15, 'Female',
            'Digital Literacy and Online Safety',
            72, 3, 'improving', null,
            'ALPHA-STU-001', 'alice.nguyen@student.test'
        ),
        (
            student_a2_uuid, mentor_alpha_uuid,
            'Arjun Sharma', 'Grade 10', 16, 'Male',
            'Civic Sense and Social Responsibility',
            65, 2, 'stable', null,
            'ALPHA-STU-002', 'arjun.sharma@student.test'
        )
    ON CONFLICT (id) DO NOTHING;

    -- ── 4. Assign two students exclusively to Mentor Beta ────────

    INSERT INTO public.students (
        id, mentor_id, name, grade, age, gender,
        primary_topic, avg_score, sessions, trend, alert_level,
        student_code, student_email
    ) VALUES
        (
            student_b1_uuid, mentor_beta_uuid,
            'Beatrice Okafor', 'Grade 8', 14, 'Female',
            'Emotional Resilience and Mental Well-being',
            58, 4, 'declining', 'medium',
            'BETA-STU-001', 'beatrice.okafor@student.test'
        ),
        (
            student_b2_uuid, mentor_beta_uuid,
            'Bruno Ferreira', 'Grade 11', 17, 'Male',
            'Team Building and Leadership',
            81, 5, 'improving', null,
            'BETA-STU-002', 'bruno.ferreira@student.test'
        )
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Phase 4 fixture insertion failed: %', SQLERRM;
END $$;

-- ============================================================
-- Verification query (run manually in Supabase SQL editor):
--
-- SELECT s.name, s.grade, up.full_name AS mentor_name
-- FROM public.students s
-- JOIN public.user_profiles up ON s.mentor_id = up.id
-- WHERE up.email IN (
--   'mentor.alpha@luminarsguide.test',
--   'mentor.beta@luminarsguide.test'
-- )
-- ORDER BY up.email, s.name;
--
-- Expected: Alice + Arjun under Mentor Alpha,
--           Beatrice + Bruno under Mentor Beta.
-- ============================================================
