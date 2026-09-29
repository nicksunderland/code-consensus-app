"""
Creates the ESC project with one phenotype per data element in
db/data/Data Elements.xltx. Each phenotype gets auto-generated
search terms derived from its name. Code selection is left to the user.

Usage:
    python db/seed_esc_project.py

Requires VITE_DATABASE_URL in backend/.env.
Prints the new project UUID at the end; add it to EXAMPLE_PROJECT_IDS
if it should appear on the examples page.
"""

import os
import re
import sys
import uuid
import openpyxl
import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

DB_URL = os.getenv("VITE_DATABASE_URL")
if not DB_URL:
    print("VITE_DATABASE_URL not set in .env")
    sys.exit(1)

DATA_FILE = Path(__file__).resolve().parent / "data" / "Data Elements.xltx"

# Words to drop when building regex search terms
STOP_WORDS = {
    "of", "the", "a", "an", "in", "on", "at", "for", "with",
    "by", "from", "to", "and", "or", "is", "are", "as", "other",
}


def make_search_terms(name: str) -> list[dict]:
    """phenotype_search_terms rows for a phenotype name (description column only)."""
    terms = []

    # plain ILIKE on the full name
    terms.append({
        "term": name.strip(),
        "is_regex": False,
        "target_columns": ["description"],
        "row_order": 0,
    })

    # plus a looser regex over the significant words, e.g. angina.*pectoris
    words = re.sub(r"[^\w\s]", "", name.lower()).split()
    key_words = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    if len(key_words) >= 2:
        regex = ".*".join(key_words)
        terms.append({
            "term": regex,
            "is_regex": True,
            "target_columns": ["description"],
            "row_order": 1,
        })

    return terms


def load_data_elements():
    wb = openpyxl.load_workbook(DATA_FILE, data_only=True)
    ws = wb.active
    elements = []
    for row_idx in range(4, ws.max_row + 1):
        name       = ws.cell(row_idx, 1).value
        definition = ws.cell(row_idx, 2).value
        authority  = ws.cell(row_idx, 7).value
        if not name:
            continue
        elements.append({
            "name":        str(name).strip(),
            "description": str(definition).strip() if definition else "",
            "source":      str(authority).strip() if authority else "ESC",
        })
    return elements


def run():
    elements = load_data_elements()
    print(f"Loaded {len(elements)} data elements from Excel")

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # owner defaults to the earliest account
        cur.execute("SELECT user_id FROM user_profiles ORDER BY created_at LIMIT 1")
        row = cur.fetchone()
        if not row:
            print("No users found. Create an account first, then re-run")
            sys.exit(1)
        owner_id = row["user_id"]
        print(f"Owner: {owner_id}")

        cur.execute("SELECT id FROM code_systems WHERE name = 'SNOMED-CT' LIMIT 1")
        sys_row = cur.fetchone()
        snomed_system_id = sys_row["id"] if sys_row else None
        print(f"SNOMED-CT system_id: {snomed_system_id}")

        cur.execute(
            "SELECT id FROM projects WHERE name = 'ESC' AND owner = %s",
            (owner_id,)
        )
        existing = cur.fetchone()
        if existing:
            project_id = existing["id"]
            print(f"Reusing existing ESC project: {project_id}")
        else:
            project_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO projects (id, owner, name, description)
                VALUES (%s, %s, %s, %s)
            """, (
                project_id,
                owner_id,
                "ESC",
                "European Society of Cardiology data elements with canonical SNOMED CT codes",
            ))
            print(f"Created ESC project: {project_id}")

        created = skipped = 0
        for el in elements:
            cur.execute("""
                SELECT id FROM phenotypes
                WHERE project_id = %s AND lower(trim(name)) = lower(trim(%s))
            """, (project_id, el["name"]))
            if cur.fetchone():
                skipped += 1
                continue

            phenotype_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO phenotypes (id, user_id, project_id, name, description, source)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                phenotype_id,
                owner_id,
                project_id,
                el["name"],
                el["description"],
                el["source"],
            ))

            search_terms = make_search_terms(el["name"])
            for st in search_terms:
                system_ids = [snomed_system_id] if snomed_system_id else []
                cur.execute("""
                    INSERT INTO phenotype_search_terms
                        (id, phenotype_id, term, is_regex, target_columns, system_ids, row_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()),
                    phenotype_id,
                    st["term"],
                    st["is_regex"],
                    st["target_columns"],
                    system_ids,
                    st["row_order"],
                ))

            created += 1
            print(f"  + {el['name']}")

        conn.commit()
        print(f"\nDone: {created} phenotypes created, {skipped} already existed")
        print(f"\nESC project UUID: {project_id}")
        print(f"\nAdd to your backend/.env:")
        print(f"   EXAMPLE_PROJECT_IDS={project_id}")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
