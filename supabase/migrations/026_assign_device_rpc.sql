-- supabase/migrations/026_assign_device_rpc.sql
--
-- RPC `assign_device` für atomare Verleih/Verkauf/Austausch-Operationen.
-- Schreibt device_assignments-Zeilen + aktualisiert devices.status +
-- devices.current_customer_id in einer Transaktion.
--
-- Aufruf-Schemas:
--   assign_device(device_id, customer_id, 'leihe',    work_report_id?, notes?)
--   assign_device(device_id, customer_id, 'verkauf',  work_report_id?, notes?)
--   assign_device(device_id, customer_id, 'austausch', swap_in_device_id, work_report_id?, notes?)
--
-- Returns: id der "Raus"-Assignment-Zeile (also die aktive Zuordnung des
-- Geräts an den Kunden).
--
-- Idempotent.

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
  v_now                timestamptz := now();
  v_out_assignment_id  uuid;
  v_in_assignment_id   uuid;
BEGIN
  IF p_kind = 'leihe' THEN
    -- Defensive: vorherige aktive Zuordnung beenden, falls vorhanden.
    UPDATE device_assignments
       SET ended_at = v_now
     WHERE device_id = p_device_id AND ended_at IS NULL;

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

    -- Vorherige Leihe des zurückkommenden Geräts beenden
    UPDATE device_assignments
       SET ended_at = v_now
     WHERE device_id = p_swap_in_device_id AND ended_at IS NULL;

    -- Tausch-Rein: Moment-in-time-Datensatz (started == ended)
    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, ended_at, notes
    ) VALUES (
      p_swap_in_device_id, p_customer_id, 'austausch_rein', p_work_report_id, v_now, v_now, p_notes
    ) RETURNING id INTO v_in_assignment_id;

    -- Tausch-Raus: aktiv bis Rückgabe (ended_at NULL)
    INSERT INTO device_assignments (
      device_id, customer_id, kind, work_report_id, started_at, swap_pair_id, notes
    ) VALUES (
      p_device_id, p_customer_id, 'austausch_raus', p_work_report_id, v_now, v_in_assignment_id, p_notes
    ) RETURNING id INTO v_out_assignment_id;

    UPDATE devices
       SET status = 'verliehen',
           current_customer_id = p_customer_id
     WHERE id = p_device_id;

    UPDATE devices
       SET status = 'in_reparatur',
           current_customer_id = NULL
     WHERE id = p_swap_in_device_id;

    RETURN v_out_assignment_id;

  ELSE
    RAISE EXCEPTION 'Unknown kind: %', p_kind;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_device(uuid, uuid, text, uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
