-- Run only against a fresh, disposable PostgreSQL database as a superuser:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/profile_authorization.sql
-- Creates minimal Supabase roles/RLS fixtures; NOT for a real Supabase project.
\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::UUID;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    org_id UUID,
    role TEXT DEFAULT 'member',
    onboarding_done BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
    USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
    USING (id = auth.uid());
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
INSERT INTO public.profiles (id, email, org_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'one@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('22222222-2222-2222-2222-222222222222', 'two@example.test', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

\ir ../../migrations/008_profile_authorization.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', FALSE);
UPDATE public.profiles SET full_name = 'Updated own name'
    WHERE id = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE changed INTEGER;
BEGIN
    IF (SELECT full_name FROM public.profiles WHERE id = auth.uid()) <> 'Updated own name' THEN
        RAISE EXCEPTION 'Own editable profile fields must remain writable';
    END IF;
    UPDATE public.profiles SET full_name = 'Should not change'
        WHERE id = '22222222-2222-2222-2222-222222222222';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Cannot edit another user profile'; END IF;
    BEGIN
        UPDATE public.profiles SET role = 'owner' WHERE id = auth.uid();
        RAISE EXCEPTION 'Role escalation was allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.profiles SET org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' WHERE id = auth.uid();
        RAISE EXCEPTION 'Organization reassignment was allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;

-- Simulate a future broad grant: the trigger must still protect identity fields.
GRANT UPDATE ON public.profiles TO authenticated;
SET ROLE authenticated;
DO $$
BEGIN
    BEGIN
        UPDATE public.profiles SET role = 'owner' WHERE id = auth.uid();
        RAISE EXCEPTION 'Trigger did not block role escalation';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.profiles SET org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' WHERE id = auth.uid();
        RAISE EXCEPTION 'Trigger did not block organization reassignment';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.profiles SET email = 'changed@example.test' WHERE id = auth.uid();
        RAISE EXCEPTION 'Trigger did not protect profile identity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;

SET ROLE service_role;
UPDATE public.profiles SET org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role = 'owner'
    WHERE id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles
        WHERE id = '11111111-1111-1111-1111-111111111111'
          AND org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND role = 'owner') THEN
        RAISE EXCEPTION 'Trusted provisioning must remain possible';
    END IF;
    IF (SELECT full_name FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222') IS NOT NULL THEN
        RAISE EXCEPTION 'Another user profile changed';
    END IF;
END;
$$;
\echo Profile authorization SQL checks passed.
