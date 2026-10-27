# Fio a Fio — cronograma capilar

App web mobile para organizar o cronograma capilar (day after, lavagem, hidratação, nutrição, reconstrução e detox) e mantê-lo sincronizado com o Google Agenda.

- **Front-end:** React + Vite + Framer Motion, hospedado na **Vercel**.
- **Back-end:** **Supabase** (login com Google, banco Postgres com RLS e Edge Functions).
- **Google:** cada dia vira uma **tarefa** (Google Tasks, aparece no Calendar) ou um **evento** numa agenda própria “Fio a Fio” — você escolhe em Ajustes.

## Como funciona

| Ação no app | O que acontece |
|---|---|
| Montar o ciclo | Dias de day after + sequência de lavagens (S/C, H, N, R, detox opcional). |
| Salvar um ciclo novo | Pergunta em que dia do ciclo você está **hoje** e vale **de hoje em diante**. O histórico fica como estava. |
| “Não fiz hoje” / “Não fiz neste dia” | Escolhe quando fez (dia seguinte, +2, +3 ou qualquer data). Os dias entre viram *day after extra* e tudo dali pra frente anda junto. Dá pra desfazer. |
| Marcar o ritual como feito | Conclui a tarefa no Google. Concluir a tarefa no Google também marca como feito no app. |

A sincronização roda a cada alteração e uma vez por dia (cron), mantendo sempre as **últimas 2 semanas e os próximos 60 dias** no Google. O motor do cronograma fica em `supabase/functions/_shared/schedule.ts` e é usado pelo app e pelo servidor, então os dois sempre calculam igual.

## Estrutura

```
src/                       app (telas em src/screens, componentes em src/components)
supabase/migrations/       esquema do banco (tabelas + RLS)
supabase/functions/        google-connect, google-sync, google-disconnect (+ _shared)

tests/                     testes do motor (Node) e da sincronização (Deno)
```

---

## Colocando em produção

Faça na ordem. Onde aparecer `<PROJECT_REF>`, use o identificador do seu projeto Supabase (a parte antes de `.supabase.co`).

### 1. Supabase — criar o projeto e o banco

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. Instale/entre na CLI e ligue a pasta ao projeto:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   *(Alternativa: copie o conteúdo de `supabase/migrations/20261027000000_init.sql` no **SQL Editor** e rode.)*

### 2. Google Cloud — credenciais OAuth

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: “Fio a Fio”).
2. **APIs e serviços → Biblioteca**: ative **Google Calendar API** e **Google Tasks API**.
3. **Tela de consentimento OAuth** (Google Auth Platform):
   - Tipo **Externo**, nome do app “Fio a Fio”, seu e-mail de suporte.
   - **Escopos de acesso a dados**: adicione
     `.../auth/calendar.app.created`, `.../auth/tasks`, além de `openid`, `email` e `profile`.
   - **Público → Publicar app** (status *Em produção*). ⚠️ Em modo *Teste* o Google expira o acesso em 7 dias e a sincronização para.
     Sem a verificação do Google, no login aparece “O Google não verificou este app” → **Avançado → Acessar Fio a Fio**. Para uso pessoal (até 100 pessoas) isso é normal.
4. **Clientes → Criar cliente → Aplicativo da Web**:
   - **URIs de redirecionamento autorizados:** `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   - Guarde o **Client ID** e o **Client Secret**.

### 3. Supabase — login com Google

1. **Authentication → Sign In / Providers → Google**: ative e cole o Client ID e o Client Secret.
2. **Authentication → URL Configuration**:
   - **Site URL:** a URL da Vercel (passo 5), ex. `https://fio-a-fio.vercel.app`
   - **Redirect URLs:** a mesma URL e `http://localhost:5173` (para testar no computador).

### 4. Supabase — funções de sincronização

```bash
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
npx supabase functions deploy google-connect google-sync google-disconnect
```

Depois, no **SQL Editor**, informe a URL das funções para o cron diário (a migração já agenda o job e gera o segredo dele):

```sql
insert into public.app_config (key, value)
values ('functions_url', 'https://<PROJECT_REF>.supabase.co/functions/v1')
on conflict (key) do update set value = excluded.value;
```

### 5. Vercel — publicar o site

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório `enrick-dev/fio-a-fio`.
2. O framework é detectado como **Vite**. Em **Environment Variables** adicione:
   - `VITE_SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *anon/publishable key* (Supabase → Project Settings → API Keys)
3. **Deploy.** Pegue a URL final e confira se ela está no passo 3.2 (Site URL / Redirect URLs).

Pronto: abra o site no celular, **Entrar com Google**, monte o ciclo e diga em que dia está hoje. No iPhone/Android use “Adicionar à tela de início” para abrir como app.

---

## Rodando no computador

```bash
cp .env.example .env      # preencha com os dados do Supabase
npm install
npm run dev               # http://localhost:5173
```

Testes:

```bash
npm test                                      # motor do cronograma (Node 22+)
deno test --allow-env tests/sync.test.ts      # sincronização com Google simulado
```

## Problemas comuns

- **“Erro na agenda” logo após entrar:** confira se as APIs Calendar e Tasks estão ativas e se os segredos `GOOGLE_CLIENT_ID/SECRET` das funções são os mesmos do provedor Google do Supabase.
- **Parou de sincronizar depois de uma semana:** o app no Google Cloud está em modo *Teste*; publique-o (passo 2.3) e conecte de novo em Ajustes.
- **Voltou para a tela de login após o Google:** a URL do site não está em *Redirect URLs* do Supabase.
- **Trocar o nome do app:** `src/config.ts`, `supabase/functions/_shared/sync.ts` (nome da agenda/lista), `index.html` e `public/manifest.webmanifest`.
