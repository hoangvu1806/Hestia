from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials

from core.config import Settings, get_settings


@lru_cache(maxsize=1)
def firebase_app() -> firebase_admin.App:
    settings = get_settings()
    return _initialize_app(settings)


def _initialize_app(settings: Settings) -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        credential_path = settings.firebase_credentials_path
        if not credential_path.is_file():
            raise RuntimeError(
                "Firebase credentials are not configured. Set "
                "HESTIA_FIREBASE_CREDENTIALS_PATH to a Firebase service-account JSON file."
            ) from None
        return firebase_admin.initialize_app(
            credentials.Certificate(str(credential_path)),
            {"projectId": settings.firebase_project_id},
        )


def verify_firebase_id_token(token: str) -> dict[str, Any]:
    """Verify a client-issued Firebase ID token and return its trusted claims."""
    return auth.verify_id_token(token, app=firebase_app(), check_revoked=False)
