-- Clean up categories that ended up at 90000+ IDs from a prior partial migration.
-- Dining (90002) is moved to a normal ID; everything else at 90000+ is deleted.
DO $$
DECLARE
    new_dining INTEGER;
    r          RECORD;
BEGIN
    -- Drop FK constraints referencing spend_categories.id
    FOR r IN (
        SELECT c.conname, t.relname AS tbl
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        WHERE c.contype = 'f' AND ft.relname = 'spend_categories'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tbl) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;

    -- Reset sequence to just above the highest normal ID so nextval gives a clean value
    PERFORM setval('spend_categories_id_seq', (SELECT MAX(id) FROM spend_categories WHERE id < 90000));

    -- Allocate a new normal ID for Dining
    new_dining := nextval('spend_categories_id_seq');

    -- Move Dining 90002 → new_dining and update all references
    UPDATE spend_categories              SET id              = new_dining WHERE id              = 90002;
    UPDATE spend_categories              SET parent_id       = new_dining WHERE parent_id       = 90002;
    UPDATE card_category_multipliers     SET category_id     = new_dining WHERE category_id     = 90002;
    UPDATE wallet_spend_items            SET spend_category_id = new_dining WHERE spend_category_id = 90002;
    UPDATE wallet_card_multipliers       SET category_id     = new_dining WHERE category_id     = 90002;
    UPDATE wallet_spend_category_mappings SET spend_category_id = new_dining WHERE spend_category_id = 90002;

    -- Delete all remaining 90000+ categories and their references
    DELETE FROM card_category_multipliers      WHERE category_id      >= 90000;
    DELETE FROM wallet_spend_items             WHERE spend_category_id >= 90000;
    DELETE FROM wallet_card_multipliers        WHERE category_id      >= 90000;
    DELETE FROM wallet_spend_category_mappings WHERE spend_category_id >= 90000;
    DELETE FROM spend_categories               WHERE id >= 90000;

    -- Re-add FK constraints
    EXECUTE 'ALTER TABLE spend_categories ADD CONSTRAINT spend_categories_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES spend_categories(id) ON DELETE RESTRICT';
    EXECUTE 'ALTER TABLE card_category_multipliers ADD CONSTRAINT card_category_multipliers_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES spend_categories(id) ON DELETE RESTRICT';
    EXECUTE 'ALTER TABLE wallet_spend_category_mappings ADD CONSTRAINT wallet_spend_category_mappings_spend_category_id_fkey
        FOREIGN KEY (spend_category_id) REFERENCES spend_categories(id) ON DELETE RESTRICT';
    EXECUTE 'ALTER TABLE wallet_card_multipliers ADD CONSTRAINT wallet_card_multipliers_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES spend_categories(id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE wallet_spend_items ADD CONSTRAINT wallet_spend_items_spend_category_id_fkey
        FOREIGN KEY (spend_category_id) REFERENCES spend_categories(id) ON DELETE RESTRICT';

    -- Update sequence to max id
    PERFORM setval('spend_categories_id_seq', (SELECT MAX(id) FROM spend_categories));
END $$;
