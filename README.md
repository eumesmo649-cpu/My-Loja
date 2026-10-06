# MyLoja

Controle simples de **vendas e caixa** para uma pequena loja de roupas. Pensado para celular: registrar uma venda leva poucos segundos (`+` → valor → forma de pagamento → Registrar).

É um PWA (instalável, funciona offline). Os dados ficam **no aparelho** e, opcionalmente, são sincronizados com o **Supabase**.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Lucide · vite-plugin-pwa · jsPDF (relatórios) · Supabase (opcional) · Vitest

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # regras financeiras (22 testes)
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build (necessário para testar o PWA/offline)
```

Sem nenhuma configuração o app já funciona 100% local. Na tela inicial vazia há o botão **"Ver com dados de exemplo"**.

## Variáveis de ambiente (opcionais)

Copie `.env.example` para `.env`:

| Variável | O que é |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | chave **anon/public**. **Nunca** use a `service_role` no frontend |

Sem as duas, a sincronização fica desligada.

## Configurar o Supabase

1. Crie um projeto em supabase.com.
2. Em **SQL Editor**, rode o arquivo [`supabase/schema.sql`](supabase/schema.sql). Ele cria as tabelas `customers` e `transactions`, constraints de negócio, triggers e **Row Level Security** (cada usuária só enxerga as próprias linhas; anônimos não têm acesso).
3. Em **Authentication → Providers**, deixe *Email* ativo. Para uso simples, desative "Confirm email" (ou confirme o e-mail após criar a conta).
4. Preencha o `.env` e rode de novo. Em **Ajustes → Nuvem**, crie a conta / entre. O que já existe no aparelho sobe automaticamente.

### Como funciona a sincronização

- Toda venda é gravada **primeiro no aparelho**; nunca se perde lançamento por falta de internet.
- Alterações ficam numa fila de pendentes e sobem quando há internet e login (ao voltar online, ao reabrir o app, ou em "Sincronizar agora").
- Conflitos: vence o registro com `updated_at` mais recente. Exclusões são lógicas (`deleted_at`).
- Dados de exemplo **nunca** são enviados à nuvem.

## Regras financeiras (o coração do app)

- Dinheiro é sempre **inteiro em centavos** (`R$ 35,90` = `3590`), formatado em pt-BR.
- Venda à vista (PIX, espécie, débito, crédito): soma em **vendas** e em **recebido**.
- Venda na **ficha**: soma em vendas e em **a receber**; recebido +0.
- **Prestação**: soma em recebido e reduz o saldo do cliente; não é nova venda.
- **Compra**: saída de dinheiro.
- O saldo de cada cliente é **derivado** das transações (vendas em ficha − prestações), nunca armazenado; editar ou excluir qualquer lançamento recalcula tudo.
- Prestação acima do saldo exige confirmação explícita.

## Estrutura

```
src/
  domain/       regras puras e testadas: saldos, resumos, validações, relatórios
  data/         storage local, repositório, sincronização, Supabase, dados de exemplo
  store/        estado global (dados) e de interface (sheets, toasts, confirmações)
  components/   ui/ (botões, sheet, inputs), forms/, layout/, charts/
  pages/        Início, Histórico, Clientes, Relatórios, Fechamento, Ajustes
  reports/      geração de PDF (carregado sob demanda)
  hooks/ lib/ types/
supabase/schema.sql
scripts/make-icons.py   gera os ícones do PWA (npm run icons)
scripts/e2e.mjs         teste de fluxos no navegador (veja abaixo)
```

## Instalar como PWA

- **Android (Chrome):** menu ⋮ → *Instalar app* (ou use o botão em Ajustes).
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- Requer **HTTPS** (ou localhost). Hospede `dist/` em qualquer hospedagem estática (Vercel, Netlify, Cloudflare Pages, Supabase Storage...). A navegação usa `#/` e não precisa de regras de redirecionamento.

## Remover dados de exemplo

Em **Ajustes → Dados de exemplo → Remover**: apaga só o que é fictício (IDs com prefixo próprio), sem tocar nos lançamentos reais. Para eliminar o recurso do código, apague `src/data/seed.ts` e o bloco "Dados de exemplo" em `src/pages/SettingsPage.tsx`.

## Teste de fluxos no navegador

```bash
npm run build && npx vite preview --port 4173 &
node scripts/e2e.mjs      # requer Chromium do Playwright
```

## Limitações conhecidas

- Os dados locais vivem no `localStorage` do navegador. Se a pessoa limpar os dados do site sem ter ativado a nuvem, perde tudo: use **Baixar cópia** ou o Supabase.
- Uma única conta/loja; sem permissões por usuário.
- Em conflito de edição entre aparelhos vence a alteração mais recente (por registro).
- O PDF usa fonte padrão (Helvetica) e layout simples.
- Fuso e "dia" seguem o relógio do aparelho.
