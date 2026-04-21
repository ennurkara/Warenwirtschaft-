-- supabase/migrations/006_dashboard_views.sql

-- Gesamt-KPIs (eine Row)
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  (SELECT count(*) FROM devices WHERE status = 'lager') AS geraete_im_lager,
  COALESCE((
    SELECT sum(pi.ek_preis)
    FROM devices d
    JOIN purchase_items pi ON pi.device_id = d.id
    WHERE d.status = 'lager'
  ), 0) AS bestandswert_ek,
  COALESCE((
    SELECT sum(si.vk_preis)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.datum >= date_trunc('month', current_date)
  ), 0) AS umsatz_mtd,
  COALESCE((
    SELECT sum(si.vk_preis - COALESCE(pi.ek_preis, 0))
    FROM sale_items si
    JOIN sales s          ON s.id = si.sale_id
    LEFT JOIN purchase_items pi ON pi.device_id = si.device_id
    WHERE s.datum >= date_trunc('month', current_date)
  ), 0) AS marge_mtd;

-- Bestand nach Kategorie (Bar-Chart)
CREATE OR REPLACE VIEW v_stock_by_category AS
SELECT
  c.id   AS category_id,
  c.name AS category_name,
  count(d.id) FILTER (WHERE d.status = 'lager') AS anzahl_im_lager,
  COALESCE(sum(pi.ek_preis) FILTER (WHERE d.status = 'lager'), 0) AS bestandswert_ek
FROM categories c
LEFT JOIN models m           ON m.category_id = c.id
LEFT JOIN devices d          ON d.model_id    = m.id
LEFT JOIN purchase_items pi  ON pi.device_id  = d.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Verkäufe letzte 30 Tage (Line-Chart)
CREATE OR REPLACE VIEW v_sales_last_30d AS
SELECT
  s.datum                    AS tag,
  sum(si.vk_preis)           AS umsatz,
  count(*)                   AS stueck
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE s.datum >= current_date - interval '30 days'
GROUP BY s.datum
ORDER BY s.datum;

-- Top-5 Modelle nach Umsatz YTD
CREATE OR REPLACE VIEW v_top_models_revenue AS
SELECT
  m.id AS model_id,
  mf.name || ' ' || m.modellname ||
    COALESCE(' ' || m.variante, '') ||
    COALESCE(' ' || m.version, '') AS model_label,
  count(si.id)        AS stueckzahl_verkauft,
  sum(si.vk_preis)    AS umsatz_ytd
FROM sale_items si
JOIN sales s         ON s.id = si.sale_id
JOIN devices d       ON d.id = si.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
WHERE s.datum >= date_trunc('year', current_date)
GROUP BY m.id, mf.name, m.modellname, m.variante, m.version
ORDER BY umsatz_ytd DESC
LIMIT 5;

-- Letzte 5 Verkäufe
CREATE OR REPLACE VIEW v_recent_sales AS
SELECT
  s.id         AS sale_id,
  s.datum,
  c.name       AS kunde,
  mf.name || ' ' || m.modellname AS model_label,
  si.vk_preis
FROM sales s
JOIN sale_items si   ON si.sale_id = s.id
JOIN customers c     ON c.id = s.customer_id
JOIN devices d       ON d.id = si.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
ORDER BY s.datum DESC, s.created_at DESC
LIMIT 5;

-- TSE-Ablauf-Warnungen (Kassen mit TSE-Frist < 90 Tagen)
CREATE OR REPLACE VIEW v_tse_expiring AS
SELECT
  d.id AS device_id,
  mf.name || ' ' || m.modellname AS model_label,
  kd.hw_serial,
  kd.tse_serial,
  kd.tse_valid_until,
  (kd.tse_valid_until - current_date) AS tage_verbleibend
FROM kassen_details kd
JOIN devices d       ON d.id = kd.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
WHERE kd.tse_valid_until IS NOT NULL
  AND kd.tse_valid_until <= current_date + interval '90 days'
ORDER BY kd.tse_valid_until;
