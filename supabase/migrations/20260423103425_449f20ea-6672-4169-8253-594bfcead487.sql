DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view delivery photos for their deliveries" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar files" ON storage.objects;

CREATE POLICY "Users can view own avatar files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);