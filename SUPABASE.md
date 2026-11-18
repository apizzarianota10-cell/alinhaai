# Ativar login e banco de dados (Supabase)

Sem estas variáveis o sistema roda como **demonstração local** (dados só no navegador).
Com elas, exige login, guarda os dados na nuvem e sincroniza em tempo real entre computadores da clínica.

1. Crie um projeto gratuito em https://supabase.com (região: South America – São Paulo).
2. **SQL Editor → New query**: cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. **Authentication → URL Configuration**: em *Site URL* coloque `https://alinhaai.vercel.app`.
4. **Project Settings → API**: copie *Project URL* e a chave *anon public*.
5. Configure as variáveis (Vercel → projeto `alinhaai` → Settings → Environment Variables, e no `.env.local` para rodar localmente):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave anon public
6. Publique de novo (`vercel deploy --prod`).

Primeiro acesso: **Criar conta** → confirmar o e-mail → **Cadastre sua clínica** (você vira administrador).
Equipe: cada pessoa cria a própria conta; o administrador libera em **Profissionais → Acesso ao sistema**.

A chave *anon* é pública por natureza; a proteção dos dados vem das regras de Row Level Security do `schema.sql`
(cada usuário só lê e grava dados das clínicas de que é membro). Nunca use a chave *service_role* no front-end.

Limitação atual: a sincronização é por módulo (pacientes, agenda, financeiro…). Se duas pessoas salvarem o
**mesmo módulo no mesmo segundo**, vale a última gravação. Para uso com muitos usuários simultâneos, o próximo passo
é migrar para uma tabela por registro.
