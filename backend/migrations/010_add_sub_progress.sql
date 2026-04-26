-- Migration 010: SUB-progress tracking on card_instances.
--
-- Adds two nullable columns so users can register an in-progress SUB on
-- any owned card:
--   sub_start_date     — when the user started pursuing the SUB. NULL =
--                        not tracking (legacy behavior, owned card SUBs are
--                        presumed historical and excluded from planning).
--                        Defaults to opening_date in the calculator when
--                        tracking is enabled but this column is NULL.
--   sub_spend_to_date  — qualifying spend so far in dollars. NULL = not
--                        tracking; 0 = tracking, no progress yet. The
--                        calculator treats NULL as "no in-progress SUB"
--                        and skips remaining-spend math.
--
-- Idempotent. These fields live on the CardInstance only (a wallet-level
-- fact, not a scenario hypothetical) — no scenario_card_overlays mirror.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'card_instances') AND name = N'sub_start_date'
)
BEGIN
    ALTER TABLE card_instances ADD sub_start_date DATE NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'card_instances') AND name = N'sub_spend_to_date'
)
BEGIN
    ALTER TABLE card_instances ADD sub_spend_to_date INT NULL;
END
GO
