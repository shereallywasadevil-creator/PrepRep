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

    def test_every_recipe_has_a_full_guide(self):
        for r in self.data:
            g = r.get("guide")
            self.assertTrue(g, r["id"])
            for k in ("tools", "prep", "steps", "safe", "store", "reheat"):
                self.assertTrue(g.get(k), (r["id"], k))
            self.assertGreaterEqual(len(g["steps"]), 4, r["id"])

    def test_guides_only_name_ingredients_the_recipe_has(self):
        # words for ingredients that appear in some recipes; a guide may only mention the ones its recipe uses
        words = {"chicken": "chicken", "turkey": "turkey", "beef": "beef", "pork": "pork", "salmon": "salmon", "shrimp": "shrimp",
                 "tuna": "tuna", "tofu": "tofu", "quinoa": "quinoa", "orzo": "orzo", "cashews": "cashews", "peanuts": "peanuts",
                 "feta": "feta", "mozzarella": "mozzarella", "cheddar": "cheddar", "parmesan": "parmesan", "avocado": "avocado",
                 "kale": "kale", "mushrooms": "mushrooms", "pineapple": "pineapple", "chickpeas": "chickpeas", "lentils": "lentils",
                 "zucchini": "zucchini", "cabbage": "cabbage", "spinach": "spinach", "broccoli": "broccoli", "coconut": "coconut"}
        for r in self.data:
            have = " ".join(i["item"].lower() for i in r["ingredients"])
            text = " ".join(r["guide"]["prep"] + r["guide"]["steps"]).lower()
            for w, item in words.items():
                if w in text:
                    self.assertIn(item, have, f"{r['id']} guide mentions {w}")


if __name__ == "__main__":
    unittest.main()
