import os
import csv
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET


def create_icd10_table():
    """
    Create the ICD-10 codes table in Supabase.
    Run this SQL in your Supabase SQL editor:

    -- Enable UUID generation
    create extension if not exists "uuid-ossp";

    ------------------------------------------------------------
    -- CODE SYSTEMS
    ------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS code_systems (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        version VARCHAR(20) NOT NULL,
        url TEXT NOT NULL
    );

    ------------------------------------------------------------
    -- CODES
    ------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS codes (
      id BIGSERIAL PRIMARY KEY,
      system_id INT NOT NULL REFERENCES code_systems(id) ON DELETE RESTRICT,
      code VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      parent_id BIGINT REFERENCES codes(id) ON DELETE SET NULL,
      materialized_path TEXT,
      is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
      is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT code_system_unique UNIQUE (system_id, code)
    );


    ------------------------------------------------------------
    -- INDEXES
    ------------------------------------------------------------
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- 1. SEARCH INDEXES (codes)

    -- 1. For fast lazy-loading (GET /nodes/{id}/children)
    CREATE INDEX IF NOT EXISTS idx_codes_parent_id
    ON codes (parent_id);

    -- 2. For fast full-tree search (e.g., finding all descendants)
    -- This index is optimized for text prefix queries (LIKE '/1/2/%')
    CREATE INDEX IF NOT EXISTS idx_codes_materialized_path
    ON codes (materialized_path text_pattern_ops); -- 'text_pattern_ops' is a PostgreSQL optimization

    -- 3. For finding root nodes quickly (optional, but helpful)
    -- You can combine this with the parent_id index, but this is explicit
    CREATE INDEX IF NOT EXISTS idx_codes_is_root
    ON codes (parent_id)
    WHERE parent_id IS NULL;

    -- 4. For finding leaf nodes quickly (e.g., for search filters)
    CREATE INDEX IF NOT EXISTS idx_codes_is_leaf
    ON codes (is_leaf)
    WHERE is_leaf = TRUE;

    -- 5. For regex matching
    CREATE INDEX IF NOT EXISTS idx_codes_trgm_desc
    ON codes USING gin (description gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_codes_trgm_code
    ON codes USING gin (code gin_trgm_ops);


    ------------------------------------------------------------
    -- CO-OCCURENCE MEASURES
    ------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS code_cooccurrence (
        id BIGSERIAL PRIMARY KEY,
        code_i BIGINT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
        code_j BIGINT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
        jaccard NUMERIC(5,3) DEFAULT 0,  -- e.g., 0.123
        lift NUMERIC(5,3) DEFAULT 0,
        CONSTRAINT code_pair_unique UNIQUE (code_i, code_j)
    );

    ------------------------------------------------------------
    -- PROJECTS
    ------------------------------------------------------------
    create table projects (
      id uuid primary key default uuid_generate_v4(),
      owner uuid not null references auth.users(id) on delete cascade,
      name text not null,
      description text,
      created_at timestamptz default now()
    );

    ------------------------------------------------------------
    -- PROJECT MEMBERS
    ------------------------------------------------------------
    create table project_members (
      project_id uuid references projects(id) on delete cascade,
      user_id uuid references auth.users(id) on delete cascade,
      role text default 'member', -- 'owner' or 'member'
      added_at timestamptz default now(),
      primary key (project_id, user_id)
    );

    ------------------------------------------------------------
    -- PHENOTYPES (private or project-based)
    ------------------------------------------------------------
    create table phenotypes (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references auth.users(id) on delete cascade,
      project_id uuid references projects(id) on delete cascade,
      name text not null,
      description text,
      source text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    ------------------------------------------------------------
    -- UNIQUE NAME RULES
    ------------------------------------------------------------
    -- Private phenotypes (project_id IS NULL)
    create unique index unique_private_phenotype_name
    on phenotypes (user_id, lower(trim(name)))
    where project_id is null;

    -- Shared phenotypes (project_id IS NOT NULL)
    create unique index unique_project_phenotype_name
    on phenotypes (project_id, lower(trim(name)))
    where project_id is not null;

    -- Unique project names per user
    create unique index unique_project_name_per_owner
    on projects (owner, lower(trim(name)));

    ------------------------------------------------------------
    -- ENABLE RLS
    ------------------------------------------------------------
    alter table projects enable row level security;
    alter table project_members enable row level security;
    alter table phenotypes enable row level security;

    ------------------------------------------------------------
    -- PROJECTS RLS
    ------------------------------------------------------------
    -- Members can see only their own membership
    CREATE POLICY "Members see their own membership"
    ON project_members
    FOR SELECT
    USING (user_id = auth.uid());

    -- Owners can see all members in their projects
    CREATE POLICY "Owners see all members"
    ON project_members
    FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE owner = auth.uid()));

    ------------------------------------------------------------
    -- PROJECT MEMBERS RLS
    ------------------------------------------------------------
    -- Members can see their memberships & others within their projects
    CREATE POLICY "Members can see all memberships in their projects"
    ON project_members
    FOR SELECT
    USING (
        project_id IN (
            SELECT id
            FROM projects
            WHERE id = project_members.project_id
              AND (
                  owner = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM project_members pm
                      WHERE pm.project_id = projects.id
                        AND pm.user_id = auth.uid()
                  )
              )
        )
    );

    -- Owners can add members (role='member') to their projects
    create policy "Owner can insert themselves as owner"
    on project_members
    for insert
    with check (
      project_id IN (select id from projects where owner = auth.uid()) AND
      (role = 'member' OR (role = 'owner' AND user_id = auth.uid()))
    );


    -- Prevent updates by anyone
    create policy "No arbitrary updates"
    on project_members
    for update
    using (false);

    -- Prevent deletes by anyone
    create policy "No arbitrary deletes"
    on project_members
    for delete
    using (false);

    ------------------------------------------------------------
    -- PHENOTYPES RLS
    ------------------------------------------------------------
    -- 1. SELECT: users can see their own private phenotypes or any project phenotypes they belong to
    create policy "Read own or project phenotypes"
    on phenotypes
    for select
    using (
      user_id = auth.uid()
      OR project_id IN (
        select project_id from project_members where user_id = auth.uid()
      )
    );

    -- 2. INSERT: users can insert private phenotypes or project phenotypes if they are members
    create policy "Insert own or project phenotypes"
    on phenotypes
    for insert
    with check (
      user_id = auth.uid()
      AND (
        project_id IS NULL
        OR project_id IN (
          select project_id from project_members where user_id = auth.uid()
        )
      )
    );

    -- 3. UPDATE: same rules as select/insert
    create policy "Update own or project phenotypes"
    on phenotypes
    for update
    using (
      user_id = auth.uid()
      OR project_id IN (
        select project_id from project_members where user_id = auth.uid()
      )
    )
    with check (
      user_id = auth.uid()
      OR project_id IN (
        select project_id from project_members where user_id = auth.uid()
      )
    );

    -- 4. DELETE: same rules
    create policy "Delete own or project phenotypes"
    on phenotypes
    for delete
    using (
      user_id = auth.uid()
      OR project_id IN (
        select project_id from project_members where user_id = auth.uid()
      )
    );


    ------------------------------------------------------------
    -- USER PROFILES
    ------------------------------------------------------------
    create table public.user_profiles (
      user_id uuid not null,
      email text not null,
      created_at timestamp with time zone null default now(),
      constraint user_profiles_pkey primary key (user_id),
      constraint user_profiles_email_key unique (email),
      constraint user_profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
    ) TABLESPACE pg_default;

);
    """
    print("Please create the table using the SQL in the function docstring")

