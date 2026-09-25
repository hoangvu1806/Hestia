from __future__ import annotations

import asyncio
import base64
import binascii
from collections.abc import AsyncIterator
from contextlib import aclosing
from uuid import uuid4

from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.apps import App
from google.adk.artifacts import InMemoryArtifactService
from google.adk.events import Event
from google.adk.events.event_actions import EventActions
from google.adk.memory import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions.database_session_service import DatabaseSessionService
from google.adk.sessions.session import Session
from google.genai import types

from core.config import Settings, get_settings
from schemas.chat import MessageCreate


class SessionNotFoundError(LookupError):
    pass


class InvalidFileError(ValueError):
    pass


class AgentRuntime:
    def __init__(self, settings: Settings) -> None:
        from agents.food_risk_agent import root_agent

        self.settings = settings
        self.sessions = DatabaseSessionService(
            settings.session_database_url,
            pool_size=3,
            max_overflow=2,
            pool_timeout=10,
            pool_recycle=1800,
            connect_args={"timeout": 10, "command_timeout": 60},
        )
        self.runner = Runner(
            app=App(name=settings.adk_app_name, root_agent=root_agent),
            session_service=self.sessions,
            artifact_service=InMemoryArtifactService(),
            memory_service=InMemoryMemoryService(),
        )
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}

    async def create_session(
        self, user_id: str, session_id: str | None, state: dict
    ) -> Session:
        return await self.sessions.create_session(
            app_name=self.settings.adk_app_name,
            user_id=user_id,
            session_id=session_id,
            state=state,
        )

    async def get_session(self, user_id: str, session_id: str) -> Session:
        session = await self.sessions.get_session(
            app_name=self.settings.adk_app_name,
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
            raise SessionNotFoundError(session_id)
        return session

    async def list_sessions(self, user_id: str) -> list[Session]:
        result = await self.sessions.list_sessions(
            app_name=self.settings.adk_app_name,
            user_id=user_id,
        )
        return result.sessions

    async def delete_session(self, user_id: str, session_id: str) -> None:
        await self.get_session(user_id, session_id)
        await self.sessions.delete_session(
            app_name=self.settings.adk_app_name,
            user_id=user_id,
            session_id=session_id,
        )
        self._locks.pop((user_id, session_id), None)

    async def patch_state(
        self, user_id: str, session_id: str, state_delta: dict
    ) -> Session:
        session = await self.get_session(user_id, session_id)
        event = Event(
            invocation_id=f"patch-{uuid4()}",
            author="user",
            actions=EventActions(state_delta=state_delta),
        )
        await self.sessions.append_event(session=session, event=event)
        return await self.get_session(user_id, session_id)

    async def run(
        self,
        user_id: str,
        session_id: str,
        message: MessageCreate,
        *,
        stream: bool,
    ) -> AsyncIterator[Event]:
        await self.get_session(user_id, session_id)
        lock = self._locks.setdefault((user_id, session_id), asyncio.Lock())
        async with lock:
            generator = self.runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=self._content(message),
                state_delta=message.state_delta,
                run_config=RunConfig(
                    streaming_mode=StreamingMode.SSE if stream else StreamingMode.NONE,
                    max_llm_calls=self.settings.max_llm_calls,
                    custom_metadata=message.metadata or None,
                ),
            )
            async with aclosing(generator) as events:
                async for event in events:
                    yield event

    def _content(self, message: MessageCreate) -> types.Content:
        parts: list[types.Part] = []
        if message.text and message.text.strip():
            parts.append(types.Part(text=message.text.strip()))
        for file in message.files:
            try:
                data = base64.b64decode(file.data, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise InvalidFileError(f"Invalid base64 data for {file.name or 'file'}") from exc
            if len(data) > self.settings.max_inline_file_bytes:
                raise InvalidFileError(
                    f"{file.name or 'File'} exceeds {self.settings.max_inline_file_bytes} bytes"
                )
            parts.append(types.Part.from_bytes(data=data, mime_type=file.mime_type))
        return types.Content(role="user", parts=parts)

    async def close(self) -> None:
        await self.runner.close()
        close = getattr(self.sessions, "close", None)
        if close is not None:
            await close()


_runtime: AgentRuntime | None = None


def get_agent_runtime() -> AgentRuntime:
    global _runtime
    if _runtime is None:
        _runtime = AgentRuntime(get_settings())
    return _runtime


async def close_agent_runtime() -> None:
    global _runtime
    if _runtime is not None:
        await _runtime.close()
        _runtime = None
