-- supabase/migrations/013_lieferschein.sql
--
-- Lieferscheinmodus (Phase 1):
--  - Add `source_document_path` to purchases (FK to Storage object path).
--  - Create `lieferscheine` Storage bucket with non-viewer RLS.
--  - Add RPC create_lieferschein(payload jsonb) for atomic bulk insert
--    of 1 purchase + N devices + N purchase_items in one transaction.
--
-- Idempotent: safe to re-run.

-- 1. Source-Doc-Reference auf purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS source_document_path text;

-- 2. Storage Bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lieferscheine', 'lieferscheine', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: non-viewer darf read/write/delete im Bucket
DROP POLICY IF EXISTS "lieferscheine_read_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_read_nonviewer"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

DROP POLICY IF EXISTS "lieferscheine_write_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_write_nonviewer"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

DROP POLICY IF EXISTS "lieferscheine_delete_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_delete_nonviewer"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

-- 4. RPC für atomares Create
CREATE OR REPLACE FUNCTION create_lieferschein(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_purchase_id uuid;
  v_device_id uuid;
  v_item jsonb;
  v_ek text;
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

    v_ek := v_item->>'ek_preis';
    IF v_ek IS NOT NULL AND v_ek <> '' THEN
      INSERT INTO purchase_items (purchase_id, device_id, ek_preis)
      VALUES (v_purchase_id, v_device_id, v_ek::numeric);
    END IF;
  END LOOP;

  RETURN v_purchase_id;
END;
$$;

-- Grant to authenticated (role check happens via invoker context + RLS)
GRANT EXECUTE ON FUNCTION create_lieferschein(jsonb) TO authenticated;
