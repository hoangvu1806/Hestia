<div align="center">

# Hestia

**Evidence-Grounded Multimodal Culinary Assistant & Chemical Hazard Screening**

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Google ADK](https://img.shields.io/badge/Google%20ADK-2.2%2B-4285F4.svg)](https://github.com/google/adk)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20App%20Router-black.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Architecture](#system-architecture) • [Key Features](#key-features) • [Quickstart](#quickstart) • [Multi-Agent Design](#multi-agent-system) • [API & Streaming](#api--event-streaming)

</div>

---

## Overview

**Hestia** is an evidence-grounded culinary and food-safety assistant designed to solve a fundamental flaw in modern AI kitchen companions: **large language model hallucination of culinary risks and non-existent chemical reactions.**

Instead of letting LLMs guess cooking chemistry or generate vague warnings, Hestia enforces **evidence-grounded screening**:
1. **Multimodal Recognition**: Identifies ingredients and physical states directly from user photos.
2. **Deterministic Entity Matching**: Resolves ingredients against canonical knowledge bases (**FooDB** with 70,000+ compounds, **EFSA OpenFoodTox 3.0**, and **PubChem**).
3. **Multi-Agent Orchestration**: Deploys specialized agents under strict tool budgets to verify candidate chemical transformations and pathogen survival via scientific literature (**Europe PMC**, **Semantic Scholar**).
4. **Auditable Answer Contract**: Provides practical culinary guidance with verifiable FooDB citation tags (`[<Compound:FDBxxxxxx>]`) and dynamic **Mermaid.js** hazard pathway diagrams.

> **Principle**: *Evidence-grounded screening, not ungrounded molecular simulation. Without empirical evidence, reaction yield, and intake exposure data, the system never fabricates a chemical verdict.*

---

## System Architecture

```text
                                  User Client
                        (Photo + Intended Cooking Dish)
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Next.js 16 App Router      │
                      │  - Multimodal Upload & Chat   │
                      │  - Mermaid Reaction Visualizer│
                      │  - Bilingual i18n (EN / VI)   │
                      └───────────────┬───────────────┘
                                      │  Server-Sent Events (SSE) Stream
                                      ▼
                      ┌───────────────────────────────┐
                      │        FastAPI Backend        │
                      │  - Session Manager (SQLite)   │
                      │  - Event Serialization Engine │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Google ADK Root Agent      │
                      │  - Multimodal Vision (LiteLLM)│
                      │  - Conversational Guardrails  │
                      └───────┬───────────────┬───────┘
                              │               │
                 (Concrete Cooking/Risk Case) │ (Explicit Literature Query)
                              ▼               ▼
                  ┌───────────────────────┐  ┌───────────────────────┐
                  │ Food Analysis Agent   │  │   Research Agent      │
                  │ (Strict 4-tool budget)│  │ (Ai2 Asta / MCP)      │
                  └───┬───────────────┬───┘  └───────────┬───────────┘
                      │               │                  │
                      ▼               ▼                  ▼
              ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐
              │ FooDB SQLite │ │ OpenFoodTox  │ │ Europe PMC /      │
              │ (Composition)│ │ EFSA Hazard  │ │ Semantic Scholar  │
              └──────────────┘ └──────────────┘ └───────────────────┘
```

---

## Key Features

- **Multimodal Ingredient Vision**: Analyzes ingredient photos, preserving uncertainty (e.g. distinguishing spring onions vs leeks) and physical states (raw, blanched, minced, charred).
- **Hierarchical Multi-Agent Architecture**:
  - `root_agent`: Direct conversational orchestrator; handles casual questions, dish brainstorming, and compiles final natural answers.
  - `food_analysis_agent`: Chemistry specialist enforcing a strict 4-tool budget to avoid runaway loops.
  - `research_agent`: Literature retrieval specialist querying Semantic Scholar via Ai2 Asta MCP.
- **Conservative Entity Resolution**: Custom fuzzy matching (normalized SequenceMatcher + token subset containment with safety score margins) mapping user ingredient names to FooDB entries without false collapsing.
- **Real-Time Streaming UX**: Low-latency Server-Sent Events (SSE) delivering `text_delta`, `tool_call`, `tool_result`, and `done` state updates.
- **Interactive Visual Pathway**: Automatically generates Mermaid diagrams for supported hazardous pathways (e.g., acrylamide formation, solanine accumulation, cross-contamination risks).
- **Production-Grade Monorepo**: Type-safe Next.js frontend paired with async FastAPI backend, tested with Pytest and strict TypeScript compiler.

---

## Monorepo Structure

```text
Hestia/
├── backend/                  # FastAPI & Google ADK backend
│   ├── adk_agents/           # ADK multi-agent configuration
│   ├── dataset/              # FooDB & OpenFoodTox datasets & docs
│   ├── experiments/          # CLI tools (image_to_compounds.py)
│   ├── src/
│   │   ├── agents/           # Production multi-agent definitions
│   │   ├── api/v1/           # Versioned REST & SSE routes
│   │   ├── core/             # Configuration & environment settings
│   │   ├── schemas/          # Pydantic v2 request/response models
│   │   ├── services/         # Agent runtime, sessions, and events
│   │   └── main.py           # Application entrypoint
│   ├── tests/                # Pytest test suite
│   ├── pyproject.toml        # Backend dependencies & metadata
│   └── README.md             # Backend detailed documentation
├── frontend/                 # Next.js 16 Web application
│   ├── src/
│   │   ├── app/[locale]/     # Statically generated localized routes
│   │   ├── components/       # Chat shell, Mermaid viewer, theme toggle
│   │   ├── i18n/             # English & Vietnamese translation dicts
│   │   └── lib/              # SSE streaming client & API adapters
│   ├── package.json          # Frontend dependencies & scripts
│   └── README.md             # Frontend detailed documentation
├── docs/                     # Product Whitepapers & Architecture Specs
│   ├── hestia-core-agent-idea.md
│   └── hestia_chemistry_first_whitepaper_prd_v2.html
└── README.md                 # Project root documentation
```

---

## Quickstart

### Prerequisites
- Python 3.11 or higher
- Node.js 20 or higher & npm
- Git

### 1. Backend Setup

```powershell
cd backend

# Copy environment template
Copy-Item .env.example .env

# Point HESTIA_FIREBASE_CREDENTIALS at a Firebase Admin service-account JSON file.

# Install dependencies in editable mode
python -m pip install -e ".[dev]"

# Run FastAPI server (runs on port 8484)
python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src
```

> The API health check is accessible at `http://localhost:8484/api/v1/health` and Swagger UI at `http://localhost:8484/docs`.

### 2. Frontend Setup

```powershell
cd frontend

# Copy environment template
Copy-Item .env.example .env.local

# Fill NEXT_PUBLIC_FIREBASE_* from the Firebase Web App configuration.

# Install dependencies
npm install

# Run development server (serves on port 3434)
npm run dev
```

Open `http://localhost:3434` in your browser.

The web app uses Firebase Google SSO. FastAPI verifies the Firebase ID token and uses its `uid`
to isolate agent sessions. Hestia does not create a separate user/profile record; application
data storage can be connected to PostgreSQL independently.

---

## Multi-Agent System

Hestia employs a **Google ADK** multi-agent setup configured in `backend/src/agents/food_risk_agent`:

| Agent | Model Role | Primary Responsibility |
| :--- | :--- | :--- |
| **`root_agent`** | Multimodal Vision (`CUSTOM_LLM_MODEL_1`) | Natural language dialogue, image perception, intent routing, and synthesizing the final culinary response. |
| **`food_analysis_agent`** | Reasoning Specialist (`CUSTOM_LLM_MODEL_2`) | Investigates chemical profiles, queries FooDB SQLite, checks EFSA OpenFoodTox endpoints, and enforces tool budget. |
| **`research_agent`** | Academic Specialist (`CUSTOM_LLM_MODEL_2`) | Traverses scientific literature via Semantic Scholar / Ai2 Asta MCP when explicit research citations are requested. |

### Tool Budgeting & Guardrails
To prevent runaway loops and uncontrolled token usage, `food_analysis_agent` implements callback hooks:
- **`_count_evidence_tool`**: Tracks evidence retrieval count in session state.
- **`_finish_when_budget_used`**: Enforces a hard limit of 4 tool calls per turn, automatically switching to `finish_task` when the budget is reached.

---

## API & Event Streaming

Chat interactions connect via Server-Sent Events (SSE) at:
`POST /api/v1/sessions/{session_id}/messages/stream`

### Stream Event Contract:
- `ready`: Session initialized.
- `text_delta`: Incremental tokens of the final synthesized answer.
- `tool_call`: Dispatched tool action metadata.
- `tool_result`: Returned evidence from scientific tools.
- `error`: Structured failure state without exposing raw stack traces.
- `done`: Emits aggregate token usage and final session snapshot.

---

## Datasets & Indexing

1. **FooDB**: Over 70,000 food-to-compound relationships.
2. **EFSA OpenFoodTox 3.0**: European Food Safety Authority chemical hazards database.

To rebuild local SQLite indices from raw archives:
```powershell
cd backend
python experiments/image_to_compounds.py build-index --force
python experiments/image_to_compounds.py build-hazards --force
```
See [`backend/dataset/README.md`](backend/dataset/README.md) for licensing and source details.

---

## Testing & Quality Assurance

### Run Backend Tests:
```powershell
cd backend
python -m pytest tests
```

### Run Frontend Type Check & Lint:
```powershell
cd frontend
npm run lint
```

---

## Scientific Acknowledgments

Hestia's evidence-grounding methodology is inspired by research in food informatics and chemical reasoning:
- **[FoodAtlas](https://github.com/AI-Institute-Food-Systems/foodatlas)**: Grounded food knowledge graphs.
- **[ChemCrow](https://github.com/ur-whitelab/chemcrow-public)**: Tool-grounded chemistry reasoning.
- **[WFSR Food Safety LLM](https://github.com/WFSRDataScience/LLMForChemicalFoodSafetyHazardExtraction)**: Chemical food-safety hazard extraction from scientific literature.
- **[NICE-Food KG](https://github.com/rivm-syso/nicekg_processing)**: Connecting nutritional and contaminant data.

---

## Disclaimer

*Hestia is an experimental research and educational tool. It provides evidence-grounded screening based on public scientific datasets, not clinical or laboratory diagnostics. Always follow certified public food-safety guidelines when handling and preparing food.*
