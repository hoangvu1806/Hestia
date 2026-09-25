import re

from agents.food_risk_agent.root_agent import root_agent


def test_root_instruction_has_no_accidental_adk_state_placeholders() -> None:
    placeholders = re.findall(r"\{[^{}]+\}", root_agent.instruction)

    assert placeholders == []


def test_root_instruction_requires_proactive_evidence_and_contextual_visuals() -> None:
    instruction = root_agent.instruction.lower()

    assert "evidence is proactive, not opt-in" in instruction
    assert "never ask the user whether they want a visual first" in instruction
    assert "must not contain the semicolon character" in instruction
    assert "risk-to-control analysis is mandatory" in instruction
    assert "minimum verified recipe shape" in instruction
    assert "visual planning is a required reasoning step" in instruction
    assert "include a process flowchart by default" in instruction
    assert "requires one illustration unless the user asks for text only" in instruction
