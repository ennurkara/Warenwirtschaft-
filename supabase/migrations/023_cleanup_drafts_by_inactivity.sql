-- supabase/migrations/023_cleanup_drafts_by_inactivity.sql
--
-- Loescht Arbeitsbericht-Entwuerfe, die seit 15 Minuten nicht mehr beruehrt
-- wurden. Vorher (022) war das Kriterium created_at — was Mitarbeiter zwingt,
-- den ganzen Wizard innerhalb von 15 Min nach Anlage abzuschliessen.
--
-- Mit updated_at + dem update_updated_at-Trigger auf work_reports gilt jetzt:
-- jede Aktion (Step-Speicherung, Heartbeat, Bearbeiten-Seite besucht) setzt
-- den Timer zurueck. Drafts sterben nur bei echter Inaktivitaet.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION cleanup_old_work_report_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM work_reports
   WHERE status = 'entwurf'
     AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
