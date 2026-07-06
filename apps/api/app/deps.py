from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from .auth import CurrentUser, get_current_user
from .config import get_settings

_bearer = HTTPBearer()


def get_user_scoped_db(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    _user: CurrentUser = Depends(get_current_user),
) -> Client:
    """Supabase client authenticated as the calling user (their access token
    is forwarded to PostgREST), so every query goes through the same Row
    Level Security policies as the client-side SDK would enforce. Prefer this
    over the service-role client for all normal request handling."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(credentials.credentials)
    return client


def get_service_db() -> Client:
    """Service-role client that bypasses RLS. Only for trusted server-side
    operations that must run before a user has a profile/org (e.g. signup),
    or scheduled jobs. Never expose results from this client directly to a
    different org than the caller's."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
