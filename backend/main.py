import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
import httpx
from uuid import UUID

load_dotenv()

# --- CORS Configuration ---
def get_allowed_origins():
    origins_env = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("ORIGIN", "")
    if not origins_env:
        return []
    return [origin.strip() for origin in origins_env.split(",") if origin.strip()]

ALLOWED_ORIGINS = get_allowed_origins()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup ---
DATABASE_URL = os.environ.get("VITE_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")
async_db_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(async_db_url, pool_pre_ping=True)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

def parse_example_project_ids(raw_ids: str | None) -> list[str]:
    """
    Parse a comma-separated string of UUIDs, ignoring invalid entries.
    Used to expose a safe, curated list of public example projects
    without requiring user ownership (bypasses Supabase RLS).
    """
    if not raw_ids:
        return []

    parsed_ids: list[str] = []
    for raw in raw_ids.split(","):
        trimmed = raw.strip()
        if not trimmed:
            continue
        try:
            parsed_ids.append(str(UUID(trimmed)))
        except ValueError:
            print(f"[examples] Skipping invalid project id: {trimmed}")
    return parsed_ids

EXAMPLE_PROJECT_IDS = parse_example_project_ids(os.environ.get("EXAMPLE_PROJECT_IDS"))


# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "API is running!"}


@app.get("/api/db_info")
async def db_info():
    if not DATABASE_URL:
        return {"env_present": False}

    # --- Parse DATABASE_URL ---
    p = urlparse(DATABASE_URL)
    # mask userinfo (user:pass)
    userinfo = p.netloc.split('@')[-1] if '@' in p.netloc else p.netloc
    host = userinfo.split(':')[0]
    port = userinfo.split(':')[1] if ':' in userinfo else None
    query = dict(parse_qs(p.query))
    sslmode = query.get("sslmode", [""])[0]

    # --- Check IPv6 support ---
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("https://api64.ipify.org")
            ipv6_address = response.text.strip()
            ipv6_reachable = True
    except Exception as e:
        ipv6_address = None
        ipv6_reachable = False
        ipv6_error = str(e)

    # --- Return combined info ---
    result = {
        "env_present": True,
        "scheme": p.scheme,
        "host": host,
        "port": port,
        "path_db": p.path.lstrip("/"),
        "sslmode_in_url": sslmode or None,
        "ipv6_reachable": ipv6_reachable,
    }

    if not ipv6_reachable:
        result["ipv6_error"] = ipv6_error
    else:
        result["ipv6_address"] = ipv6_address

    return result


@app.get("/api/status")
async def get_status():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("SELECT 1"))
            return {"status": "ok", "db_status": "Database connection successful."}
        except Exception as e:
            return {"status": "error", "db_status": f"Database connection failed: {e}"}


@app.get("/api/tree-nodes")
async def get_tree_nodes(parent_id: str | None = None):
    """
    Lazy-loads nodes for a tree.
    - If parent_id is NULL, returns the root nodes (the systems).
    - If parent_id is provided, returns the direct children of that node.
    """
    query_base = """
        SELECT e.id, e.code, e.description, e.is_leaf, e.is_selectable, s.id AS system_id, s.name AS system_name
        FROM codes e
        JOIN code_systems s ON e.system_id = s.id
 
    """

    query_text: str
    params: dict = {}

    async with AsyncSessionLocal() as session:
        try:
            if parent_id is None:
                # Use Case 1: Get root nodes (ICD-10, SNOMED-CT, etc.)
                query_text = f"""
                    {query_base}
                    WHERE e.parent_id IS NULL
                    ORDER BY e.code;
                """
            else:
                # Use Case 2 & 3: Get children of any node
                # The frontend passes the 'id' of the clicked node.
                # This works for the "ICD-10" root node just as it
                # does for any chapter or code.
                query_text = f"""
                    {query_base}
                    WHERE e.parent_id = :parent_id
                    ORDER BY e.code;
                """
                params = {"parent_id": int(parent_id)}

            # Execute the constructed query
            result = await session.execute(text(query_text), params)
            entities = result.fetchall()

            # Format the response for the frontend
            tree_nodes = [
                {
                    "key": str(ent.id),
                    "label": f"{ent.code} - {ent.description}",
                    "data": {
                        "id": ent.id,
                        "code": ent.code,
                        "description": ent.description,
                        "system": ent.system_name,
                        "system_id": ent.system_id,
                        "is_leaf": ent.is_leaf,
                        "is_selectable": ent.is_selectable,
                        "found_in_search": False
                    },
                    "leaf": ent.is_leaf,
                    "selectable": ent.is_selectable
                }
                for ent in entities
            ]

            return tree_nodes

        except Exception as e:
            print(f"Error in /api/tree-nodes: {e}")
            raise HTTPException(status_code=500, detail="Database query failed")


