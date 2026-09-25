# Hestia

Hestia is an open-source culinary intelligence application for ingredient research, cooking guidance, and evidence-aware food-safety analysis. It combines a Next.js interface with a FastAPI API, Firebase Authentication, PostgreSQL, private S3-compatible object storage, and a Google ADK agent runtime.

Production: [hestia.vectorium.space](https://hestia.vectorium.space/)

## Capabilities

- Multimodal chat with image uploads and Server-Sent Events streaming
- Persistent, user-isolated conversations, uploads, and generated images
- Dish and ingredient discovery through TheMealDB
- Nutrient records from USDA FoodData Central
- Food and compound relationships from a local FooDB index
- Food-chemistry, safety, calculation, and literature-search specialists
- English and Vietnamese interface preferences
- Light and dark themes
- Static frontend export with canonical metadata, structured data, sitemap.xml, robots.txt, and llms.txt

Hestia keeps observations, user-provided facts, database records, calculations, and model inference distinct. A compound record is compositional evidence, not proof that a reaction occurred or that a food is safe.

## Architecture

    Browser
      ├── Firebase Authentication
      ├── Next.js static frontend
      └── FastAPI REST and SSE API
              ├── Google ADK agents
              ├── PostgreSQL sessions and food data
              ├── private MinIO / S3 objects
              └── external food and literature sources

The frontend container serves static files only. It does not proxy API traffic. In production, Cloudflare Tunnel routes the public frontend and /api/v1 traffic to their respective local services.

## Repository layout

    backend/
      dataset/          Dataset notes and local import inputs
      scripts/          Database migration utilities
      src/
        agents/         Agent instructions and tools
        api/v1/         REST and SSE routes
        auth/           Firebase token verification
        core/           Runtime configuration
        services/       Sessions, storage, agents, and food library
      tests/
    frontend/
      public/           Optimized WebP assets
      src/app/          App Router pages and metadata routes
      src/components/   Product and marketing components
      src/lib/          Firebase and API clients
    docs/

## Requirements

- Python 3.11 or later
- Node.js 20 or later
- PostgreSQL 16 or compatible
- An S3-compatible private object store, such as MinIO
- A Firebase project with Google sign-in enabled
- Credentials for the configured model provider

Production deployments should use their own data-provider API keys and follow each provider's rate limits and terms.

## Local development

### Backend

    cd backend
    Copy-Item .env.example .env
    python -m pip install -e ".[dev]"

Store the Firebase Admin service-account file at:

    backend/secrets/firebase/service-account.json

backend/secrets/ is ignored by Git. Never commit the service-account JSON.

Configure the required values in backend/.env:

    HESTIA_SESSION_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE
    HESTIA_FIREBASE_PROJECT_ID=your-firebase-project-id
    HESTIA_FIREBASE_CREDENTIALS_PATH=secrets/firebase/service-account.json
    HESTIA_S3_ENDPOINT_URL=http://100.x.x.x:9000
    HESTIA_S3_ACCESS_KEY_ID=your-access-key
    HESTIA_S3_SECRET_ACCESS_KEY=your-secret-key
    HESTIA_S3_BUCKET=hestia
    HESTIA_S3_REGION=us-east-1
    CUSTOM_API_KEY=your-provider-key
    CUSTOM_BASE_URL=https://provider.example/v1
    CUSTOM_LLM_MODEL_1=provider/vision-and-tools-model
    CUSTOM_LLM_MODEL_2=provider/reasoning-and-tools-model
    CUSTOM_IMAGE_GEN_MODEL_NAME=provider/image-model
    ASTA_API_KEY=your-asta-key

Start the API:

    python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src

- API documentation: http://127.0.0.1:8484/docs
- Health check: http://127.0.0.1:8484/api/v1/health

### Frontend

    cd frontend
    Copy-Item .env.example .env.local
    npm install

Configure the Firebase web application and API origin:

    NEXT_PUBLIC_HESTIA_API_URL=http://127.0.0.1:8484/api/v1
    NEXT_PUBLIC_SITE_URL=https://hestia.vectorium.space
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

Run the local static-export workflow:

    npm run dev

Open http://localhost:3434. npm run build creates frontend/out/, and npm run start serves an existing export.

## Docker Compose

Copy the environment templates, provide the Firebase Admin key, and start the stack:

    Copy-Item compose.env.example .env
    Copy-Item backend/.env.example backend/.env
    docker compose build
    docker compose up -d
    docker compose ps

Compose does not provision or migrate PostgreSQL. Set `HESTIA_SESSION_DATABASE_URL` to the existing
database on the VPS or its private network address. That database must already contain both the
application/session tables and the `food_intelligence` schema.

The default host bindings are local-only:

- frontend: 127.0.0.1:8080
- backend: 127.0.0.1:8484

This is intentional for Cloudflare Tunnel deployments. Configure the tunnel so normal web traffic reaches the frontend and /api/v1/* reaches the backend. Nginx in the frontend image only serves static assets.

BuildKit cache mounts and .docker-cache/ preserve npm, Python, and Docker build layers. A source-only change should reuse dependency layers.

To deploy images published by CI:

    HESTIA_BACKEND_IMAGE=ghcr.io/OWNER/hestia-backend:latest
    HESTIA_FRONTEND_IMAGE=ghcr.io/OWNER/hestia-frontend:latest

Then run:

    docker compose pull
    docker compose up -d

Back up the external PostgreSQL database and object-storage bucket before destructive upgrades.

## Search and discovery

NEXT_PUBLIC_SITE_URL is the canonical origin for metadata and generated discovery files. Production uses only https://hestia.vectorium.space.

    /sitemap.xml          Public, indexable routes
    /robots.txt           Crawl policy and sitemap location
    /llms.txt             Concise project and source guide
    /manifest.webmanifest Browser install metadata

Authenticated pages are marked noindex and excluded from the sitemap. The crawler files improve discovery and consistency, but they do not guarantee search ranking.

## Database import

The running application reads food-intelligence records from the externally managed PostgreSQL
database. Docker Compose never creates or migrates that database. SQLite files under
`backend/dataset/processed/` are manual import sources only and are not committed or included in
container images.

    cd backend
    $env:PYTHONPATH = "src"
    python scripts/migrate_food_intelligence_to_postgres.py --source dataset/processed/foodb_compounds.sqlite3

To restore manually from private object storage, provide `--s3-key` and `--sha256`. The command uses
the same `HESTIA_S3_*` settings as chat media storage. Back up the database before an import.

See [backend/dataset/README.md](backend/dataset/README.md) for source and licensing notes.

## API overview

All application endpoints use the /api/v1 prefix.

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
    POST   /sessions/{session_id}/messages/stream
    GET    /sessions/{session_id}/attachments/{attachment_id}
    GET    /sessions/{session_id}/images/{image_id}

Authenticated requests use a Firebase ID token:

    Authorization: Bearer <firebase-id-token>

## Checks

Backend:

    cd backend
    $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
    python -m pytest tests -q
    python -m ruff check src tests

Frontend:

    cd frontend
    npm run lint
    npm run build

GitHub Actions runs backend checks, frontend lint and export, and cached container builds. The image publication workflow publishes branch and version tags to GHCR.

## Security

- Keep .env, .env.local, Firebase Admin credentials, database exports, and provider keys out of version control.
- Keep the S3 bucket private. Media endpoints verify the Firebase user and session before returning an object.
- Rotate a credential immediately if it appears in a commit, build artifact, log, or screenshot.
- Firebase web configuration is public by design. Authorization is enforced by Firebase and backend token verification.
- Generated guidance is not a substitute for laboratory testing, medical advice, or official food-safety instructions.

## Data sources

- [FooDB](https://foodb.ca/) for food and compound relationships
- [USDA FoodData Central](https://fdc.nal.usda.gov/) for nutrient records
- [TheMealDB](https://www.themealdb.com/) for dish data and ingredient imagery
- [EFSA OpenFoodTox](https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox) for toxicology records
- [PubChem](https://pubchem.ncbi.nlm.nih.gov/) for chemical identity and hazard references
- [Semantic Scholar](https://www.semanticscholar.org/) through Ai2 Asta for literature retrieval

Review each source's terms and attribution requirements before redistributing data.

## Status and contacts

Hestia is under active development. Interfaces, schemas, and agent behavior may change.

- Developer: [hoangvu.id.vn](https://hoangvu.id.vn)
- Vectorium: [vectorium.space](https://vectorium.space)
- Production: [hestia.vectorium.space](https://hestia.vectorium.space/)
