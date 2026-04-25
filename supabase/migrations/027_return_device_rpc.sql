-- supabase/migrations/027_return_device_rpc.sql
--
-- RPC `return_device` für Rückgabe-Operationen (Leihe-Rückgabe, Reparatur
-- abgeschlossen, Defekt-Markierung). Beendet ggf. die aktive Zuordnung,
-- räumt current_customer_id und setzt den Ziel-Status atomar.
--
-- Aufruf:
--   return_device(device_id, 'lager')         -- Rückgabe ins Lager
--   return_device(device_id, 'in_reparatur')  -- in Werkstatt geben
--   return_device(device_id, 'defekt')        -- Defekt markieren (kommt nicht zurück)
--   return_device(device_id, 'ausgemustert')  -- ausmustern
--
-- Idempotent.

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
  v_now timestamptz := now();
BEGIN
  IF p_target_status NOT IN ('lager', 'in_reparatur', 'defekt', 'ausgemustert', 'reserviert') THEN
    RAISE EXCEPTION 'invalid target_status: %', p_target_status;
  END IF;

  -- Aktive Zuordnung beenden (falls vorhanden)
  UPDATE device_assignments
     SET ended_at = v_now,
         notes = COALESCE(notes || E'\n' || p_notes, notes, p_notes)
   WHERE device_id = p_device_id AND ended_at IS NULL;

  -- Status + current_customer_id setzen
  UPDATE devices
     SET status = p_target_status::device_status,
         current_customer_id = NULL
   WHERE id = p_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION return_device(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