class SingleSearch(BaseModel):
    text: str
    regex: bool
    columns: List[str]  # e.g., ["code", "description"]
    system_ids: List[int]


class SearchRequest(BaseModel):
    searches: List[SingleSearch]
    limit: int = 100


@app.post("/api/search-nodes")
async def search_nodes(request: SearchRequest):
    """
    Performs an advanced search with multiple searches,
    combining them with 'AND'.
    """
    if not request.searches:
        return {"results": [], "ancestor_map": {}}

    # --- Step 1: Dynamically build the search query ---
    where_clauses = ["e.is_selectable = TRUE"]
    params = {"limit": request.limit}

    # --- Step 1a: Global system filter ---
    all_system_ids = list({sid for s in request.searches for sid in s.system_ids})
    if all_system_ids:
        where_clauses.append("e.system_id = ANY(:all_system_ids)")
        params["all_system_ids"] = all_system_ids

    # --- Build OR conditions for each search ---
    or_clauses = []

    for i, s in enumerate(request.searches):
        if not s.text.strip():
            continue

        operator = "~*" if s.regex else "ILIKE"
        param_name = f"term_{i}"
        params[param_name] = s.text if s.regex else f"%{s.text}%"

        # Columns per search
        col_conditions = []
        ALLOWED_COLUMNS = {'code', 'description'}
        for col in s.columns:
            if col not in ALLOWED_COLUMNS:
                raise HTTPException(status_code=400, detail=f"Invalid column: {col}")
            col_conditions.append(f"e.{col} {operator} :{param_name}")

        # System filter for this search
        if s.system_ids:
            system_param = f"system_ids_{i}"
            params[system_param] = s.system_ids
            col_conditions = [f"({c} AND e.system_id = ANY(:{system_param}))" for c in col_conditions]

        or_clauses.append(f"({' OR '.join(col_conditions)})")

    if or_clauses:
        where_clauses.append(f"({' OR '.join(or_clauses)})")

    # --- Step 1b: Assemble and execute the 'find' query ---
    full_where_clause = " AND ".join(where_clauses)
    query_find_nodes = text(f"""
        SELECT e.id, e.code, e.description, e.materialized_path, e.is_leaf, e.is_selectable, e.system_id, s.name AS system_name
        FROM codes e
        JOIN code_systems s ON e.system_id = s.id
        WHERE {full_where_clause}
        LIMIT :limit;
    """)

    # This base query is for building the ancestor map
    ancestor_query_base = """
        SELECT e.id, e.code, e.description, e.materialized_path, e.is_leaf, e.is_selectable, e.system_id, s.name AS system_name
        FROM codes e
        JOIN code_systems s ON e.system_id = s.id
    """

    ancestor_ids = set()
    results_list = []

    async with AsyncSessionLocal() as session:
        try:
            result_nodes = await session.execute(query_find_nodes, params)
            search_results = result_nodes.fetchall()

            if not search_results:
                return {"results": [], "ancestor_map": {}}

            # --- Step 2: Parse paths (Unchanged) ---
            for row in search_results:
                results_list.append({
                    "key": str(row.id),
                    "label": f"{row.code} - {row.description}",
                    "data": {
                        "id": row.id,
                        "materialized_path": row.materialized_path,
                        "code": row.code,
                        "description": row.description,
                        "system": row.system_name,
                        "system_id": row.system_id,
                        "is_leaf": row.is_leaf,
                        "is_selectable": row.is_selectable,
                        "found_in_search": True,
                    },
                    "leaf": row.is_leaf,
                    "selectable": row.is_selectable,
                })
                path_ids = row.materialized_path.strip('/').split('/')
                if len(path_ids) > 1:
                    ancestor_ids.update(path_ids[:-1])

            # --- Step 3: Fetch ancestors ---
            ancestor_map = {}
            if ancestor_ids:
                query_get_ancestors = text(f"""
                    {ancestor_query_base}
                    WHERE e.id = ANY(:ancestor_id_list);
                """)
                result_ancestors = await session.execute(
                    query_get_ancestors,
                    {"ancestor_id_list": [int(a) for a in ancestor_ids]}
                )
                ancestor_search_results = result_ancestors.fetchall()
                ancestor_map = {
                    str(row.id): {
                        "key": str(row.id),
                        "label": f"{row.code} - {row.description}",
                        "data": {
                            "id": row.id,
                            "materialized_path": row.materialized_path,
                            "code": row.code,
                            "description": row.description,
                            "system": row.system_name,
                            "system_id": row.system_id,
                            "is_leaf": row.is_leaf,
                            "is_selectable": row.is_selectable,
                            "found_in_search": False,  # ancestors aren't hits
                        },
                        "leaf": row.is_leaf,
                        "selectable": row.is_selectable,
                    }
                    for row in ancestor_search_results
                }

            # --- Step 4: Return payload ---
            print(str(query_find_nodes))
            return {
                "results": results_list,
                "ancestor_map": ancestor_map,
                "query": str(query_find_nodes)
            }

        except Exception as e:
            print(f"Error in /api/search/nodes: {e}")
            raise HTTPException(status_code=500, detail="Search query failed. Check query syntax.")


