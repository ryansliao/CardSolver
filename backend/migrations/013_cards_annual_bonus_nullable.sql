-- Allow NULL for annual_bonus (unknown / not applicable vs explicit 0).
ALTER TABLE cards ALTER COLUMN annual_bonus DROP NOT NULL;
