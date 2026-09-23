import asyncio

import pytest
from fastapi import HTTPException

from api import dependencies


def test_firebase_uid_is_used_as_application_identity(monkeypatch) -> None:
    monkeypatch.setattr(
        dependencies,
        "verify_firebase_token",
        lambda token: {"uid": "firebase-user-123", "token": token},
    )

    user_id = asyncio.run(dependencies.current_user_id("Bearer signed-token"))

    assert user_id == "firebase-user-123"


def test_missing_bearer_token_is_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        asyncio.run(dependencies.current_user_id(None))

    assert error.value.status_code == 401
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}
