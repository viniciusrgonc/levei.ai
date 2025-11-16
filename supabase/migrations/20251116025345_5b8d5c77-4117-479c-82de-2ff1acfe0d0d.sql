-- Link drivers.user_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_user_id_fkey'
  ) THEN
    ALTER TABLE public.drivers
    ADD CONSTRAINT drivers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);

-- Link restaurants.user_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_user_id_fkey'
  ) THEN
    ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);