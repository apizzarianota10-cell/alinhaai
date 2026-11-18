-- PilatesFlow — schema do Supabase
-- Execute uma vez em: Supabase > SQL Editor > New query > cole tudo > Run.
--
-- Modelo: cada clínica tem membros (usuários do Supabase Auth com um papel) e um "estado" por chave
-- (pacientes, agenda, financeiro...). Row Level Security garante que um usuário só lê/grava dados
-- das clínicas das quais é membro.

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'receptionist', 'professional')),
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table if not exists public.clinic_state (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (clinic_id, key)
);

-- Helpers (security definer evita recursão de RLS ao consultar a própria tabela de membros)
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clinic_members where clinic_id = cid and user_id = auth.uid());
$$;

create or replace function public.is_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clinic_members where clinic_id = cid and user_id = auth.uid() and role = 'admin');
$$;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_state enable row level security;

drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics for select using (public.is_member(id));

drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics for update using (public.is_admin(id));

drop policy if exists members_select on public.clinic_members;
create policy members_select on public.clinic_members for select using (public.is_member(clinic_id));

drop policy if exists members_admin_update on public.clinic_members;
create policy members_admin_update on public.clinic_members for update using (public.is_admin(clinic_id));

drop policy if exists members_admin_delete on public.clinic_members;
create policy members_admin_delete on public.clinic_members for delete
  using (public.is_admin(clinic_id) and user_id <> auth.uid());

drop policy if exists state_select on public.clinic_state;
create policy state_select on public.clinic_state for select using (public.is_member(clinic_id));

drop policy if exists state_insert on public.clinic_state;
create policy state_insert on public.clinic_state for insert
  with check (public.is_member(clinic_id) and updated_by = auth.uid());

drop policy if exists state_update on public.clinic_state;
create policy state_update on public.clinic_state for update
  using (public.is_member(clinic_id)) with check (updated_by = auth.uid());

-- Cria uma clínica e torna o usuário atual administrador dela
create or replace function public.create_clinic(clinic_name text, admin_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into clinics (name) values (clinic_name) returning id into new_id;
  insert into clinic_members (clinic_id, user_id, role, display_name, email)
  values (new_id, auth.uid(), 'admin', admin_name, coalesce((select email from auth.users where id = auth.uid()), ''));
  return new_id;
end;
$$;

-- Administrador dá acesso a alguém que já criou conta (cadastro com e-mail e senha na tela de login)
create or replace function public.add_clinic_member(cid uuid, member_email text, member_role text, member_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not public.is_admin(cid) then
    raise exception 'only admins can add members';
  end if;
  if member_role not in ('admin', 'receptionist', 'professional') then
    raise exception 'invalid role';
  end if;
  select id into uid from auth.users where lower(email) = lower(member_email);
  if uid is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  insert into clinic_members (clinic_id, user_id, role, display_name, email)
  values (cid, uid, member_role, member_name, lower(member_email))
  on conflict (clinic_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;
end;
$$;

revoke all on function public.create_clinic(text, text) from public, anon;
revoke all on function public.add_clinic_member(uuid, text, text, text) from public, anon;
grant execute on function public.create_clinic(text, text) to authenticated;
grant execute on function public.add_clinic_member(uuid, text, text, text) to authenticated;

-- Atualizações em tempo real entre computadores da mesma clínica
do $$
begin
  alter publication supabase_realtime add table public.clinic_state;
exception when duplicate_object then null;
end $$;
