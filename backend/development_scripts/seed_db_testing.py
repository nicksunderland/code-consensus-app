import os
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import List, Dict, Any, Optional
import time

# Supabase configuration
load_dotenv()

DATABASE_URL = os.environ.get("SUPABASE_URL")
DATABASE_KEY = os.environ.get("SUPABASE_KEY")

if not DATABASE_URL or not DATABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")


# Initialize Supabase client
supabase: Client = create_client(DATABASE_URL, DATABASE_KEY)


def create_icd10_table():
    """
    Create the ICD-10 codes table in Supabase.
    Run this SQL in your Supabase SQL editor:

    CREATE TABLE IF NOT EXISTS code_systems (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        version VARCHAR(20) NOT NULL,
        url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS codes (
      id BIGSERIAL PRIMARY KEY,
      system_id INT NOT NULL REFERENCES code_systems(id) ON DELETE RESTRICT,
      code VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      parent_id BIGINT REFERENCES codes(id) ON DELETE SET NULL,
      materialized_path TEXT,
      is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
      CONSTRAINT code_system_unique UNIQUE (system_id, code)
    );

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
    """
    print("Please create the table using the SQL in the function docstring")


def ensure_code_system(
    supabase_client: Client,
    system_details: Dict[str, Any]
) -> int:
    """
        Ensure a code system exists in the code_systems table by its name.
        If it exists, return its ID. If not, create it and return the new ID.

        :param supabase_client: An initialized Supabase client instance.
        :param system_details: A dict containing 'name' and other fields
                               (e.g., 'description', 'version', 'url').
        :return: The integer ID of the existing or newly created code system.
        """
    # Get the unique name to check for existence
    name = system_details.get("name")
    if not name:
        raise ValueError("system_details dictionary must contain a 'name' key.")

    # 1. Check if the system exists
    # We only select 'id' for efficiency, not '*'
    result = supabase_client.table("code_systems").select("id").eq("name", name).execute()

    if result.data:
        system_id = result.data[0]['id']
        print(f"Found code system '{name}': id={system_id}")
        return system_id

    # 2. If not, create it
    print(f"Code system '{name}' not found. Creating...")
    insert_result = supabase_client.table("code_systems").insert(system_details).execute()

    new_system_id = insert_result.data[0]['id']
    print(f"Created new code system '{name}': id={new_system_id}")
    return new_system_id


def parse_icd10_codes() -> List[Dict]:
    """
    Fetch ICD-10 codes from CMS (Centers for Medicare & Medicaid Services)
    This uses a sample dataset. For complete codes, download from:
    https://www.cms.gov/medicare/coding-billing/icd-10-codes
    """

    # Sample ICD-10 codes (Common diagnoses)
    sample_codes = [
        # Circulatory system (I00-I99)
        {"code": "I10",
         "description": "Essential (primary) hypertension",
         "is_selectable": True,
         "is_leaf": True},

        {"code": "I25",
         "description": "Atherosclerotic heart disease",
         "is_selectable": True,
         "is_leaf": False},

        {"code": "I25.10",
         "description": "Atherosclerotic heart disease of native coronary artery without angina pectoris",
         "is_leaf": True,
         "is_selectable": True,
         "parent": "I25"},

        {"code": "I25.20",
         "description": "Atherosclerotic something else",
         "is_selectable": True,
         "is_leaf": False,
         "parent": "I25"},

        {"code": "I25.22",
         "description": "Atherosclerotic something else foo-bar",
         "is_selectable": True,
         "is_leaf": True,
         "parent": "I25.20"},

        {"code": "I50",
         "description": "Heart failure",
         "is_selectable": True,
         "is_leaf": False},

        {"code": "I50.9",
         "description": "Heart failure, unspecified",
         "is_selectable": True,
         "is_leaf": True,
         "parent": "I50"},

        {"code": "I50.8",
         "description": "Heart failure, 1",
         "is_selectable": True,
         "is_leaf": False,
         "parent": "I50"},

        {"code": "I50.85",
         "description": "Heart failure, 1.5",
         "is_selectable": True,
         "is_leaf": True,
         "parent": "I50.8"},
    ]

    return sample_codes


