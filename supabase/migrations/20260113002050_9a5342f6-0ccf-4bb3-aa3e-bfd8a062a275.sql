-- Drop the vulnerable policy that allows any role to be self-assigned
DROP POLICY IF EXISTS "Users can insert their first role" ON public.user_roles;

-- Create a secure policy that restricts self-assignment to non-admin roles only
-- and ensures users can only insert their first role (no duplicates)
CREATE POLICY "Users can insert their first non-admin role"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND role IN ('restaurant'::app_role, 'driver'::app_role)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
  );