class CooccurrenceRequest(BaseModel):
    code_ids: List[int]
    min_threshold: float = 0.0
    max_threshold: float = 1.0
    metric: str = "jaccard"


@app.post("/api/get-cooccurrence")
async def get_cooccurrence(request: CooccurrenceRequest):
    """
    Returns codes that co-occur with the given code_ids
    above the specified threshold for the selected metric.
    """
    if not request.code_ids:
        return {"results": []}

    metric_map = {
        "jaccard": "jaccard",
        "lift": "lift",
        "pair_count": "pair_count"
    }
    if request.metric not in metric_map:
        raise HTTPException(status_code=400, detail="Invalid metric. Must be 'jaccard', 'lift', or 'pair_count'.")

    metric_column = metric_map[request.metric]

    # SQL query to get co-occurring codes
    sql = text(f"""
        WITH input_codes AS (
            SELECT unnest(CAST(:code_ids AS bigint[])) AS code_id
        )
        SELECT
            ic.code_id AS code_i,
            c_i.code AS code_i_str,
            c_i.description AS code_i_description,

            cc.other_code AS code_j,
            c_j.code AS code_j_str,
            c_j.description AS code_j_description,

            cc.metric_value
        FROM input_codes ic
        LEFT JOIN LATERAL (
            SELECT
                CASE WHEN cc.code_i = ic.code_id THEN cc.code_j ELSE cc.code_i END AS other_code,
                cc.{metric_column} AS metric_value
            FROM code_cooccurrence cc
            WHERE (cc.code_i = ic.code_id OR cc.code_j = ic.code_id)
              AND cc.{metric_column} >= :min_threshold
              AND cc.{metric_column} <= :max_threshold
            ORDER BY cc.{metric_column} DESC
        ) cc ON TRUE
        LEFT JOIN codes c_i ON c_i.id = ic.code_id
        LEFT JOIN codes c_j ON c_j.id = cc.other_code
        ORDER BY ic.code_id, cc.metric_value DESC NULLS LAST;
    """)

    params = {
        "code_ids": request.code_ids,
        "min_threshold": request.min_threshold,
        "max_threshold": request.max_threshold
    }

    async with AsyncSessionLocal() as session:
        try:
            print("SQL Query:", str(sql))
            print("Parameters:", params)
            result = await session.execute(sql, params)
            search_results = result.fetchall()

            if not search_results:
                return {"results": []}

            # Build a list of fully labeled pairs
            results = [
                {
                    "code_i": row.code_i,
                    "code_i_str": row.code_i_str,
                    "code_i_description": row.code_i_description,
                    "code_j": row.code_j,
                    "code_j_str": row.code_j_str,
                    "code_j_description": row.code_j_description,
                    request.metric: row.metric_value
                }
                for row in search_results
            ]
            return {"results": results}

        except Exception as e:
            print(f"Error in /api/get-cooccurrence: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch co-occurring codes.")


