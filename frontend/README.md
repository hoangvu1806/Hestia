# Hestia frontend

The Hestia frontend is a statically exported Next.js App Router application. It contains the public marketing and Food Library pages, the authenticated chat workspace, SEO metadata routes, and the browser clients for Firebase Authentication and the Hestia API.

## Development

    npm install
    npm run dev

Open http://localhost:3434.

npm run dev builds the static export and serves out/. For separate steps:

    npm run build
    npm run start

There is no Next.js production server. Nginx in the container serves the exported files and does not proxy the API.

## Environment

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

All NEXT_PUBLIC_* values are embedded at build time. Never put private service-account data or provider secrets in them.

## Structure

    public/              Optimized WebP assets
    src/app/             Pages, metadata routes, and global styles
    src/components/      Shared product and marketing components
    src/i18n/            Interface dictionaries
    src/lib/             Firebase, API, and site-metadata helpers

The build generates:

    /sitemap.xml
    /robots.txt
    /llms.txt
    /manifest.webmanifest
    /404.html

The canonical production origin is https://hestia.vectorium.space.

## Checks

    npm run lint
    npm run build

Static assets should use WebP unless a required platform format cannot support the asset.
