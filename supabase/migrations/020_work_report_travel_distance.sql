-- supabase/migrations/020_work_report_travel_distance.sql
--
-- Speichert die per OSRM-Routing berechnete Anfahrt-Distanz in Kilometern,
-- damit Warenwirtschaft sie ohne erneute Geocoding-Calls anzeigen kann.
-- Setzt der Arbeitsbericht-Wizard beim Step "Aufwand".
--
-- Idempotent.

ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS travel_distance_km numeric(7,2);

-- PostgREST schema reload, damit der neue Column ohne DB-Restart sichtbar wird.
NOTIFY pgrst, 'reload schema';
