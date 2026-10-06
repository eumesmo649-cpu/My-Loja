/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (opcional – sem ela o app funciona 100% local). */
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública "anon" do Supabase. NUNCA use a service_role aqui. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
