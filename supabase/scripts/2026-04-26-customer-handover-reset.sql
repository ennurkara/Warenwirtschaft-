-- supabase/scripts/2026-04-26-customer-handover-reset.sql
--
-- ONE-SHOT, DESTRUCTIVE. Setzt die DB in den Auslieferungs-Zustand zurück:
--   * leert alle Geräte und alle daran hängenden Beleg-/Bewegungs-Tabellen
--   * leert alle Arbeitsberichte (inkl. work_report_devices via CASCADE)
--
-- Bleibt erhalten (Stammdaten):
--   customers, profiles, categories, manufacturers, models, suppliers, stock_items
--
-- Run manuell im Supabase SQL Editor (https://supabase.kassen-buch.cloud).
-- Ablauf: 1) Pre-Check ausführen → Counts notieren
--         2) DELETE-Block einkommentieren und ausführen
--         3) Post-Check ausführen → alle Counts müssen 0 sein
--
-- FK-Map auf devices(id):
--   purchase_items, sale_items, work_report_devices  → ON DELETE RESTRICT  (müssen vor devices weg)
--   vectron_details, stock_movements,
--   device_assignments                               → ON DELETE CASCADE   (gehen automatisch mit)
--
-- Hinweis: kassen_details (FK in Migration 005) existiert in Prod nicht — daher hier weggelassen.

-- ==========================================================================
-- 1. PRE-CHECK
-- ==========================================================================

SELECT 'work_reports'        AS tbl, count(*) FROM work_reports
UNION ALL SELECT 'work_report_devices',  count(*) FROM work_report_devices
UNION ALL SELECT 'device_assignments',   count(*) FROM device_assignments
UNION ALL SELECT 'devices',              count(*) FROM devices
UNION ALL SELECT 'vectron_details',      count(*) FROM vectron_details
UNION ALL SELECT 'purchase_items',       count(*) FROM purchase_items
UNION ALL SELECT 'purchases',            count(*) FROM purchases
UNION ALL SELECT 'sale_items',           count(*) FROM sale_items
UNION ALL SELECT 'sales',                count(*) FROM sales
UNION ALL SELECT 'stock_movements',      count(*) FROM stock_movements;

-- ==========================================================================
-- 2. WIPE — einkommentieren und ausführen nach Pre-Check.
-- ==========================================================================

-- BEGIN;
-- -- Arbeitsberichte zuerst (CASCADE räumt work_report_devices)
-- DELETE FROM work_reports;
-- -- Geräte-Historie / Zuweisungen
-- DELETE FROM device_assignments;
-- -- Beleg-Items mit FK auf devices (RESTRICT)
-- DELETE FROM purchase_items;
-- DELETE FROM sale_items;
-- -- Beleg-Köpfe (jetzt leer)
-- DELETE FROM purchases;
-- DELETE FROM sales;
-- -- Lager-Bewegungen mit device_id
-- DELETE FROM stock_movements;
-- -- Geräte (CASCADE räumt vectron_details + kassen_details)
-- DELETE FROM devices;
-- COMMIT;

-- ==========================================================================
-- 3. POST-CHECK — alle Counts müssen 0 sein.
-- ==========================================================================

-- SELECT 'work_reports'       AS tbl, count(*) FROM work_reports
-- UNION ALL SELECT 'work_report_devices', count(*) FROM work_report_devices
-- UNION ALL SELECT 'device_assignments',  count(*) FROM device_assignments
-- UNION ALL SELECT 'devices',             count(*) FROM devices
-- UNION ALL SELECT 'vectron_details',     count(*) FROM vectron_details
-- UNION ALL SELECT 'purchase_items',      count(*) FROM purchase_items
-- UNION ALL SELECT 'purchases',           count(*) FROM purchases
-- UNION ALL SELECT 'sale_items',          count(*) FROM sale_items
-- UNION ALL SELECT 'sales',               count(*) FROM sales
-- UNION ALL SELECT 'stock_movements',     count(*) FROM stock_movements;
