-- supabase/migrations/056_drop_vectron_cash_register_secrets.sql
--
-- 054 hatte das per-Kasse "Master-Passwort" eingefuehrt — laut Vectron-Portal-
-- Recon war das aber das ConnectID-/Wartungs-Passwort, nicht das echte Master-
-- Passwort der Kasse. Das echte Master-Passwort haengt an der Site und wird in
-- 055 abgehandelt. Wir brauchen das ConnectID-Feld nicht, also weg.

DROP TABLE IF EXISTS vectron_cash_register_secrets;

NOTIFY pgrst, 'reload schema';
