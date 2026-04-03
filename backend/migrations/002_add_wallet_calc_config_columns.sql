-- Add persisted calculation config columns to wallets.
DO $$
BEGIN
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS calc_start_date DATE;
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS calc_end_date DATE;
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS calc_duration_years INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS calc_duration_months INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS calc_window_mode VARCHAR(20) NOT NULL DEFAULT 'duration';
END $$;
