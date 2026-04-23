DROP POLICY IF EXISTS "Drivers can upload delivery confirmation photos" ON storage.objects;
DROP POLICY IF EXISTS "Delivery participants can view confirmation photos" ON storage.objects;

CREATE POLICY "Drivers can upload delivery confirmation photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Delivery participants can view confirmation photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.delivery_confirmations dc
      JOIN public.deliveries d ON d.id = dc.delivery_id
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE dc.photo_url = storage.objects.name
        AND r.user_id = auth.uid()
    )
  )
);