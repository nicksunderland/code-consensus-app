import os
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import text, bindparam, select, func, Column, Integer, String, Boolean, BigInteger, ForeignKey
from pydantic import BaseModel, Field
from typing import List
from enum import Enum
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


class SearchRequest(BaseModel):
    """The complete search request body."""
    terms: List[str] = Field(..., min_length=1)
    system_ids: List[int] = Field(default_factory=list)
    use_regex: bool = False
    limit: int = 100


@app.post("/api/search-nodes")
async def search_nodes(request: SearchRequest):
    """
    Performs an advanced search with multiple terms,
    combining them with 'AND'.
    """
    if not request.terms:
        return {"results": [], "ancestor_map": {}}

    # --- Step 1: Dynamically build the search query ---
    operator = "~*" if request.use_regex else "ILIKE"
    where_clauses = ["e.is_selectable = TRUE"]
    params = {"limit": request.limit}

    if request.system_ids:
        # If the list is NOT empty, add the filter
        where_clauses.append("e.system_id = ANY(:system_ids)")
        params["system_ids"] = request.system_ids

    # Each term searches both code and description, combined with OR
    for i, term in enumerate(request.terms):
        if not term or not term.strip():
            continue

        param_name = f"term_{i}"
        if request.use_regex:
            params[param_name] = term
        else:
            params[param_name] = f"%{term}%"
        where_clauses.append(f"(e.code {operator} :{param_name} OR e.description {operator} :{param_name})")
    # --- Step 1b: Assemble and execute the 'find' query ---

    full_where_clause = " AND ".join(where_clauses)
    query_find_nodes = text(f"""
        SELECT e.id, e.code, e.description, e.materialized_path, e.is_leaf, e.is_selectable, e.system_id, s.name AS system_name
        FROM codes e
        JOIN code_systems s ON e.system_id = s.id
        WHERE {full_where_clause}
        LIMIT :limit;
    """)

    # This base query is useful for building the ancestor map
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
            return {
                "results": results_list,
                "ancestor_map": ancestor_map,
                "query": str(query_find_nodes)
            }

        except Exception as e:
            print(f"Error in /api/search/nodes: {e}")
            raise HTTPException(status_code=500, detail="Search query failed. Check query syntax.")