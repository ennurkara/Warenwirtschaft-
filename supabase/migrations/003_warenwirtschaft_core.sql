-- supabase/migrations/003_warenwirtschaft_core.sql
-- Hersteller
CREATE TABLE manufacturers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Modell-Katalog
CREATE TABLE models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE RESTRICT,
  category_id     uuid NOT NULL REFERENCES categories(id)    ON DELETE RESTRICT,
  modellname      text NOT NULL,
  variante        text,
  version         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, modellname, variante, version)
);

CREATE INDEX models_manufacturer_idx ON models(manufacturer_id);
CREATE INDEX models_category_idx     ON models(category_id);

-- Lieferanten
CREATE TABLE suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kunden
CREATE TABLE customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
