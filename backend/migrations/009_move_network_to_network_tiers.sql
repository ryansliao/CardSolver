-- Move network from cards (free-text) to network_tiers (FK reference).
-- Add network_id FK to network_tiers (nullable; not every tier needs a network).
ALTER TABLE network_tiers
    ADD COLUMN IF NOT EXISTS network_id INTEGER REFERENCES networks(id) ON DELETE SET NULL;
