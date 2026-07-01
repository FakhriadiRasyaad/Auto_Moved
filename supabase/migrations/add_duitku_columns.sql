-- ============================================================
-- Migration: Tambah kolom untuk integrasi Duitku
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- Kolom untuk menyimpan merchantOrderId dari Duitku
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS duitku_order_id TEXT DEFAULT NULL;

-- Kolom untuk menyimpan reference number dari Duitku
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS duitku_reference TEXT DEFAULT NULL;

-- Kolom timestamp kapan pembayaran selesai (opsional, berguna untuk audit)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- Index untuk mempercepat lookup berdasarkan duitku_order_id
-- (digunakan oleh Edge Function duitku-callback)
CREATE INDEX IF NOT EXISTS idx_sessions_duitku_order_id
  ON sessions (duitku_order_id);

-- ============================================================
-- Verifikasi: Tampilkan struktur tabel sessions setelah migrasi
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'sessions'
-- ORDER BY ordinal_position;
