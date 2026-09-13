from typing import Any

from pydantic import BaseModel, Field

from schemas.chat import AgentEvent


class SessionCreate(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=128)
    state: dict[str, Any] = Field(default_factory=dict)


class SessionPatch(BaseModel):
    state_delta: dict[str, Any] = Field(min_length=1)


class SessionResponse(BaseModel):
    id: str
    state: dict[str, Any]
    updated_at: float


class SessionEventsResponse(BaseModel):
    session_id: str
    events: list[AgentEvent]
