"""Run the toxic-cooking benchmark through the real Hestia agent and trace every step.

Usage (from backend/):  PYTHONPATH=src python evals/run_toxic_eval.py [out.json] [case_id ...]
"""

import asyncio
import json
import sys
import time
from pathlib import Path

from google.adk.agents.run_config import RunConfig, StreamingMode, ToolThreadPoolConfig
from google.adk.apps import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.food_risk_agent import root_agent

CASES = json.loads((Path(__file__).parent / "toxic_cooking_cases.json").read_text("utf-8"))
CONCURRENCY = 5


def short(value: object, limit: int = 500) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[:limit] + "…"


def score(case: dict, answer: str) -> dict:
    lowered = f" {answer.lower()} "
    groups = [any(term.lower() in lowered for term in group) for group in case["expect"]]
    return {"passed": all(groups), "groups": groups}


async def run_case(runner: Runner, sessions: InMemorySessionService, case: dict) -> dict:
    sid = case["id"]
    await sessions.create_session(app_name="hestia", user_id="eval", session_id=sid)
    trace: list[str] = []
    answer = ""
    brief = ""
    start = time.perf_counter()
    try:
        async for event in runner.run_async(
            user_id="eval",
            session_id=sid,
            new_message=types.Content(role="user", parts=[types.Part(text=case["prompt"])]),
            run_config=RunConfig(
                streaming_mode=StreamingMode.NONE,
                max_llm_calls=20,
                tool_thread_pool_config=ToolThreadPoolConfig(max_workers=8),
            ),
        ):
            if event.error_code:
                trace.append(f"ERROR {event.author}: {event.error_code} {event.error_message}")
            for part in (event.content.parts if event.content else None) or []:
                if part.function_call:
                    trace.append(f"CALL {event.author} -> {part.function_call.name}"
                                 f"({short(part.function_call.args, 300)})")
                elif part.function_response:
                    response = part.function_response.response
                    trace.append(f"RESP {part.function_response.name} <- {short(response, 400)}")
                    if part.function_response.name in {"food_analysis_agent", "research_agent"}:
                        brief = str((response or {}).get("result", ""))
                elif part.text and not part.thought and event.author == "root_agent":
                    answer = part.text
    except Exception as exc:  # noqa: BLE001
        trace.append(f"EXCEPTION {type(exc).__name__}: {exc}")
    return {
        "id": sid,
        "kind": case["kind"],
        "seconds": round(time.perf_counter() - start, 1),
        "score": score(case, answer),
        "brief_score": score(case, brief) if brief else None,
        "trace": trace,
        "brief": brief,
        "answer": answer,
    }


async def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "toxic_eval_result.json")
    selected = set(sys.argv[2:])
    cases = [case for case in CASES if not selected or case["id"] in selected]
    sessions = InMemorySessionService()
    runner = Runner(app=App(name="hestia", root_agent=root_agent), session_service=sessions)
    gate = asyncio.Semaphore(CONCURRENCY)

    async def guarded(case: dict) -> dict:
        async with gate:
            return await run_case(runner, sessions, case)

    results = await asyncio.gather(*(guarded(case) for case in cases))
    await runner.close()
    out.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    for result in results:
        mark = "PASS" if result["score"]["passed"] else "FAIL"
        specialist = any("food_analysis_agent" in line for line in result["trace"])
        print(f"{mark} {result['id']:32} {result['kind']:6} {result['seconds']:6}s "
              f"specialist={specialist} groups={result['score']['groups']}")
    passed = sum(result["score"]["passed"] for result in results)
    print(f"\n{passed}/{len(results)} passed")


asyncio.run(main())
