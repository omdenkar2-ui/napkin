-- Run manually as an administrator in the Supabase SQL Editor AFTER migration
-- 008 and AFTER the demo user signs up and confirms their email.
-- Replace target_user_id below with the UUID from Authentication > Users.
-- Optionally edit workspace_name. The all-zero placeholder deliberately fails.
-- This is for an isolated demo database; it does not connect client systems.
-- Existing memberships are refused rather than overwritten or reassigned.
BEGIN;

DO $$
DECLARE
    target_user_id UUID := '00000000-0000-0000-0000-000000000000';
    workspace_name TEXT := 'Demo workspace';
    new_org_id UUID;
    existing_org_id UUID;
BEGIN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
        RAISE EXCEPTION 'Run this script with administrator privileges';
    END IF;
    IF target_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
        RAISE EXCEPTION 'Replace target_user_id with a confirmed auth.users UUID';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = target_user_id AND email_confirmed_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'No confirmed user found for %. Sign up and confirm the email first.', target_user_id;
    END IF;
    IF length(trim(workspace_name)) NOT BETWEEN 2 AND 100 THEN
        RAISE EXCEPTION 'Workspace name must contain 2 to 100 characters';
    END IF;

    -- Also supports a user created before the profile-signup trigger was added.
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    SELECT id, email,
        COALESCE(raw_user_meta_data->>'full_name', ''),
        COALESCE(raw_user_meta_data->>'avatar_url', '')
    FROM auth.users WHERE id = target_user_id
    ON CONFLICT (id) DO NOTHING;

    SELECT org_id INTO existing_org_id
    FROM public.profiles WHERE id = target_user_id FOR UPDATE;
    IF existing_org_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.org_members WHERE user_id = target_user_id
    ) THEN
        RAISE EXCEPTION 'User already has organization membership. No membership was changed.';
    END IF;

    INSERT INTO public.organizations (name, slug)
    VALUES (trim(workspace_name), 'demo-' || target_user_id::TEXT)
    RETURNING id INTO new_org_id;

    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (new_org_id, target_user_id, 'owner');

    UPDATE public.profiles
    SET org_id = new_org_id, role = 'owner', onboarding_done = TRUE
    WHERE id = target_user_id;

    INSERT INTO public.projects (org_id, name, description, created_by)
    VALUES (new_org_id, trim(workspace_name), 'Isolated demo workspace', target_user_id);

    RAISE NOTICE 'Provisioned user % with organization %. Sign in to the frontend.', target_user_id, new_org_id;
END;
$$;

COMMIT;
