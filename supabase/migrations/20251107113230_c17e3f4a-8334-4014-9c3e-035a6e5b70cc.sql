-- Adicionar campo vehicle_category na tabela deliveries
ALTER TABLE deliveries 
ADD COLUMN vehicle_category vehicle_type;

-- Atualizar RLS policy para drivers verem apenas entregas compatíveis
DROP POLICY IF EXISTS "Drivers can view pending deliveries within radius" ON deliveries;

CREATE POLICY "Drivers can view pending deliveries within radius"
ON deliveries
FOR SELECT
USING (
  status = 'pending' 
  AND EXISTS (
    SELECT 1 
    FROM drivers d
    WHERE d.user_id = auth.uid() 
    AND d.is_available = true 
    AND d.is_approved = true
    AND (vehicle_category IS NULL OR d.vehicle_type = vehicle_category)
  )
);

-- Comentário explicativo
COMMENT ON COLUMN deliveries.vehicle_category IS 'Categoria de veículo necessária para esta entrega. Se NULL, qualquer veículo pode aceitar.';