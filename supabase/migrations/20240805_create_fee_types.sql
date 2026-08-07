-- Cria tabela fee_types para gerenciar taxas de serviço
create table if not exists fee_types (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  percentual  numeric(5, 2) not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índice para listagens frequentes
create index if not exists idx_fee_types_ativo on fee_types (ativo);

-- Trigger para atualizar updated_at automaticamente
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fee_types_updated_at
  before update on fee_types
  for each row execute function update_updated_at_column();

-- RLS
alter table fee_types enable row level security;

-- Somente admins têm acesso total (usa tabela user_roles)
drop policy if exists "admins_full_access" on fee_types;
create policy "admins_full_access" on fee_types
  for all
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'::app_role
    )
  )
  with check (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'::app_role
    )
  );
