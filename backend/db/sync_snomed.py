"""
Updates the SNOMED CT rows in `codes` (system 10) in place from one or more
RF2 releases, e.g. the UK Clinical Edition (UK extension + International).

Rows are matched on concept id, so existing codes.id values never change and
user selections are left alone. Nothing is deleted: `user_code_selections`,
`code_counts` and `code_cooccurrence` cascade on delete.

Inactive (retired) concepts are loaded too, because historic records still carry
them. They stay selectable, get " [inactive]" appended to their description, and
sit in the tree under the active concept their historical association points to
(SAME_AS, then REPLACED_BY, POSSIBLY_EQUIVALENT_TO, ...), so expanding a concept
also picks up the retired codes it replaced. Retired concepts with no usable
association go under an "Inactive concepts" node, grouped by semantic tag (and by
first letter for large tags) so no node gets an unmanageable number of children.

What it does:
  - concepts not yet in the DB (active or inactive) are inserted with ids above max(codes.id)
  - existing concepts get their description, parent, path and leaf flag refreshed
  - the code_systems row and the SNOMED root row are relabelled with the release

Preferred terms come from the UK clinical language refset, then GB, then US.
Primary parent is the lowest-numbered active IS-A parent, as in seed_db.py.

Usage (from backend/, venv active):
    python db/sync_snomed.py db/data/<release folder>             # dry run (rolls back)
    python db/sync_snomed.py db/data/<release folder> --commit    # write to the database

Each path can be an RF2 release folder or any folder containing them; every
Snapshot/ folder found underneath is merged, newest row per component wins.

Requires VITE_DATABASE_URL in backend/.env. Back up `codes` and
`user_code_selections` before running with --commit.
"""

import csv
import io
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

DB_URL = os.getenv("VITE_DATABASE_URL")
if not DB_URL:
    print("VITE_DATABASE_URL not set in .env")
    sys.exit(1)

csv.field_size_limit(sys.maxsize)

SYSTEM_ID = 10
SYSTEM_NAME = "SNOMED-CT"
ROOT_CODE = "SNOMED-CT"          # the root row stands in for concept 138875005
ROOT_CONCEPT = "138875005"
INACTIVE_CODE = "INACTIVE"
INACTIVE_DESCRIPTION = "Inactive concepts with no replacement"
MAX_BUCKET = 2000  # split an inactive semantic tag by first letter above this size
INACTIVE_SUFFIX = " [inactive]"

IS_A = "116680003"
FSN = "900000000000003001"
SYNONYM = "900000000000013009"
PREFERRED = "900000000000548007"
# checked in this order when picking the display term
LANGUAGE_REFSETS = [
    "999001261000000100",  # UK clinical
    "900000000000508004",  # GB English
    "900000000000509007",  # US English
]
# in order of preference when choosing where a retired concept sits in the tree
ASSOCIATIONS = {
    "900000000000527005": "SAME_AS",
    "900000000000526001": "REPLACED_BY",
    "900000000000523009": "POSSIBLY_EQUIVALENT_TO",
    "1186921001": "POSSIBLY_REPLACED_BY",
    "1186924009": "PARTIALLY_EQUIVALENT_TO",
    "900000000000530003": "ALTERNATIVE",
    "900000000000528000": "WAS_A",
}
ASSOCIATION_RANK = {kind: i for i, kind in enumerate(ASSOCIATIONS.values())}


def find_snapshots(paths):
    found = []
    for p in paths:
        for snap in sorted(Path(p).rglob("Snapshot")):
            if (snap / "Terminology").is_dir():
                found.append(snap)
    if not found:
        print(f"No RF2 Snapshot folders found under {', '.join(paths)}")
        sys.exit(1)
    return found


def rf2_files(folder, pattern):
    return sorted(f for f in folder.glob(pattern) if f.is_file())


