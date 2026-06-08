-- v17: Borrar usuarios desde el panel sin edge function
--
-- Crea un RPC `admin_delete_user(target_id)` que corre como superuser (SECURITY DEFINER)
-- y puede borrar de auth.users. La FK profiles.id → auth.users.id (ON DELETE CASCADE, v16)
-- limpia profiles y workers.profile_id se libera por ON DELETE SET NULL.
--
-- Verifica que el caller esté autenticado, sea admin (profiles.role='admin') y no se borre
-- a sí mismo. No requiere service_role ni edge functions.

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Falta target_id' USING ERRCODE = '22023';
  END IF;

  IF target_id = caller_id THEN
    RAISE EXCEPTION 'No puedes borrarte a ti mismo' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden borrar usuarios' USING ERRCODE = '42501';
  END IF;

  -- Borra de auth.users. CASCADE (v16) limpia public.profiles.
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- Sólo los usuarios autenticados pueden invocarla; la lógica interna comprueba si son admin.
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
