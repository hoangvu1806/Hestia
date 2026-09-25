# Hestia Backend — FastAPI & Google ADK Culinary Intelligence Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://python.org)
[![Google ADK](https://img.shields.io/badge/Google-ADK%20Agents-4285F4?style=flat&logo=google)](https://github.com/google/agent-development-kit)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-AsyncPG-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![MinIO](https://img.shields.io/badge/MinIO-Object%20Store-C72C48?style=flat&logo=minio)](https://min.io/)

High-performance asynchronous backend powering **Hestia** — built around Google Agent Development Kit (ADK), PostgreSQL session & food compound storage, and Server-Sent Events (SSE) streaming.

---

## 🏗️ Architecture & Multi-Agent Design

The backend uses a specialist multi-agent coordination topology:

```text
               User Prompt / Ingredient Image
                            │
                            ▼
                  ┌───────────────────┐
                  │    Root Agent     │ <── Top-level conversational coordinator
                  └─────────┬─────────┘
                            │
            ┌───────────────┴───────────────┐
            │ Calls Agent Tool              │ Calls Agent Tool
            ▼                               ▼
  ┌───────────────────┐           ┌───────────────────┐
  │   Food Analysis   │           │     Research      │
  │       Agent       │           │       Agent       │
  └─────────┬─────────┘           └─────────┬─────────┘
            │                               │
  ┌─────────┴─────────┐           ┌─────────┴─────────┐
  │ • FooDB Compounds │           │ • Ai2 Asta Scholar│
  │ • USDA Retention  │           │ • PubChem CIDs    │
  │ • EFSA Tox Hazards│           │ • EFSA Hazard Data│
  │ • D/z Inactivation│           │ • Chemical SMILES │
  └───────────────────┘           └───────────────────┘
```

1. **Root Agent**: Handles conversational flow, user interaction, clarification questions, and synthesizing final, practical kitchen instructions.
2. **Food Analysis Agent**: Dissects ingredients into chemical constituents, computes thermal retention factors, models Maillard/protein reactions, and screens food-safety risks.
3. **Research Agent**: Queries scientific databases, verifies chemical identifiers via PubChem, and retrieves peer-reviewed food science literature through Semantic Scholar / Ai2 Asta.

---

## 📁 Directory Structure

```text
backend/
├── adk_agents/       # Prototyping directory for Google ADK agents
├── dataset/          # Raw dataset documentation and SQLite import sources
├── scripts/          # Database migration & schema swapping scripts
├── src/
│   ├── agents/       # Production ADK agents and custom tool definitions
│   │   ├── root_agent.py
│   │   ├── food_analysis_agent.py
│   │   ├── research_agent.py
│   │   ├── image_tools.py
│   │   └── tools.py
│   ├── api/          # FastAPI routes
│   │   ├── dependencies.py # Firebase token & session dependencies
│   │   └── v1/
│   │       ├── router.py   # Aggregated v1 API router
│   │       └── routes/     # chat.py, library.py, sessions.py, health.py
│   ├── auth/         # Firebase Admin SDK authentication boundary
│   ├── core/         # Pydantic Settings & application configuration
│   ├── schemas/      # Request/response contracts (Chat, Session, Health)
│   ├── services/     # Agent runtime, PostgreSQL adapters, MinIO storage
│   └── main.py       # FastAPI application factory
├── tests/            # Automated test suite (Pytest & AsyncIO)
├── Dockerfile        # Production multi-stage Docker build
└── pyproject.toml    # Dependencies and Ruff linting rules
```

---

## 🛠️ Local Development Setup

### 1. Configure Environment

```powershell
cd backend
Copy-Item .env.example .env
python -m pip install -e ".[dev]"
```

Place your Firebase Admin SDK service-account credentials at `backend/secrets/firebase/service-account.json`.

Update `backend/.env`:
```dotenv
HESTIA_SESSION_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/hestia
HESTIA_FIREBASE_PROJECT_ID=your-firebase-project-id
HESTIA_FIREBASE_CREDENTIALS_PATH=secrets/firebase/service-account.json
HESTIA_S3_ENDPOINT_URL=http://localhost:9000
HESTIA_S3_ACCESS_KEY_ID=your-access-key
HESTIA_S3_SECRET_ACCESS_KEY=your-secret-key
HESTIA_S3_BUCKET=hestia

CUSTOM_API_KEY=your-provider-key
CUSTOM_BASE_URL=https://openrouter.ai/api/v1
CUSTOM_LLM_MODEL_1=openrouter/google/gemini-3.5-flash-lite
CUSTOM_LLM_MODEL_2=openrouter/qwen/qwen3.6-35b-a3b
CUSTOM_IMAGE_GEN_MODEL_NAME=bytedance/sdxl-lightning
ASTA_API_KEY=your-asta-key
```

### 2. Run Database Migration

Import FooDB SQLite records into PostgreSQL:
```powershell
$env:PYTHONPATH = "src"
python scripts/migrate_food_intelligence_to_postgres.py --source dataset/processed/foodb_compounds.sqlite3
```

### 3. Start Development Server

```powershell
python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src
```

---

## 📡 API v1 Reference

All endpoints are nested under `/api/v1`.

### Health Check
- `GET /api/v1/health`: Checks backend responsiveness and database connectivity.

### Food & Ingredient Library
- `GET /api/v1/library/discover`: Discovers curated meal categories and ingredients.
- `GET /api/v1/library/search?q={query}`: Full-text search across dishes, ingredients, and FooDB compounds.
- `GET /api/v1/library/meals/{meal_id}`: Retrieves comprehensive dish details, recipe steps, and constituent compounds.
- `GET /api/v1/library/ingredients/profile?name={name}`: Retrieves USDA nutrient breakdown and FooDB chemical markers.

### Sessions & Chat
- `POST /api/v1/sessions`: Create a new private conversation session.
- `GET /api/v1/sessions`: List user's sessions.
- `GET /api/v1/sessions/{session_id}`: Get session metadata.
- `PATCH /api/v1/sessions/{session_id}`: Update session title or state.
- `DELETE /api/v1/sessions/{session_id}`: Delete session and associated image attachments.
- `GET /api/v1/sessions/{session_id}/events`: Retrieve event history.
- `POST /api/v1/sessions/{session_id}/messages`: Submit message synchronously.
- `POST /api/v1/sessions/{session_id}/messages/stream`: Submit message and receive streaming SSE events.

---

## 🧪 Code Quality & Tests

```powershell
# Run Ruff lint and format checks
python -m ruff check src tests

# Run Unit Tests
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
python -m pytest tests -q
```
