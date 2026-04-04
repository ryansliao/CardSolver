-- Populate network_id on network_tiers based on name prefix.
UPDATE network_tiers
SET network_id = CASE
    WHEN name ILIKE 'Visa%'             THEN (SELECT id FROM networks WHERE name = 'Visa')
    WHEN name ILIKE '%Mastercard%'      THEN (SELECT id FROM networks WHERE name = 'Mastercard')
    WHEN name ILIKE 'American Express%' THEN (SELECT id FROM networks WHERE name = 'American Express')
    WHEN name ILIKE 'Discover%'         THEN (SELECT id FROM networks WHERE name = 'Discover')
END
WHERE network_id IS NULL;
