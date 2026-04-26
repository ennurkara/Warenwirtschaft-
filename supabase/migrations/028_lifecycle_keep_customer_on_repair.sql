-- supabase/migrations/028_lifecycle_keep_customer_on_repair.sql
--
-- Verkaufte Geräte gehören dauerhaft dem Kunden. Wenn sie zur Reparatur
-- kommen oder via Austausch zurückgenommen werden, bleibt die Kunden-
-- Beziehung erhalten (current_customer_id + aktive 'verkauf'-Assignment
-- werden nicht angetastet). Nach abgeschlossener Reparatur geht das
-- Gerät wieder in den Status 'verkauft' zurück, nicht ins Lager.
--
-- Idempotent.

-- 1) return_device — kennt jetzt verkaufte Geräte
CREATE OR REPLACE FUNCTION return_device(
  p_device_id     uuid,
  p_target_status text DEFAULT 'lager',
  p_notes         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_now                   timestamptz := now();
  v_has_active_verkauf    boolean;
BEGIN
  IF p_target_status NOT IN ('lager', 'in_reparatur', 'defekt', 'ausgemustert', 'reserviert', 'verkauft') THEN
    RAISE EXCEPTION 'invalid target_status: %', p_target_status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM device_assignments
     WHERE device_id = p_device_id AND kind = 'verkauf' AND ended_at IS NULL
  ) INTO v_has_active_verkauf;

  -- Sonderfall: "Reparatur abgeschlossen" auf einem verkauften Gerät →
  -- das Gerät gehört dem Kunden, nicht uns; Status zurück auf 'verkauft'.
  IF p_target_status = 'lager' AND v_has_active_verkauf THEN
    UPDATE devices
       SET status = 'verkauft'
     WHERE id = p_device_id;
    RETURN;
  END IF;

  IF v_has_active_verkauf THEN
    -- Verkaufte Geräte: 'verkauf'-Assignment NIEMALS beenden, nur Status ändern.
    -- Andere offene Assignments (Leihe parallel etc) trotzdem schließen.
    UPDATE device_assignments
       SET ended_at = v_now,
           notes = COALESCE(notes || E'\n' || p_notes, notes, p_notes)
     WHERE device_id = p_device_id AND ended_at IS NULL AND kind <> 'verkauf';
    UPDATE devices
       SET status = p_target_status::device_status
       -- current_customer_id bleibt erhalten
     WHERE id = p_device_id;
  ELSE
    -- Firma-Geräte: alle aktiven Assignments beenden + Customer leeren
    UPDATE device_assignments
       SET ended_at = v_now,
           notes = COALESCE(notes || E'\n' || p_notes, notes, p_notes)
     WHERE device_id = p_device_id AND ended_at IS NULL;
    UPDATE devices
       SET status = p_target_status::device_status,
           current_customer_id = NULL
     WHERE id = p_device_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION return_device(uuid, text, text) TO authenticated;

-- 2) assign_device — Austausch behält bei verkauftem Rückläufer den Eigentümer
CREATE OR REPLACE FUNCTION assign_device(
  p_device_id          uuid,
  p_customer_id        uuid,
  p_kind               text,
  p_swap_in_device_id  uuid DEFAULT NULL,
  p_work_report_id     uuid DEFAULT NULL,
  p_notes              text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_now                  timestamptz := now();
  v_out_assignment_id    uuid;
  v_in_assignment_id     uuid;
  v_in_has_verkauf       boolean;
BEGIN
  IF p_kind = 'leihe' THEN
    UPDATE device_assignments
       SET ended_at = v_now
     WHERE device_id = p_device_id AND ended_at IS NULL AND kind <> 'verkauf';

    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, notes
    ) VALUES (
      p_device_id, p_customer_id, 'leihe', p_work_report_id, v_now, p_notes
    ) RETURNING id INTO v_out_assignment_id;

    UPDATE devices
       SET status = 'verliehen',
           current_customer_id = p_customer_id
     WHERE id = p_device_id;

    RETURN v_out_assignment_id;

  ELSIF p_kind = 'verkauf' THEN
    UPDATE device_assignments
       SET ended_at = v_now
     WHERE device_id = p_device_id AND ended_at IS NULL;

    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, notes
    ) VALUES (
      p_device_id, p_customer_id, 'verkauf', p_work_report_id, v_now, p_notes
    ) RETURNING id INTO v_out_assignment_id;

    UPDATE devices
       SET status = 'verkauft',
           current_customer_id = p_customer_id
     WHERE id = p_device_id;

    RETURN v_out_assignment_id;

  ELSIF p_kind = 'austausch' THEN
    IF p_swap_in_device_id IS NULL THEN
      RAISE EXCEPTION 'austausch requires p_swap_in_device_id';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM device_assignments
       WHERE device_id = p_swap_in_device_id AND kind = 'verkauf' AND ended_at IS NULL
    ) INTO v_in_has_verkauf;

    -- Beende aktive Leihe-Zuordnungen des Rückläufers — verkauf bleibt aktiv
    UPDATE device_assignments
       SET ended_at = v_now
     WHERE device_id = p_swap_in_device_id AND ended_at IS NULL AND kind <> 'verkauf';

    -- Tausch-Rein: Moment-Datensatz
    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, ended_at, notes
    ) VALUES (
      p_swap_in_device_id, p_customer_id, 'austausch_rein', p_work_report_id, v_now, v_now, p_notes
    ) RETURNING id INTO v_in_assignment_id;

    -- Tausch-Raus: aktive Leihe für die neue Kasse
    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, swap_pair_id, notes
    ) VALUES (
      p_device_id, p_customer_id, 'austausch_raus', p_work_report_id, v_now, v_in_assignment_id, p_notes
    ) RETURNING id INTO v_out_assignment_id;

    UPDATE devices
       SET status = 'verliehen',
           current_customer_id = p_customer_id
     WHERE id = p_device_id;

    -- Rückläufer auf in_reparatur. Bei verkauftem Rückläufer Customer-FK behalten.
    IF v_in_has_verkauf THEN
      UPDATE devices
         SET status = 'in_reparatur'
       WHERE id = p_swap_in_device_id;
    ELSE
      UPDATE devices
         SET status = 'in_reparatur',
             current_customer_id = NULL
       WHERE id = p_swap_in_device_id;
    END IF;

    RETURN v_out_assignment_id;

  ELSE
    RAISE EXCEPTION 'Unknown kind: %', p_kind;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_device(uuid, uuid, text, uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
