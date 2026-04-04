-- Pin "All Other" to ID 1 for a stable, predictable fallback category ID.
-- Uses negative temp ID (-1) as a swap staging slot; guaranteed free because
-- the sequence never produces negative values.
DO $$
DECLARE
    cur_ao  INTEGER;
    occ1    INTEGER;
    r       RECORD;
BEGIN
    SELECT id INTO cur_ao FROM spend_categories WHERE category = 'All Other';
    IF cur_ao IS NULL THEN RETURN; END IF;
    IF cur_ao = 1 THEN RETURN; END IF;

    -- Drop all FK constraints referencing spend_categories.id
    FOR r IN (
        SELECT c.conname, t.relname AS tbl
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        WHERE c.contype = 'f' AND ft.relname = 'spend_categories'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tbl) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;

    -- If something else occupies ID 1, move it to -1 temporarily
    SELECT id INTO occ1 FROM spend_categories WHERE id = 1;
    IF occ1 IS NOT NULL THEN
        UPDATE spend_categories SET id = -1 WHERE id = 1;
        UPDATE spend_categories SET parent_id = -1 WHERE parent_id = 1;
        UPDATE card_category_multipliers SET category_id = -1 WHERE category_id = 1;
        UPDATE wallet_spend_category_mappings SET spend_category_id = -1 WHERE spend_category_id = 1;
        UPDATE wallet_card_multipliers SET category_id = -1 WHERE category_id = 1;
        UPDATE wallet_spend_items SET spend_category_id = -1 WHERE spend_category_id = 1;
    END IF;

    -- Move All Other → 1
    UPDATE spend_categories SET id = 1 WHERE id = cur_ao;
    UPDATE spend_categories SET parent_id = 1 WHERE parent_id = cur_ao;
    UPDATE card_category_multipliers SET category_id = 1 WHERE category_id = cur_ao;
    UPDATE wallet_spend_category_mappings SET spend_category_id = 1 WHERE spend_category_id = cur_ao;
    UPDATE wallet_card_multipliers SET category_id = 1 WHERE category_id = cur_ao;
    UPDATE wallet_spend_items SET spend_category_id = 1 WHERE spend_category_id = cur_ao;

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
