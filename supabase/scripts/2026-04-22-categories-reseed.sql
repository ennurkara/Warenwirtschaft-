-- supabase/scripts/2026-04-22-categories-reseed.sql
--
-- ONE-SHOT, DESTRUCTIVE. Wipes all inventory test data and reseeds
-- the 21 production categories. NOT idempotent — re-running wipes again.
--
-- Run manually in Supabase SQL Editor AFTER migration 012 has been applied.
-- Operator must explicitly confirm before running. Pre-check counts first.
--
-- The Vectron manufacturer + its seeded models (migration 008) and the
-- Swissbit TSE models (migration 010) are wiped by this script. They must
-- be re-added through the admin UI after reseed if you still need them.

-- ==========================================================================
-- 1. PRE-CHECK — review these counts before scrolling down to the wipe block.
-- ==========================================================================

SELECT 'devices'        AS tbl, count(*) FROM devices
UNION ALL SELECT 'vectron_details',     count(*) FROM vectron_details
UNION ALL SELECT 'purchase_items',      count(*) FROM purchase_items
UNION ALL SELECT 'purchases',           count(*) FROM purchases
UNION ALL SELECT 'sale_items',          count(*) FROM sale_items
UNION ALL SELECT 'sales',               count(*) FROM sales
UNION ALL SELECT 'stock_items',         count(*) FROM stock_items
UNION ALL SELECT 'stock_movements',     count(*) FROM stock_movements
UNION ALL SELECT 'models',              count(*) FROM models
UNION ALL SELECT 'manufacturers',       count(*) FROM manufacturers
UNION ALL SELECT 'suppliers',           count(*) FROM suppliers
UNION ALL SELECT 'categories',          count(*) FROM categories;

-- ==========================================================================
-- 2. WIPE — uncomment and run only after operator confirmation.
-- ==========================================================================

-- BEGIN;
-- DELETE FROM stock_movements;
-- DELETE FROM sale_items;
-- DELETE FROM sales;
-- DELETE FROM purchase_items;
-- DELETE FROM purchases;
-- DELETE FROM vectron_details;
-- DELETE FROM devices;
-- DELETE FROM stock_items;
-- DELETE FROM models;
-- DELETE FROM manufacturers;
-- DELETE FROM suppliers;
-- DELETE FROM categories;
-- COMMIT;

-- ==========================================================================
-- 3. RESEED CATEGORIES — 21 entries across 6 clusters.
--    Uncomment after the wipe COMMIT.
-- ==========================================================================

-- INSERT INTO categories (name, icon, kind, cluster) VALUES
--   -- Cluster 1: kassen
--   ('Kassenhardware',           'cash-register',     'kassenhardware', 'kassen'),
--   ('Dockingstation',           'dock',              'generic',        'kassen'),
--   ('Kundendisplay',            'monitor-smartphone','generic',        'kassen'),
--   ('Kassenschublade',          'archive',           'generic',        'kassen'),
--   ('Schlösser',                'key',               'generic',        'kassen'),
--   ('TSE Swissbit',             'shield-check',      'generic',        'kassen'),
--   ('Scanner',                  'scan',              'generic',        'kassen'),
--   -- Cluster 2: druck
--   ('Drucker',                  'printer',           'generic',        'druck'),
--   ('Küchenmonitor',            'monitor',           'generic',        'druck'),
--   ('Bonrollen',                'scroll',            'stock',          'druck'),
--   -- Cluster 3: mobile
--   ('Handhelds',                'tablet',            'generic',        'mobile'),
--   ('Ladestation',              'battery-charging',  'generic',        'mobile'),
--   ('Kiosksysteme',             'square-terminal',   'generic',        'mobile'),
--   -- Cluster 4: peripherie
--   ('Waagen',                   'scale',             'generic',        'peripherie'),
--   ('Externe Festplatte',       'hard-drive',        'generic',        'peripherie'),
--   ('USB-Sticks',               'usb',               'stock',          'peripherie'),
--   -- Cluster 5: netzwerk_strom
--   ('Netzwerktechnik',          'network',           'generic',        'netzwerk_strom'),
--   ('Netzteile',                'plug',              'generic',        'netzwerk_strom'),
--   ('USV',                      'battery-warning',   'generic',        'netzwerk_strom'),
--   -- Cluster 6: montage
--   ('Kassenmontagesystem',      'columns',           'simple',         'montage'),
--   ('Installationsmaterial',    'cable',             'simple',         'montage');

-- ==========================================================================
-- 4. POST-CHECK — uncomment after reseed.
-- ==========================================================================

-- SELECT cluster, count(*) FROM categories GROUP BY cluster ORDER BY cluster;
-- SELECT name, kind, cluster, icon FROM categories ORDER BY cluster, name;
