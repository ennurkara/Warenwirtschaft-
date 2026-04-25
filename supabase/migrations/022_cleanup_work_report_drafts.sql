-- supabase/migrations/022_cleanup_work_report_drafts.sql
--
-- Loescht Arbeitsbericht-Entwuerfe, die aelter als 15 Minuten und damit
-- abgebrochen sind. Die zugehoerigen work_report_devices-Zeilen werden ueber
-- die ON DELETE CASCADE FK aus 015_work_reports.sql automatisch mit entfernt.
--
-- Wird von beiden Apps (Arbeitsbericht + Warenwirtschaft) auf der Berichts-
-- Liste vor dem SELECT aufgerufen — opportunistic, billig, idempotent.
-- SECURITY DEFINER damit auch Mitarbeiter (RLS) globale Stale-Drafts loeschen
-- koennen; die Funktion selbst kennt keine Sub-User-Logik, sie killt nur
-- Drafts die per zeit-Kriterium abgelaufen sind.
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
     AND created_at < now() - interval '15 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_work_report_drafts() TO authenticated;

NOTIFY pgrst, 'reload schema';
