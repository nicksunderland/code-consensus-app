-- One row per phenotype for the project overview page.
-- SECURITY INVOKER so the caller's RLS still applies: non-members get no rows.
-- Run once in the Supabase SQL editor. Safe to re-run.

CREATE OR REPLACE FUNCTION get_project_summary(p_project_id UUID)
RETURNS TABLE (
    phenotype_id UUID,
    name TEXT,
    description TEXT,
    source TEXT,
    consensus_codes BIGINT,
    raters BIGINT,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID,
    created_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        ph.id,
        ph.name,
        ph.description,
        ph.source,
        -- consensus is duplicated on every rater's row, so count distinct codes
        count(DISTINCT coalesce(s.code_id::text, s.orphan_id)) FILTER (WHERE s.is_consensus),
        count(DISTINCT s.user_id) FILTER (WHERE s.is_selected),
        ph.finalized_at,
        ph.finalized_by,
        ph.created_at,
        greatest(ph.updated_at, max(s.created_at))
    FROM phenotypes ph
    LEFT JOIN user_code_selections s ON s.phenotype_id = ph.id
    WHERE ph.project_id = p_project_id
    GROUP BY ph.id
    ORDER BY lower(ph.name);
$$;

GRANT EXECUTE ON FUNCTION get_project_summary(UUID) TO authenticated;
