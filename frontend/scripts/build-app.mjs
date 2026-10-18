// Builds the static export for the native app. The app is served from tauri.localhost,
// so the API must be absolute; local .env files would otherwise point it at 127.0.0.1.
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_HESTIA_API_URL:
    process.env.HESTIA_APP_API_URL || "https://hestia.vectorium.space/api/v1",
};

const result = spawnSync("npx", ["next", "build"], { env, shell: true, stdio: "inherit" });
process.exit(result.status ?? 1);
