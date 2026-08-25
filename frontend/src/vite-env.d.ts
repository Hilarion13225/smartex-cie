/// <reference types="vite/client" />

interface ImportMetaEnv {
  // URL de base du backend réel (RealApiAdapter). Défaut : http://localhost:8080.
  readonly VITE_API_BASE_URL?: string
  // "true" (défaut) = MockApiAdapter (aucun backend requis, données simulées).
  // "false" = RealApiAdapter (appels HTTP réels vers VITE_API_BASE_URL).
  readonly VITE_USE_MOCK_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
