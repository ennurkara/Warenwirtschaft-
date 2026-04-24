-- supabase/migrations/017_work_report_pdfs.sql
--
-- PDF-Persistierung für Arbeitsberichte.
-- Bucket `work-report-pdfs` (private) + Storage-Policies.
-- work_reports.pdf_path + work_reports.pdf_uploaded_at.
--
-- Pfad-Konvention im Bucket: `{work_report_id}.pdf`.
-- Aufbewahrung: unbefristet (bestätigt 2026-04-24).
--
-- Idempotent.

ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS pdf_path        text,
  ADD COLUMN IF NOT EXISTS pdf_uploaded_at timestamptz;

-- Private bucket anlegen
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-report-pdfs', 'work-report-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies
DROP POLICY IF EXISTS "work_report_pdfs_select" ON storage.objects;
CREATE POLICY "work_report_pdfs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'work-report-pdfs');

DROP POLICY IF EXISTS "work_report_pdfs_insert" ON storage.objects;
CREATE POLICY "work_report_pdfs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-report-pdfs'
    AND get_my_role() IN ('admin', 'mitarbeiter')
  );

DROP POLICY IF EXISTS "work_report_pdfs_update" ON storage.objects;
CREATE POLICY "work_report_pdfs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-report-pdfs'
    AND get_my_role() IN ('admin', 'mitarbeiter')
  );

DROP POLICY IF EXISTS "work_report_pdfs_delete" ON storage.objects;
CREATE POLICY "work_report_pdfs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-report-pdfs'
    AND get_my_role() = 'admin'
  );