class CodeCountsRequest(BaseModel):
    code_ids: List[int]
    dataset: str | None = "ukb"


@app.post("/api/get-code-counts")
async def get_code_counts(request: CodeCountsRequest):
    """
    Returns per-code counts for the requested dataset (default UKB).
    """
    if not request.code_ids:
        return {"results": []}

    sql = text("""
        SELECT
            c.id AS code_id,
            c.code AS code_str,
            c.description AS code_description,
            c.system_name,
            cc.person_count,
            cc.event_count
        FROM codes c
        LEFT JOIN code_counts cc
          ON cc.code_id = c.id AND cc.dataset = :dataset
        WHERE c.id = ANY(:code_ids :: bigint[])
    """)

    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(sql, {"code_ids": request.code_ids, "dataset": request.dataset or "ukb"})
            rows = res.fetchall()
            results = [
                {
                    "code_id": int(row.code_id),
                    "code_str": row.code_str,
                    "code_description": row.code_description,
                    "system_name": row.system_name,
                    "person_count": int(row.person_count) if row.person_count is not None else 0,
                    "event_count": int(row.event_count) if row.event_count is not None else 0,
                }
                for row in rows
            ]
            return {"results": results}
        except Exception as e:
            print(f"Error in /api/get-code-counts: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch code counts.")


class BoundsRequest(BaseModel):
    code_ids: List[int]
    dataset: str | None = "ukb"


