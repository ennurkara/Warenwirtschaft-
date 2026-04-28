-- supabase/migrations/045_devices_site_and_vectron_extras.sql
--
-- Bringt zwei Erweiterungen fuer den Vectron-Import:
--
-- 1) devices.site_id  → customer_sites
--    Eine Kasse kann jetzt an einer konkreten Filiale haengen,
--    nicht nur am Kunden. ON DELETE SET NULL.
--
-- 2) vectron_details erweitert um:
--      - sw_version              z.B. "8.3.1.0"
--      - os_version              z.B. "1.2.1.0"
--      - platform                "K5" / "K6" / "K7" / "Android" / "PC"
--      - login                   z.B. "adlkofen-1"
--      - connect_id              z.B. "3146496.adlkofen_connect"
--      - fiscal_identifier       z.B. "10000000001"
--      - last_heartbeat_at       letzter Heartbeat aus MyVectron
--      - vectron_cash_register_id  Re-Sync-Anker (UNIQUE)
--    license_type wird NULLABLE (Vectron-API liefert das nicht; manuell pflegbar).
--
-- Idempotent.

-- 1) devices.site_id
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS site_id uuid;

DO $$ BEGIN
  ALTER TABLE devices
    ADD CONSTRAINT devices_site_id_fk
    FOREIGN KEY (site_id) REFERENCES customer_sites(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS devices_site_idx
  ON devices(site_id) WHERE site_id IS NOT NULL;

-- 2) vectron_details erweitern
ALTER TABLE vectron_details
  ADD COLUMN IF NOT EXISTS sw_version               text,
  ADD COLUMN IF NOT EXISTS os_version               text,
  ADD COLUMN IF NOT EXISTS platform                 text,
  ADD COLUMN IF NOT EXISTS login                    text,
  ADD COLUMN IF NOT EXISTS connect_id               text,
  ADD COLUMN IF NOT EXISTS fiscal_identifier        text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at        timestamptz,
  ADD COLUMN IF NOT EXISTS vectron_cash_register_id uuid;

-- license_type NULLABLE machen (war vorher NOT NULL)
ALTER TABLE vectron_details
  ALTER COLUMN license_type DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vectron_details_cash_register_id_uniq
  ON vectron_details(vectron_cash_register_id)
  WHERE vectron_cash_register_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
