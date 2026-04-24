-- supabase/migrations/016_work_reports_rls.sql
--
-- RLS für work_reports + work_report_devices.
-- customers hat bereits RLS (007_rls_v2.sql) — nichts ändern.
--
-- Sichtbarkeit:
--   - work_reports: Techniker sieht eigene; admin sieht alle; viewer sieht alle read-only.
--   - work_report_devices: folgt den Rechten des zugehörigen work_report.
--
-- Idempotent.

ALTER TABLE work_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_devices ENABLE ROW LEVEL SECURITY;

-- work_reports ---------------------------------------------------------------

DROP POLICY IF EXISTS "reports_select" ON work_reports;
CREATE POLICY "reports_select" ON work_reports
  FOR SELECT TO authenticated
  USING (
    technician_id = auth.uid()
    OR get_my_role() IN ('admin', 'viewer')
  );

DROP POLICY IF EXISTS "reports_insert" ON work_reports;
CREATE POLICY "reports_insert" ON work_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND technician_id = auth.uid()
  );

DROP POLICY IF EXISTS "reports_update_own" ON work_reports;
CREATE POLICY "reports_update_own" ON work_reports
  FOR UPDATE TO authenticated
  USING (
    (technician_id = auth.uid() OR get_my_role() = 'admin')
    AND get_my_role() IN ('admin', 'mitarbeiter')
  );

DROP POLICY IF EXISTS "reports_delete_admin" ON work_reports;
CREATE POLICY "reports_delete_admin" ON work_reports
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- work_report_devices --------------------------------------------------------

DROP POLICY IF EXISTS "report_devices_select" ON work_report_devices;
CREATE POLICY "report_devices_select" ON work_report_devices
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

DROP POLICY IF EXISTS "report_devices_insert" ON work_report_devices;
CREATE POLICY "report_devices_insert" ON work_report_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND wr.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "report_devices_delete" ON work_report_devices;
CREATE POLICY "report_devices_delete" ON work_report_devices
  FOR DELETE TO authenticated
  USING (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND wr.technician_id = auth.uid()
    )
  );
