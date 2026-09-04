/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API; unset for a single-origin deploy. */
  readonly VITE_API_URL?: string;
  /** Release tag or short commit SHA, stamped by CI at build time. */
  readonly VITE_APP_VERSION?: string;
  /** Full commit SHA, stamped by CI at build time. */
  readonly VITE_GIT_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
