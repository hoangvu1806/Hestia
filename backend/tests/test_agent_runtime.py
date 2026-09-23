import asyncio

from core.config import Settings
from services.agent_runtime import AgentRuntime


def test_real_agent_can_initialize_and_store_session(tmp_path, monkeypatch) -> None:
    """Exercise the real agent imports without making a model or MCP request."""
    monkeypatch.setenv("CUSTOM_LLM_MODEL_1", "gemini/gemini-2.5-flash")
    monkeypatch.setenv("CUSTOM_LLM_MODEL_2", "gemini/gemini-2.5-flash")
    monkeypatch.setenv("CUSTOM_API_KEY", "test-key-not-used")
    monkeypatch.setenv("CUSTOM_BASE_URL", "")

    async def scenario() -> None:
        runtime = AgentRuntime(Settings(session_db_path=tmp_path / "sessions.sqlite3"))
        try:
            session = await runtime.create_session("test-user", None, {"test": True})
            stored = await runtime.get_session("test-user", session.id)
            assert stored.state == {"test": True}
            await runtime.delete_session("test-user", session.id)
            assert await runtime.list_sessions("test-user") == []
        finally:
            await runtime.close()

    asyncio.run(scenario())
