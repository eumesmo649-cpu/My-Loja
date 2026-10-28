/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (opcional – sem ela o app funciona 100% local). */
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública "anon" do Supabase. NUNCA use a service_role aqui. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Contato (e-mail) exibido no aviso de privacidade, para pedidos dos titulares. */
  readonly VITE_PRIVACY_CONTACT?: string
}

declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
