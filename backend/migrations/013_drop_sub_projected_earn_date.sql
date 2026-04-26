-- Migration 013: drop the vestigial sub_projected_earn_date column from
-- card_instances and scenario_card_overlays.
--
-- Background: this column was written by a pre-refactor backend path that
-- synced the projected SUB earn date back to the WalletCard row whenever
-- ``sub_earned_date`` toggled. That writeback was removed (commit a12e330)
-- and the field has had no current writer since. Migration 008 faithfully
-- copied the legacy values from wallet_cards.sub_projected_earn_date into
-- card_instances.sub_projected_earn_date, leaving stale fossils that the
-- chart and roadmap endpoint preferred over live, window-capped projection.
-- The roadmap endpoint and timeline chart now always live-compute, so the
-- column has no readers either. Drop it.
--
-- T-SQL conventions: GO on its own line is the batch separator. Each
-- destructive step is guarded with a sys.columns lookup so the migration
-- is idempotent and re-runnable.

------------------------------------------------------------------------------
-- 1. Drop sub_projected_earn_date from card_instances.
------------------------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'card_instances')
      AND name = N'sub_projected_earn_date'
)
    ALTER TABLE card_instances DROP COLUMN sub_projected_earn_date;
GO

------------------------------------------------------------------------------
-- 2. Drop sub_projected_earn_date from scenario_card_overlays.
------------------------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'scenario_card_overlays')
      AND name = N'sub_projected_earn_date'
)
    ALTER TABLE scenario_card_overlays DROP COLUMN sub_projected_earn_date;
GO
