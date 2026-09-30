/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL d'AppSec Academy, pour les liens vers les leçons. */
  readonly VITE_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
