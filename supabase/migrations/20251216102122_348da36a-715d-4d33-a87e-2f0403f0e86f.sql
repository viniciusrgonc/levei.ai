-- Drop the existing broken policy
DROP POLICY IF EXISTS "Restaurants can cancel their own deliveries" ON public.deliveries;

-- Recreate with proper WITH CHECK clause that allows status to change to cancelled
CREATE POLICY "Restaurants can cancel their own deliveries"
ON public.deliveries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = deliveries.restaurant_id AND r.user_id = auth.uid()
  )
  AND status IN ('pending', 'accepted')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = deliveries.restaurant_id AND r.user_id = auth.uid()
  )
  AND status = 'cancelled'
);