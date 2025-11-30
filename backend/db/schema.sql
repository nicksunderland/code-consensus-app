-- ============================================================
-- PHENOTYPE BUILDER - SIMPLIFIED DATABASE SCHEMA
-- ============================================================
-- Bare bones functional design
-- All project members can view all project phenotypes
-- No denormalized counts - calculate on demand
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. CODE SYSTEMS & CODES
-- ============================================================

CREATE TABLE code_systems (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    version TEXT NOT NULL,
    url TEXT NOT NULL
);

CREATE TABLE codes (
    id BIGSERIAL PRIMARY KEY,
    system_id INT NOT NULL REFERENCES code_systems(id) ON DELETE RESTRICT,
    system_name VARCHAR(50) NOT NULL, -- Denormalized for display
    code VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    parent_id BIGINT REFERENCES codes(id) ON DELETE SET NULL,
    materialized_path TEXT,
    is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
    is_selectable BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT code_system_unique UNIQUE (system_id, code)
);


-- -- UPLOADING DATA: make foreign key deferrable
-- ALTER TABLE codes DROP CONSTRAINT codes_parent_id_fkey;
-- -- UPLOAD STEP: add codes first, then set parent_id in a separate step
-- ALTER TABLE codes
-- ADD CONSTRAINT codes_parent_id_fkey
-- FOREIGN KEY (parent_id)
-- REFERENCES codes(id)
-- DEFERRABLE INITIALLY DEFERRED;


-- Essential indexes only
CREATE INDEX idx_codes_system_id ON codes(system_id);
CREATE INDEX idx_codes_parent_id ON codes(parent_id);
CREATE INDEX idx_codes_materialized_path ON codes(materialized_path text_pattern_ops);
CREATE INDEX idx_codes_trgm_desc ON codes USING gin(description gin_trgm_ops);
CREATE INDEX idx_codes_trgm_code ON codes USING gin(code gin_trgm_ops);

-- Sync system_name on insert/update
CREATE OR REPLACE FUNCTION sync_code_system_name()
RETURNS TRIGGER AS $$
BEGIN
    SELECT name INTO NEW.system_name
    FROM code_systems
    WHERE id = NEW.system_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_code_system_name_trigger
    BEFORE INSERT OR UPDATE OF system_id ON codes
    FOR EACH ROW EXECUTE FUNCTION sync_code_system_name();

-- ============================================================
-- 2. CODE CO-OCCURRENCE
-- ============================================================

CREATE TABLE code_cooccurrence (
    id BIGSERIAL PRIMARY KEY,
    code_i BIGINT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    code_j BIGINT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    jaccard NUMERIC(5,3) DEFAULT 0,
    lift NUMERIC(5,3) DEFAULT 0,

    CONSTRAINT code_pair_unique UNIQUE (code_i, code_j),
    CONSTRAINT code_order_check CHECK (code_i < code_j)
);

CREATE INDEX idx_cooccurrence_code_i ON code_cooccurrence(code_i);
CREATE INDEX idx_cooccurrence_code_j ON code_cooccurrence(code_j);

-- ============================================================
-- 3. USER PROFILES
-- ============================================================

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        TRIM(COALESCE(first_name || ' ', '') || COALESCE(last_name, ''))
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT user_profiles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 4. PROJECTS (with embedded members)
-- ============================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    member_ids UUID[] DEFAULT '{}',
    member_data JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_projects_member_ids ON projects USING GIN(member_ids);
CREATE UNIQUE INDEX idx_unique_project_name_per_owner
    ON projects(owner, lower(trim(name)));

-- Helper functions for managing members
CREATE OR REPLACE FUNCTION add_project_member(
    p_project_id UUID,
    p_user_id UUID,
    p_role TEXT DEFAULT 'member'
)
RETURNS void AS $$
DECLARE
    v_user_name TEXT;
    v_user_email TEXT;
