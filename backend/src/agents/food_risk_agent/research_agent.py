"""Scientific literature specialist."""

from typing import Any

from google.adk.agents import LlmAgent
from google.adk.agents.context import Context
from google.adk.models.llm_request import LlmRequest
from google.adk.tools import BaseTool
from google.genai import types

from .runtime import asta, model

TOOL_BUDGET = 5


def _count_research_tool(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: Context,
    tool_response: Any,
) -> None:
    del args, tool_response
    if tool.name != "finish_task":
        key = "temp:research_tool_count"
        tool_context.state[key] = int(tool_context.state.get(key, 0)) + 1


def _finish_when_budget_used(callback_context: Context, llm_request: LlmRequest) -> None:
    if int(callback_context.state.get("temp:research_tool_count", 0)) < TOOL_BUDGET:
        return None
    llm_request.config.tool_config = types.ToolConfig(
        function_calling_config=types.FunctionCallingConfig(
            mode=types.FunctionCallingConfigMode.ANY,
            allowed_function_names=["finish_task"],
        )
    )
    return None


research_agent = LlmAgent(
    name="research_agent",
    description=(
        "Finds scientific papers and source metadata when the user explicitly asks for research "
        "or references, or when a non-cooking scientific claim needs literature support."
    ),
    model=model("CUSTOM_LLM_MODEL_2"),
    mode="task",
    tools=[
        asta(
            [
                "search_papers_by_relevance",
                "search_paper_by_title",
                "get_paper",
                "snippet_search",
            ]
        )
    ],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    after_tool_callback=_count_research_tool,
    before_model_callback=_finish_when_budget_used,
    instruction="""
ROLE
You are Hestia's scientific evidence specialist. You retrieve evidence for an explicit paper,
literature, or source request. You do not answer ordinary cooking questions.

METHOD
- Convert the request into one focused research question.
- Start with asta_snippet_search using a short natural-language query. Its results already
  contain titles, authors, years, and the supporting passage, so they are often enough.
- When you need more papers, call asta_search_papers_by_relevance once with 3-8 keywords and
  fields exactly "title,year,authors,url,abstract,venue". Do not request doi or any other field.
- Call asta_get_paper only for the one or two papers whose year, URL, or abstract is missing.
  Use fields exactly "title,year,authors,url,abstract".
- Prefer primary studies and reviews that match the food, process, and outcome asked about.
- For each useful paper state the title, first author, year, a URL that appears in the tool
  result, and the precise claim it supports. Report a number only when the abstract or snippet
  states it.
- Distinguish evidence from an abstract or snippet from evidence verified in full text.
- Mark indirect or uncertain relevance as provisional.

CONSTRAINTS
At most five tool calls in total. Independent calls may run in the same step. Never invent
metadata or URLs, infer a food risk from a paper without matching food and process facts, or
request large citation/reference payloads. If a call fails, change the parameters that caused
the error instead of repeating them, or report the limitation briefly.

OUTPUT
After research is complete, call finish_task with a compact evidence brief of 3-5 papers in its
result field. This is evidence for the root agent, not a user-facing report.
""".strip(),
)
