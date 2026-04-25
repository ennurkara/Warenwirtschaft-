-- supabase/migrations/021_work_report_pdf_emailed_at.sql
--
-- Trackt, wann das PDF eines Arbeitsberichts an den Kunden gemailt wurde.
-- Sowohl der Arbeitsbericht-Wizard (auto am Ende) als auch der WW-Detail-View
-- (manueller Button) setzen das Feld via /api/send-report-pdf.
--
-- Idempotent.

ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS pdf_emailed_at timestamptz;

NOTIFY pgrst, 'reload schema';