BEGIN
    SELECT full_name, email INTO v_user_name, v_user_email
    FROM user_profiles
    WHERE user_id = p_user_id;

    UPDATE projects
    SET
        member_ids = array_append(member_ids, p_user_id),
        member_data = member_data || jsonb_build_object(
            'user_id', p_user_id,
            'name', v_user_name,
            'email', v_user_email,
            'role', p_role,
            'added_at', now()
        ),
        updated_at = now()
    WHERE id = p_project_id
      AND NOT (p_user_id = ANY(member_ids));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_project_member(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
BEGIN
    UPDATE projects
    SET
        member_ids = array_remove(member_ids, p_user_id),
        member_data = (
            SELECT jsonb_agg(member)
            FROM jsonb_array_elements(member_data) AS member
            WHERE (member->>'user_id')::uuid != p_user_id
        ),
        updated_at = now()
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. PHENOTYPES
-- ============================================================

CREATE TABLE phenotypes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- Always required
    name TEXT NOT NULL,
    description TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_phenotypes_user_id ON phenotypes(user_id);
CREATE INDEX idx_phenotypes_project_id ON phenotypes(project_id);
CREATE UNIQUE INDEX idx_unique_project_phenotype_name
    ON phenotypes(project_id, lower(trim(name)));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phenotypes_updated_at
    BEFORE UPDATE ON phenotypes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. PHENOTYPE SEARCH TERMS
-- ============================================================

CREATE TABLE phenotype_search_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phenotype_id UUID NOT NULL REFERENCES phenotypes(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    is_regex BOOLEAN DEFAULT FALSE,
    target_columns TEXT[] DEFAULT '{code,description}',
    system_ids INT[] DEFAULT '{}',
    row_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_search_terms_phenotype ON phenotype_search_terms(phenotype_id);

-- ============================================================
-- 7. USER CODE SELECTIONS (unified standard + orphan codes)
-- ============================================================

CREATE TABLE user_code_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phenotype_id UUID NOT NULL REFERENCES phenotypes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,

    -- Discriminated union: either code_id OR orphan_id
    code_type VARCHAR(20) DEFAULT 'standard' CHECK (code_type IN ('standard', 'orphan')),
    code_id BIGINT REFERENCES codes(id) ON DELETE CASCADE,
    orphan_id TEXT,

    -- Cached for display performance
    code_text VARCHAR(255),
    code_description TEXT,
    system_name VARCHAR(50),

    found_in_search BOOLEAN NOT NULL DEFAULT TRUE,
    imported BOOLEAN NOT NULL DEFAULT FALSE,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    comment TEXT, -- Individual user's comment

    -- Consensus (duplicated across all users for same code)
    is_consensus BOOLEAN DEFAULT FALSE,
    consensus_comments TEXT, -- Team decision notes

    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure exactly one of code_id or orphan_id is set
    CONSTRAINT selection_has_code CHECK (
        (code_type = 'standard' AND code_id IS NOT NULL AND orphan_id IS NULL) OR
        (code_type = 'orphan' AND orphan_id IS NOT NULL AND code_id IS NULL)
    ),
    CONSTRAINT unique_standard_selection UNIQUE (phenotype_id, code_id, user_id),
    CONSTRAINT unique_orphan_selection UNIQUE (phenotype_id, orphan_id, user_id)
);

CREATE INDEX idx_ucs_phenotype_id ON user_code_selections(phenotype_id);
CREATE INDEX idx_ucs_user_phenotype ON user_code_selections(user_id, phenotype_id);
CREATE INDEX idx_ucs_code_id ON user_code_selections(code_id) WHERE code_id IS NOT NULL;
CREATE INDEX idx_ucs_code_type ON user_code_selections(phenotype_id, code_type);

-- Cache code metadata on insert/update
CREATE OR REPLACE FUNCTION cache_code_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code_type = 'standard' THEN
        -- Get metadata from codes table
        SELECT c.code, c.description, c.system_name
        INTO NEW.code_text, NEW.code_description, NEW.system_name
        FROM codes c
        WHERE c.id = NEW.code_id;
    ELSIF NEW.code_type = 'orphan' THEN
        -- For orphan codes, metadata is provided by user
        -- code_text, code_description, system_name should be set by application
        IF NEW.system_name IS NULL THEN
            NEW.system_name := 'Custom';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cache_code_metadata_trigger
    BEFORE INSERT OR UPDATE OF code_id, code_type ON user_code_selections
    FOR EACH ROW EXECUTE FUNCTION cache_code_metadata();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phenotypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE phenotype_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_code_selections ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROJECTS RLS
-- ============================================================

-- Users can view projects they own or are members of
CREATE POLICY "Users can view their projects"
ON projects FOR SELECT
USING (
    owner = auth.uid()
    OR auth.uid() = ANY(member_ids)
);

-- Only owners can create projects (and they become owner automatically)
CREATE POLICY "Users can create projects"
ON projects FOR INSERT
WITH CHECK (owner = auth.uid());

-- Only owners can update their projects
CREATE POLICY "Owners can update their projects"
ON projects FOR UPDATE
USING (owner = auth.uid())
WITH CHECK (owner = auth.uid());

-- Only owners can delete their projects
CREATE POLICY "Owners can delete their projects"
ON projects FOR DELETE
USING (owner = auth.uid());

-- ============================================================
-- PHENOTYPES RLS
-- ============================================================

-- Users can view phenotypes in projects they own or are members of
CREATE POLICY "Users can view project phenotypes"
ON phenotypes FOR SELECT
USING (
    project_id IN (
        SELECT id FROM projects
        WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
    )
);

-- Users can create phenotypes in projects they belong to
CREATE POLICY "Users can create phenotypes"
ON phenotypes FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
        SELECT id FROM projects
        WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
    )
);