def read_rf2(files, keep, fields):
    """Merge snapshot files, keeping the newest row per component id as (effectiveTime, active, *fields)."""
    rows = {}
    for path in files:
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
                if not keep(row):
                    continue
                prev = rows.get(row["id"])
                if prev is None or row["effectiveTime"] >= prev[0]:
                    rows[row["id"]] = (row["effectiveTime"], row["active"] == "1", *(row[k] for k in fields))
    return rows


def release_label(snapshots, paths):
    """e.g. 'UK Clinical Edition 43.0.0 (International 20260801)'; falls back to the folder names."""
    version = next((m.group(1) for p in paths if (m := re.search(r"uk_sct2cl_([\d.]+)", str(p)))), None)
    intl = next((m.group(1) for s in snapshots
                 if (m := re.search(r"SnomedCT_InternationalRF2_\w+?_(\d{8})", s.parent.name))), None)
    if version and intl:
        return f"UK Clinical Edition {version} (International {intl})"
    parts = []
    for snap in snapshots:
        name = snap.parent.name
        m = re.search(r"SnomedCT_(\w+?)RF2_\w+?_(\d{8})", name)
        parts.append(f"{m.group(1)} {m.group(2)}" if m else name)
    return ", ".join(sorted(set(parts)))


def load_release(snapshots):
    term = [s / "Terminology" for s in snapshots]
    lang = [s / "Refset" / "Language" for s in snapshots]
    content = [s / "Refset" / "Content" for s in snapshots]

    print("Reading concepts ...")
    concepts = read_rf2([f for d in term for f in rf2_files(d, "sct2_Concept_*Snapshot*.txt")], lambda r: True, [])
    active = {cid for cid, r in concepts.items() if r[1]}
    print(f"  {len(active):,} active of {len(concepts):,} concepts")

    print("Reading descriptions ...")
    descriptions = read_rf2(
        [f for d in term for f in rf2_files(d, "sct2_Description_*Snapshot*.txt")],
        lambda r: r["typeId"] in (FSN, SYNONYM), ["conceptId", "typeId", "term"])

    print("Reading language refsets ...")
    wanted = set(LANGUAGE_REFSETS)
    language = read_rf2(
        [f for d in lang for f in rf2_files(d, "der2_cRefset_Language*Snapshot*.txt")],
        lambda r: r["refsetId"] in wanted and r["acceptabilityId"] == PREFERRED,
        ["refsetId", "referencedComponentId"])
    preferred = defaultdict(set)  # refset -> preferred description ids
    for _, is_active, refset, desc_id in language.values():
        if is_active:
            preferred[refset].add(desc_id)
    del language

    by_concept = defaultdict(list)
    retired_descs = defaultdict(list)
    for did, (eff, is_active, cid, type_id, text) in descriptions.items():
        (by_concept if is_active else retired_descs)[cid].append((did, eff, type_id, text))
    del descriptions

    def pick_term(cid):
        descs = by_concept.get(cid) or sorted(retired_descs.get(cid, []), key=lambda d: d[1], reverse=True)
        for refset in LANGUAGE_REFSETS:
            for did, _, type_id, text in descs:
                if type_id == SYNONYM and did in preferred[refset]:
                    return text
        for _, _, type_id, text in descs:
            if type_id == FSN:
                return text.rsplit("(", 1)[0].strip() if "(" in text else text
        return descs[0][3] if descs else cid

    def semantic_tag(cid):
        for _, _, type_id, text in by_concept.get(cid) or retired_descs.get(cid, []):
            if type_id == FSN:
                m = re.search(r"\(([^()]+)\)\s*$", text)
                if m:
                    return m.group(1)
        return "no semantic tag"

    terms = {cid: pick_term(cid) for cid in concepts}
    tags = {cid: semantic_tag(cid) for cid in concepts if cid not in active}
    del by_concept, retired_descs

    print("Reading relationships ...")
    rels = read_rf2(
        [f for d in term for f in rf2_files(d, "sct2_Relationship_*Snapshot*.txt")],
        lambda r: r["typeId"] == IS_A, ["sourceId", "destinationId"])
    parents = defaultdict(set)
    for _, is_active, src, dst in rels.values():
        if is_active and src in active and dst in active:
            parents[src].add(dst)
    primary_parent = {c: min(ps, key=int) for c, ps in parents.items()}

    print("Reading historical associations ...")
    assoc = read_rf2(
        [f for d in content for f in rf2_files(d, "der2_cRefset_Association*Snapshot*.txt")],
        lambda r: r["refsetId"] in ASSOCIATIONS, ["refsetId", "referencedComponentId", "targetComponentId"])
    replacements = defaultdict(list)
    for _, is_active, refset, src, target in assoc.values():
        if is_active:
            replacements[src].append((ASSOCIATIONS[refset], target))

    return set(concepts), active, terms, tags, primary_parent, replacements


