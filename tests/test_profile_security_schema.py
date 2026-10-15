"""Static deployment contracts, not a substitute for a PostgreSQL/RLS test."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_profile_authorization_migration_removes_table_and_column_grants():
    sql = (ROOT / "migrations/008_profile_authorization.sql").read_text()
    assert "REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated" in sql
    assert "REVOKE UPDATE (" in sql
    assert "GRANT UPDATE (full_name, avatar_url, preferences, onboarding_done)" in sql
    assert "WITH CHECK (id = auth.uid())" in sql


def test_trigger_checks_calling_role_and_identity_fields():
    sql = (ROOT / "migrations/008_profile_authorization.sql").read_text()
    assert "SECURITY INVOKER" in sql
    assert "SECURITY DEFINER" not in sql
    assert "SET search_path = pg_catalog" in sql
    for column in ("id", "email", "org_id", "role", "created_at"):
        assert f"NEW.{column} IS DISTINCT FROM OLD.{column}" in sql
    assert "current_user NOT IN ('postgres', 'supabase_admin', 'service_role')" in sql
    assert "BEFORE UPDATE ON public.profiles" in sql
    assert "ERRCODE = '42501'" in sql


def test_demo_provisioning_is_admin_only_and_does_not_reassign_memberships():
    sql = (ROOT / "scripts/provision_demo_workspace.sql").read_text()
    assert "current_user NOT IN ('postgres', 'supabase_admin', 'service_role')" in sql
    assert "email_confirmed_at IS NOT NULL" in sql
    assert "FOR UPDATE" in sql
    assert "User already has organization membership" in sql
    assert "ON CONFLICT (id) DO NOTHING" in sql
    for table in ("organizations", "org_members", "projects"):
        assert f"INSERT INTO public.{table}" in sql
    assert "UPDATE public.profiles" in sql
    assert "BEGIN;" in sql and sql.rstrip().endswith("COMMIT;")
    assert "CREATE FUNCTION" not in sql
    assert "CREATE OR REPLACE FUNCTION" not in sql
