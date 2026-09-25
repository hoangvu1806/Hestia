# Hestia Frontend — Next.js Culinary Intelligence Web Client

[![Next.js](https://img.shields.io/badge/Next.js-16.2.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat&logo=react)](https://react.dev/)
[![SEO](https://img.shields.io/badge/SEO-Schema.org%20JSON--LD-success)](https://schema.org)
[![LLMs.txt](https://img.shields.io/badge/LLMs.txt-Standard-blueviolet)](https://llmstxt.org)

Modern, performant Next.js App Router static web application for **Hestia** — the evidence-based AI culinary intelligence and food science platform.

---

## 🚀 Key Features

- **Static HTML Export (`output: 'export'`)**: Compiles into pure, zero-overhead static assets deployed behind Nginx or any CDN.
- **Multimodal AI Cooking Chat**: Direct Server-Sent Events (SSE) streaming with tool call progression, markdown formatting, LaTeX equations (KaTeX), and Mermaid diagram rendering.
- **Comprehensive Search Engine Optimization (SEO)**:
  - Dynamic & Static XML Sitemap generation with multi-language alternates (`hreflang="en"`, `hreflang="vi"`, `hreflang="x-default"`) and Google Image metadata.
  - Granular `robots.txt` configuration with specialized access policies for search engine bots (Googlebot, Bingbot, Applebot) and AI crawlers (GPTBot, PerplexityBot, ClaudeBot, Google-Extended).
  - Schema.org JSON-LD structured data (`WebSite`, `Organization`, `WebApplication`, `BreadcrumbList`, `FAQPage`, `DataCatalog`, `DefinedTermSet`).
  - Open Graph and Twitter Card rich media previews.
  - Sitelinks SearchBox integration pointing directly to the Ingredient Explorer.
- **AI Search Discoverability (`llms.txt` & `llms-full.txt`)**: Implements the [llmstxt.org](https://llmstxt.org) standard for context ingestion by AI search engines.
- **Progressive Web App (PWA)**: Web manifest (`manifest.webmanifest`) with home screen installation, shortcuts, and app icons.
- **Bilingual Interface**: Seamless switching between English (`en`) and Vietnamese (`vi`).
- **Theme Support**: Zero-flicker light and dark mode switching with system preference detection.

---

## 📁 Directory Structure

```text
frontend/
├── public/                  # Static assets & discovery files
│   ├── hestia-hero.png      # Marketing hero graphic
│   ├── ingredient-intelligence.png
│   ├── logo-transparent.png # High-res logo
│   ├── logo.png             # Master icon (1600x1600)
│   ├── robots.txt           # Static crawler directives
│   ├── sitemap.xml          # Static fallback XML sitemap
│   ├── llms.txt             # AI agent digest
│   └── llms-full.txt        # Comprehensive AI specification
│
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── home/            # Landing page & value proposition
│   │   ├── ingredients/     # Food constituent & nutrient explorer
│   │   ├── science/         # Cooking chemistry & safety guide
│   │   ├── about/           # Mission & transparency standards
│   │   ├── download/        # Mobile app roadmap
│   │   ├── chat/            # Authenticated multimodal workspace
│   │   ├── login/           # Google sign-in page
│   │   ├── settings/        # Preferences & account settings
│   │   ├── sitemap.ts       # Dynamic XML sitemap generator
│   │   ├── robots.ts        # Dynamic robots.txt generator
│   │   ├── manifest.ts      # Web App Manifest generator
│   │   ├── llms.txt/        # LLM summary route
│   │   ├── llms-full.txt/   # LLM full specification route
│   │   ├── globals.css      # Core styles & responsive layout
│   │   └── layout.tsx       # Root layout, fonts & structured data
│   │
│   ├── components/          # Reusable UI components
│   │   ├── app-shell.tsx    # Workspace chat shell
│   │   ├── food-library.tsx # Ingredient & compound browser
│   │   ├── json-ld.tsx      # Schema.org JSON-LD injector
│   │   ├── auth-provider.tsx# Firebase authentication context
│   │   └── site-header.tsx  # Navigation & account popover
│   │
│   ├── i18n/                # Localization
│   │   └── locales/         # en.json & vi.json dictionaries
│   │
│   └── lib/                 # Utilities & configuration
│       ├── site.ts          # SEO settings & Schema.org generators
│       ├── firebase.ts      # Client Firebase SDK setup
│       └── hestia-api.ts    # REST & SSE streaming API client
│
├── nginx.conf               # Production Nginx reverse proxy
├── next.config.ts           # Next.js build configuration
└── package.json             # Scripts & dependencies
```

---

## 🛠️ Local Development

### 1. Install Dependencies

```powershell
npm install
```

### 2. Environment Variables

Create `.env.local` based on `.env.example`:

```dotenv
NEXT_PUBLIC_HESTIA_API_URL=http://127.0.0.1:8484/api/v1
NEXT_PUBLIC_SITE_URL=https://hestia.hoangvu.id.vn
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. Run Development Server

```powershell
npm run dev
```

`npm run dev` builds the static export and serves the `out/` directory on `http://localhost:3434`.

---

## 📦 Production Build

```powershell
npm run build
```

The exported HTML/CSS/JS and discovery files will be output to `frontend/out/`.

To preview the production build locally:
```powershell
npm run start
```

---

## 🌐 SEO & Discovery Directives

| Resource | URL Path | Description |
| :--- | :--- | :--- |
| **Sitemap** | `/sitemap.xml` | Lists all public pages, priorities, image links, and hreflang translations. |
| **Robots** | `/robots.txt` | Controls bot crawling behavior for Google, Bing, GPTBot, PerplexityBot, etc. |
| **LLMs Digest** | `/llms.txt` | Brief summary of Hestia capabilities, databases, and citation guidelines. |
| **LLMs Full** | `/llms-full.txt`| Deep chemical, culinary, and architectural specification for AI agents. |
| **PWA Manifest**| `/manifest.webmanifest`| Configures mobile installability, icons, and display modes. |
