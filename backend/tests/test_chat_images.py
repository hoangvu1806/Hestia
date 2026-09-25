import asyncio
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from google.adk.events import Event
from google.genai import types

from api import dependencies
from api.v1.routes import generated_images
from main import create_app
from schemas.chat import InlineFile, MessageCreate
from services import agent_runtime
from services.agent_runtime import InvalidFileError, SessionNotFoundError, get_agent_runtime
from services.events import serialize_event
from services.object_store import StoredObject


class FakeRuntime:
    async def get_session(self, user_id: str, session_id: str):
        if user_id != "owner" or session_id != "session-1":
            raise SessionNotFoundError(session_id)
        return SimpleNamespace(id=session_id)


class FakeStore:
    def get_attachment(self, user_id: str, session_id: str, attachment_id):
        assert user_id == "owner"
        assert session_id == "session-1"
        return StoredObject(body=b"image-bytes", content_type="image/png", size=11)


class FakeMigrationStore:
    def __init__(self) -> None:
        self.saved: list[tuple] = []

    def attachment_exists(self, *_args) -> bool:
        return False

    def put_attachment(self, *args) -> None:
        self.saved.append(args)


def test_event_history_exposes_private_attachment_metadata() -> None:
    attachment_id = str(uuid4())
    event = Event(
        invocation_id="invocation-1",
        author="user",
        content=types.Content(role="user", parts=[types.Part(text="What is this?")]),
        custom_metadata={
            "attachments": [
                {
                    "id": attachment_id,
                    "name": "meal.png",
                    "mime_type": "image/png",
                    "size": 123,
                }
            ]
        },
    )

    result = serialize_event(event)

    assert result.text_delta == "What is this?"
    assert result.attachments[0].id == attachment_id
    assert result.attachments[0].url == f"attachments/{attachment_id}"


def test_attachment_download_requires_owning_firebase_user(monkeypatch) -> None:
    app = create_app()
    app.dependency_overrides[get_agent_runtime] = lambda: FakeRuntime()
    monkeypatch.setattr(
        dependencies,
        "verify_firebase_id_token",
        lambda token: {"uid": {"owner-token": "owner", "other-token": "other"}[token]},
    )
    monkeypatch.setattr(generated_images, "get_object_store", lambda: FakeStore())
    attachment_id = uuid4()

    with TestClient(app) as client:
        owner = client.get(
            f"/api/v1/sessions/session-1/attachments/{attachment_id}",
            headers={"Authorization": "Bearer owner-token"},
        )
        other = client.get(
            f"/api/v1/sessions/session-1/attachments/{attachment_id}",
            headers={"Authorization": "Bearer other-token"},
        )

    assert owner.status_code == 200
    assert owner.content == b"image-bytes"
    assert owner.headers["cache-control"].startswith("private")
    assert other.status_code == 404


def test_legacy_inline_image_is_copied_to_object_storage(monkeypatch) -> None:
    store = FakeMigrationStore()
    monkeypatch.setattr(agent_runtime, "get_object_store", lambda: store)
    event = Event(
        invocation_id="invocation-1",
        author="user",
        content=types.Content(
            role="user",
            parts=[types.Part.from_bytes(data=b"legacy-image", mime_type="image/png")],
        ),
    )
    session = SimpleNamespace(events=[event])

    asyncio.run(
        agent_runtime.AgentRuntime.hydrate_legacy_attachments(
            SimpleNamespace(), "owner", "session-1", session
        )
    )

    assert len(store.saved) == 1
    result = serialize_event(event)
    assert result.attachments[0].mime_type == "image/png"
    assert result.attachments[0].name.endswith(".png")


def test_runtime_rejects_non_image_attachments() -> None:
    runtime = SimpleNamespace(settings=SimpleNamespace(max_inline_file_bytes=1024))
    message = MessageCreate(
        files=[InlineFile(name="page.html", mime_type="text/html", data="PGgxPng8L2gxPg==")]
    )

    try:
        asyncio.run(
            agent_runtime.AgentRuntime._content(runtime, "owner", "session-1", message)
        )
    except InvalidFileError:
        pass
    else:
        raise AssertionError("A non-image attachment must be rejected")
