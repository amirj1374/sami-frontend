/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API calls. Defaults to "/api" (proxied in dev, same-origin in prod). */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
