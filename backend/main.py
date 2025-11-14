import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "https://code-consensus.netlify.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")
async_db_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(async_db_url, pool_pre_ping=True)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)


# --- API Endpoints ---
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
        for col in s.columns:
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
    max_threshold: float = 0.0
    metric: str = "jaccard"


@app.post("/api/get-cooccurrence")
async def get_cooccurrence(request: CooccurrenceRequest):
    """
    Returns codes that co-occur with the given code_ids
    above the specified threshold for the selected metric.
    """
    if not request.code_ids:
        return {"results": []}

    if request.metric not in ("jaccard", "lift"):
        raise HTTPException(status_code=400, detail="Invalid metric. Must be 'jaccard' or 'lift'.")

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
                cc.{request.metric} AS metric_value
            FROM code_cooccurrence cc
            WHERE (cc.code_i = ic.code_id OR cc.code_j = ic.code_id)
              AND cc.{request.metric} >= :min_threshold
              AND cc.{request.metric} <= :max_threshold
            ORDER BY cc.{request.metric} DESC
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