@app.post("/api/get-metric-bounds")
async def get_metric_bounds(request: BoundsRequest):
    """
    Calculates the absolute MIN and MAX values for the selected metric
    across all co-occurrences involving the provided code_ids.
    """
    if not request.code_ids:
        return {
            "jaccard": {"min": 0.0, "max": 1.0},
            "lift": {"min": 0.0, "max": 10.0},
            "pair_count": {"min": 0.0, "max": 100.0},
            "ukb_person_count": {"min": 0.0, "max": 0.0},
            "ukb_event_count": {"min": 0.0, "max": 0.0}
        }

    # 1. SQL: Fetches bounds for BOTH metrics in one go
    sql = text("""
            SELECT 
                MIN(jaccard) as min_j, MAX(jaccard) as max_j,
                MIN(lift) as min_l, MAX(lift) as max_l,
                MIN(pair_count) as min_c, MAX(pair_count) as max_c
            FROM code_cooccurrence
            WHERE code_i = ANY(:code_ids :: bigint[]) 
               OR code_j = ANY(:code_ids :: bigint[])
    """)

    counts_sql = text("""
        SELECT
            MIN(person_count) AS min_p,
            MAX(person_count) AS max_p,
            MIN(event_count) AS min_e,
            MAX(event_count) AS max_e
        FROM code_counts
        WHERE code_id = ANY(:code_ids :: bigint[])
          AND dataset = :dataset
    """)

    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(sql, {"code_ids": request.code_ids})
            row = result.fetchone()
            min_j = float(row.min_j) if row.min_j is not None else 0.0
            max_j = float(row.max_j) if row.max_j is not None else 1.0
            min_l = float(row.min_l) if row.min_l is not None else 0.0
            max_l = float(row.max_l) if row.max_l is not None else 10.0
            min_c = float(row.min_c) if row.min_c is not None else 0.0
            max_c = float(row.max_c) if row.max_c is not None else 100.0

            counts_result = await session.execute(counts_sql, {"code_ids": request.code_ids, "dataset": request.dataset or "ukb"})
            counts_row = counts_result.fetchone()
            min_p = float(counts_row.min_p) if counts_row.min_p is not None else 0.0
            max_p = float(counts_row.max_p) if counts_row.max_p is not None else 0.0
            min_e = float(counts_row.min_e) if counts_row.min_e is not None else 0.0
            max_e = float(counts_row.max_e) if counts_row.max_e is not None else 0.0

            return {
                "jaccard": {"min": min_j, "max": max_j},
                "lift": {"min": min_l, "max": max_l},
                "pair_count": {"min": min_c, "max": max_c},
                "ukb_person_count": {"min": min_p, "max": max_p},
                "ukb_event_count": {"min": min_e, "max": max_e}
            }

        except Exception as e:
            print(f"Error fetching metric bounds: {e}")
            raise HTTPException(status_code=500, detail="Failed to calculate bounds")


@app.get("/api/example-phenotypes")
async def get_example_phenotypes(project_ids: str | None = None):
    """
    Public endpoint to showcase selected projects/phenotypes without requiring
    the caller to own the project. Uses EXAMPLE_PROJECT_IDS (comma separated)
    unless overridden by `project_ids` query param.
    """
    target_ids = parse_example_project_ids(project_ids) or EXAMPLE_PROJECT_IDS
    if not target_ids:
        return {"projects": []}

    sql = text("""
        WITH example_projects AS (
            SELECT id, name, description
            FROM projects
            WHERE id = ANY(:project_ids :: uuid[])
        ),
        consensus_counts AS (
            SELECT phenotype_id, COUNT(*) AS total_consensus
            FROM phenotype_consensus_codes
            GROUP BY phenotype_id
        ),
        search_term_counts AS (
            SELECT phenotype_id, COUNT(*) AS total_terms
            FROM phenotype_search_terms
            WHERE term IS NOT NULL AND btrim(term) <> ''
            GROUP BY phenotype_id
        )
        SELECT
            p.id AS project_id,
            p.name AS project_name,
            p.description AS project_description,
            ph.id AS phenotype_id,
            ph.name AS phenotype_name,
            ph.description AS phenotype_description,
            ph.source AS source,
            ph.updated_at AS updated_at,
            COALESCE(cc.total_consensus, 0) AS consensus_codes,
            COALESCE(st.total_terms, 0) AS search_terms
        FROM example_projects p
        LEFT JOIN phenotypes ph ON ph.project_id = p.id
        LEFT JOIN consensus_counts cc ON cc.phenotype_id = ph.id
        LEFT JOIN search_term_counts st ON st.phenotype_id = ph.id
        ORDER BY p.name, ph.name;
    """)

    async with AsyncSessionLocal() as session:
        result = await session.execute(sql, {"project_ids": target_ids})
        rows = result.fetchall()

        projects: dict[str, dict] = {}
        for row in rows:
            project = projects.setdefault(
                str(row.project_id),
                {
                    "id": str(row.project_id),
                    "name": row.project_name,
                    "description": row.project_description,
                    "phenotypes": []
                }
            )

            if row.phenotype_id:
                project["phenotypes"].append({
                    "id": str(row.phenotype_id),
                    "name": row.phenotype_name,
                    "description": row.phenotype_description,
                    "source": row.source,
                    "updated_at": row.updated_at,
                    "consensus_codes": int(row.consensus_codes or 0),
                    "search_terms": int(row.search_terms or 0)
                })

        return {"projects": list(projects.values())}


