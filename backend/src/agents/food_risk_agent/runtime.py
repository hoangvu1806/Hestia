"""Shared model and MCP configuration for Hestia agents."""

import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm, LiteLLMClient
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from pydantic import Field

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


class WebLiteLlm(LiteLlm):
    llm_client: LiteLLMClient = Field(default_factory=LiteLLMClient, exclude=True)


def model(env_name: str) -> WebLiteLlm:
    options = {"model": os.environ[env_name]}
    if value := os.getenv("CUSTOM_API_KEY"):
        options["api_key"] = value
    if value := os.getenv("CUSTOM_BASE_URL"):
        options["api_base"] = value
    return WebLiteLlm(**options)


def asta(names: list[str]) -> McpToolset:
    def headers(_context) -> dict[str, str]:
        return {"x-api-key": os.environ["ASTA_API_KEY"]}

    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url="https://asta-tools.allen.ai/mcp/v1", timeout=30, sse_read_timeout=90
        ),
        tool_filter=names,
        tool_name_prefix="asta",
        header_provider=headers,
    )