# ==========================================================
# 1. PARSERS — You can add MANY of these
#    Every parser MUST return: List[Dict] with:
#      - code: str
#      - description: str
#      - parent_code: Optional[str]
#      - is_leaf: bool
#      - is_selectable: bool
# ==========================================================


def parse_icd10(file_path) -> List[Dict]:
    """ Returns list of flat ICD-10 code dicts with correct hierarchy. """

    import xml.etree.ElementTree as ET

    tree = ET.parse(file_path)
    root = tree.getroot()

    codes = []
    code_lookup = {}  # for parent lookup by code
    current_chapter = None
    block_stack = []  # track nested blocks/sub-blocks

    def find_block_parent(code: str):
        """Determine correct parent for a block, handling ranges like M05-M14."""
        # If the block is a range (contains '-'), we may need to pop stack
        while block_stack:
            top = block_stack[-1]["code"]
            # If current code range is outside top block, pop
            if "-" in top and "-" in code:
                top_start, top_end = top.split("-")
                code_start, code_end = code.split("-")
                # If current block starts after top block ends, it's sibling of top's parent
                if code_start > top_end:
                    block_stack.pop()
                    continue
            break
        return block_stack[-1]["code"] if block_stack else current_chapter

    for cls in root.findall(".//Class"):
        code = cls.attrib.get("code")
        kind = cls.attrib.get("kind")

        rubric = cls.find(".//Rubric/Label")
        description = rubric.text if rubric is not None else ""

        parent = None
        is_selectable = True

        if kind == "chapter":
            parent = "ROOT"
            current_chapter = code
            block_stack = []  # reset stack
            is_selectable = False

        elif kind == "block":
            # Determine parent intelligently
            parent = find_block_parent(code)
            # Push this block onto the stack
            block_stack.append({"code": code, "kind": "block"})
            is_selectable = False

        elif kind == "category":
            # Determine parent: use code_lookup for dotted codes or top block
            if "." in code:
                prefix = code.split(".")[0]
                parent = code_lookup.get(prefix, block_stack[-1]["code"] if block_stack else current_chapter)
            else:
                parent = block_stack[-1]["code"] if block_stack else current_chapter

        # Update code_lookup only for non-dotted codes
        if "." not in code:
            code_lookup[code] = code

        codes.append({
            "code": code.replace(".", ""),  # remove dots for storage
            "description": description,
            "parent_code": parent,
            "is_leaf": True,
            "is_selectable": is_selectable
        })

    # Fix leaf flags: any code that is a parent is not a leaf
    parent_codes = {c["parent_code"] for c in codes if c["parent_code"] not in (None, "ROOT")}
    for c in codes:
        if c["code"] in parent_codes:
            c["is_leaf"] = False

    return codes


