-- Drop display_order column; ordering is handled in the application layer.
ALTER TABLE spend_categories DROP COLUMN IF EXISTS display_order;
