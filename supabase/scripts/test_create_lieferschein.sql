-- Manual test for create_lieferschein RPC.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/test_create_lieferschein.sql
-- Leaves no data behind (BEGIN / ROLLBACK).

BEGIN;

-- === Setup fixtures ===
INSERT INTO suppliers (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'TEST Supplier');
INSERT INTO manufacturers (id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'TEST Manufacturer');
INSERT INTO categories (id, name, kind, cluster)
  VALUES ('33333333-3333-3333-3333-333333333333', 'TEST Category', 'generic', 'sonstiges');
INSERT INTO models (id, manufacturer_id, category_id, modellname)
  VALUES ('44444444-4444-4444-4444-444444444444',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333',
          'TEST Model');

-- === Happy path: 2 items, 1 with price ===
DO $$
DECLARE
  v_purchase_id uuid;
  v_dev_count int;
  v_item_count int;
BEGIN
  SELECT create_lieferschein(jsonb_build_object(
    'supplier_id', '11111111-1111-1111-1111-111111111111',
    'rechnungsnr', 'LS-TEST-001',
    'datum', '2026-04-23',
    'source_document_path', 'lieferscheine/test.pdf',
    'items', jsonb_build_array(
      jsonb_build_object(
        'model_id', '44444444-4444-4444-4444-444444444444',
        'serial_number', 'TESTSN-001',
        'location', NULL, 'notes', NULL,
        'ek_preis', 199.50
      ),
      jsonb_build_object(
        'model_id', '44444444-4444-4444-4444-444444444444',
        'serial_number', 'TESTSN-002',
        'location', NULL, 'notes', NULL,
        'ek_preis', NULL
      )
    )
  )) INTO v_purchase_id;

  SELECT COUNT(*) INTO v_dev_count
    FROM devices WHERE serial_number IN ('TESTSN-001', 'TESTSN-002');
  SELECT COUNT(*) INTO v_item_count
    FROM purchase_items WHERE purchase_id = v_purchase_id;

  IF v_dev_count <> 2 THEN RAISE EXCEPTION 'Expected 2 devices, got %', v_dev_count; END IF;
  IF v_item_count <> 1 THEN RAISE EXCEPTION 'Expected 1 purchase_item (one has NULL price), got %', v_item_count; END IF;

  RAISE NOTICE 'Happy path OK: purchase_id=%, devices=2, purchase_items=1', v_purchase_id;
END $$;

-- === Rollback path: duplicate SN must rollback the whole call ===
DO $$
DECLARE
  v_before_count int;
  v_after_count int;
  v_caught bool := false;
BEGIN
  SELECT COUNT(*) INTO v_before_count FROM devices;

  BEGIN
    PERFORM create_lieferschein(jsonb_build_object(
      'supplier_id', '11111111-1111-1111-1111-111111111111',
      'rechnungsnr', 'LS-TEST-002',
      'datum', '2026-04-23',
      'source_document_path', NULL,
      'items', jsonb_build_array(
        jsonb_build_object(
          'model_id', '44444444-4444-4444-4444-444444444444',
          'serial_number', 'TESTSN-003',
          'location', NULL, 'notes', NULL, 'ek_preis', 100
        ),
        jsonb_build_object(
          'model_id', '44444444-4444-4444-4444-444444444444',
          'serial_number', 'TESTSN-001',
          'location', NULL, 'notes', NULL, 'ek_preis', 100
        )
      )
    ));
  EXCEPTION WHEN unique_violation THEN
    v_caught := true;
  END;

  SELECT COUNT(*) INTO v_after_count FROM devices;

  IF NOT v_caught THEN RAISE EXCEPTION 'Expected unique_violation, none raised'; END IF;
  IF v_after_count <> v_before_count THEN
    RAISE EXCEPTION 'Rollback failed: device count changed (% → %)', v_before_count, v_after_count;
  END IF;

  RAISE NOTICE 'Rollback path OK: unique_violation raised, no devices persisted';
END $$;

ROLLBACK;
