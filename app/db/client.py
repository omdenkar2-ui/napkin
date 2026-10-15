"""
Napkin Backend — Supabase Client
Isolated user-auth clients and a cached service-role client.
"""

from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.core.config import get_settings


def get_supabase_client() -> Client:
    """Fresh anon-key client for one auth request.

    Supabase auth operations mutate client session state and authorization
    headers. Sharing this client would let one user's login affect another
    request. The API returns tokens to its caller instead of keeping a session.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )


@lru_cache
def get_supabase_admin() -> Client:
    """Service-role client — bypasses RLS. Use ONLY for background jobs & admin ops."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(access_token: str) -> Client:
    """Per-request client authenticated as a specific user."""
    client = get_supabase_client()
    client.auth.set_session(access_token, "")
    return client
