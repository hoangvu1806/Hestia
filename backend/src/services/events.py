from __future__ import annotations

from google.adk.events import Event

from schemas.chat import AgentEvent, TokenUsage


def _text(event: Event) -> str | None:
    if not event.content or not event.content.parts:
        return None
    value = "".join(part.text or "" for part in event.content.parts if not part.thought)
    return value or None


def _has_thought(event: Event) -> bool:
    return bool(
        event.content
        and event.content.parts
        and any(part.thought and part.text for part in event.content.parts)
    )


def _usage(event: Event) -> TokenUsage | None:
    value = event.usage_metadata
    if not value:
        return None
    return TokenUsage(
        prompt_tokens=getattr(value, "prompt_token_count", 0) or 0,
        output_tokens=getattr(value, "candidates_token_count", 0) or 0,
        total_tokens=getattr(value, "total_token_count", 0) or 0,
        cached_tokens=getattr(value, "cached_content_token_count", 0) or 0,
        reasoning_tokens=getattr(value, "thoughts_token_count", 0) or 0,
    )


def serialize_event(event: Event) -> AgentEvent:
    calls = event.get_function_calls()
    responses = event.get_function_responses()
    text = _text(event)
    has_thought = _has_thought(event)
    state_delta = dict(event.actions.state_delta or {})

    if event.error_code:
        kind = "error"
    elif calls:
        kind = "tool_call"
    elif responses:
        kind = "tool_result"
    elif event.partial and text:
        kind = "text_delta"
    elif event.partial and has_thought:
        kind = "agent_progress"
    elif event.is_final_response() and text:
        kind = "message"
    elif state_delta:
        kind = "state"
    else:
        kind = "agent_event"

    return AgentEvent(
        id=event.id,
        invocation_id=event.invocation_id,
        kind=kind,
        author=event.author,
        node_path=event.node_info.path,
        partial=bool(event.partial),
        final=event.is_final_response(),
        turn_complete=bool(event.turn_complete),
        text_delta=text,
        tool_names=[item.name or "unknown" for item in [*calls, *responses]],
        state_delta=state_delta,
        usage=_usage(event),
        model=event.model_version,
        error="request_failed" if event.error_code else None,
        timestamp=event.timestamp,
    )


def add_usage(total: TokenUsage, event: AgentEvent) -> None:
    if event.partial or not event.usage:
        return
    total.prompt_tokens += event.usage.prompt_tokens
    total.output_tokens += event.usage.output_tokens
    total.total_tokens += event.usage.total_tokens
    total.cached_tokens += event.usage.cached_tokens
    total.reasoning_tokens += event.usage.reasoning_tokens
