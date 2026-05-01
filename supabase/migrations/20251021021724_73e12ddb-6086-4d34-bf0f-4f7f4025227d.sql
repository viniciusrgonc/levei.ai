-- Allow users to insert their own role when they don't have one yet
CREATE POLICY "Users can insert their first role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
