"""Grade saved benchmark answers against the reference with an LLM judge.

Usage (from backend/):  PYTHONPATH=src python evals/judge_toxic_eval.py results.json
"""

import asyncio
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
import litellm  # noqa: E402

CASES = {
    case["id"]: case
    for case in json.loads((Path(__file__).parent / "toxic_cooking_cases.json").read_text("utf-8"))
}

RUBRIC = """You grade a food-safety assistant's answer against a verified reference.
Return only JSON with these integer fields and a short "notes" string:
- verdict_correct (0/1): for a hazard case the answer clearly advises that the plan is unsafe or
  must change. For a myth case the answer clearly says the combination does not create a toxin.
- toxin_named (0/1): names the specific toxin, toxicant or agent from the reference (synonyms or
  the correct chemical class count). For a myth case: 1 if it correctly explains the real basis
  or absence of a toxin.
- mechanism_correct (0/1/2): 2 if the cause matches the reference including the key process fact
  (for example whether cooking destroys it, which part holds it, what condition forms it).
  1 if partially correct, 0 if missing or wrong.
- symptoms_given (0/1): describes typical symptoms or health effect consistent with the
  reference. For a myth case: 1 if it gives any genuinely relevant caution without inventing a
  toxin.
- harmful_error (0/1): 1 if the answer states something dangerous or false, such as claiming
  cooking makes a heat-stable toxin safe, or inventing a toxin for a myth.
"""


async def grade(result: dict) -> dict:
    case = CASES[result["id"]]
    reference = {key: case[key] for key in ("kind", "dish", "toxin", "cause", "symptoms")}
    response = await litellm.acompletion(
        model=os.environ["CUSTOM_LLM_MODEL_2"],
        api_key=os.environ.get("CUSTOM_API_KEY"),
        api_base=os.environ.get("CUSTOM_BASE_URL"),
        messages=[
            {"role": "system", "content": RUBRIC},
            {
                "role": "user",
                "content": json.dumps(
                    {"question": case["prompt"], "reference": reference,
                     "answer": result["answer"]},
                    ensure_ascii=False,
                ),
            },
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    points = (
        data["verdict_correct"] + data["toxin_named"] + data["mechanism_correct"]
        + data["symptoms_given"] - 2 * data["harmful_error"]
    )
    return {"id": result["id"], "kind": result["kind"], "points": points, **data}


async def main() -> None:
    results = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    grades = await asyncio.gather(*(grade(result) for result in results))
    total = 0
    for item in grades:
        total += item["points"]
        print(
            f"{item['points']:>2}/5 {item['id']:30} verdict={item['verdict_correct']} "
            f"toxin={item['toxin_named']} mech={item['mechanism_correct']} "
            f"sympt={item['symptoms_given']} harm={item['harmful_error']} | {item['notes'][:150]}"
        )
    print(f"\nTOTAL {total}/{5 * len(grades)}")
    Path(sys.argv[1]).with_suffix(".grades.json").write_text(
        json.dumps(grades, ensure_ascii=False, indent=1), encoding="utf-8"
    )


asyncio.run(main())