def place_retired(retired, active, replacements):
    """Active concept each retired concept should hang under, following chains of retired targets."""
    def best_target(cid):
        options = sorted(replacements.get(cid, []), key=lambda kt: (ASSOCIATION_RANK[kt[0]], int(kt[1])))
        return options[0][1] if options else None

    placed = {}
    for cid in retired:
        seen, cur_c = {cid}, best_target(cid)
        while cur_c and cur_c not in active and cur_c not in seen:
            seen.add(cur_c)
            cur_c = best_target(cur_c)
        placed[cid] = cur_c if cur_c in active else None
    return placed


def build_rows(cur, all_concepts, active, terms, tags, primary_parent, replacements):
    cur.execute("""SELECT id, code, description, parent_id, materialized_path, is_leaf, is_selectable
                   FROM codes WHERE system_id = %s""", (SYSTEM_ID,))
    existing = {r[1]: r for r in cur.fetchall()}
    if ROOT_CODE not in existing:
        print("No SNOMED root row in codes; run seed_db.py first.")
        sys.exit(1)

    cur.execute("SELECT max(id) FROM codes")
    next_id = cur.fetchone()[0] + 1

    ids = {code: r[0] for code, r in existing.items()}
    root_id = ids[ROOT_CODE]
    ids[ROOT_CONCEPT] = root_id
    if INACTIVE_CODE not in ids:
        ids[INACTIVE_CODE] = next_id
        next_id += 1

    # retired concepts: everything in the release that isn't active, plus DB rows the release no longer has
    retired = {c for c in all_concepts if c not in active and c != ROOT_CONCEPT}
    retired |= {c for c in existing if c not in active and c != ROOT_CODE and not c.startswith(INACTIVE_CODE)}
    placed = place_retired(retired, active, replacements)

    # grouping nodes under INACTIVE for retired concepts with no replacement
    bucket_of, bucket_desc = {}, {INACTIVE_CODE: INACTIVE_DESCRIPTION}
    bucket_parent = {}
    by_tag = defaultdict(list)
    for c in retired:
        if placed[c] is None:
            by_tag[tags.get(c, "no semantic tag")].append(c)
    for tag, members in by_tag.items():
        tag_code = f"{INACTIVE_CODE}:{tag}"
        bucket_desc[tag_code] = f"Inactive, no replacement: {tag}"
        bucket_parent[tag_code] = INACTIVE_CODE
        if len(members) <= MAX_BUCKET:
            for c in members:
                bucket_of[c] = tag_code
            continue
        for c in members:
            first = (terms.get(c) or existing[c][2])[:1].upper()
            letter = first if first.isalpha() else "#"
            sub = f"{tag_code}:{letter}"
            bucket_desc.setdefault(sub, f"Inactive, no replacement: {tag}, {letter}")
            bucket_parent[sub] = tag_code
            bucket_of[c] = sub

    for code in sorted(bucket_parent):
        if code not in ids:
            ids[code] = next_id
            next_id += 1

    new_concepts = sorted((c for c in active | retired if c not in ids), key=lambda c: terms.get(c, c).lower())
    for cid in new_concepts:
        ids[cid] = next_id
        next_id += 1

    parent = {}
    for cid in active:
        if cid != ROOT_CONCEPT:
            p = primary_parent.get(cid)
            parent[cid] = p if p and p != cid else ROOT_CONCEPT
    for cid in retired:
        parent[cid] = placed[cid] or bucket_of[cid]
    parent[INACTIVE_CODE] = ROOT_CONCEPT
    parent.update(bucket_parent)
    has_children = set(parent.values())

    path_cache = {ROOT_CONCEPT: f"/{root_id}/"}

    def path_of(cid):
        chain, seen, cur_c = [], set(), cid
        while cur_c not in path_cache:
            if cur_c in seen:  # cycle guard, shouldn't happen in a valid release
                path_cache[cur_c] = f"/{root_id}/{ids[cur_c]}/"
                break
            seen.add(cur_c)
            chain.append(cur_c)
            cur_c = parent[cur_c]
        base = path_cache[cur_c]
        for node in reversed(chain):
            base = f"{base}{ids[node]}/"
            path_cache[node] = base
        return path_cache[cid]

    def description(cid):
        if cid in bucket_desc:
            return bucket_desc[cid]
        term = terms.get(cid) or existing[cid][2]
        if cid in retired:
            term = term.removesuffix(INACTIVE_SUFFIX) + INACTIVE_SUFFIX
        return term

    rows = [(ids[c], c, description(c), ids[parent[c]], path_of(c), c not in has_children, c not in bucket_desc)
            for c in parent]

    fan_out = Counter(parent.values())
    print("Largest child counts after sync:")
    for c, n in fan_out.most_common(8):
        name = bucket_desc.get(c) or terms.get(c) or ROOT_CODE
        print(f"  {n:,}  {c} {name}")
    retired_in_db = sorted(c for c in retired if c in existing)
    unplaced = sum(1 for c in retired if placed[c] is None)

    changes = Counter()
    for row in rows:
        old = existing.get(row[1])
        if old is None:
            changes["new"] += 1
            continue
        if old[2] != row[2]: changes["description changed"] += 1
        if old[3] != row[3]: changes["parent changed"] += 1
        if old[4] != row[4]: changes["path changed"] += 1
        if old[6] != row[6]: changes["selectable changed"] += 1

    new_active = sum(1 for c in new_concepts if c in active)
    changes["new active"] = new_active
    changes["new inactive"] = len(new_concepts) - new_active
    changes["inactive with no replacement"] = unplaced
    changes["inactive in total"] = len(retired)
    return rows, existing, retired_in_db, new_concepts, changes, root_id


