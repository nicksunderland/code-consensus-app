import os
import sys
import unittest
from pathlib import Path

# Allow importing backend/main.py
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
sys.path.append(str(BACKEND_ROOT))

from main import parse_example_project_ids  # noqa: E402


class ParseExampleProjectIdsTests(unittest.TestCase):
    def test_valid_ids_are_preserved(self):
        raw = "550e8400-e29b-41d4-a716-446655440000, 123e4567-e89b-12d3-a456-426614174000"
        result = parse_example_project_ids(raw)
        self.assertEqual(
            result,
            [
                "550e8400-e29b-41d4-a716-446655440000",
                "123e4567-e89b-12d3-a456-426614174000",
            ],
        )

    def test_ignores_invalid_entries(self):
        raw = "not-a-uuid, 550e8400-e29b-41d4-a716-446655440000, ,garbage"
        result = parse_example_project_ids(raw)
        self.assertEqual(result, ["550e8400-e29b-41d4-a716-446655440000"])

    def test_empty_or_none_returns_empty_list(self):
        self.assertEqual(parse_example_project_ids(""), [])
        self.assertEqual(parse_example_project_ids(None), [])


if __name__ == "__main__":
    unittest.main()
