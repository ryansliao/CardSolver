-- Add optional per-wallet annual_bonus override (null = use card library value).
ALTER TABLE wallet_cards ADD COLUMN IF NOT EXISTS annual_bonus INTEGER;
