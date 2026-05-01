-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'restaurant', 'driver');

-- Create enum for delivery status
CREATE TYPE public.delivery_status AS ENUM (
  'pending',
  'accepted',
  'picking_up',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled'
);

-- Create enum for vehicle types
CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'bicycle', 'car');

-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('delivery_payment', 'withdrawal', 'platform_fee');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type public.vehicle_type NOT NULL,
  license_plate TEXT NOT NULL,
  drivers_license_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_deliveries INTEGER DEFAULT 0,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  cnpj TEXT,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  logo_url TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  
  -- Pickup details
  pickup_address TEXT NOT NULL,
  pickup_latitude DECIMAL(10, 8) NOT NULL,
  pickup_longitude DECIMAL(11, 8) NOT NULL,
  
  -- Delivery details
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10, 8) NOT NULL,
  delivery_longitude DECIMAL(11, 8) NOT NULL,
  
  -- Delivery info
  description TEXT,
  distance_km DECIMAL(6, 2) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  
  -- Photos
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create driver_locations table for real-time tracking
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  type public.transaction_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  rated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(delivery_id, rated_by, rated_user)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for new user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for drivers
CREATE POLICY "Drivers can view their own data"
  ON public.drivers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data"
  ON public.drivers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert their own data"
  ON public.drivers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all drivers"
  ON public.drivers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all drivers"
  ON public.drivers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for restaurants
CREATE POLICY "Restaurants can view their own data"
  ON public.restaurants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Restaurants can update their own data"
  ON public.restaurants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Restaurants can insert their own data"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all restaurants"
  ON public.restaurants FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all restaurants"
  ON public.restaurants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for deliveries
CREATE POLICY "Restaurants can view their own deliveries"
  ON public.deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = deliveries.restaurant_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can view pending deliveries within radius"
  ON public.deliveries FOR SELECT
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
      AND d.is_available = true
      AND d.is_approved = true
    )
  );

CREATE POLICY "Drivers can view their accepted deliveries"
  ON public.deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = deliveries.driver_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurants can create deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = deliveries.restaurant_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update their accepted deliveries"
  ON public.deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = deliveries.driver_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurants can cancel their own deliveries"
  ON public.deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = deliveries.restaurant_id
      AND r.user_id = auth.uid()
    )
    AND status IN ('pending', 'accepted')
  );

CREATE POLICY "Admins can view all deliveries"
  ON public.deliveries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all deliveries"
  ON public.deliveries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for driver_locations
CREATE POLICY "Drivers can insert their own location"
  ON public.driver_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurants can view locations of their delivery drivers"
  ON public.driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries del
      JOIN public.restaurants r ON r.id = del.restaurant_id
      WHERE del.id = driver_locations.delivery_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all driver locations"
  ON public.driver_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
CREATE POLICY "Drivers can view their own transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = transactions.driver_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ratings
CREATE POLICY "Users can view ratings they gave or received"
  ON public.ratings FOR SELECT
  USING (auth.uid() = rated_by OR auth.uid() = rated_user);

CREATE POLICY "Users can create ratings for completed deliveries"
  ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rated_by
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = ratings.delivery_id
      AND d.status = 'delivered'
      AND (
        (d.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
        OR (d.restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Admins can view all ratings"
  ON public.ratings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for disputes
CREATE POLICY "Users can view disputes they reported"
  ON public.disputes FOR SELECT
  USING (auth.uid() = reported_by);

CREATE POLICY "Users can create disputes for their deliveries"
  ON public.disputes FOR INSERT
  WITH CHECK (
    auth.uid() = reported_by
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = disputes.delivery_id
      AND (
        d.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        OR d.restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Admins can view all disputes"
  ON public.disputes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all disputes"
  ON public.disputes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-photos', 'delivery-photos', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);

-- Storage policies for driver documents
CREATE POLICY "Drivers can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Drivers can view their own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all driver documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Storage policies for delivery photos
CREATE POLICY "Drivers can upload delivery photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view delivery photos for their deliveries"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Storage policies for avatars (public)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );