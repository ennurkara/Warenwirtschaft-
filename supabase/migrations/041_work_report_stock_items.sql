-- supabase/migrations/041_work_report_stock_items.sql
--
-- Bestand-Positionen im Arbeitsbericht. Bisher konnten nur seriennummer-basierte
-- devices an einen work_report gehängt werden (work_report_devices). Mit dieser
-- Migration kommen Bestand-Positionen dazu — Bonrollen, Installationsmaterial,
-- USB-Sticks etc., wo nur Modell + Menge erfasst werden.
--
-- Buchungs-Mechanik beim Wizard-Finish (im AB-Repo, route /api/finish-report
-- bzw. handleFinish):
--   1. Insert in work_report_stock_items
--   2. UPDATE stock_items SET quantity = quantity - menge WHERE model_id = ...
--   3. Insert in stock_movements (kind='verkauf', delta=-menge,
--      reference_id=work_report.id, unit_price=models.default_vk)
--
-- Schritt 2/3 sind nicht in dieser Migration — sie laufen im Server-Code,
-- damit das transaktional mit allen anderen Finish-Aufgaben passiert.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS work_report_stock_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_report_id uuid        NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  model_id       uuid        NOT NULL REFERENCES models(id)       ON DELETE RESTRICT,
  quantity       integer     NOT NULL CHECK (quantity > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_report_id, model_id)
);

CREATE INDEX IF NOT EXISTS work_report_stock_items_report_idx
  ON work_report_stock_items(work_report_id);
CREATE INDEX IF NOT EXISTS work_report_stock_items_model_idx
  ON work_report_stock_items(model_id);

-- RLS — gleiche Logik wie work_report_devices: Sichtbarkeit folgt dem
-- übergeordneten work_report; insert/delete nur durch den eigenen Techniker
-- oder admin/mitarbeiter.

ALTER TABLE work_report_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wrsi_select" ON work_report_stock_items;
CREATE POLICY "wrsi_select" ON work_report_stock_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND (
          wr.technician_id = auth.uid()
          OR get_my_role() IN ('admin', 'viewer')
        )
    )
  );

DROP POLICY IF EXISTS "wrsi_insert" ON work_report_stock_items;
CREATE POLICY "wrsi_insert" ON work_report_stock_items
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter', 'techniker')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND wr.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "wrsi_delete" ON work_report_stock_items;
CREATE POLICY "wrsi_delete" ON work_report_stock_items
  FOR DELETE TO authenticated
  USING (
    get_my_role() IN ('admin', 'mitarbeiter', 'techniker')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND wr.technician_id = auth.uid()
    )
  );

-- RPC: Bestand-Buchung beim Wizard-Finish, atomar in einer Transaktion.
--   1. INSERT (oder UPDATE) work_report_stock_items
--   2. UPDATE stock_items.quantity -= p_quantity
--   3. INSERT stock_movements (kind='verkauf', delta=-p_quantity)
-- SECURITY DEFINER, damit techniker stock_items aktualisieren darf, ohne dass
-- wir das in der base-RLS aufmachen müssen (stock_items_update_admin_staff
-- erlaubt aktuell nur admin/mitarbeiter — und das soll so bleiben).
CREATE OR REPLACE FUNCTION consume_stock_for_report(
  p_model_id       uuid,
  p_quantity       integer,
  p_work_report_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_item_id uuid;
  v_unit_price    numeric(10,2);
  v_owner         uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'consume_stock_for_report: quantity must be positive';
  END IF;

  -- Aufrufer muss der Techniker des Berichts ODER admin/mitarbeiter sein.
  -- (Vermeidet, dass eine versehentliche Client-Manipulation fremde Berichte
  -- bucht — SECURITY DEFINER würde das sonst durchwinken.)
  SELECT technician_id INTO v_owner FROM work_reports WHERE id = p_work_report_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'consume_stock_for_report: report % not found', p_work_report_id;
  END IF;
  IF v_owner <> auth.uid()
     AND COALESCE(get_my_role(), 'viewer') NOT IN ('admin', 'mitarbeiter') THEN
    RAISE EXCEPTION 'consume_stock_for_report: not authorised for report %', p_work_report_id;
  END IF;

  SELECT si.id, m.default_vk
    INTO v_stock_item_id, v_unit_price
  FROM stock_items si
  JOIN models m ON m.id = si.model_id
  WHERE si.model_id = p_model_id;

  IF v_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'consume_stock_for_report: stock_items für model_id % nicht gefunden', p_model_id;
  END IF;

  INSERT INTO work_report_stock_items (work_report_id, model_id, quantity)
  VALUES (p_work_report_id, p_model_id, p_quantity)
  ON CONFLICT (work_report_id, model_id) DO UPDATE
    SET quantity = EXCLUDED.quantity;

  UPDATE stock_items
    SET quantity = GREATEST(0, quantity - p_quantity)
    WHERE id = v_stock_item_id;

  INSERT INTO stock_movements (stock_item_id, kind, delta, unit_price, reference_id, user_id, note)
  VALUES (
    v_stock_item_id,
    'verkauf',
    -p_quantity,
    v_unit_price,
    p_work_report_id,
    auth.uid(),
    'Verbrauch über Arbeitsbericht'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_stock_for_report(uuid, integer, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
