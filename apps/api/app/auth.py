import time

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JOSEError

from .config import get_settings

_bearer = HTTPBearer(auto_error=False)

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 3600


def _get_jwks() -> dict:
    settings = get_settings()
    now = time.time()
    if _jwks_cache["keys"] is None or now - _jwks_cache["fetched_at"] > _JWKS_TTL_SECONDS:
        response = httpx.get(settings.jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache["keys"] = response.json()
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


class CurrentUser:
    def __init__(self, user_id: str, email: str | None, claims: dict):
        self.user_id = user_id
        self.email = email
        self.claims = claims


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    settings = get_settings()
    token = credentials.credentials
    jwks = _get_jwks()

    try:
        unverified_header = jwt.get_unverified_header(token)
        key = next((k for k in jwks["keys"] if k["kid"] == unverified_header.get("kid")), None)
        if key is None:
            # JWKS may have rotated; force a refresh once.
            _jwks_cache["keys"] = None
            jwks = _get_jwks()
            key = next((k for k in jwks["keys"] if k["kid"] == unverified_header.get("kid")), None)
        if key is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown signing key")

        claims = jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=settings.supabase_jwt_aud,
        )
    except JOSEError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject")

    return CurrentUser(user_id=user_id, email=claims.get("email"), claims=claims)
