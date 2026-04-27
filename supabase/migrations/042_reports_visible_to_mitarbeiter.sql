-- supabase/migrations/042_reports_visible_to_mitarbeiter.sql
--
-- Mitarbeiter sollen alle Arbeitsberichte sehen (Dashboard-Übersicht und
-- Listen). Bisher waren sie aus den SELECT-Policies ausgeschlossen — nur
-- techniker (eigene), admin und viewer durften lesen. Folge: das mitarbeiter-
-- Dashboard zeigte fetchRecentReports(null) als leere Liste.
--
-- Diese Migration ergänzt 'mitarbeiter' in den SELECT-Policies von:
--   - work_reports
--   - work_report_devices
--   - work_report_stock_items (kommt aus 041)
--
-- INSERT/UPDATE/DELETE bleiben unverändert (Mitarbeiter sollen NICHT
-- Berichte für andere techniker schreiben).
--
-- Idempotent.

DROP POLICY IF EXISTS "reports_select" ON work_reports;
CREATE POLICY "reports_select" ON work_reports
  FOR SELECT TO authenticated
  USING (
    technician_id = auth.uid()
    OR get_my_role() IN ('admin', 'mitarbeiter', 'viewer')
  );

DROP POLICY IF EXISTS "report_devices_select" ON work_report_devices;
CREATE POLICY "report_devices_select" ON work_report_devices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND (
          wr.technician_id = auth.uid()
          OR get_my_role() IN ('admin', 'mitarbeiter', 'viewer')
        )
    )
  );

DROP POLICY IF EXISTS "wrsi_select" ON work_report_stock_items;
CREATE POLICY "wrsi_select" ON work_report_stock_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND (
          wr.technician_id = auth.uid()
          OR get_my_role() IN ('admin', 'mitarbeiter', 'viewer')
        )
    )
  );

NOTIFY pgrst, 'reload schema';
