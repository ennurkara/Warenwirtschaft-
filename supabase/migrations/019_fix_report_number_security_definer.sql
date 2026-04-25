-- supabase/migrations/019_fix_report_number_security_definer.sql
--
-- Fix: Mitarbeiter konnten ihren ersten Arbeitsbericht nicht anlegen
-- ("duplicate key value violates unique constraint work_reports_report_number_key").
--
-- Ursache: Der BEFORE-INSERT-Trigger set_report_number() lief im RLS-Kontext
-- des aufrufenden Users. Die SELECT-Policy auf work_reports zeigt einem
-- Mitarbeiter nur eigene Berichte (technician_id = auth.uid() OR admin/viewer).
-- Beim ersten Bericht eines Mitarbeiters sah der MAX(...)-Query in der Trigger-
-- Funktion eine leere Tabelle → MAX = NULL → COALESCE → 0 → +1 → AB-YYYY-0001
-- → kollidiert mit dem bereits vom Admin angelegten AB-YYYY-0001.
--
-- Fix: SECURITY DEFINER auf die Trigger-Funktion. Damit läuft die Numerierung
-- mit Owner-Rechten und sieht alle Berichte. Der eigentliche INSERT bleibt
-- weiterhin RLS-gegated (016_work_reports_rls.sql).
--
-- Zusätzlich: COUNT(*)+1 → MAX(suffix)+1, damit Lücken (durch Löschung) nicht
-- zu erneuten Kollisionen führen.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS trigger AS $$
DECLARE
  year_str text := to_char(now(), 'YYYY');
  seq_num  int;
BEGIN
  IF NEW.report_number IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(split_part(report_number, '-', 3) AS int)),
      0
    ) + 1
    INTO seq_num
    FROM public.work_reports
    WHERE report_number LIKE 'AB-' || year_str || '-%';

    NEW.report_number := 'AB-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, pg_temp;

-- generate_report_number() existiert noch aus Migration 015, wird aber vom
-- Trigger nicht mehr gebraucht (Logik ist inline). Nicht droppen, falls
-- externer Code sie ad-hoc aufruft — in einer Folge-Migration bei Bedarf.
