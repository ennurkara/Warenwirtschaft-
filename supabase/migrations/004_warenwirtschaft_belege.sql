-- supabase/migrations/004_warenwirtschaft_belege.sql

-- Einkaufsbeleg-Kopf
CREATE TABLE purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  rechnungsnr text,
  datum       date NOT NULL,
  notes       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_supplier_idx ON purchases(supplier_id);
CREATE INDEX purchases_datum_idx    ON purchases(datum);

-- Einkaufsbeleg-Positionen (1 Position = 1 Einzelgerät)
CREATE TABLE purchase_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL UNIQUE,  -- FK wird in 005 hinzugefügt (devices existiert dann neu)
  ek_preis    numeric(10,2) NOT NULL CHECK (ek_preis >= 0)
);

CREATE INDEX purchase_items_purchase_idx ON purchase_items(purchase_id);

-- Verkaufsbeleg-Kopf
CREATE TABLE sales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  rechnungsnr text,
  datum       date NOT NULL,
  notes       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_customer_idx ON sales(customer_id);
CREATE INDEX sales_datum_idx    ON sales(datum);

-- Verkaufsbeleg-Positionen
CREATE TABLE sale_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id   uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  device_id uuid NOT NULL UNIQUE,  -- FK wird in 005 gesetzt
  vk_preis  numeric(10,2) NOT NULL CHECK (vk_preis >= 0)
);

CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);

-- Kassen-spezifische Details (1:1 mit devices)
CREATE TABLE kassen_details (
  device_id       uuid PRIMARY KEY,  -- FK wird in 005 gesetzt
  fiskal_2020     boolean NOT NULL DEFAULT false,
  zvt             boolean NOT NULL DEFAULT false,
  hw_serial       text,
  sw_serial       text,
  tse_serial      text,
  tse_valid_until date
);