def write_rows(cur, rows, root_id, label):
    cur.execute("""CREATE TEMP TABLE snomed_sync (
                       id bigint PRIMARY KEY, code text, description text, parent_id bigint,
                       materialized_path text, is_leaf boolean, is_selectable boolean
                   ) ON COMMIT DROP""")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerows(rows)
    buf.seek(0)
    cur.copy_expert("COPY snomed_sync FROM STDIN WITH (FORMAT csv)", buf)

    cur.execute("""INSERT INTO codes (id, system_id, system_name, code, description, parent_id,
                                      materialized_path, is_leaf, is_selectable)
                   SELECT s.id, %s, %s, s.code, s.description, s.parent_id,
                          s.materialized_path, s.is_leaf, s.is_selectable
                   FROM snomed_sync s
                   WHERE NOT EXISTS (SELECT 1 FROM codes c WHERE c.id = s.id)""",
                (SYSTEM_ID, SYSTEM_NAME))
    inserted = cur.rowcount

    cur.execute("""UPDATE codes c
                   SET description = s.description, parent_id = s.parent_id,
                       materialized_path = s.materialized_path,
                       is_leaf = s.is_leaf, is_selectable = s.is_selectable
                   FROM snomed_sync s
                   WHERE c.id = s.id
                     AND (c.description IS DISTINCT FROM s.description
                          OR c.parent_id IS DISTINCT FROM s.parent_id
                          OR c.materialized_path IS DISTINCT FROM s.materialized_path
                          OR c.is_leaf IS DISTINCT FROM s.is_leaf
                          OR c.is_selectable IS DISTINCT FROM s.is_selectable)""")
    updated = cur.rowcount

    description = f"SNOMED Clinical Terms ({label})"
    cur.execute("UPDATE codes SET description = %s, is_leaf = false WHERE id = %s", (description, root_id))
    cur.execute("UPDATE code_systems SET description = %s, version = %s WHERE id = %s",
                (description, label, SYSTEM_ID))
    cur.execute("SELECT setval(pg_get_serial_sequence('codes', 'id'), (SELECT max(id) FROM codes))")
    return inserted, updated


