-- Enum-Typen
CREATE TYPE user_role AS ENUM ('admin', 'mitarbeiter', 'viewer');
CREATE TYPE device_condition AS ENUM ('neu', 'gebraucht');
CREATE TYPE device_status AS ENUM ('lager', 'im_einsatz', 'defekt', 'ausgemustert');
CREATE TYPE movement_action AS ENUM ('entnahme', 'einlagerung', 'defekt_gemeldet');

-- Benutzerprofile
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        user_role NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger: Profil automatisch bei User-Registrierung anlegen
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'viewer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Kategorien
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  icon        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Standardkategorien
INSERT INTO categories (name, icon) VALUES
  ('Registrierkasse', 'cash-register'),
  ('Drucker', 'printer'),
  ('Scanner', 'scan'),
  ('Kabel', 'cable'),
  ('Monitor', 'monitor'),
  ('Tastatur', 'keyboard'),
  ('Maus', 'mouse-pointer'),
  ('Netzwerk', 'network'),
  ('Sonstiges', 'package');

-- Endgeräte
CREATE TABLE devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  category_id   uuid NOT NULL REFERENCES categories(id),
  serial_number text,
  condition     device_condition NOT NULL,
  status        device_status NOT NULL DEFAULT 'lager',
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  location      text,
  photo_url     text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Bewegungshistorie
CREATE TABLE device_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  action      movement_action NOT NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Storage Bucket für Geräte-Fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('device-photos', 'device-photos', false);