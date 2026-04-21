-- Migration 009: Standard-Preise am Modell
-- EK/VK als optionale Vorbelegung am Modell. Tatsächliche Preise bleiben
-- weiterhin auf purchase_items.ek_preis / sale_items.vk_preis (echte Historie).
-- RLS bleibt unverändert: UPDATE models ist bereits admin-only (siehe 007_rls_v2.sql).

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS default_ek numeric(10,2),
  ADD COLUMN IF NOT EXISTS default_vk numeric(10,2);
