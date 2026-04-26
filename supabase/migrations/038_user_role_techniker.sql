-- supabase/migrations/038_user_role_techniker.sql
--
-- Erweitert user_role um 'techniker'. Unterscheidung zu mitarbeiter:
-- techniker arbeitet im Feld (Arbeitsberichte, Geräte-Installation),
-- mitarbeiter ist im Innendienst (Inventar, Belege, Lizenzen).
--
-- ENUM-Erweiterung läuft transaktionsfest, RLS-Policies referenzieren
-- den neuen Wert noch nicht — wo nötig wird das in nachfolgenden
-- Migrationen ergänzt (techniker bekommt im Zweifel mitarbeiter-Rechte).
--
-- Idempotent.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'techniker';

NOTIFY pgrst, 'reload schema';