# ==========================================================
# 2. HIERARCHY BUILDER (shared across all parsers)
# ==========================================================
def build_hierarchy_for_system(codes: List[Dict], system_id: int, system_row, next_global_id: int):
    """
    Produces normalized rows for one code system:
      - Adds a synthetic root
      - Assigns numeric IDs
      - Computes parent_id
      - Computes materialized_path
    Returns:
      (normalized_code_rows, next_available_global_id)
    """

    # ============================
    # 1. Create synthetic root node
    # ============================
    root_internal_code = "__ROOT__"   # internal stable key, never shown externally

    root_node = {
        "id": next_global_id,
        "system_id": system_id,
        "code": system_row["name"],              # display code (e.g. ICD-10)
        "internal_code": root_internal_code,     # internal lookup key
        "description": system_row["description"],
        "parent_id": None,
        "materialized_path": None,               # fill later
        "is_leaf": False,
        "is_selectable": False,
    }

    lookup = {root_internal_code: root_node}

    next_global_id += 1

    # ============================
    # 2. Assign IDs to actual codes
    # ============================
    for c in codes:
        c["id"] = next_global_id
        c["system_id"] = system_id
        next_global_id += 1
        c["internal_code"] = c["code"]
        lookup[c["internal_code"]] = c

    # ============================
    # 3. Compute materialized paths
    # ============================
    def compute_path(node_key):
        node = lookup[node_key]

        if node.get("materialized_path"):
            return node["materialized_path"]

        parent_code = node.get("parent_code")

        # FALLBACK: assign to root if parser left parent None or "ROOT"
        if parent_code in (None, "ROOT", "__ROOT__", ""):
            parent = root_node
        else:
            parent = lookup[parent_code]

        node["parent_id"] = parent["id"]
        parent_path = compute_path(parent["internal_code"])
        node["materialized_path"] = f"{parent_path}{node['id']}/"
        return node["materialized_path"]

    # Compute root path first
    root_node["materialized_path"] = f"/{root_node['id']}/"

    # Now compute all others
    for key in lookup:
        compute_path(key)

    # ============================
    # 4. Return normalized rows
    # ============================
    final = []
    for key, node in lookup.items():
        final.append({
            "id": node["id"],
            "system_id": node["system_id"],
            "code": node["code"],                       # human-friendly
            "description": node["description"],
            "parent_id": node["parent_id"],
            "materialized_path": node["materialized_path"],
            "is_leaf": node.get("is_leaf", False),
            "is_selectable": node.get("is_selectable", False),
        })

    return final, next_global_id


