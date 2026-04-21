-- supabase/migrations/005_devices_restructure.sql

-- 1. Bestehende Tabelle device_movements löschen (wird durch purchases/sales ersetzt)
DROP TABLE IF EXISTS device_movements CASCADE;

-- 2. Alte Spalten von devices entfernen
ALTER TABLE devices
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS condition,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS category_id;

-- 3. enum device_status um 'verkauft' und 'reserviert' erweitern
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'verkauft';
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'reserviert';

-- 4. enum device_condition entfernen (wird nicht mehr verwendet)
DROP TYPE IF EXISTS device_condition;

-- 5. enum movement_action entfernen
DROP TYPE IF EXISTS movement_action;

-- 6. Neue Spalte model_id hinzufügen
ALTER TABLE devices
  ADD COLUMN model_id uuid REFERENCES models(id) ON DELETE RESTRICT;

-- Da devices leer ist (Pre-Check bestätigt), NOT NULL direkt setzen:
ALTER TABLE devices
  ALTER COLUMN model_id SET NOT NULL;

CREATE INDEX devices_model_idx ON devices(model_id);

-- 7. FKs in den Beleg-Tabellen nachziehen (in 004 wurden device_id ohne FK angelegt)
ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT;

ALTER TABLE kassen_details
  ADD CONSTRAINT kassen_details_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
