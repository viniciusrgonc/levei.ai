-- Cria RLS policy de acesso admin para fee_types.
-- Separada de 20240805_create_fee_types.sql porque user_roles e app_role
-- são criados em 20251021015257 (migration anterior a esta).
-- Usa DROP ... IF EXISTS para ser idempotente em ambientes que já aplicaram
-- a policy original via dashboard ou migration anterior.

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
