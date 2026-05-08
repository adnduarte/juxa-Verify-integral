/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_USE_FIREBASE?: string;
  readonly VITE_PLATFORM_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
