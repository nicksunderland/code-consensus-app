"""
Creates the BICCS project with one phenotype per SNOMED CT concept in
db/data/disease_list_BICCs.tsv. Each phenotype gets auto-generated
search terms (SNOMED-CT scoped) derived from its name. Code selection
is left to the users.

Owner:   nicholas.sunderland@bristol.ac.uk
Members: t.lumbers@ucl.ac.uk

Descriptions are enriched with the BICCS suggested data field from
db/data/2026-06-23_BICCS-SNOMED.xlsx (sheet BICCS_DisorderToSNOMED) when present.

Usage:
    python db/seed_biccs_project.py            # dry run (rolls back)
    python db/seed_biccs_project.py --commit   # write to the database

Requires VITE_DATABASE_URL in backend/.env.
"""

import csv
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from seed_esc_project import make_search_terms

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

DB_URL = os.getenv("VITE_DATABASE_URL")
if not DB_URL:
    print("VITE_DATABASE_URL not set in .env")
    sys.exit(1)

DATA_DIR = Path(__file__).resolve().parent / "data"
DISEASE_FILE = DATA_DIR / "disease_list_BICCs.tsv"
MAPPING_FILE = DATA_DIR / "2026-06-23_BICCS-SNOMED.xlsx"

PROJECT_NAME = "BICCS"
PROJECT_DESCRIPTION = "BICCS inherited cardiac conditions referral indications mapped to SNOMED CT"
OWNER_EMAIL = "nicholas.sunderland@bristol.ac.uk"
MEMBER_EMAILS = ["t.lumbers@ucl.ac.uk"]


def load_field_mapping() -> dict[str, str]:
    """SCTID -> BICCS suggested data field (from the mapping workbook)."""
    if not MAPPING_FILE.exists():
        return {}
    ws = openpyxl.load_workbook(MAPPING_FILE, data_only=True)["BICCS_DisorderToSNOMED"]
    mapping = {}
    for field, _, _, sctid, *_ in ws.iter_rows(min_row=2, values_only=True):
        if field and sctid and str(sctid).strip() != "NA":
            mapping[str(sctid).strip()] = str(field).strip()
    return mapping


def load_phenotypes() -> list[dict]:
    field_map = load_field_mapping()
    with open(DISEASE_FILE, newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    phenotypes = []
    for r in rows:
        sctid = r["SCTID"].strip()
        name = r["official_PT"].strip()
        field = field_map.get(sctid)
        desc = f"SNOMED CT {sctid} | {name}"
        if field:
            desc = f"BICCS data field: {field}. " + desc
        phenotypes.append({"sctid": sctid, "name": name, "description": desc})
    return phenotypes


def run(commit: bool):
    phenotypes = load_phenotypes()
    print(f"Loaded {len(phenotypes)} phenotypes from {DISEASE_FILE.name}")

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        emails = [OWNER_EMAIL] + MEMBER_EMAILS
        cur.execute(
            "SELECT user_id, email, full_name FROM user_profiles WHERE email = ANY(%s)",
            (emails,),
        )
        profiles = {r["email"]: r for r in cur.fetchall()}
        missing = [e for e in emails if e not in profiles]
        if missing:
            print(f"Not registered: {', '.join(missing)}")
            sys.exit(1)
        owner_id = profiles[OWNER_EMAIL]["user_id"]
        print(f"Owner: {OWNER_EMAIL} ({owner_id})")

        # member_ids / member_data mirror the frontend (useProjects.saveProject):
        # the owner is included with role 'owner'
        now = datetime.now(timezone.utc).isoformat()
        member_ids = [profiles[e]["user_id"] for e in emails]
        member_data = [{
            "user_id": profiles[e]["user_id"],
            "name": profiles[e]["full_name"] or "",
            "email": e,
            "role": "owner" if e == OWNER_EMAIL else "member",
            "added_at": now,
        } for e in emails]

        cur.execute("SELECT id FROM code_systems WHERE name = 'SNOMED-CT' LIMIT 1")
        snomed_system_id = cur.fetchone()["id"]
        print(f"SNOMED-CT system_id: {snomed_system_id}")

        # warn if any SCTID is missing from the loaded SNOMED release
        sctids = [p["sctid"] for p in phenotypes]
        cur.execute(
            "SELECT code FROM codes WHERE system_id = %s AND code = ANY(%s)",
            (snomed_system_id, sctids),
        )
        found = {r["code"] for r in cur.fetchall()}
        for s in sctids:
            if s not in found:
                print(f"   warning: SCTID {s} not found in codes table")

        cur.execute(
            "SELECT id FROM projects WHERE lower(trim(name)) = lower(%s) AND owner = %s",
            (PROJECT_NAME, owner_id),
        )
        existing = cur.fetchone()
        if existing:
            project_id = existing["id"]
            cur.execute("""
                UPDATE projects SET member_ids = %s::uuid[], member_data = %s, updated_at = now()
                WHERE id = %s
            """, (member_ids, json.dumps(member_data), project_id))
            print(f"Reusing existing {PROJECT_NAME} project: {project_id} (members refreshed)")
        else:
            project_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO projects (id, owner, name, description, member_ids, member_data)
                VALUES (%s, %s, %s, %s, %s::uuid[], %s)
            """, (project_id, owner_id, PROJECT_NAME, PROJECT_DESCRIPTION,
                  member_ids, json.dumps(member_data)))
            print(f"Created {PROJECT_NAME} project: {project_id}")

        created = skipped = 0
        for ph in phenotypes:
            cur.execute("""
                SELECT id FROM phenotypes
                WHERE project_id = %s AND lower(trim(name)) = lower(trim(%s))
            """, (project_id, ph["name"]))
            if cur.fetchone():
                skipped += 1
                continue

            phenotype_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO phenotypes (id, user_id, project_id, name, description, source)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (phenotype_id, owner_id, project_id, ph["name"], ph["description"], PROJECT_NAME))

            for st in make_search_terms(ph["name"]):
                cur.execute("""
                    INSERT INTO phenotype_search_terms
                        (id, phenotype_id, term, is_regex, target_columns, system_ids, row_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (str(uuid.uuid4()), phenotype_id, st["term"], st["is_regex"],
                      st["target_columns"], [snomed_system_id], st["row_order"]))

            created += 1
            print(f"  + {ph['name']}")

        if commit:
            conn.commit()
            print(f"\nCommitted: {created} phenotypes created, {skipped} already existed")
        else:
            conn.rollback()
            print(f"\nDry run: {created} phenotypes would be created, {skipped} already exist. "
                  f"Re-run with --commit to write.")
        print(f"{PROJECT_NAME} project UUID: {project_id}")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run(commit="--commit" in sys.argv)