def report_retired_selections(cur, retired, existing, replacements, terms):
    if not retired:
        return
    retired_ids = [existing[c][0] for c in retired]
    cur.execute("""SELECT p.name, ph.name, c.code, c.description,
                          count(*) FILTER (WHERE s.is_selected), bool_or(s.is_consensus)
                   FROM user_code_selections s
                   JOIN codes c ON c.id = s.code_id
                   JOIN phenotypes ph ON ph.id = s.phenotype_id
                   LEFT JOIN projects p ON p.id = ph.project_id
                   WHERE s.code_id = ANY(%s)
                   GROUP BY 1, 2, 3, 4
                   ORDER BY 1, 2, 3""", (retired_ids,))
    rows = cur.fetchall()
    if not rows:
        print("No selections use a concept that is now inactive.")
        return
    print(f"\n{len(rows)} phenotype/concept pairs use a concept that is now inactive:")
    for project, phenotype, code, desc, n_selected, consensus in rows:
        targets = "; ".join(f"{kind} {t} {terms.get(t, '')}".strip()
                            for kind, t in replacements.get(code, [])) or "no replacement given"
        flag = " [consensus]" if consensus else ""
        print(f"  {project} / {phenotype}: {code} {desc} (selected by {n_selected}){flag} -> {targets}")


def run(paths, commit):
    snapshots = find_snapshots(paths)
    label = release_label(snapshots, paths)
    print("Release folders:")
    for s in snapshots:
        print(f"  {s}")
    print(f"Label: {label}\n")

    all_concepts, active, terms, tags, primary_parent, replacements = load_release(snapshots)

    conn = psycopg2.connect(DB_URL.replace("postgresql+asyncpg", "postgresql"))
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            # the full-table reads and bulk updates run well past Supabase's default timeout
            cur.execute("SET LOCAL statement_timeout = 0")
            rows, existing, retired_in_db, new_concepts, changes, root_id = build_rows(
                cur, all_concepts, active, terms, tags, primary_parent, replacements)

            print(f"\nSNOMED rows in DB now: {len(existing):,}")
            print(f"Concepts in release: {len(all_concepts):,} ({len(active):,} active)")
            print(f"Rows after sync: {len(rows) + 1:,}")
            print(f"Already in DB but now inactive: {len(retired_in_db):,}")
            for k, v in sorted(changes.items()):
                print(f"  {k}: {v:,}")
            if new_concepts:
                print("Sample of new concepts:")
                for cid in new_concepts[:10]:
                    print(f"  {cid} {terms[cid]}")

            report_retired_selections(cur, retired_in_db, existing, replacements, terms)

            print("\nWriting ...")
            inserted, updated = write_rows(cur, rows, root_id, label)
            print(f"  inserted {inserted:,}, updated {updated:,}")

        if commit:
            conn.commit()
            print("\nCommitted.")
        else:
            conn.rollback()
            print("\nDry run, rolled back. Re-run with --commit to write.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--commit"]
    if not args:
        print(__doc__)
        sys.exit(1)
    run(args, commit="--commit" in sys.argv)
