-- Adicionar novos valores ao enum vehicle_type
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'van';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'truck';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'hourly_service';

-- Comentário explicativo
COMMENT ON TYPE vehicle_type IS 'Tipos de veículos disponíveis: motorcycle, bicycle, car, van, truck, hourly_service';