# Hestia Web

Next.js App Router shell for the Hestia food, chemistry and safety assistant.

## Run

```powershell
npm install
npm run dev
```

`npm run dev` first exports the app and then serves only the generated `out/` directory. Open
`http://localhost:3434`. The static `index.html` redirects to `/en/` or `/vi/` using the saved
preference and browser language. Theme preference is stored locally and falls back to the system
color scheme.

The static file server runs at `http://localhost:3434`. Chat connects directly to the Hestia API
at `http://127.0.0.1:8484/api/v1` and consumes its Server-Sent Events stream. Override the endpoint
with `NEXT_PUBLIC_HESTIA_API_URL` when needed.

## Static production build

```powershell
npm run build
npm run start
```

`npm run build` only produces static assets in `out/`; `npm run start` serves that directory on
port `3434`. There is no Next.js production server, middleware, server action, or image optimizer.

## Structure

```text
src/
├── app/[locale]/       # Statically generated localized pages
├── components/         # Reusable webapp shell components
└── i18n/locales/       # Translation dictionaries
```
