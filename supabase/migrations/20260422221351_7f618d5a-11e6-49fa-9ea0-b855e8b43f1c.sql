CREATE OR REPLACE FUNCTION public.ensure_admin_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_email text := 'admin@admin.com';
  v_admin_user_id uuid;
  v_role_exists boolean;
  v_was_recreated boolean := false;
BEGIN
  SELECT u.id
  INTO v_admin_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_admin_email)
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE LOG 'ensure_admin_user: admin user % not found', v_admin_email;
    RETURN json_build_object(
      'success', false,
      'reason', 'admin_user_not_found',
      'email', v_admin_email
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_admin_user_id
      AND ur.role = 'admin'::public.app_role
  )
  INTO v_role_exists;

  IF NOT v_role_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;

    v_was_recreated := true;
    RAISE LOG 'ensure_admin_user: admin role recreated for %', v_admin_email;
  END IF;

  RETURN json_build_object(
    'success', true,
    'email', v_admin_email,
    'role_existed', v_role_exists,
    'role_recreated', v_was_recreated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_admin_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_admin_user() FROM anon;
REVOKE ALL ON FUNCTION public.ensure_admin_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_admin_user() TO service_role;

SELECT public.ensure_admin_user();