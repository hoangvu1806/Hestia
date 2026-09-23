from functools import lru_cache
from typing import Annotated, Any

import firebase_admin
from fastapi import Header, HTTPException, status
from firebase_admin import auth, credentials

from core.config import get_settings


@lru_cache(maxsize=1)
def firebase_app():
    settings = get_settings()
    credential_path = settings.firebase_credentials
    if credential_path is None or not credential_path.is_file():
        raise RuntimeError("Firebase Admin credentials are not configured.")
    try:
        return firebase_admin.get_app("hestia")
    except ValueError:
        return firebase_admin.initialize_app(
            credentials.Certificate(credential_path),
            name="hestia",
        )


def verify_firebase_token(token: str) -> dict[str, Any]:
    return auth.verify_id_token(token, firebase_app(), check_revoked=False)


def unauthorized(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Return the verified Firebase UID without creating a local user record."""
    resolved_settings = get_settings()
    if not authorization:
        if not resolved_settings.auth_required:
            return "local-user"
        raise unauthorized()

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise unauthorized("Invalid authorization header.")

    try:
        claims = verify_firebase_token(token)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured.",
        ) from exc
    except (
        ValueError,
        auth.InvalidIdTokenError,
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
        auth.UserDisabledError,
    ) as exc:
        raise unauthorized("Invalid or expired authentication token.") from exc

    uid = claims.get("uid") or claims.get("sub")
    if not isinstance(uid, str) or not uid:
        raise unauthorized("Authentication token has no user identity.")
    return uid
