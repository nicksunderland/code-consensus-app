"""
Runs each ESC phenotype's saved search terms against the codes table
and saves all matches as user_code_selections (found_in_search=True).

The user can then review and refine selections manually.

Usage:
    python db/seed_esc_selections.py
"""

import os
import sys
import uuid
import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

DB_URL = os.getenv("VITE_DATABASE_URL")
if not DB_URL:
    print("VITE_DATABASE_URL not set in .env")
    sys.exit(1)

SEARCH_LIMIT = 500  # max codes to save per phenotype


def build_search_query(search_terms: list[dict]) -> tuple[str, dict] | None:
    """
    Replicates the backend search logic for a list of search term rows.
    Returns (sql_string, params) or None if no valid terms.
    """
    where_clauses = ["e.is_selectable = TRUE"]
    params = {}
    or_clauses = []

    all_system_ids = list({sid for st in search_terms for sid in (st["system_ids"] or [])})
    if all_system_ids:
        where_clauses.append("e.system_id = ANY(%(all_system_ids)s)")
        params["all_system_ids"] = all_system_ids

    for i, st in enumerate(search_terms):
        term = (st["term"] or "").strip()
        if not term:
            continue

        is_regex = st["is_regex"]
        operator = "~*" if is_regex else "ILIKE"
        param_name = f"term_{i}"
        params[param_name] = term if is_regex else f"%{term}%"

        col_conditions = []
        for col in (st["target_columns"] or ["description"]):
            if col not in ("code", "description"):
                continue
            col_conditions.append(f"e.{col} {operator} %({param_name})s")

        if not col_conditions:
            continue

        system_ids = st["system_ids"] or []
        if system_ids:
            sys_param = f"sys_{i}"
            params[sys_param] = system_ids
            col_conditions = [f"({c} AND e.system_id = ANY(%({sys_param})s))" for c in col_conditions]

        or_clauses.append(f"({' OR '.join(col_conditions)})")

    if not or_clauses:
        return None

    where_clauses.append(f"({' OR '.join(or_clauses)})")
    sql = f"""
        SELECT e.id, e.code, e.description, e.system_name
        FROM codes e
        WHERE {" AND ".join(where_clauses)}
        LIMIT %(limit)s
    """
    params["limit"] = SEARCH_LIMIT
    return sql, params


def run():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("SELECT id, owner FROM projects WHERE name = 'ESC' LIMIT 1")
        project = cur.fetchone()
        if not project:
            print("ESC project not found. Run seed_esc_project.py first")
            sys.exit(1)
        project_id = project["id"]
        owner_id = project["owner"]
        print(f"ESC project: {project_id}")
        print(f"Owner: {owner_id}")

        cur.execute("""
            SELECT id, name FROM phenotypes
            WHERE project_id = %s ORDER BY name
        """, (project_id,))
        phenotypes = cur.fetchall()
        print(f"{len(phenotypes)} phenotypes found\n")

        total_saved = 0

        for ph in phenotypes:
            ph_id = ph["id"]
            ph_name = ph["name"]

            cur.execute("""
                SELECT term, is_regex, target_columns, system_ids
                FROM phenotype_search_terms
                WHERE phenotype_id = %s
                ORDER BY row_order
            """, (ph_id,))
            search_terms = cur.fetchall()

            if not search_terms:
                print(f"   warning: {ph_name}: no search terms, skipping")
                continue

            result = build_search_query([dict(st) for st in search_terms])
            if not result:
                print(f"   warning: {ph_name}: could not build query, skipping")
                continue

            sql, params = result

            cur.execute(sql, params)
            matches = cur.fetchall()

            if not matches:
                print(f"   {ph_name}: 0 matches")
                continue

            # ON CONFLICT so re-running doesn't duplicate selections
            saved = 0
            for m in matches:
                try:
                    cur.execute("""
                        INSERT INTO user_code_selections
                            (id, phenotype_id, user_id, code_type, code_id,
                             found_in_search, imported, is_selected, is_consensus)
                        VALUES (%s, %s, %s, 'standard', %s, TRUE, FALSE, TRUE, FALSE)
                        ON CONFLICT DO NOTHING
                    """, (str(uuid.uuid4()), ph_id, owner_id, m["id"]))
                    saved += cur.rowcount
                except Exception as e:
                    print(f"      warning: skipping code {m['code']}: {e}")
                    conn.rollback()
                    continue

            total_saved += saved
            print(f"   {ph_name}: {saved} codes saved ({len(matches)} matched)")

        conn.commit()
        print(f"\nDone: {total_saved} total code selections saved across {len(phenotypes)} phenotypes")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
