-- supabase/migrations/024_lieferschein_vectron_details.sql
--
-- Lieferschein-RPC schreibt jetzt fuer Vectron-Geraete automatisch eine
-- vectron_details-Zeile (vorher musste man jedes Vectron-Geraet einzeln
-- ueber die Detail-Seite nachpflegen). Die Software-Seriennummer wird
-- direkt im Lieferschein-Item mitgeliefert.
--
-- Plus: license_type bekommt einen Default 'full', damit Bulk-Inserts
-- ohne Lizenztyp-Auswahl funktionieren — der User pflegt im Detail nach.
--
-- Idempotent.

-- 1) Default fuer license_type setzen
ALTER TABLE vectron_details
  ALTER COLUMN license_type SET DEFAULT 'full';

-- 2) RPC anpassen
CREATE OR REPLACE FUNCTION create_lieferschein(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_purchase_id uuid;
  v_device_id   uuid;
  v_item        jsonb;
  v_ek          text;
  v_is_vectron  boolean;
  v_sw_serial   text;
BEGIN
  INSERT INTO purchases (supplier_id, rechnungsnr, datum, source_document_path)
  VALUES (
    (payload->>'supplier_id')::uuid,
    NULLIF(payload->>'rechnungsnr', ''),
    (payload->>'datum')::date,
    NULLIF(payload->>'source_document_path', '')
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    INSERT INTO devices (model_id, serial_number, status, location, notes)
    VALUES (
      (v_item->>'model_id')::uuid,
      NULLIF(v_item->>'serial_number', ''),
      'lager',
      NULLIF(v_item->>'location', ''),
      NULLIF(v_item->>'notes', '')
    )
    RETURNING id INTO v_device_id;

    -- Vectron erkennen ueber model -> manufacturer
    SELECT EXISTS (
      SELECT 1 FROM models m
      JOIN manufacturers mf ON mf.id = m.manufacturer_id
      WHERE m.id = (v_item->>'model_id')::uuid
        AND mf.name = 'Vectron'
    ) INTO v_is_vectron;

    IF v_is_vectron THEN
      v_sw_serial := NULLIF(v_item->>'sw_serial', '');
      INSERT INTO vectron_details (device_id, sw_serial)
      VALUES (v_device_id, v_sw_serial)
      ON CONFLICT (device_id) DO UPDATE SET sw_serial = EXCLUDED.sw_serial;
    END IF;

    v_ek := v_item->>'ek_preis';
    IF v_ek IS NOT NULL AND v_ek <> '' THEN
      INSERT INTO purchase_items (purchase_id, device_id, ek_preis)
      VALUES (v_purchase_id, v_device_id, v_ek::numeric);
    END IF;
  END LOOP;

  RETURN v_purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_lieferschein(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
