-- supabase/migrations/050_replace_apro_license_catalog.sql
--
-- Ersetzt den alten Excel-basierten APRO-Lizenzkatalog (53 Modelle mit
-- deutschen Namen wie "APRO. Kasse 10") durch die 39 echten Lizenztypen
-- aus dem APRO Distributoren-Portal (liveupdate.apro.at).
--
-- Naming-Schema: technische APRO-Identifier (z.B. "apro.kassa10",
-- "apro.handy9_5Jahre", "apro.DATEV_KassenArchiv"). Damit ist der
-- Re-Sync mit dem Portal direkt moeglich.
--
-- Lizenzen ohne Versions-Suffix wurden entfernt; einzige Ausnahme:
-- "apro.DATEV_KassenArchiv" (legitimer eigener Lizenztyp).
--
-- Idempotent. Vor der Anwendung sollte sichergestellt sein, dass keine
-- aktiven Lizenzen auf den alten Modellen haengen — andernfalls werden
-- die FKs auf NULL gesetzt (licenses.model_id ON DELETE SET NULL).

DO $$
DECLARE
  v_apro_id uuid;
  v_cat_id  uuid;
BEGIN
  SELECT id INTO v_apro_id FROM manufacturers WHERE name = 'Apro';
  SELECT id INTO v_cat_id  FROM categories    WHERE name = 'Apro-Lizenz';

  IF v_apro_id IS NULL OR v_cat_id IS NULL THEN
    RAISE EXCEPTION 'Apro manufacturer or Apro-Lizenz category not found';
  END IF;

  -- 1) Alte Modelle loeschen (model_id auf licenses.* wird per ON DELETE SET NULL geloescht)
  DELETE FROM models
   WHERE manufacturer_id = v_apro_id
     AND category_id     = v_cat_id;

  -- 2) Neuen Katalog seeden (39 Modelle aus dem APRO-Portal)
  INSERT INTO models (manufacturer_id, category_id, modellname)
  SELECT v_apro_id, v_cat_id, t.name FROM (VALUES
    ('apro.bestellmanager10'),
    ('apro.bestellmanager9'),
    ('apro.bon10'),
    ('apro.card10'),
    ('apro.card9'),
    ('apro.DATEV_KassenArchiv'),
    ('apro.easyStart9'),
    ('apro.faktura10'),
    ('apro.faktura9'),
    ('apro.fibu10'),
    ('apro.funk10'),
    ('apro.funk9'),
    ('apro.gutschein10'),
    ('apro.gutschein9'),
    ('apro.handy10'),
    ('apro.handy10_1Monat'),
    ('apro.handy10_3Monate'),
    ('apro.handy10_5Jahre'),
    ('apro.handy10_6Monate'),
    ('apro.handy9'),
    ('apro.handy9_1Jahr'),
    ('apro.handy9_1Monat'),
    ('apro.handy9_5Jahre'),
    ('apro.hotel10'),
    ('apro.hotel9'),
    ('apro.kassa10'),
    ('apro.kassa9'),
    ('apro.kassabuch10'),
    ('apro.kassabuch9'),
    ('apro.kredit10'),
    ('apro.kredit9'),
    ('apro.lager/stand10'),
    ('apro.lager/stand9'),
    ('apro.office10'),
    ('apro.office9'),
    ('apro.schank10'),
    ('apro.schank9'),
    ('apro.server10'),
    ('apro.softpay10')
  ) AS t(name);
END $$;

NOTIFY pgrst, 'reload schema';
