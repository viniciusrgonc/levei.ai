-- Tornar o campo license_plate opcional na tabela drivers
ALTER TABLE public.drivers 
ALTER COLUMN license_plate DROP NOT NULL;