-- Rename wallet_spend_items.app_spend_category_id → spend_category_id.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wallet_spend_items'
          AND column_name = 'app_spend_category_id'
    ) THEN
        ALTER TABLE wallet_spend_items
            RENAME COLUMN app_spend_category_id TO spend_category_id;
    END IF;
END $$;
