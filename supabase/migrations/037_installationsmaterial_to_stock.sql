-- supabase/migrations/037_installationsmaterial_to_stock.sql
--
-- Kategorie "Installationsmaterial" (Kabel, Schrauben, Klemmen, Klebeband etc.)
-- ist Massenware ohne Seriennummer-Tracking — wird daher von simple auf
-- stock umgestellt. Aktuell sind keine Modelle/Devices/StockItems daran
-- gehängt, daher ist der Switch verlustfrei.
--
-- Idempotent.

UPDATE categories
   SET kind = 'stock'
 WHERE name = 'Installationsmaterial'
   AND kind <> 'stock';

NOTIFY pgrst, 'reload schema';
