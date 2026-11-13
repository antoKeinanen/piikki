/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Encrypts database files when set. Built into the bundle; see docs/deployment.md. */
  readonly VITE_DATABASE_PASSWORD?: string;
}
