from typing import Annotated

from fastapi import Header, HTTPException, status
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from starlette.concurrency import run_in_threadpool

from auth.firebase import verify_firebase_id_token


async def current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Return the UID from a cryptographically verified Firebase ID token."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized()
    try:
        claims = await run_in_threadpool(verify_firebase_id_token, token.strip())
    except (auth.InvalidIdTokenError, auth.ExpiredIdTokenError, auth.RevokedIdTokenError):
        raise _unauthorized() from None
    except (FirebaseError, ValueError):
        raise _unauthorized() from None

    uid = claims.get("uid") or claims.get("sub")
    if not isinstance(uid, str) or not uid.strip():
        raise _unauthorized()
    return uid


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid Firebase sign-in is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
