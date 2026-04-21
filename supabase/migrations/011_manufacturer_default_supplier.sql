-- Migration 011: Default-Lieferant am Hersteller
-- Wird in DeviceForm als Fallback genutzt, wenn am Modell selbst
-- kein default_supplier_id gepflegt ist.

ALTER TABLE manufacturers
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
