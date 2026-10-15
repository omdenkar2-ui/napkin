-- Protect the tenant and role fields that FastAPI authorization reads.
-- Apply after 001..007. This changes permissions for existing and future rows;
-- it does not rewrite existing membership or create a public onboarding RPC.
BEGIN;

-- Table-wide and old column grants must both be removed. Otherwise an existing
-- grant could still let a browser assign itself another organization's ID.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (
    id, email, full_name, avatar_url, org_id, role, onboarding_done,
    preferences, created_at, updated_at
) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, avatar_url, preferences, onboarding_done)
    ON TABLE public.profiles TO authenticated;

-- Keep the row boundary explicit, including after an UPDATE.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Defense in depth if a future migration restores a broad UPDATE grant.
-- SECURITY INVOKER is intentional: current_user must remain the calling DB role,
-- never the function owner. Do not trust client-writable profile metadata here.
CREATE OR REPLACE FUNCTION public.guard_profile_authorization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    IF (
        NEW.id IS DISTINCT FROM OLD.id
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.org_id IS DISTINCT FROM OLD.org_id
        OR NEW.role IS DISTINCT FROM OLD.role
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
        RAISE EXCEPTION 'Profile identity, organization and role require administrator provisioning'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_authorization ON public.profiles;
CREATE TRIGGER protect_profile_authorization
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_authorization();

COMMIT;
