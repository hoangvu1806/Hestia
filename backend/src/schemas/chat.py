from typing import Any

from pydantic import BaseModel, Field, model_validator


class InlineFile(BaseModel):
    mime_type: str = Field(pattern=r"^[\w.+-]+/[\w.+-]+$")
    data: str = Field(min_length=1, description="Base64 payload without a data-URL prefix.")
    name: str | None = None


class MessageCreate(BaseModel):
    text: str | None = Field(default=None, max_length=20_000)
    files: list[InlineFile] = Field(default_factory=list, max_length=6)
    state_delta: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_content(self) -> "MessageCreate":
        if not (self.text and self.text.strip()) and not self.files:
            raise ValueError("A message needs text or at least one file.")
        return self


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    reasoning_tokens: int = 0


class AgentEvent(BaseModel):
    id: str
    invocation_id: str
    kind: str
    author: str
    node_path: str = ""
    partial: bool = False
    final: bool = False
    turn_complete: bool = False
    text_delta: str | None = None
    tool_names: list[str] = Field(default_factory=list)
    state_delta: dict[str, Any] = Field(default_factory=dict)
    usage: TokenUsage | None = None
    model: str | None = None
    error: str | None = None
    timestamp: float


class MessageResponse(BaseModel):
    session_id: str
    message: str
    state: dict[str, Any]
    usage: TokenUsage
    events: list[AgentEvent]