@app.get("/api/example-phenotypes/{phenotype_id}")
async def get_example_phenotype_detail(phenotype_id: str, project_ids: str | None = None):
    """
    Returns consensus codes and search-term context for a single phenotype that
    belongs to the curated example projects list. This bypasses RLS but is
    constrained to EXAMPLE_PROJECT_IDS (or the explicit `project_ids` override).
    """
    target_ids = parse_example_project_ids(project_ids) or EXAMPLE_PROJECT_IDS
    if not target_ids:
        raise HTTPException(status_code=404, detail="No example projects configured.")

    try:
        phenotype_uuid = str(UUID(phenotype_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phenotype id.")

    phenotype_sql = text("""
        SELECT
            ph.id,
            ph.name,
            ph.description,
            ph.source,
            ph.updated_at,
            ph.project_id,
            p.name AS project_name
        FROM phenotypes ph
        JOIN projects p ON p.id = ph.project_id
        WHERE ph.id = :phenotype_id
          AND p.id = ANY(:project_ids :: uuid[])
    """)

    consensus_sql = text("""
        SELECT
            code_type,
            code_id,
            orphan_id,
            code_text,
            code_description,
            system_name,
            consensus_comments
        FROM phenotype_consensus_codes
        WHERE phenotype_id = :phenotype_id
        ORDER BY system_name, code_text
    """)

    search_terms_sql = text("""
        SELECT
            pst.term,
            pst.is_regex,
            pst.target_columns,
            pst.system_ids,
            pst.row_order,
            COALESCE(array_remove(array_agg(cs.name), NULL), '{}') AS system_names
        FROM phenotype_search_terms pst
        LEFT JOIN LATERAL unnest(pst.system_ids) sid ON TRUE
        LEFT JOIN code_systems cs ON cs.id = sid
        WHERE pst.phenotype_id = :phenotype_id
        GROUP BY pst.id, pst.row_order
        ORDER BY pst.row_order
    """)

    system_breakdown_sql = text("""
        SELECT
            COALESCE(cs.name, ucs.system_name, 'Unknown') AS system_name,
            COUNT(DISTINCT COALESCE(ucs.code_id::text, ucs.orphan_id)) AS total
        FROM user_code_selections ucs
        LEFT JOIN codes c ON ucs.code_id = c.id
        LEFT JOIN code_systems cs ON c.system_id = cs.id
        WHERE ucs.phenotype_id = :phenotype_id
          AND (ucs.found_in_search OR ucs.imported)
        GROUP BY COALESCE(cs.name, ucs.system_name, 'Unknown')
        ORDER BY total DESC
    """)

    search_import_counts_sql = text("""
        SELECT
            COUNT(DISTINCT COALESCE(code_id::text, orphan_id)) FILTER (WHERE found_in_search) AS search_codes,
            COUNT(DISTINCT COALESCE(code_id::text, orphan_id)) FILTER (WHERE imported) AS imported_codes
        FROM user_code_selections
        WHERE phenotype_id = :phenotype_id
    """)

    rater_count_sql = text("""
        SELECT COUNT(DISTINCT user_id) AS raters
        FROM user_code_selections
        WHERE phenotype_id = :phenotype_id
    """)

    async with AsyncSessionLocal() as session:
        # Validate phenotype belongs to curated projects
        ph_result = await session.execute(
            phenotype_sql,
            {"phenotype_id": phenotype_uuid, "project_ids": target_ids},
        )
        ph_row = ph_result.fetchone()
        if not ph_row:
            raise HTTPException(status_code=404, detail="Phenotype not available in examples.")

        consensus_rows = await session.execute(
            consensus_sql, {"phenotype_id": phenotype_uuid}
        )
        consensus_codes = [
            {
                "code_type": row.code_type,
                "code_id": row.code_id,
                "orphan_id": row.orphan_id,
                "code": row.code_text,
                "description": row.code_description,
                "system": row.system_name,
                "consensus_comments": row.consensus_comments,
            }
            for row in consensus_rows.fetchall()
        ]

        term_rows = await session.execute(
            search_terms_sql, {"phenotype_id": phenotype_uuid}
        )
        raw_search_terms = [
            {
                "term": row.term,
                "is_regex": row.is_regex,
                "target_columns": row.target_columns,
                "system_ids": row.system_ids or [],
                "system_names": row.system_names or [],
                "row_order": row.row_order,
            }
            for row in term_rows.fetchall()
        ]

        # Ignore blank rows when reporting metrics to avoid counting the default empty input
        search_terms = [
            term for term in raw_search_terms
            if (term.get("term") or "").strip()
        ]

        system_rows = await session.execute(
            system_breakdown_sql, {"phenotype_id": phenotype_uuid}
        )
        systems = [
            {"name": row.system_name, "count": int(row.total)}
            for row in system_rows.fetchall()
            if row.system_name is not None
        ]

        search_import_counts = await session.execute(
            search_import_counts_sql, {"phenotype_id": phenotype_uuid}
        )
        counts_row = search_import_counts.fetchone()
        search_codes = int(counts_row.search_codes or 0)
        imported_codes = int(counts_row.imported_codes or 0)
        total_codes = sum(s["count"] for s in systems)

        rater_row = await session.execute(
            rater_count_sql, {"phenotype_id": phenotype_uuid}
        )
        rater_count = int(rater_row.scalar() or 0)

        agreement_sql = text("""
            SELECT
                code_type,
                code_id,
                orphan_id,
                COUNT(*) AS raters,
                COUNT(*) FILTER (WHERE is_selected) AS selected
            FROM user_code_selections
            WHERE phenotype_id = :phenotype_id
            GROUP BY code_type, code_id, orphan_id
        """)

        agreement_rows = await session.execute(
            agreement_sql, {"phenotype_id": phenotype_uuid}
        )

        total_ratings = 0
        total_selected = 0
        p_sum = 0.0
        items = 0

        for row in agreement_rows.fetchall():
            n = int(row.raters or 0)
            n_sel = int(row.selected or 0)
            if n < 2:
                continue  # need at least two raters for agreement
            n_not = n - n_sel
            # Fleiss-style per-item agreement for binary categories
            p_i = ((n_sel * (n_sel - 1)) + (n_not * (n_not - 1))) / (n * (n - 1))
            p_sum += float(p_i)
            items += 1
            total_ratings += n
            total_selected += n_sel

        p_bar = (p_sum / items) if items else 0.0
        p_yes = (total_selected / total_ratings) if total_ratings else 0.0
        p_no = 1.0 - p_yes
        p_e = (p_yes * p_yes) + (p_no * p_no)
        kappa_den = (1 - p_e)
        kappa = (p_bar - p_e) / kappa_den if kappa_den != 0 else 0.0

        agreement = {
            "items": items,
            "agreement": round(p_bar, 4),
            "kappa": round(kappa, 4),
            "raters": rater_count
        }

        return {
            "phenotype": {
                "id": str(ph_row.id),
                "name": ph_row.name,
                "description": ph_row.description,
                "source": ph_row.source,
                "updated_at": ph_row.updated_at,
                "project_id": str(ph_row.project_id),
                "project_name": ph_row.project_name,
            },
            "metrics": {
                "consensus_total": len(consensus_codes),
                "search_terms": len(search_terms),
                "system_breakdown": systems,
                "search_codes": total_codes,
                "imported_codes": imported_codes,
                "agreement": agreement,
            },
            "consensus_codes": consensus_codes,
            "search_terms": search_terms,
        }


if __name__ == "__main__":
    import uvicorn
    PORT = int(os.environ.get("PORT", 8080))  # Use Fly.io port
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
