-- Add parent_id, display_order, and is_system columns to spend_categories.
DO $$
BEGIN
    ALTER TABLE spend_categories
        ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES spend_categories(id) ON DELETE RESTRICT;
    ALTER TABLE spend_categories
        ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spend_categories
        ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
END $$;
