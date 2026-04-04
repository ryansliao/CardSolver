-- Drop the free-text network column from cards (moved to network_tiers.network_id).
ALTER TABLE cards DROP COLUMN IF EXISTS network;