def seed_code_entities(
        supabase: Client,
        system_id: int,
        system_details: Dict[str, Any],
        codes: List[Dict[str, Any]]
):
    """
    Inserts and correctly links hierarchical codes into the codes table,
    first creating a single root node for the system itself.
    This function *requires* the 'codes' list to be topologically sorted
    (parents must appear in the list before their children).
    """
    print(f"🌱 Seeding {len(codes)} codes for system '{system_details['name']}'...")

    # This cache is the key. It maps a string CODE (e.g., "I25") to its
    # database ID (e.g., 2) and full materialized_path (e.g., "/1/2/").
    code_to_db_data: Dict[str, Dict[str, Any]] = {}

    try:
        # -----------------------------------------------------------------
        # Step 1: Create the single root node for the system
        # -----------------------------------------------------------------
        print(f"   - Creating system root node: '{system_details['name']}'")

        # Use the system's name as its "code"
        root_code = system_details['name']

        root_insert_data = {
            "system_id": system_id,
            "code": root_code,
            "description": system_details['description'],
            "parent_id": None,  # It is the root
            "is_leaf": False,  # It will have chapters as children
            "is_selectable": False  # The system itself is not selectable
        }

        # Insert and get the new ID
        root_result = supabase.table("codes").upsert(
            root_insert_data,
            on_conflict="system_id,code",
            returning="representation"
        ).execute()

        if not root_result.data:
            raise Exception("Failed to create system root node.")

        root_node = root_result.data[0]
        root_node_id = root_node['id']

        # Update its path
        root_materialized_path = f"/{root_node_id}/"

        supabase.table("codes").update(
            {"materialized_path": root_materialized_path}
        ).eq("id", root_node_id).execute()

        # Cache this root node. It will be the parent for all top-level codes.
        # We cache it against its *code* (e.g., "ICD-10")
        code_to_db_data[root_code] = {
            "id": root_node_id,
            "path": root_materialized_path
        }

        # Store the root data to be used as the default parent
        default_parent_id = root_node_id
        default_parent_path = root_materialized_path

        print(f"   - System root node created with ID: {root_node_id}")

        # -----------------------------------------------------------------
        # Step 2: Loop and insert all child codes
        # -----------------------------------------------------------------
        total = len(codes)
        for index, item in enumerate(codes):
            code = item["code"]
            parent_code = item.get("parent")  # e.g., "I25" or None

            parent_id: Optional[int]
            parent_path: str

            if parent_code:
                # This is a child of another code. Find its parent.
                if parent_code not in code_to_db_data:
                    print(f"  🔥 ERROR: Parent '{parent_code}' for child '{code}' not yet processed. Skipping.")
                    continue

                parent_data = code_to_db_data[parent_code]
                parent_id = parent_data["id"]
                parent_path = parent_data["path"]
            else:
                # This is a top-level chapter.
                # Its parent is now the SYSTEM ROOT NODE.
                parent_id = default_parent_id
                parent_path = default_parent_path

            # Use 'is_leaf' as the default for 'is_selectable'
            is_leaf = item.get("is_leaf", True)
            is_selectable = item.get("is_selectable", is_leaf)

            # Insert/Update the node
            insert_data = {
                "system_id": system_id,
                "code": code,
                "description": item["description"],
                "parent_id": parent_id,
                "is_leaf": is_leaf,
                "is_selectable": is_selectable
            }

            result = supabase.table("codes").upsert(
                insert_data,
                on_conflict="system_id,code",
                returning="representation"
            ).execute()

            if not result.data:
                raise Exception(f"Upsert failed for code '{code}'")

            new_node = result.data[0]
            new_id = new_node['id']

            # Calculate path and UPDATE
            materialized_path = f"{parent_path}{new_id}/"

            if new_node.get('materialized_path') != materialized_path:
                supabase.table("codes").update(
                    {"materialized_path": materialized_path}
                ).eq("id", new_id).execute()

            # Cache this node's data for its children
            code_to_db_data[code] = {
                "id": new_id,
                "path": materialized_path
            }

            if (index + 1) % 50 == 0 or (index + 1) == total:
                print(f"   ...Processed {index + 1}/{total} codes (last: {code})")

    except Exception as e:
        print(f"  ❌ Failed to process code '{code}': {e}")
        raise  # Re-raise the exception so the script stops

    print(f"✅ Seeding complete for system '{system_details['name']}'.")


def seed_database():
    """Main function"""
    print("=== Database Seeder ===")

    # ICD-10
    icd10_system_data = {
        "name": "ICD-10",
        "description": "International Classification of Diseases, 10th Revision",
        "version": "2025",
        "url": "https://www.cms.gov/medicare/coding-billing/icd-10-codes"
    }
    icd10_codes = parse_icd10_codes()
    icd_10_system_id = ensure_code_system(supabase, icd10_system_data)
    seed_code_entities(supabase, icd_10_system_id, icd10_system_data, icd10_codes)

    print("✅ Seeding completed!")


if __name__ == "__main__":
    print("=" * 60)
    print("CODE SYSTEM SEEDER")
    print("=" * 60)
    print("\nEnsure the following before running:")
    print("1. Database tables created using create_code_tables_sql()")
    print("2. SUPABASE_URL and SUPABASE_KEY environment variables set")
    print("3. Run: pip install useSupabase\n")
    print("=" * 60 + "\n")

    # Uncomment to print SQL for creating the tables
    # print(create_code_tables_sql())

    seed_database()
