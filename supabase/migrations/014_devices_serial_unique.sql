-- supabase/migrations/014_devices_serial_unique.sql
--
-- Enforces uniqueness of `devices.serial_number` at the DB level.
-- NULL serial_numbers are allowed (stubless devices from delivery slips
-- without SN lists), but any non-NULL SN must be unique.
--
-- Originally assumed to exist in the Lieferscheinmodus spec (2026-04-23)
-- but verified missing — added here so the RPC rollback path behaves
-- correctly on duplicate SNs.
--
-- Idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS devices_serial_number_unique
  ON devices (serial_number)
  WHERE serial_number IS NOT NULL;
