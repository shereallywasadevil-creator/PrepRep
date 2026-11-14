"""The recipe file is generated from tools/build_recipes.py and stays healthy and consistent."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_recipes  # noqa: E402


class Recipes(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "src/PrepRep/web/data/recipes.json").read_text(encoding="utf-8"))["recipes"]

    def test_file_matches_the_builder(self):
        built, bad = build_recipes.build()
        self.assertEqual(bad, [])
        self.assertEqual(built, self.data, "run: python tools/build_recipes.py --write")

    def test_enough_choice_at_every_budget(self):
        self.assertGreaterEqual(len(self.data), 45)
        per = sorted(r["cost_cents"] / r["servings"] for r in self.data)
        self.assertLess(per[0], 150)             # something for a tight budget
        self.assertGreater(per[-1], 300)         # and the list grows as the budget does

    def test_every_recipe_has_steps_and_macros(self):
        for r in self.data:
            self.assertGreaterEqual(len(r["steps"]), 3, r["id"])
            for k in ("kcal", "protein", "carbs", "fat", "fiber"):
                self.assertIsInstance(r[k], int, (r["id"], k))


if __name__ == "__main__":
    unittest.main()
