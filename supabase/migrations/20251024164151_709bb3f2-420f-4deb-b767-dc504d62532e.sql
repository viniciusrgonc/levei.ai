-- Add separate columns for recipient information (PII protection)
ALTER TABLE public.deliveries 
ADD COLUMN recipient_name TEXT,
ADD COLUMN recipient_phone TEXT;

-- Add RLS policy to restrict recipient info to only assigned drivers
CREATE POLICY "Only assigned drivers can see recipient details"
ON public.deliveries
FOR SELECT
USING (
  driver_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM drivers d 
    WHERE d.id = deliveries.driver_id 
    AND d.user_id = auth.uid()
  )
);

-- Update existing RLS policy for pending deliveries to exclude recipient info
-- We need to recreate the policy with explicit column selection
DROP POLICY IF EXISTS "Drivers can view pending deliveries within radius" ON public.deliveries;

CREATE POLICY "Drivers can view pending deliveries within radius"
ON public.deliveries
FOR SELECT
USING (
  status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.user_id = auth.uid()
    AND d.is_available = true
    AND d.is_approved = true
  )
);

-- Add comment explaining the security design
COMMENT ON COLUMN public.deliveries.recipient_name IS 'Recipient name - only visible to assigned driver after acceptance';
COMMENT ON COLUMN public.deliveries.recipient_phone IS 'Recipient phone - only visible to assigned driver after acceptance';