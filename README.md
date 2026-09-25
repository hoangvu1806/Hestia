# Hestia

Hestia is a web application for ingredient research, cooking guidance, and evidence-based food-safety screening. It combines a static Next.js client with a FastAPI API, Firebase authentication, PostgreSQL-backed food data, and a Google ADK agent runtime.

The project is designed to distinguish observed facts, database matches, and model inference. Chemical records are treated as compositional evidence, not as proof that a reaction occurred or that a serving is safe.

## What is included

- Multimodal chat with image attachments and Server-Sent Events streaming
- Ingredient search across TheMealDB, USDA FoodData Central, and a local FooDB index
- Food-compound profiles with explicit quantified and reported evidence labels
- Firebase ID-token verification and per-user session isolation
- PostgreSQL persistence for conversations and food-intelligence data
- Specialist agents for food chemistry, safety analysis, and literature retrieval
- English and Vietnamese interface preferences, light and dark themes
- Static frontend export suitable for deployment behind any static file server

## Architecture

```text
Browser
  │
  ├── Firebase Authentication
  │
  └── Next.js static application (port 3434)
          │
          ├── REST: sessions, food library, generated images
          └── SSE: streamed chat events
                  │
                  ▼
             FastAPI (port 8484)
                  │
                  ├── Google ADK agent runtime
                  ├── PostgreSQL sessions
                  ├── FooDB / OpenFoodTox index
                  └── External data and literature services
```

## Repository layout

```text
backend/
  adk_agents/       ADK development entrypoint
  dataset/          Dataset documentation and local import inputs
  scripts/          Database migration utilities
  src/
    agents/         Production agent definitions and tools
    api/v1/         HTTP and SSE routes
    auth/           Firebase token verification
    core/           Application configuration
    schemas/        Public request and response models
    services/       Agent, session, event, and food-library services
  tests/            Backend test suite
frontend/
  public/           Static assets
  src/app/          Next.js routes and global styles
  src/components/   Application and marketing components
  src/i18n/         Interface dictionaries
  src/lib/          Firebase and API clients
docs/               Product and architecture notes
```

## Requirements

- Python 3.11 or later
- Node.js 20 or later
- npm
- PostgreSQL
- A Firebase project with Google sign-in enabled
- Credentials for the configured model provider

The food library can use the public TheMealDB test key and USDA `DEMO_KEY` for local development. Production deployments should use their own API keys and respect each provider's rate limits and terms.

## Local setup

### 1. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
python -m pip install -e ".[dev]"
```

Place the Firebase Admin SDK service-account file at:

```text
backend/secrets/firebase/service-account.json
```

The `backend/secrets/` directory is ignored by Git. Do not commit service-account credentials. A different location can be configured with `HESTIA_FIREBASE_CREDENTIALS_PATH`; relative paths are resolved from `backend/`.

Set the required values in `backend/.env`:

```dotenv
HESTIA_SESSION_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE
HESTIA_FIREBASE_PROJECT_ID=your-firebase-project-id
HESTIA_FIREBASE_CREDENTIALS_PATH=secrets/firebase/service-account.json

CUSTOM_API_KEY=your-provider-key
CUSTOM_BASE_URL=https://openrouter.ai/api/v1
CUSTOM_LLM_MODEL_1=provider/vision-capable-model
CUSTOM_LLM_MODEL_2=provider/reasoning-model
CUSTOM_IMAGE_GEN_MODEL_NAME=provider/image-model

ASTA_API_KEY=your-asta-key
```

`CUSTOM_LLM_MODEL_1` must support image input and tool calling. The database password must be URL-encoded when it contains reserved characters.

Start the API:

```powershell
python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src
```

Useful endpoints:

- API documentation: `http://127.0.0.1:8484/docs`
- Health check: `http://127.0.0.1:8484/api/v1/health`

### 2. Configure the frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
```

Fill in the public Firebase web configuration in `frontend/.env.local`. These values identify the Firebase web application; they are separate from the private Admin SDK service-account file.

```dotenv
NEXT_PUBLIC_HESTIA_API_URL=http://127.0.0.1:8484/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Build and serve the static application:

```powershell
npm run dev
```

Open `http://localhost:3434`.

`npm run dev` performs a production-style static export before serving `frontend/out/`. Use `npm run build` when only the export is required and `npm run start` to serve an existing export.

## Database import

The running application reads food-intelligence data from PostgreSQL. Local SQLite files are import inputs only and are not used at runtime.

```powershell
cd backend
$env:PYTHONPATH = "src"
python scripts/migrate_food_intelligence_to_postgres.py `
  --source dataset/processed/foodb_compounds.sqlite3
```

The migration stages the imported tables in a separate schema, validates row counts, builds indexes, and then swaps the schema into place. See [backend/dataset/README.md](backend/dataset/README.md) for source and licensing notes.

## API overview

All application routes are under `/api/v1`.

```text
GET    /health
GET    /library/discover
GET    /library/search
GET    /library/meals/{meal_id}
GET    /library/ingredients/profile
POST   /sessions
GET    /sessions
GET    /sessions/{session_id}
PATCH  /sessions/{session_id}
DELETE /sessions/{session_id}
GET    /sessions/{session_id}/events
POST   /sessions/{session_id}/messages
POST   /sessions/{session_id}/messages/stream
GET    /generated-images/{image_id}
```

Authenticated routes expect a Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

The streaming message endpoint emits named SSE events such as `ready`, `text_delta`, `tool_call`, `tool_result`, `error`, and `done`.

## Development checks

Backend:

```powershell
cd backend
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
python -m pytest tests -q
python -m ruff check src tests
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

## Security notes

- Keep `.env`, `.env.local`, Firebase Admin SDK credentials, and database exports out of version control.
- Rotate a service-account key immediately if it is exposed in a commit, build artifact, log, or screenshot.
- The frontend Firebase configuration is public by design; access control must be enforced by Firebase rules and backend token verification.
- Generated analysis is not a substitute for laboratory testing, medical advice, or official food-safety guidance.

## Data sources

- [FooDB](https://foodb.ca/) for food and compound relationships
- [USDA FoodData Central](https://fdc.nal.usda.gov/) for nutrient records
- [TheMealDB](https://www.themealdb.com/) for recipes and ingredient imagery
- [EFSA OpenFoodTox](https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox) for toxicology records
- [PubChem](https://pubchem.ncbi.nlm.nih.gov/) for chemical identity and hazard references
- [Semantic Scholar](https://www.semanticscholar.org/) through Ai2 Asta for literature retrieval

Review the terms and attribution requirements of each source before redistributing data or deploying the application publicly.

## Project status

Hestia is under active development. Interfaces, database schemas, and agent behavior may change without backward-compatibility guarantees.