-- Users can update phenotypes in their projects
CREATE POLICY "Users can update project phenotypes"
ON phenotypes FOR UPDATE
USING (
    project_id IN (
        SELECT id FROM projects
        WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
    )
)
WITH CHECK (
    project_id IN (
        SELECT id FROM projects
        WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
    )
);

-- Project owners can delete phenotypes, or phenotype creators can delete their own
CREATE POLICY "Users can delete phenotypes"
ON phenotypes FOR DELETE
USING (
    user_id = auth.uid() -- Creator can delete
    OR project_id IN (
        SELECT id FROM projects WHERE owner = auth.uid() -- Project owner can delete
    )
);

-- ============================================================
-- PHENOTYPE SEARCH TERMS RLS
-- ============================================================

-- Users can view search terms for phenotypes they can access
CREATE POLICY "Users can view search terms"
ON phenotype_search_terms FOR SELECT
USING (
    phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- Users can create search terms for phenotypes they can access
CREATE POLICY "Users can create search terms"
ON phenotype_search_terms FOR INSERT
WITH CHECK (
    phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- Users can update search terms for phenotypes they can access
CREATE POLICY "Users can update search terms"
ON phenotype_search_terms FOR UPDATE
USING (
    phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- Users can delete search terms for phenotypes they can access
CREATE POLICY "Users can delete search terms"
ON phenotype_search_terms FOR DELETE
USING (
    phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- ============================================================
-- USER CODE SELECTIONS RLS
-- ============================================================

-- Users can view all selections for phenotypes they can access
CREATE POLICY "Users can view code selections"
ON user_code_selections FOR SELECT
USING (
    phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- Users can only create their own selections
CREATE POLICY "Users can create their own selections"
ON user_code_selections FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND phenotype_id IN (
        SELECT id FROM phenotypes
        WHERE user_id = auth.uid()
           OR project_id IN (
               SELECT id FROM projects
               WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
           )
    )
);

-- Users can update their own selections
-- Project members can update consensus fields for any selection
CREATE POLICY "Users can update selections"
ON user_code_selections FOR UPDATE
USING (
    user_id = auth.uid() -- Own selections
    OR ( -- Or can update consensus for project phenotypes
        phenotype_id IN (
            SELECT id FROM phenotypes
            WHERE project_id IN (
                SELECT id FROM projects
                WHERE owner = auth.uid() OR auth.uid() = ANY(member_ids)
            )
        )
    )
);

-- Users can delete their own selections
CREATE POLICY "Users can delete their own selections"
ON user_code_selections FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: User's accessible projects
CREATE OR REPLACE VIEW user_accessible_projects AS
SELECT
    p.*,
    CASE
        WHEN p.owner = auth.uid() THEN 'owner'
        WHEN auth.uid() = ANY(p.member_ids) THEN
            (SELECT m->>'role'
             FROM jsonb_array_elements(p.member_data) m
             WHERE (m->>'user_id')::uuid = auth.uid())
        ELSE NULL
    END as user_role
FROM projects p
WHERE p.owner = auth.uid() OR auth.uid() = ANY(p.member_ids);

-- View: User's accessible phenotypes with project info
CREATE OR REPLACE VIEW user_accessible_phenotypes AS
SELECT
    ph.*,
    p.name as project_name,
    p.owner as project_owner,
    CASE
        WHEN p.owner = auth.uid() THEN 'owner'
        ELSE 'member'
    END as user_role
FROM phenotypes ph
JOIN projects p ON ph.project_id = p.id
WHERE p.owner = auth.uid() OR auth.uid() = ANY(p.member_ids);

-- View: Consensus codes (distinct codes marked as consensus)
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
    created_at
FROM user_code_selections
WHERE is_consensus = TRUE
ORDER BY phenotype_id, code_type, code_id, orphan_id, created_at DESC;

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Check if user can access a phenotype
CREATE OR REPLACE FUNCTION user_can_access_phenotype(
    p_phenotype_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
    v_owner UUID;
BEGIN
    SELECT project_id, user_id INTO v_project_id, v_owner
    FROM phenotypes WHERE id = p_phenotype_id;

    -- Private phenotype - only owner can access
    IF v_project_id IS NULL THEN
        RETURN v_owner = p_user_id;
    END IF;

    -- Project phenotype - owner or members can access
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = v_project_id
          AND (owner = p_user_id OR p_user_id = ANY(member_ids))
    );
END;
$$ LANGUAGE plpgsql;

-- Mark code as consensus for all users in a phenotype
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
    -- Update all user selections for this code
    IF p_code_type = 'standard' THEN
        UPDATE user_code_selections
        SET
            is_consensus = p_is_consensus,
            consensus_comments = p_consensus_comments
        WHERE phenotype_id = p_phenotype_id
          AND code_id = p_code_id
          AND code_type = 'standard';
    ELSIF p_code_type = 'orphan' THEN
        UPDATE user_code_selections
        SET
            is_consensus = p_is_consensus,
            consensus_comments = p_consensus_comments
        WHERE phenotype_id = p_phenotype_id
          AND orphan_id = p_orphan_id
          AND code_type = 'orphan';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE phenotypes IS 'Phenotype definitions - always belong to a project';
COMMENT ON TABLE user_code_selections IS 'Unified table for both standard codes and orphan/custom codes - distinguished by code_type. Consensus is duplicated across all users for simplicity.';
COMMENT ON COLUMN user_code_selections.code_type IS 'Either "standard" (from codes table) or "orphan" (custom user code)';
COMMENT ON COLUMN user_code_selections.code_id IS 'Foreign key to codes table - only set when code_type = "standard"';
COMMENT ON COLUMN user_code_selections.orphan_id IS 'User-provided ID for custom codes - only set when code_type = "orphan"';
COMMENT ON COLUMN user_code_selections.comment IS 'Individual user comment about this code';
COMMENT ON COLUMN user_code_selections.is_consensus IS 'Whether this code is part of final consensus (duplicated across all users)';
COMMENT ON COLUMN user_code_selections.consensus_comments IS 'Team decision notes about consensus (duplicated across all users)';
COMMENT ON TABLE code_cooccurrence IS 'Symmetric storage: code_i < code_j to avoid duplicates';
COMMENT ON COLUMN projects.member_ids IS 'Array of member user IDs for fast access checks';
COMMENT ON COLUMN projects.member_data IS 'JSONB array with full member details';

-- ============================================================
-- END OF SCHEMA
-- ============================================================