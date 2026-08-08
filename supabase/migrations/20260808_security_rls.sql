-- ─────────────────────────────────────────────────────────────────────────────
-- Security: Row Level Security policies
-- Run this in Supabase SQL Editor (Database > SQL Editor) or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── driver_locations ─────────────────────────────────────────────────────────

-- Enable RLS if not already enabled
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can only INSERT their own location rows
DROP POLICY IF EXISTS "driver_locations_insert_own" ON driver_locations;
CREATE POLICY "driver_locations_insert_own"
  ON driver_locations FOR INSERT
  WITH CHECK (
    driver_id = (
      SELECT id FROM drivers WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Only the delivery's restaurant and assigned driver can SELECT GPS data
DROP POLICY IF EXISTS "driver_locations_select_restricted" ON driver_locations;
CREATE POLICY "driver_locations_select_restricted"
  ON driver_locations FOR SELECT
  USING (
    -- Assigned driver
    driver_id = (SELECT id FROM drivers WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Restaurant that owns this delivery
    EXISTS (
      SELECT 1
      FROM deliveries d
      JOIN restaurants r ON r.id = d.restaurant_id
      WHERE d.id = driver_locations.delivery_id
        AND r.user_id = auth.uid()
    )
  );

-- ── delivery_messages ─────────────────────────────────────────────────────────

ALTER TABLE delivery_messages ENABLE ROW LEVEL SECURITY;

-- Only the delivery's restaurant and assigned driver can read/write messages
DROP POLICY IF EXISTS "delivery_messages_access" ON delivery_messages;
CREATE POLICY "delivery_messages_access"
  ON delivery_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM deliveries d
      LEFT JOIN restaurants r ON r.id = d.restaurant_id
      LEFT JOIN drivers dr ON dr.id = d.driver_id
      WHERE d.id = delivery_messages.delivery_id
        AND (r.user_id = auth.uid() OR dr.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deliveries d
      LEFT JOIN restaurants r ON r.id = d.restaurant_id
      LEFT JOIN drivers dr ON dr.id = d.driver_id
      WHERE d.id = delivery_messages.delivery_id
        AND (r.user_id = auth.uid() OR dr.user_id = auth.uid())
    )
  );

-- ── deliveries (restaurant SELECT guard) ─────────────────────────────────────

-- This policy ensures restaurant users can only SELECT their own deliveries.
-- Adjust or merge with existing policies in your project as needed.
DROP POLICY IF EXISTS "deliveries_restaurant_select_own" ON deliveries;
CREATE POLICY "deliveries_restaurant_select_own"
  ON deliveries FOR SELECT
  USING (
    -- Allow drivers to see deliveries assigned to them
    driver_id = (SELECT id FROM drivers WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Allow restaurants to see only their own deliveries
    restaurant_id = (SELECT id FROM restaurants WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Allow admins (user_roles table)
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
