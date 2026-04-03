-- Pin "All Other" to ID 1 and "Travel" to ID 2 for stable, predictable IDs.
-- Uses negative temp IDs (-1/-2) as swap staging; they are guaranteed free
-- because the sequence never produces negative values.
DO $$
DECLARE
    cur_ao  INTEGER;
    cur_tr  INTEGER;
    occ1    INTEGER;
    occ2    INTEGER;
    r       RECORD;
BEGIN
    SELECT id INTO cur_ao FROM spend_categories WHERE category = 'All Other';
    SELECT id INTO cur_tr FROM spend_categories WHERE category = 'Travel';
    IF cur_ao IS NULL OR cur_tr IS NULL THEN RETURN; END IF;
    IF cur_ao = 1 AND cur_tr = 2 THEN RETURN; END IF;

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

    -- Move current occupants of IDs 1 and 2 to temp IDs if needed.
    SELECT id INTO occ1 FROM spend_categories WHERE id = 1;
    SELECT id INTO occ2 FROM spend_categories WHERE id = 2;

    IF occ1 IS NOT NULL AND occ1 != cur_ao THEN
        UPDATE spend_categories SET id = -1 WHERE id = 1;
        UPDATE spend_categories SET parent_id = -1 WHERE parent_id = 1;
        UPDATE card_category_multipliers SET category_id = -1 WHERE category_id = 1;
        UPDATE wallet_spend_category_mappings SET spend_category_id = -1 WHERE spend_category_id = 1;
        UPDATE wallet_card_multipliers SET category_id = -1 WHERE category_id = 1;
        UPDATE wallet_spend_items SET spend_category_id = -1 WHERE spend_category_id = 1;
    END IF;

    IF occ2 IS NOT NULL AND occ2 != cur_tr THEN
        UPDATE spend_categories SET id = -2 WHERE id = 2;
        UPDATE spend_categories SET parent_id = -2 WHERE parent_id = 2;
        UPDATE card_category_multipliers SET category_id = -2 WHERE category_id = 2;
        UPDATE wallet_spend_category_mappings SET spend_category_id = -2 WHERE spend_category_id = 2;
        UPDATE wallet_card_multipliers SET category_id = -2 WHERE category_id = 2;
        UPDATE wallet_spend_items SET spend_category_id = -2 WHERE spend_category_id = 2;
    END IF;

    -- Move All Other → 1
    IF cur_ao != 1 THEN
        UPDATE spend_categories SET id = 1 WHERE id = cur_ao;
        UPDATE spend_categories SET parent_id = 1 WHERE parent_id = cur_ao;
        UPDATE card_category_multipliers SET category_id = 1 WHERE category_id = cur_ao;
        UPDATE wallet_spend_category_mappings SET spend_category_id = 1 WHERE spend_category_id = cur_ao;
        UPDATE wallet_card_multipliers SET category_id = 1 WHERE category_id = cur_ao;
        UPDATE wallet_spend_items SET spend_category_id = 1 WHERE spend_category_id = cur_ao;
    END IF;

    -- Move Travel → 2
    IF cur_tr != 2 THEN
        UPDATE spend_categories SET id = 2 WHERE id = cur_tr;
        UPDATE spend_categories SET parent_id = 2 WHERE parent_id = cur_tr;
        UPDATE card_category_multipliers SET category_id = 2 WHERE category_id = cur_tr;
        UPDATE wallet_spend_category_mappings SET spend_category_id = 2 WHERE spend_category_id = cur_tr;
        UPDATE wallet_card_multipliers SET category_id = 2 WHERE category_id = cur_tr;
        UPDATE wallet_spend_items SET spend_category_id = 2 WHERE spend_category_id = cur_tr;
    END IF;

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