# ==========================================================
# 3. CSV EXPORT HELPERS
# ==========================================================

def write_code_systems_csv(systems, path="code_systems.csv"):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "name", "description", "version", "url"])
        w.writeheader()
        for s in systems:
            w.writerow(s)
    print(f"✅ Wrote {path}")


def write_codes_csv(code_rows, path="codes.csv"):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[
            "id", "system_id", "code", "description",
            "parent_id", "materialized_path", "is_leaf", "is_selectable"
        ])
        w.writeheader()
        for r in code_rows:
            w.writerow(r)
    print(f"✅ Wrote {path}")


# ==========================================================
# 4. MAIN — Supports Unlimited Systems
# ==========================================================

def run_export():
    SYSTEMS = [
        {
            "name": "ICD-10",
            "description": "ICD-10 2019 version (including COVID-19 updates)",
            "version": "2019",
            "url": "https://icdcdn.who.int/icd10/claml/icd102019en.xml.zip",
            "parser": lambda: parse_icd10(os.path.expanduser("~/Downloads/icd102019en.xml"))
        },

        # Add more systems as needed:
        # {
        #     "name": "ICD-11",
        #     "description": "foo",
        #     "version": "2019",
        #     "url": "https://icd.who.int/...",
        #     "parser": lambda: parse_icd10(os.path.expanduser("~/Downloads/icd102019en.xml"))
        # },
    ]

    system_rows = []
    all_code_rows = []
    next_system_id = 1
    next_global_code_id = 1  # unique across *all* systems

    for system in SYSTEMS:
        print(f"\n📘 Parsing: {system['name']}")

        parsed_codes = system["parser"]()

        system_row = {
            "id": next_system_id,
            "name": system["name"],
            "description": system["description"],
            "version": system["version"],
            "url": system["url"]
        }
        system_rows.append(system_row)

        print(f"🌳 Building hierarchy for {system['name']}…")
        rows, next_global_code_id = build_hierarchy_for_system(
            parsed_codes,
            system_id=next_system_id,
            system_row=system_row,
            next_global_id=next_global_code_id
        )

        all_code_rows.extend(rows)

        next_system_id += 1

    # ======================================================
    # PRINT TOP 50 CODE ROWS FOR DEBUGGING
    # ======================================================
    print("\n🔎 Top 10 Codes:")
    for row in all_code_rows[:10]:
        desc = (row["description"][:50] + "…") if len(row["description"]) > 50 else row["description"]
        print(
            f"ID={row['id']} | system_id={row['system_id']} | code={row['code']} | "
            f"parent_id={row['parent_id']} | leaf={row['is_leaf']} | "
            f"path={row['materialized_path']} | desc=\"{desc}\""
        )

    print("\n🔎 Bottom 10 Codes:")
    for row in all_code_rows[-10:]:
        desc = (row["description"][:50] + "…") if len(row["description"]) > 50 else row["description"]
        print(
            f"ID={row['id']} | system_id={row['system_id']} | code={row['code']} | "
            f"parent_id={row['parent_id']} | leaf={row['is_leaf']} | "
            f"path={row['materialized_path']} | desc=\"{desc}\""
        )

    write_code_systems_csv(system_rows, path = os.path.expanduser("~/Downloads/systems.csv"))
    write_codes_csv(all_code_rows, path = os.path.expanduser("~/Downloads/codes.csv"))

    print("\n🎉 EXPORT COMPLETE — ALL SYSTEMS PROCESSED!")


if __name__ == "__main__":
    run_export()
