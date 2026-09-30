-- Canonical code: at most one consensus code per coding system can be flagged
-- as the canonical code for a phenotype.
--
-- Also replaces the per-user consensus upsert with save_phenotype_consensus, which
-- writes the consensus to every rater's rows in one transaction. The old upsert only
-- touched the saving user's rows, so a code unticked by one reviewer could stay in
-- phenotype_consensus_codes through another reviewer's rows.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE user_code_selections
    ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_code_selections.is_canonical IS
    'Canonical code for its coding system within the consensus (duplicated across all users)';

-- Existing columns must keep their order; is_canonical goes on the end.
CREATE OR REPLACE VIEW phenotype_consensus_codes AS
SELECT DISTINCT ON (phenotype_id, code_type, code_id, orphan_id)
    phenotype_id,
    code_type,
    code_id,
    orphan_id,
    code_text,
    code_description,
    system_name,
    consensus_comments,
    created_at,
    updated_at,
    is_canonical
FROM user_code_selections
WHERE is_consensus = TRUE
ORDER BY phenotype_id, code_type, code_id, orphan_id, COALESCE(updated_at, created_at) DESC;

-- Unticking consensus also drops the canonical flag.
CREATE OR REPLACE FUNCTION set_code_consensus(
    p_phenotype_id UUID,
    p_code_type VARCHAR(20),
    p_code_id BIGINT DEFAULT NULL,
    p_orphan_id TEXT DEFAULT NULL,
    p_consensus_comments TEXT DEFAULT NULL,
    p_is_consensus BOOLEAN DEFAULT TRUE
)
RETURNS void AS $$
BEGIN
    IF p_code_type = 'standard' THEN
        UPDATE user_code_selections
        SET
            is_consensus = p_is_consensus,
            consensus_comments = p_consensus_comments,
            is_canonical = is_canonical AND p_is_consensus
        WHERE phenotype_id = p_phenotype_id
          AND code_id = p_code_id
          AND code_type = 'standard';
    ELSIF p_code_type = 'orphan' THEN
        UPDATE user_code_selections
        SET
            is_consensus = p_is_consensus,
            consensus_comments = p_consensus_comments,
            is_canonical = is_canonical AND p_is_consensus
        WHERE phenotype_id = p_phenotype_id
          AND orphan_id = p_orphan_id
          AND code_type = 'orphan';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Replace the whole consensus for a phenotype.
-- p_codes is a JSON array of the consensus codes:
--   [{code_type, code_id, orphan_id, code_text, code_description, system_name,
--     consensus_comments, is_canonical}, ...]
-- Codes not in the list lose their consensus and canonical flags (their comments are kept).
-- SECURITY INVOKER, so the existing RLS policies still decide what the caller can write.
CREATE OR REPLACE FUNCTION save_phenotype_consensus(
    p_phenotype_id UUID,
    p_codes JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM phenotypes ph
        JOIN projects p ON p.id = ph.project_id
        WHERE ph.id = p_phenotype_id
          AND (p.owner = auth.uid() OR auth.uid() = ANY(p.member_ids))
    ) THEN
        RAISE EXCEPTION 'You are not a member of this phenotype''s project';
    END IF;

    IF EXISTS (SELECT 1 FROM phenotypes WHERE id = p_phenotype_id AND finalized_at IS NOT NULL) THEN
        RAISE EXCEPTION 'The consensus is finalised; unlock it before making changes';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_codes) AS d(system_name TEXT, is_canonical BOOLEAN)
        WHERE d.is_canonical
        GROUP BY COALESCE(d.system_name, 'Custom')
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Only one canonical code is allowed per coding system';
    END IF;

    -- Make sure the caller has a row for every consensus code (e.g. an imported code
    -- that hasn't been saved yet), so the code shows up in the view.
    INSERT INTO user_code_selections (
        phenotype_id, user_id, code_type, code_id, orphan_id,
        code_text, code_description, system_name
    )
    SELECT
        p_phenotype_id, auth.uid(), d.code_type,
        CASE WHEN d.code_type = 'standard' THEN d.code_id END,
        CASE WHEN d.code_type = 'orphan' THEN d.orphan_id END,
        d.code_text, d.code_description, d.system_name
    FROM jsonb_to_recordset(p_codes) AS d(
        code_type TEXT, code_id BIGINT, orphan_id TEXT,
        code_text TEXT, code_description TEXT, system_name TEXT
    )
    ON CONFLICT DO NOTHING;

    UPDATE user_code_selections s
    SET
        is_consensus = TRUE,
        consensus_comments = d.consensus_comments,
        is_canonical = COALESCE(d.is_canonical, FALSE)
    FROM jsonb_to_recordset(p_codes) AS d(
        code_type TEXT, code_id BIGINT, orphan_id TEXT,
        consensus_comments TEXT, is_canonical BOOLEAN
    )
    WHERE s.phenotype_id = p_phenotype_id
      AND s.code_type = d.code_type
      AND (
          (d.code_type = 'standard' AND s.code_id = d.code_id)
          OR (d.code_type = 'orphan' AND s.orphan_id = d.orphan_id)
      )
      AND (
          s.is_consensus IS DISTINCT FROM TRUE
          OR s.consensus_comments IS DISTINCT FROM d.consensus_comments
          OR s.is_canonical IS DISTINCT FROM COALESCE(d.is_canonical, FALSE)
      );

    UPDATE user_code_selections s
    SET is_consensus = FALSE, is_canonical = FALSE
    WHERE s.phenotype_id = p_phenotype_id
      AND (s.is_consensus OR s.is_canonical)
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(p_codes) AS d(code_type TEXT, code_id BIGINT, orphan_id TEXT)
          WHERE s.code_type = d.code_type
            AND (
                (d.code_type = 'standard' AND s.code_id = d.code_id)
                OR (d.code_type = 'orphan' AND s.orphan_id = d.orphan_id)
            )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION save_phenotype_consensus(UUID, JSONB) TO authenticated;
