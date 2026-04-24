-- supabase/migrations/018_customer_supplier_address_fields.sql
--
-- Split the single `address` column on customers + suppliers into three
-- structured fields. `address` keeps holding the street + house number for
-- backward compatibility; new columns hold postal code and city. All NULLABLE
-- so existing rows stay valid. Idempotent.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city        text;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city        text;

-- PostgREST cache reload so the new columns show up in embedded selects.
NOTIFY pgrst, 'reload schema';
