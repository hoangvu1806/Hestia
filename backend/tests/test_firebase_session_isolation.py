from types import SimpleNamespace

from fastapi.testclient import TestClient

from api import dependencies
from main import create_app
from services.agent_runtime import SessionNotFoundError, get_agent_runtime


class FakeRuntime:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], SimpleNamespace] = {}

    async def create_session(self, user_id: str, session_id: str | None, state: dict):
        value = SimpleNamespace(
            id=session_id or f"session-{len(self.items) + 1}",
            state=state,
            last_update_time=1.0,
        )
        self.items[(user_id, value.id)] = value
        return value

    async def get_session(self, user_id: str, session_id: str):
        try:
            return self.items[(user_id, session_id)]
        except KeyError:
            raise SessionNotFoundError(session_id) from None

    async def list_sessions(self, user_id: str):
        return [value for (owner, _), value in self.items.items() if owner == user_id]


def test_session_access_is_scoped_to_verified_firebase_uid(monkeypatch) -> None:
    runtime = FakeRuntime()
    app = create_app()
    app.dependency_overrides[get_agent_runtime] = lambda: runtime
    monkeypatch.setattr(
        dependencies,
        "verify_firebase_id_token",
        lambda token: {"uid": {"token-a": "user-a", "token-b": "user-b"}[token]},
    )

    with TestClient(app) as client:
        created = client.post(
            "/api/v1/sessions",
            headers={"Authorization": "Bearer token-a"},
            json={"state": {"title": "Private recipe"}},
        )
        session_id = created.json()["id"]

        owner_response = client.get(
            f"/api/v1/sessions/{session_id}",
            headers={"Authorization": "Bearer token-a"},
        )
        other_user_response = client.get(
            f"/api/v1/sessions/{session_id}",
            headers={"Authorization": "Bearer token-b"},
        )

    assert created.status_code == 201
    assert owner_response.status_code == 200
    assert other_user_response.status_code == 404


def test_session_api_rejects_missing_bearer_token() -> None:
    app = create_app()
    app.dependency_overrides[get_agent_runtime] = lambda: FakeRuntime()

    with TestClient(app) as client:
        response = client.get("/api/v1/sessions")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
