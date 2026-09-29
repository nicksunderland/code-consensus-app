-- Store the finalised state on the phenotype.
-- It used to live on each row of phenotype_consensus (finalized_at) and was lost
-- when that table was merged into user_code_selections in the Nov 2025 refactor.
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE phenotypes
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN phenotypes.finalized_at IS 'When the consensus was finalised; NULL = draft';
COMMENT ON COLUMN phenotypes.finalized_by IS 'Who finalised it';
