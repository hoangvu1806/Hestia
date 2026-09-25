# Hestia — Evidence-Based AI Culinary Intelligence & Food Science

[![Next.js](https://img.shields.io/badge/Next.js-16.2.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Google ADK](https://img.shields.io/badge/Google-ADK%20Agents-4285F4?style=flat&logo=google)](https://github.com/google/agent-development-kit)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)
[![MinIO](https://img.shields.io/badge/MinIO-S3%20Storage-C72C48?style=flat&logo=minio)](https://min.io/)
[![SEO Optimized](https://img.shields.io/badge/SEO-Schema.org%20%7C%20JSON--LD-success)](https://schema.org)
[![LLMs.txt](https://img.shields.io/badge/LLMs.txt-Standard%20v1.0-blueviolet)](https://llmstxt.org)

**Hestia** is a web application for culinary intelligence, ingredient research, cooking chemistry, and evidence-based food safety screening. It combines a static Next.js frontend, a FastAPI backend powered by Google ADK multi-agent architecture, Firebase Authentication, PostgreSQL-backed food knowledge graphs (FooDB & USDA), private S3-compatible image storage, and rigorous search engine (SEO) & AI search (`llms.txt`) optimization.

The platform distinguishes observed facts, database records, calculations, and generative inference—treating chemical records as compositional evidence rather than unsubstantiated claims.

---

## 🌟 Key Capabilities

- **Multimodal Ingredient Recognition**: Upload counter or pantry photos to segment ingredients, identify compounds, and flag ambiguous items with transparent confidence boundaries.
- **Cooking Chemistry Pathways**: Explains browning (Maillard cascade, caramelization), protein denaturation, starch gelatinization, and lipid oxidation in actionable kitchen terms.
- **Evidence-Based Food Safety**: Real-time evaluation of thermal pathogen inactivation kinetics ($D$ and $z$ values), temperature danger zones (4°C to 60°C / 40°F to 140°F), and cross-contamination risks.
- **Biochemical Food Explorer**: Explore over 70,000+ biochemical compound records from FooDB, USDA FoodData Central nutritional profiles, and TheMealDB culinary taxonomy.
- **Nutrient Retention Kinetics**: Transparent mathematical modeling of micronutrient retention (Vitamins C, B-complex, carotenoids) across boiling, steaming, baking, and air frying.
- **Persistent Private Sessions**: Firebase ID-token verification with isolated per-user conversation history and MinIO S3 object storage.
- **Bilingual & Accessible**: Full English and Vietnamese language localization with system-aware light and dark themes.
- **Top-Tier Search & AI Engine Optimization**: Automated `sitemap.xml`, multi-bot `robots.txt`, rich Schema.org JSON-LD (WebSite, Organization, WebApplication, BreadcrumbList, FAQPage, DataCatalog, DefinedTermSet), and `llms.txt` / `llms-full.txt` for AI search visibility (ChatGPT Search, Perplexity, Gemini).

---

## 🏗️ Architecture Overview

```text
                               ┌──────────────────────────────────────────────┐
                               │                Web Browser                   │
                               │  (Desktop / Tablet / Mobile Chrome & Safari) │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                   ┌──────────────────┴──────────────────┐
                                   │                                     │
                                   ▼                                     ▼
                      ┌─────────────────────────┐          ┌───────────────────────────┐
                      │  Firebase Authentication│          │  Next.js Static Frontend  │
                      │  (Google Sign-In / OIDC)│          │ (Nginx Static / Port 8080)│
                      └─────────────────────────┘          └─────────────┬─────────────┘
                                                                         │
                                       ┌─────────────────────────────────┴─────────────────┐
                                       │ REST: /api/v1/sessions, /library, /images        │
                                       │ SSE:  /api/v1/sessions/{id}/messages/stream       │
                                       ▼                                                   │
                        ┌──────────────────────────────┐                                   │
                        │     FastAPI API Gateway      │                                   │
                        │         (Port 8484)          │                                   │
                        └──────────────┬───────────────┘                                   │
                                       │                                                   │
            ┌──────────────────────────┼──────────────────────────┐                        │
            ▼                          ▼                          ▼                        ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ Google ADK Multi-    │   │ PostgreSQL Database  │   │ MinIO / S3 Object    │   │ External APIs:    │
│ Agent Runtime:       │   │ (FooDB Compounds,    │   │ Storage (Private     │   │ • FooDB & USDA    │
│ • Root Agent         │   │  Sessions, Events,   │   │  Chat & Generated    │   │ • TheMealDB       │
│ • Food Analysis Agent│   │  Nutrient Retention) │   │  Image Blobs)        │   │ • EFSA / PubChem  │
│ • Research Agent     │   │                      │   │                      │   │ • Ai2 Asta Scholar│
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘   └───────────────────┘
```

---

## 🔍 Search Engine (SEO) & AI Discoverability (`llms.txt`)

Hestia is engineered with technical SEO and LLM discoverability:

### 1. Automated Discovery Files
- **[`/sitemap.xml`](https://hestia.hoangvu.id.vn/sitemap.xml)**: Dynamically generated XML sitemap with route priorities, change frequencies, Google Image Search tags, and multi-language alternate links (`hreflang="en"`, `hreflang="vi"`, `hreflang="x-default"`).
- **[`/robots.txt`](https://hestia.hoangvu.id.vn/robots.txt)**: Granular crawl rules distinguishing standard web bots (Googlebot, Bingbot, Applebot) and AI search agents (GPTBot, PerplexityBot, ClaudeBot, Google-Extended).
- **[`/llms.txt`](https://hestia.hoangvu.id.vn/llms.txt)**: Standard machine-readable digest following the [llmstxt.org](https://llmstxt.org) standard for AI citation and agentic synthesis.
- **[`/llms-full.txt`](https://hestia.hoangvu.id.vn/llms-full.txt)**: In-depth technical specification detailing chemical reaction kinematics, food safety models, and database schema mappings.
- **[`/manifest.webmanifest`](https://hestia.hoangvu.id.vn/manifest.webmanifest)**: Progressive Web App manifest with icons, shortcuts, and display metadata.

### 2. Schema.org Structured Data (JSON-LD)
- `WebSite`: Includes Google Sitelinks SearchBox (`SearchAction`) targeting `/ingredients?q={query}`.
- `Organization`: Global branding, logo image objects, and social links.
- `WebApplication`: Category classification, feature list, aggregate ratings, and operating system targets.
- `BreadcrumbList`: Full hierarchy breadcrumbs across all subpages.
- `FAQPage`: Structured rich-snippet FAQs on Home, Science, and About pages.
- `DataCatalog` & `Dataset`: Explicit schema declaring FooDB and USDA FoodData Central integration.
- `DefinedTermSet`: Formal terminology definitions for cooking chemistry concepts (Maillard reaction, protein denaturation, danger zone).

---

## 📁 Repository Structure

```text
Hestia/
├── backend/
│   ├── adk_agents/       # Google ADK agent prototyping & definitions
│   ├── dataset/          # Food dataset sources, documentation & import scripts
│   ├── scripts/          # PostgreSQL migration & schema swapping scripts
│   ├── src/
│   │   ├── agents/       # Production Google ADK specialist agents & tools
│   │   ├── api/v1/       # REST and SSE endpoints (chat, library, sessions)
│   │   ├── auth/         # Firebase Admin SDK token verification
│   │   ├── core/         # Settings, environment variables & logging
│   │   ├── schemas/      # Pydantic request & response models
│   │   ├── services/     # Agent runtime, food library, MinIO & event services
│   │   └── main.py       # FastAPI application factory
│   ├── tests/            # Pytest test suite & benchmarks
│   ├── Dockerfile        # Production multi-stage Python container
│   └── pyproject.toml    # Python dependencies & Ruff configuration
│
├── frontend/
│   ├── public/           # Static assets, hero images, robots.txt, sitemap.xml, llms.txt
│   ├── src/
│   │   ├── app/          # Next.js App Router (home, ingredients, science, about, download, chat)
│   │   ├── components/   # UI components (app shell, food library, mermaid, json-ld)
│   │   ├── i18n/         # Bilingual dictionaries (en.json, vi.json)
│   │   └── lib/          # SEO configuration, Schema.org builders, Firebase & API client
│   ├── Dockerfile        # Production multi-stage Next.js export container
│   ├── nginx.conf        # Static file serving, caching, and security headers
│   └── package.json      # Node.js dependencies & scripts
│
├── .github/workflows/    # CI/CD pipelines (Lint, Test, Docker Build & GHCR Publish)
├── docker-compose.yml    # Complete orchestration stack
└── README.md             # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+ & npm
- PostgreSQL 15+
- MinIO or AWS S3 bucket
- Firebase Project with Google Authentication enabled

---

### Step 1: Backend Setup

```powershell
cd backend
Copy-Item .env.example .env
python -m pip install -e ".[dev]"
```

Place your Firebase Admin SDK service account key at:
```text
backend/secrets/firebase/service-account.json
```

Configure `backend/.env` with your credentials:
```dotenv
HESTIA_SESSION_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/hestia
HESTIA_FIREBASE_PROJECT_ID=your-firebase-project-id
HESTIA_FIREBASE_CREDENTIALS_PATH=secrets/firebase/service-account.json
HESTIA_S3_ENDPOINT_URL=http://localhost:9000
HESTIA_S3_ACCESS_KEY_ID=minioadmin
HESTIA_S3_SECRET_ACCESS_KEY=minioadmin
HESTIA_S3_BUCKET=hestia

CUSTOM_API_KEY=your-api-key
CUSTOM_BASE_URL=https://openrouter.ai/api/v1
CUSTOM_LLM_MODEL_1=openrouter/google/gemini-3.5-flash-lite
CUSTOM_LLM_MODEL_2=openrouter/qwen/qwen3.6-35b-a3b
CUSTOM_IMAGE_GEN_MODEL_NAME=bytedance/sdxl-lightning
ASTA_API_KEY=your-asta-key
```

Run the FastAPI application:
```powershell
python -m uvicorn main:app --app-dir src --host 0.0.0.0 --port 8484 --reload --reload-dir src
```

Endpoints:
- API Documentation: `http://localhost:8484/docs`
- Health Check: `http://localhost:8484/api/v1/health`

---

### Step 2: Frontend Setup

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
```

Configure `frontend/.env.local`:
```dotenv
NEXT_PUBLIC_HESTIA_API_URL=http://127.0.0.1:8484/api/v1
NEXT_PUBLIC_SITE_URL=https://hestia.hoangvu.id.vn
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Start the frontend development server:
```powershell
npm run dev
```

Open `http://localhost:3434` in your browser.

---

## 🐳 Docker Deployment

To launch the application stack (Nginx static frontend, FastAPI, PostgreSQL, and external MinIO):

```powershell
Copy-Item compose.env.example .env
Copy-Item backend/.env.example backend/.env
# Update environment variables and place Firebase service-account.json
docker compose build
docker compose up -d
```

Check status:
```powershell
docker compose ps
```

The frontend is bound to `127.0.0.1:8080` and the API to `127.0.0.1:8484` by default. Nginx serves only the exported frontend and does not proxy API traffic.

### Cloudflare Tunnel routing

Use Cloudflare Tunnel as the public edge and route `/api/*` directly to FastAPI before the frontend catch-all rule. A host-installed `cloudflared` configuration can use:

```yaml
ingress:
  - hostname: hestia.hoangvu.id.vn
    path: ^/api/.*
    service: http://127.0.0.1:8484
  - hostname: hestia.hoangvu.id.vn
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Build the frontend with `NEXT_PUBLIC_HESTIA_API_URL=/api/v1`. Browser API and SSE requests then stay on the same public origin while Cloudflare Tunnel sends them directly to FastAPI. Keep `HESTIA_CORS_ORIGINS` set to the public frontend origin as defense in depth.

If `cloudflared` runs as a container on the Compose `app` network, use `http://backend:8484` and `http://frontend:8080` as services instead of the loopback addresses. Do not expose PostgreSQL or MinIO through the application tunnel.

---

## 🧪 Testing & Code Quality

```powershell
# Backend Checks
cd backend
python -m ruff check src tests
python -m pytest tests -q

# Frontend Checks
cd frontend
npm run lint
npm run build
```

---

## 📚 Data Sources & Attribution

- **[FooDB](https://foodb.ca/)**: Comprehensive food constituent and chemical compound database.
- **[USDA FoodData Central](https://fdc.nal.usda.gov/)**: Standard Reference nutrient profiles and retention values.
- **[TheMealDB](https://www.themealdb.com/)**: International recipe taxonomy and food imagery.
- **[EFSA OpenFoodTox](https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox)**: Toxicological hazard benchmark data.
- **[PubChem](https://pubchem.ncbi.nlm.nih.gov/)**: Chemical structure identification and safety sheets.
- **[Semantic Scholar / Ai2](https://www.semanticscholar.org/)**: Peer-reviewed scientific literature retrieval.

---

## ⚖️ License & Disclaimer

Hestia output is provided for educational and culinary intelligence purposes only. It is **not** a substitute for laboratory microbial testing, medical diagnosis, or certified food safety inspection. Always verify critical internal meat temperatures with a calibrated food thermometer.
