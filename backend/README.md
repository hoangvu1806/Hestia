# Hestia Backend

FastAPI backend for Hestia, built around Google ADK sessions, events and streaming.

## Run locally

```powershell
Copy-Item .env.example .env
python -m pip install -e ".[dev]"
python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src
```

Configure `HESTIA_FIREBASE_CREDENTIALS` with the path to a Firebase Admin service-account
JSON file. Authenticated API calls must send `Authorization: Bearer <firebase-id-token>`.
The backend uses the verified Firebase `uid` as the ADK session owner and does not copy the
Firebase profile into an application user database.

Các lệnh trên sử dụng trực tiếp Python environment đang active trong terminal;
dự án không tạo hoặc quản lý virtual environment riêng.

Open `http://localhost:8000/docs` or check:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
```

## Structure

```text
src/
├── agents/            # Google ADK root and specialist agents
├── api/v1/routes/     # Versioned REST and SSE endpoints
├── auth/              # Boundary reserved for authentication
├── core/              # Configuration
├── schemas/           # Public request/response contracts
├── services/          # ADK runner, session and event adapters
└── main.py            # FastAPI application factory
tests/
```

## API v1

All endpoints use `/api/v1`. Session and chat endpoints require a Firebase ID token. Health and
API documentation remain public.

```text
POST   /api/v1/sessions
GET    /api/v1/sessions
GET    /api/v1/sessions/{session_id}
PATCH  /api/v1/sessions/{session_id}
DELETE /api/v1/sessions/{session_id}
GET    /api/v1/sessions/{session_id}/events
POST   /api/v1/sessions/{session_id}/messages
POST   /api/v1/sessions/{session_id}/messages/stream
```

The streaming endpoint is Server-Sent Events. It emits `text_delta`, `tool_call`, `tool_result`,
`state`, `message`, `error`, and `done` events. Each event identifies its author and invocation;
model usage is included when ADK provides it, while `done` contains aggregate token usage and the
latest session-state snapshot. Inline images are sent as `{mime_type, data}` where `data` is base64.

## Image-to-compounds experiment

FooDB data and licensing notes are documented in `dataset/README.md`. Configure one
vision-capable model using LiteLLM's provider/model naming in `.env`:

```dotenv
CUSTOM_API_KEY=...
CUSTOM_BASE_URL=https://openrouter.ai/api/v1
CUSTOM_LLM_MODEL_1=openrouter/google/gemini-3.5-flash-lite
CUSTOM_LLM_MODEL_2=openrouter/qwen/qwen3.6-35b-a3b
```

For a Google AI Studio / Gemini API key, use Gemini directly through LiteLLM
instead of the OpenRouter endpoint. Set these values in your local `.env`:

```dotenv
CUSTOM_API_KEY=your_gemini_api_key
CUSTOM_BASE_URL=
CUSTOM_LLM_MODEL_1=gemini/gemini-2.5-flash
CUSTOM_LLM_MODEL_2=gemini/gemini-2.5-flash
```

Restart the backend after changing `.env`. `ASTA_API_KEY` is a separate credential
for literature search; the Gemini key does not replace it. Local FooDB/OpenFoodTox
indices are still required for composition and toxicology lookups.

Run the CLI. The short form treats a bare image path as the `analyze` command:

```powershell
python experiments/image_to_compounds.py analyze path\to\ingredients.jpg
python experiments/image_to_compounds.py path\to\ingredients.jpg
```

Query FooDB directly without making a model request:

```powershell
python experiments/image_to_compounds.py lookup garlic "garden onion" -n 10
python experiments/image_to_compounds.py lookup garlic --quantified-only
python experiments/image_to_compounds.py analyze test.jpg --attention -n 10
```

Useful operational commands:

```powershell
python experiments/image_to_compounds.py info
python experiments/image_to_compounds.py build-index --force
python experiments/image_to_compounds.py build-hazards --force
python experiments/image_to_compounds.py analyze test.jpg --json
python experiments/image_to_compounds.py analyze test.jpg -o result.json
```

## Multi-agent food-risk app

Start the Google ADK web UI from the `backend` directory:

```powershell
adk web adk_agents
```

Open `http://127.0.0.1:8000` and select `food_risk_agent`. It behaves as a normal chatbot for
greetings, casual conversation and simple cooking questions. Attach an image and ask for deep
chemical/risk analysis only when needed. `CUSTOM_LLM_MODEL_1` must support vision and tool calling;
specialists use `CUSTOM_LLM_MODEL_2`.

The copied source agent can also be inspected with `adk web src/agents`. The original
`adk_agents/food_risk_agent` folder is intentionally kept unchanged as the working prototype.

On Windows, ADK automatically disables reload. After changing agent code, stop the current server
with `Ctrl+C` and run `adk web adk_agents` again so Python does not retain a failed/cached import.

`root_agent` answers ordinary chat itself. For an explicit specialist request it may call one of
two agent tools: food-risk analysis or academic search. Their evidence is returned to
`root_agent`, which always writes the final natural answer. There is no fixed output schema or
custom renderer.
It retrieves FooDB composition records, resolves arbitrary structures through PubChem, searches
Ai2 Asta/Semantic Scholar for papers and supporting snippets, and checks EFSA
OpenFoodTox/PubChem hazard evidence. Set `ASTA_API_KEY` in `.env`; it is sent only as the Asta MCP
`x-api-key` header. A proposed reaction is not accepted merely because the model knows it or
because two compounds coexist.

This is evidence-grounded screening, not molecular simulation: without experimental conditions,
yield and exposure data it must not predict a product concentration or declare a serving unsafe.

The design follows the literature-retrieval pattern used by
[WFSR's food-safety hazard extractor](https://github.com/WFSRDataScience/LLMForChemicalFoodSafetyHazardExtraction)
and the tool-grounded chemistry pattern demonstrated by
[ChemCrow](https://github.com/ur-whitelab/chemcrow-public). General reaction planners such as
[ASKCOS](https://github.com/ASKCOS/askcos-core) and datasets such as
[ORD](https://github.com/open-reaction-database/ord-schema) are not used as cooking simulators:
they target synthetic laboratory reactions and do not establish reaction yield in a food matrix.

The default output is a colored terminal table. `--json` writes clean machine-readable
JSON to stdout, while `-o` saves JSON to a file. Diagnostics and progress go to stderr.
For `analyze`, the same configured LiteLLM model performs vision detection and one batched
semantic reconciliation pass for names that cannot be matched safely by text. `lookup`
remains local-only and never calls the model.
This remains an exploratory lookup, not a food-safety verdict: image recognition,
fuzzy name matching, and FooDB coverage can all be incomplete.
