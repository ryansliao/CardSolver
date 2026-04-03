-- Remove obsolete spend categories (Airlines, Airfare, Shopping).
-- Orphan their children first, then delete rows with no card multiplier references.
DO $$
BEGIN
    UPDATE spend_categories
       SET parent_id = NULL
     WHERE parent_id IN (
         SELECT id FROM spend_categories
          WHERE category IN ('Airlines', 'Airfare', 'Shopping')
     );

    DELETE FROM spend_categories
     WHERE category IN ('Airlines', 'Airfare', 'Shopping')
       AND id NOT IN (SELECT DISTINCT category_id FROM card_category_multipliers);
END $$;
