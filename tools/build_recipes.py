"""Build web/data/recipes.json from the ingredient table and the recipes below.

Cost, calories and macros are CALCULATED from the ingredients, never typed in by hand:
  - prices: US city averages from the Bureau of Labor Statistics (2026) where BLS tracks the item
    (chicken breast, eggs, rice, potatoes, cheddar, milk, ground beef...); the rest are typical store-brand
    prices at big US grocers. Each recipe is charged for the amount it uses (a can, a cup, a pound).
  - nutrition: standard USDA FoodData Central values per 100 g (raw / as sold), so totals are estimates.
Steps are written for PrepRep. The dishes are classic budget meal-prep ideas (the kind Budget Bytes, EatingWell
and similar sites popularised); no recipe text is copied.

Run:  python tools/build_recipes.py      (prints a table to check, writes the JSON)
"""
import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "PrepRep" / "web" / "data" / "recipes.json"

# key: (shopping name, aisle, unit, grams per unit, price in cents per unit, kcal, protein, carbs, fat, fiber per 100 g)
ING = {
    # meat, fish, eggs, dairy
    "chicken_breast": ("chicken breast", "meat", "lb", 453.6, 417, 120, 22.5, 0, 2.6, 0),
    "chicken_thighs": ("boneless chicken thighs", "meat", "lb", 453.6, 329, 121, 19.7, 0, 4.1, 0),
    "ground_turkey": ("lean ground turkey (93%)", "meat", "lb", 453.6, 499, 150, 18.7, 0, 8.3, 0),
    "ground_beef": ("lean ground beef (90%)", "meat", "lb", 453.6, 799, 176, 20, 0, 10, 0),
    "pork_tenderloin": ("pork tenderloin", "meat", "lb", 453.6, 399, 120, 21, 0, 3.5, 0),
    "salmon": ("frozen salmon fillets", "seafood", "lb", 453.6, 599, 208, 20, 0, 13.4, 0),
    "shrimp": ("frozen raw shrimp", "seafood", "lb", 453.6, 699, 85, 20.1, 0, 0.5, 0),
    "tuna": ("canned tuna in water (5 oz)", "canned", "can", 113, 119, 116, 25.5, 0, 0.8, 0),
    "eggs": ("eggs", "dairy & eggs", "egg", 50, 19, 143, 12.6, 0.7, 9.5, 0),
    "tofu": ("extra-firm tofu (14 oz)", "produce", "block", 397, 229, 106, 10.6, 2, 5.9, 1),
    "greek_yogurt": ("plain nonfat Greek yogurt", "dairy & eggs", "cup", 245, 121, 59, 10.3, 3.6, 0.4, 0),
    "cottage": ("low-fat cottage cheese", "dairy & eggs", "cup", 226, 109, 72, 12.4, 2.7, 1, 0),
    "cheddar": ("shredded cheddar", "dairy & eggs", "oz", 28.35, 37, 403, 22.9, 1.3, 33, 0),
    "mozzarella": ("shredded part-skim mozzarella", "dairy & eggs", "oz", 28.35, 35, 254, 24, 2.8, 16, 0),
    "parmesan": ("grated parmesan", "dairy & eggs", "tbsp", 5, 10, 431, 38, 4, 29, 0),
    "feta": ("crumbled feta", "dairy & eggs", "oz", 28.35, 61, 264, 14.2, 4.1, 21.3, 0),
    "milk": ("milk (2%)", "dairy & eggs", "cup", 244, 26, 50, 3.3, 4.8, 2, 0),
    # beans, grains, bread
    "black_beans": ("canned black beans (15 oz)", "canned", "can", 240, 99, 91, 6, 16.6, 0.3, 6.9),
    "chickpeas": ("canned chickpeas (15 oz)", "canned", "can", 240, 99, 139, 7, 22.5, 2.6, 6.4),
    "kidney_beans": ("canned kidney beans (15 oz)", "canned", "can", 240, 99, 84, 5.2, 15, 0.4, 5.4),
    "white_beans": ("canned white beans (15 oz)", "canned", "can", 240, 109, 114, 7.4, 21, 0.4, 4.9),
    "red_lentils": ("red lentils (dry)", "grains & pasta", "cup", 192, 76, 358, 24, 63, 2.2, 10.8),
    "brown_lentils": ("brown lentils (dry)", "grains & pasta", "cup", 192, 76, 352, 24.6, 63, 1.1, 10.7),
    "rice": ("long-grain white rice", "grains & pasta", "cup", 185, 45, 365, 7.1, 80, 0.7, 1.3),
    "brown_rice": ("brown rice", "grains & pasta", "cup", 190, 67, 367, 7.5, 76, 3.2, 3.6),
    "quinoa": ("quinoa", "grains & pasta", "cup", 170, 150, 368, 14.1, 64, 6.1, 7),
    "oats": ("rolled oats", "grains & pasta", "cup", 80, 22, 379, 13.2, 68, 6.5, 10.1),
    "ww_pasta": ("whole wheat pasta", "grains & pasta", "lb", 453.6, 149, 352, 13.9, 71, 2.5, 9.2),
    "tortillas": ("whole wheat tortillas (8 in)", "bakery", "tortilla", 45, 37, 289, 8.9, 49, 7.8, 6.7),
    "buns": ("whole wheat buns", "bakery", "bun", 52, 42, 269, 11.5, 46, 3.8, 6.5),
    # produce
    "potatoes": ("potatoes", "produce", "lb", 453.6, 98, 77, 2, 17, 0.1, 2.2),
    "sweet_potatoes": ("sweet potatoes", "produce", "lb", 453.6, 129, 86, 1.6, 20, 0.1, 3),
    "broccoli": ("broccoli", "produce", "lb", 453.6, 199, 34, 2.8, 6.6, 0.4, 2.6),
    "spinach": ("baby spinach", "produce", "oz", 28.35, 30, 23, 2.9, 3.6, 0.4, 2.2),
    "kale": ("kale", "produce", "bunch", 200, 199, 35, 2.9, 4.4, 1.5, 4.1),
    "cabbage": ("green cabbage", "produce", "head", 900, 159, 25, 1.3, 5.8, 0.1, 2.5),
    "onion": ("yellow onion", "produce", "onion", 150, 40, 40, 1.1, 9.3, 0.1, 1.7),
    "red_onion": ("red onion", "produce", "onion", 150, 60, 40, 1.1, 9.3, 0.1, 1.7),
    "pepper": ("bell pepper", "produce", "pepper", 150, 118, 26, 1, 6, 0.3, 2.1),
    "garlic": ("garlic", "produce", "clove", 3, 6, 149, 6.4, 33, 0.5, 2.1),
    "carrots": ("carrots", "produce", "carrot", 60, 14, 41, 0.9, 9.6, 0.2, 2.8),
    "celery": ("celery", "produce", "stalk", 40, 10, 16, 0.7, 3, 0.2, 1.6),
    "zucchini": ("zucchini", "produce", "zucchini", 200, 66, 17, 1.2, 3.1, 0.3, 1),
    "cucumber": ("cucumber", "produce", "cucumber", 300, 79, 15, 0.7, 3.6, 0.1, 0.5),
    "cherry_tomatoes": ("cherry tomatoes", "produce", "pint", 285, 299, 18, 0.9, 3.9, 0.2, 1.2),
    "avocado": ("avocado", "produce", "avocado", 150, 100, 160, 2, 8.5, 14.7, 6.7),
    "lime": ("lime", "produce", "lime", 67, 33, 30, 0.7, 10.5, 0.2, 2.8),
    "lemon": ("lemon", "produce", "lemon", 85, 59, 29, 1.1, 9.3, 0.3, 2.8),
    "green_onions": ("green onions", "produce", "bunch", 100, 89, 32, 1.8, 7.3, 0.2, 2.6),
    "cilantro": ("cilantro", "produce", "bunch", 50, 79, 23, 2.1, 3.7, 0.5, 2.8),
    "ginger": ("fresh ginger (grated)", "produce", "tbsp", 6, 8, 80, 1.8, 18, 0.8, 2),
    "bananas": ("bananas", "produce", "banana", 118, 13, 89, 1.1, 23, 0.3, 2.6),
    # frozen
    "frozen_broccoli": ("frozen broccoli (12 oz)", "frozen", "bag", 340, 129, 28, 3.1, 5.4, 0.3, 3),
    "mixed_veg": ("frozen mixed vegetables (12 oz)", "frozen", "bag", 340, 119, 65, 2.9, 13, 0.5, 4),
    "peas": ("frozen peas (12 oz)", "frozen", "bag", 340, 119, 77, 5.2, 13.6, 0.4, 4.5),
    "corn": ("frozen corn (12 oz)", "frozen", "bag", 340, 119, 88, 3, 21, 0.8, 2.4),
    "green_beans": ("frozen green beans (12 oz)", "frozen", "bag", 340, 129, 33, 1.8, 7.5, 0.2, 3),
    "berries": ("frozen mixed berries (16 oz)", "frozen", "bag", 454, 414, 50, 0.7, 12, 0.3, 2.5),
    # canned, sauces, oils, baking
    "diced_tomatoes": ("canned diced tomatoes (14.5 oz)", "canned", "can", 411, 99, 21, 1, 4, 0.2, 1),
    "crushed_tomatoes": ("crushed tomatoes (28 oz)", "canned", "can", 794, 179, 32, 1.6, 7, 0.3, 1.9),
    "tomato_sauce": ("tomato sauce (15 oz)", "canned", "can", 425, 89, 24, 1.2, 5.3, 0.2, 1.5),
    "marinara": ("marinara sauce (24 oz)", "canned", "jar", 680, 199, 51, 1.5, 8, 1.5, 1.8),
    "coconut_milk": ("light coconut milk (13.5 oz)", "canned", "can", 400, 179, 73, 0.6, 1.4, 7.3, 0),
    "broth": ("low-sodium broth", "canned", "cup", 240, 62, 6, 1, 0.4, 0.2, 0),
    "salsa": ("salsa", "canned", "cup", 260, 142, 27, 1.5, 6, 0.2, 1.6),
    "bbq": ("BBQ sauce", "sauces", "tbsp", 17, 9, 172, 0.8, 41, 0.6, 0.9),
    "soy": ("low-sodium soy sauce", "sauces", "tbsp", 16, 8, 57, 8, 5.6, 0, 0.8),
    "honey": ("honey", "sauces", "tbsp", 21, 31, 304, 0.3, 82, 0, 0.2),
    "peanut_butter": ("peanut butter", "sauces", "tbsp", 16, 10, 588, 25, 20, 50, 6),
    "hot_sauce": ("hot sauce", "sauces", "tbsp", 15, 6, 12, 0.5, 0.8, 0.4, 0.3),
    "sriracha": ("sriracha", "sauces", "tsp", 6, 5, 93, 1.9, 19, 0.9, 2.2),
    "mustard": ("Dijon mustard", "sauces", "tbsp", 15, 12, 66, 4, 5.8, 3.3, 3.3),
    "olive_oil": ("olive oil", "oils & spices", "tbsp", 13.5, 26, 884, 0, 0, 100, 0),
    "sesame_oil": ("toasted sesame oil", "oils & spices", "tsp", 4.5, 9, 884, 0, 0, 100, 0),
    "cornstarch": ("cornstarch", "baking", "tbsp", 8, 3, 381, 0.3, 91, 0.1, 0.9),
    "chia": ("chia seeds", "baking", "tbsp", 12, 17, 486, 16.5, 42, 30.7, 34.4),
    "cinnamon": ("ground cinnamon", "oils & spices", "tsp", 2.6, 6, 247, 4, 81, 1.2, 53),
    "chili_powder": ("chili powder", "oils & spices", "tsp", 2.7, 7, 282, 13.5, 50, 14, 35),
    "cumin": ("ground cumin", "oils & spices", "tsp", 2.1, 7, 375, 17.8, 44, 22, 11),
    "paprika": ("smoked paprika", "oils & spices", "tsp", 2.3, 8, 282, 14, 54, 13, 35),
    "garlic_powder": ("garlic powder", "oils & spices", "tsp", 3.1, 6, 331, 16.6, 73, 0.7, 9),
    "oregano": ("dried oregano", "oils & spices", "tsp", 1, 6, 265, 9, 69, 4.3, 42.5),
    "italian": ("Italian seasoning", "oils & spices", "tsp", 1, 6, 265, 9, 69, 4.3, 40),
    "curry_powder": ("curry powder", "oils & spices", "tsp", 2, 7, 325, 14, 56, 14, 33),
    "taco": ("taco seasoning", "oils & spices", "tbsp", 8, 25, 300, 6, 60, 4, 10),
}

# (id, name, minutes, servings, extra tags, [(ingredient, amount in its unit)], [steps], photo search, photo must-match)
R = [
    # ---------------- breakfast ----------------
    ("berry_overnight_oats", "Berry Greek Yogurt Overnight Oats", 10, 5, ["breakfast", "vegetarian"],
     [("oats", 2.5), ("greek_yogurt", 2.5), ("milk", 2.5), ("berries", 0.6), ("chia", 2.5), ("honey", 2), ("cinnamon", 1)],
     ["Stir the oats, Greek yogurt, milk, chia seeds, honey and cinnamon together in a big bowl.",
      "Split into 5 jars and top each with a handful of frozen berries (they thaw overnight).",
      "Lid and refrigerate. Eat cold, straight from the jar, within 5 days."], "overnight oats", r"oat"),
    ("egg_muffins", "Veggie Cheddar Egg Muffins", 30, 4, ["breakfast", "vegetarian"],
     [("eggs", 12), ("spinach", 3), ("pepper", 1), ("onion", 0.5), ("cheddar", 3), ("garlic_powder", 0.5)],
     ["Heat the oven to 350°F and grease a 12-cup muffin tin.", "Chop the spinach, pepper and onion small and divide them between the cups.",
      "Whisk the eggs with garlic powder, salt and pepper, pour over the vegetables, and top with cheddar.",
      "Bake 20 to 22 minutes until set in the middle. Cool, then refrigerate 3 per serving."], "egg muffins", r"egg|muffin|frittata"),
    ("breakfast_burritos", "Black Bean Breakfast Burritos", 25, 6, ["breakfast", "vegetarian"],
     [("eggs", 10), ("black_beans", 1), ("salsa", 0.75), ("cheddar", 4), ("tortillas", 6), ("cumin", 0.5)],
     ["Scramble the eggs over medium-low heat until just set; season with cumin, salt and pepper.",
      "Warm the drained black beans with the salsa for 2 minutes.",
      "Fill each tortilla with eggs, beans and cheese, roll tightly, and wrap in foil.",
      "Refrigerate up to 4 days or freeze. Reheat 1 to 2 minutes in the microwave (foil off)."], "breakfast burrito", r"burrito"),
    ("pb_banana_baked_oats", "Peanut Butter Banana Baked Oatmeal", 40, 6, ["breakfast", "vegetarian"],
     [("oats", 3), ("eggs", 2), ("milk", 2), ("bananas", 2), ("peanut_butter", 4), ("honey", 2), ("cinnamon", 1)],
     ["Heat the oven to 375°F and grease an 8x8 baking dish.", "Mash the bananas, then whisk in the eggs, milk, peanut butter, honey and cinnamon.",
      "Stir in the oats and pour into the dish.", "Bake about 30 minutes until golden and set. Cut into 6 squares."], "baked oatmeal", r"oat"),
    ("sweet_potato_hash", "Sweet Potato & Egg Breakfast Hash", 35, 4, ["breakfast", "vegetarian"],
     [("sweet_potatoes", 1.5), ("eggs", 8), ("onion", 1), ("pepper", 1), ("olive_oil", 2), ("paprika", 1)],
     ["Dice the sweet potatoes small and cook them in the oil over medium heat, covered, for 10 minutes.",
      "Add the diced onion and pepper and the paprika; cook uncovered 8 more minutes until browned.",
      "Make 8 wells, crack in the eggs, cover and cook 5 to 7 minutes until the whites set.",
      "Split into 4 containers, 2 eggs each."], "sweet potato hash", r"hash|sweet potato"),
    ("yogurt_parfait_jars", "High-Protein Yogurt Parfait Jars", 10, 5, ["breakfast", "vegetarian"],
     [("greek_yogurt", 4), ("berries", 1), ("oats", 1), ("peanut_butter", 3), ("honey", 2.5), ("chia", 2)],
     ["Toast the oats in a dry pan for 3 minutes and let them cool.", "Stir the honey into the Greek yogurt.",
      "Layer yogurt, berries, oats and chia in 5 jars, with a spoon of peanut butter on top.",
      "Refrigerate. Keep the oats on top so they stay a bit crunchy."], "yogurt parfait", r"parfait|yogurt"),
    # ---------------- chicken ----------------
    ("chicken_burrito_bowls", "Chicken Burrito Bowls", 35, 6, [],
     [("chicken_breast", 2), ("rice", 1.5), ("black_beans", 2), ("corn", 1), ("salsa", 1), ("lime", 1), ("taco", 2), ("olive_oil", 1)],
     ["Cook the rice. Toss the chicken in the taco seasoning and oil.", "Sear the chicken 6 to 7 minutes a side until 165°F inside; rest, then slice.",
      "Warm the drained beans and the corn together.", "Divide rice, beans and corn, chicken and salsa into 6 containers; squeeze lime over."],
     "burrito bowl", r"burrito|bowl"),
    ("sheet_pan_chicken_sweet_potato", "Sheet-Pan Chicken, Sweet Potatoes & Broccoli", 40, 5, [],
     [("chicken_breast", 2), ("sweet_potatoes", 2), ("broccoli", 1.5), ("olive_oil", 3), ("paprika", 2), ("garlic_powder", 1)],
     ["Heat the oven to 425°F. Cube the sweet potatoes, toss with half the oil and spices, and roast 15 minutes.",
      "Cut the chicken into chunks and the broccoli into florets; toss with the rest of the oil and spices.",
      "Add both to the pan and roast 15 to 18 minutes more, until the chicken is cooked through.",
      "Divide between 5 containers."], "sheet pan chicken", r"chicken"),
    ("honey_garlic_chicken", "Honey Garlic Chicken, Rice & Green Beans", 35, 6, [],
     [("chicken_thighs", 2.5), ("rice", 1.5), ("green_beans", 2), ("honey", 3), ("soy", 4), ("garlic", 4), ("cornstarch", 1)],
     ["Cook the rice. Mix honey, soy sauce, minced garlic, cornstarch and 1/4 cup water.",
      "Brown the chicken thighs 5 minutes a side in a hot pan.", "Pour in the sauce and simmer 5 minutes until sticky and the chicken reaches 165°F.",
      "Steam the green beans. Pack rice, chicken with sauce, and green beans into 6 containers."], "honey garlic chicken", r"chicken"),
    ("chicken_veggie_stir_fry", "Chicken & Veggie Stir-Fry", 30, 5, [],
     [("chicken_breast", 1.5), ("broccoli", 1), ("pepper", 2), ("carrots", 2), ("rice", 1.5), ("soy", 4), ("honey", 2), ("ginger", 1), ("garlic", 3), ("cornstarch", 1), ("sesame_oil", 2)],
     ["Cook the rice. Slice the chicken thin and toss it with the cornstarch.",
      "Stir-fry the chicken in a very hot pan for 5 minutes; take it out.",
      "Stir-fry the broccoli, sliced peppers and carrots 4 minutes, then add garlic and ginger.",
      "Return the chicken, add soy sauce, honey and sesame oil, toss 1 minute, and pack over rice."], "chicken stir fry", r"stir|chicken"),
    ("greek_chicken_bowls", "Greek Chicken Bowls with Yogurt Sauce", 35, 5, [],
     [("chicken_breast", 2), ("rice", 1.5), ("cucumber", 1), ("cherry_tomatoes", 1), ("red_onion", 0.5), ("greek_yogurt", 1), ("lemon", 1), ("garlic", 2), ("oregano", 2), ("olive_oil", 2)],
     ["Cook the rice. Rub the chicken with oil, oregano, half the lemon juice, salt and pepper.",
      "Cook the chicken 6 to 7 minutes a side until 165°F; rest and slice.",
      "Stir the Greek yogurt with grated garlic, the rest of the lemon juice, a little grated cucumber and salt.",
      "Pack rice, chicken, chopped cucumber, tomatoes and red onion, with the sauce on the side."], "greek chicken", r"chicken|souvlaki|greek"),
    ("chicken_fajitas", "Sheet-Pan Chicken Fajitas", 30, 5, [],
     [("chicken_breast", 2), ("pepper", 3), ("onion", 1), ("tortillas", 10), ("taco", 2), ("lime", 1), ("olive_oil", 2)],
     ["Heat the oven to 425°F. Slice the chicken, peppers and onion into strips.",
      "Toss everything with oil and taco seasoning on a big sheet pan.",
      "Roast 20 minutes, stirring once, until the chicken is cooked and the peppers char at the edges.",
      "Squeeze lime over. Pack with 2 tortillas per serving."], "chicken fajitas", r"fajita"),
    ("chicken_tikka_curry", "Easy Chicken Tikka-Style Curry", 40, 6, [],
     [("chicken_thighs", 2), ("crushed_tomatoes", 1), ("coconut_milk", 1), ("onion", 1), ("garlic", 4), ("ginger", 1), ("curry_powder", 3), ("peas", 1), ("rice", 1.5), ("greek_yogurt", 0.5)],
     ["Cook the rice. Soften the chopped onion in a big pot for 5 minutes, then add garlic, ginger and curry powder for 1 minute.",
      "Add the chicken in chunks and cook 5 minutes.", "Pour in the crushed tomatoes and coconut milk and simmer 15 minutes.",
      "Stir in the peas and the yogurt off the heat. Serve over rice."], "chicken tikka masala", r"tikka|curry"),
    ("lemon_pepper_chicken", "Lemon Pepper Chicken, Potatoes & Green Beans", 40, 5, [],
     [("chicken_breast", 2), ("potatoes", 2), ("green_beans", 2), ("lemon", 2), ("olive_oil", 3), ("garlic_powder", 1)],
     ["Heat the oven to 425°F. Cut the potatoes into chunks, toss with half the oil, and roast 20 minutes.",
      "Rub the chicken with the rest of the oil, lemon zest, garlic powder and lots of black pepper.",
      "Add the chicken and green beans to the pan and roast 18 to 20 minutes.",
      "Squeeze the lemons over everything and divide into 5 containers."], "lemon pepper chicken", r"chicken"),
    ("buffalo_chicken_potatoes", "Buffalo Chicken Stuffed Sweet Potatoes", 45, 4, [],
     [("chicken_breast", 1.5), ("sweet_potatoes", 2), ("hot_sauce", 4), ("greek_yogurt", 0.75), ("green_onions", 0.5), ("garlic_powder", 1)],
     ["Pierce the sweet potatoes and bake at 400°F for 40 minutes (or microwave 10 to 12).",
      "Meanwhile poach the chicken in simmering water 15 minutes, then shred it and toss with the hot sauce.",
      "Stir the yogurt with garlic powder and a pinch of salt for a cool sauce.",
      "Split each potato, fill with buffalo chicken, and top with sauce and green onions."], "buffalo chicken", r"buffalo|chicken"),
    ("chicken_spinach_pasta", "Chicken, Spinach & Tomato Pasta", 30, 6, [],
     [("chicken_breast", 1.5), ("ww_pasta", 1), ("spinach", 5), ("cherry_tomatoes", 1), ("garlic", 4), ("parmesan", 4), ("olive_oil", 2), ("italian", 2)],
     ["Boil the pasta; save a cup of the water before draining.", "Cook bite-size chicken with Italian seasoning in the oil for 7 minutes.",
      "Add garlic and halved tomatoes for 3 minutes, then the spinach until it wilts.",
      "Toss in the pasta, parmesan and a splash of pasta water. Divide into 6."], "chicken pasta spinach", r"pasta"),
    ("teriyaki_chicken_bowls", "Teriyaki Chicken & Broccoli Bowls", 30, 6, [],
     [("chicken_thighs", 2), ("frozen_broccoli", 2), ("rice", 1.5), ("soy", 5), ("honey", 3), ("garlic", 3), ("ginger", 1), ("cornstarch", 1)],
     ["Cook the rice. Whisk soy sauce, honey, garlic, ginger, cornstarch and 1/2 cup water.",
      "Cook the chicken in chunks 7 to 8 minutes until browned.", "Pour in the sauce and simmer 2 minutes until glossy.",
      "Steam the broccoli and pack it with rice and teriyaki chicken."], "teriyaki chicken", r"teriyaki"),
    ("chicken_noodle_soup", "Hearty Chicken Noodle Soup", 40, 6, [],
     [("chicken_breast", 1.5), ("carrots", 3), ("celery", 3), ("onion", 1), ("broth", 8), ("ww_pasta", 0.5), ("garlic", 3), ("italian", 1)],
     ["Soften the chopped onion, carrots and celery in a big pot for 6 minutes; add garlic.",
      "Add the broth, whole chicken breasts and Italian seasoning; simmer 20 minutes.",
      "Lift out the chicken and shred it. Add the pasta and cook 8 minutes.", "Return the chicken, season with salt and pepper, and portion into 6."],
     "chicken noodle soup", r"noodle soup|chicken soup"),
    ("bbq_chicken_potatoes", "BBQ Chicken, Corn & Roasted Potatoes", 40, 5, [],
     [("chicken_breast", 2), ("potatoes", 2), ("corn", 1), ("bbq", 6), ("olive_oil", 2), ("paprika", 1)],
     ["Heat the oven to 425°F. Roast the potato chunks with oil and paprika for 20 minutes.",
      "Add the chicken to the pan, brush it with half the BBQ sauce, and roast 18 minutes.",
      "Warm the corn. Brush the chicken with the rest of the sauce and slice.",
      "Divide chicken, potatoes and corn into 5 containers."], "barbecue chicken", r"chicken"),
    ("chicken_enchilada_skillet", "Chicken Enchilada Skillet", 30, 6, [],
     [("chicken_breast", 1.5), ("black_beans", 1), ("corn", 1), ("tomato_sauce", 2), ("chili_powder", 3), ("cumin", 1), ("cheddar", 4), ("tortillas", 4), ("onion", 1)],
     ["Brown diced chicken and onion in a large skillet for 7 minutes.",
      "Stir in the tomato sauce, chili powder, cumin, beans and corn; simmer 5 minutes.",
      "Tear the tortillas into pieces and fold them in.", "Top with cheddar, cover 3 minutes to melt, and portion into 6."],
     "enchilada", r"enchilada"),
    # ---------------- turkey & beef ----------------
    ("turkey_chili", "Turkey & Three-Bean Chili", 45, 8, [],
     [("ground_turkey", 2), ("black_beans", 2), ("kidney_beans", 1), ("crushed_tomatoes", 1), ("onion", 1), ("pepper", 1), ("garlic", 3), ("chili_powder", 4), ("cumin", 2)],
     ["Brown the turkey with the chopped onion and pepper for 8 minutes.", "Add the garlic, chili powder and cumin for 1 minute.",
      "Add the beans (drained), crushed tomatoes and 1 cup water; simmer 25 minutes.", "Taste for salt. Portion into 8; it freezes well."],
     "chili con carne", r"chili"),
    ("turkey_taco_rice", "One-Pot Turkey Taco Rice", 35, 6, [],
     [("ground_turkey", 1.5), ("rice", 1.5), ("salsa", 1), ("black_beans", 1), ("corn", 1), ("cheddar", 3), ("taco", 2), ("broth", 3)],
     ["Brown the turkey with the taco seasoning in a deep pan.", "Stir in the rice, salsa and broth; bring to a boil.",
      "Cover and simmer on low 18 minutes until the rice is tender.", "Stir in the beans and corn, top with cheddar, and portion into 6."],
     "taco rice", r"rice"),
    ("egg_roll_bowl", "Egg Roll in a Bowl (Turkey & Cabbage)", 25, 6, [],
     [("ground_turkey", 2), ("cabbage", 0.6), ("carrots", 2), ("green_onions", 1), ("soy", 4), ("ginger", 1), ("garlic", 3), ("sriracha", 2), ("sesame_oil", 2), ("rice", 1)],
     ["Cook the rice. Brown the turkey in a large pan.", "Add garlic and ginger for 1 minute, then the shredded cabbage and grated carrots.",
      "Stir-fry 6 minutes until the cabbage softens. Add soy sauce, sriracha and sesame oil.",
      "Top with green onions and pack with a scoop of rice."], "cabbage stir fry", r"cabbage|stir"),
    ("turkey_meatballs_spaghetti", "Turkey Meatballs & Whole Wheat Spaghetti", 40, 6, [],
     [("ground_turkey", 1.5), ("eggs", 1), ("oats", 0.5), ("parmesan", 4), ("italian", 2), ("garlic", 2), ("marinara", 1), ("ww_pasta", 1)],
     ["Heat the oven to 400°F. Mix the turkey, egg, oats, parmesan, Italian seasoning and garlic; roll 24 meatballs.",
      "Bake 18 minutes. Boil the pasta.", "Simmer the meatballs in the marinara 5 minutes.", "Toss with the pasta and divide into 6."],
     "spaghetti meatballs", r"meatball"),
    ("beef_broccoli", "Beef & Broccoli Rice Bowls", 25, 6, [],
     [("ground_beef", 1.5), ("broccoli", 2), ("rice", 1.5), ("soy", 4), ("honey", 2), ("garlic", 3), ("ginger", 1), ("cornstarch", 1)],
     ["Cook the rice. Whisk soy sauce, honey, cornstarch and 1/3 cup water.",
      "Brown the beef with garlic and ginger, breaking it up.", "Add the broccoli florets and 2 tablespoons water; cover and steam 4 minutes.",
      "Pour in the sauce, toss until glossy, and pack over rice."], "beef and broccoli", r"broccoli"),
    ("veggie_bolognese", "Hidden-Veggie Beef Bolognese", 45, 6, [],
     [("ground_beef", 1), ("carrots", 2), ("zucchini", 1), ("onion", 1), ("garlic", 3), ("crushed_tomatoes", 1), ("ww_pasta", 1), ("italian", 2), ("parmesan", 3)],
     ["Grate the carrots and zucchini and chop the onion.", "Brown the beef, then add the vegetables and garlic and cook 8 minutes.",
      "Add crushed tomatoes and Italian seasoning; simmer 20 minutes. Boil the pasta meanwhile.",
      "Toss pasta with sauce, add parmesan, and divide into 6."], "spaghetti bolognese", r"bolognese|spaghetti"),
    ("turkey_stuffed_peppers", "Turkey & Rice Stuffed Peppers", 50, 6, [],
     [("pepper", 6), ("ground_turkey", 1.5), ("rice", 1), ("tomato_sauce", 1), ("onion", 1), ("cheddar", 3), ("italian", 1)],
     ["Cook the rice. Heat the oven to 375°F. Cut the tops off the peppers and scoop out the seeds.",
      "Brown the turkey with chopped onion; stir in the rice, most of the tomato sauce and the seasoning.",
      "Stuff the peppers, spoon the rest of the sauce on top, cover with foil, and bake 30 minutes.",
      "Add cheddar and bake 5 more minutes uncovered."], "stuffed peppers", r"stuffed pepper"),
    ("turkey_shepherds_pie", "Turkey Shepherd's Pie", 55, 6, [],
     [("ground_turkey", 2), ("mixed_veg", 2), ("potatoes", 3), ("milk", 0.5), ("onion", 1), ("broth", 1), ("tomato_sauce", 0.5), ("cornstarch", 1), ("garlic", 2)],
     ["Boil the peeled potato chunks 15 minutes, then mash with the milk and salt.",
      "Brown the turkey with the onion and garlic; add the frozen vegetables, broth and tomato sauce and simmer 5 minutes.",
      "Stir in the cornstarch mixed with a little water to thicken.",
      "Spread in a baking dish, top with mash, and bake at 400°F for 20 minutes."], "shepherd's pie", r"shepherd|cottage pie"),
    # ---------------- pork ----------------
    ("pork_tenderloin_roast", "Pork Tenderloin with Roasted Carrots & Potatoes", 45, 6, [],
     [("pork_tenderloin", 2), ("potatoes", 2), ("carrots", 6), ("olive_oil", 3), ("garlic", 4), ("mustard", 2), ("honey", 1)],
     ["Heat the oven to 425°F. Toss potato chunks and carrot sticks with 2 tablespoons oil and roast 15 minutes.",
      "Rub the pork with mustard, honey, garlic and the rest of the oil.",
      "Add the pork to the pan and roast 20 to 25 minutes, to 145°F inside. Rest 5 minutes and slice.",
      "Divide into 6."], "pork tenderloin", r"pork"),
    ("pork_carnitas_bowls", "Cilantro-Lime Pork Carnitas Bowls", 45, 7, [],
     [("pork_tenderloin", 2.5), ("lime", 2), ("garlic", 4), ("cumin", 2), ("oregano", 1), ("rice", 1.75), ("black_beans", 2), ("salsa", 1), ("cilantro", 1)],
     ["Cut the pork into 2-inch chunks and rub with cumin, oregano, garlic and salt.",
      "Simmer covered in 1 cup water and the juice of 1 lime for 30 minutes, then shred and crisp in a hot pan.",
      "Cook the rice and stir in chopped cilantro and the other lime's juice.", "Pack rice, beans, pork and salsa into 7 containers."],
     "carnitas", r"carnitas|pork"),
    # ---------------- seafood ----------------
    ("tuna_white_bean_salad", "Lemony Tuna & White Bean Salad", 15, 4, [],
     [("tuna", 4), ("white_beans", 2), ("cucumber", 1), ("cherry_tomatoes", 1), ("red_onion", 0.5), ("lemon", 1), ("olive_oil", 2), ("oregano", 1)],
     ["Drain the tuna and beans.", "Chop the cucumber, halve the tomatoes and slice the red onion thin.",
      "Toss everything with lemon juice, olive oil, oregano, salt and pepper.", "Keeps 3 days in the fridge; no cooking needed."],
     "tuna salad beans", r"tuna"),
    ("shrimp_fried_rice", "Shrimp Fried Rice", 25, 5, [],
     [("shrimp", 1), ("rice", 1.5), ("eggs", 4), ("mixed_veg", 1), ("soy", 4), ("green_onions", 1), ("garlic", 3), ("sesame_oil", 2)],
     ["Cook the rice ahead and let it cool (day-old rice fries best).", "Cook the shrimp 2 minutes a side and set aside.",
      "Scramble the eggs, push aside, then stir-fry the vegetables and garlic 3 minutes.",
      "Add the rice, soy sauce and sesame oil; fry 4 minutes. Return the shrimp and add green onions."], "shrimp fried rice", r"fried rice"),
    ("salmon_rice_broccoli", "Soy-Honey Salmon, Rice & Broccoli", 30, 4, [],
     [("salmon", 1.5), ("rice", 1), ("broccoli", 1.5), ("soy", 3), ("honey", 2), ("garlic", 2), ("olive_oil", 1)],
     ["Cook the rice. Heat the oven to 400°F.", "Mix soy sauce, honey and garlic; brush it over the salmon on a sheet pan.",
      "Toss the broccoli with the oil around the fish and bake 12 to 15 minutes.", "Pack salmon, broccoli and rice into 4 containers."],
     "salmon broccoli rice", r"salmon"),
    ("garlic_shrimp_pasta", "Garlic Shrimp & Spinach Pasta", 25, 5, [],
     [("shrimp", 1), ("ww_pasta", 0.75), ("spinach", 5), ("garlic", 5), ("lemon", 1), ("parmesan", 4), ("olive_oil", 2)],
     ["Boil the pasta; keep a cup of the water.", "Cook the garlic in the oil 1 minute, add the shrimp and cook 2 minutes a side.",
      "Add the spinach until wilted, then the pasta, lemon juice, parmesan and a splash of pasta water.", "Toss and divide into 5."],
     "shrimp pasta", r"shrimp|prawn"),
    ("tuna_pasta_salad", "Greek Yogurt Tuna Pasta Salad", 20, 5, [],
     [("ww_pasta", 0.75), ("tuna", 3), ("greek_yogurt", 1), ("peas", 1), ("celery", 2), ("red_onion", 0.5), ("lemon", 1), ("mustard", 1)],
     ["Boil the pasta, adding the frozen peas for the last 2 minutes; rinse under cold water.",
      "Stir the yogurt with mustard, lemon juice, salt and pepper.", "Fold in the drained tuna, chopped celery and red onion, pasta and peas.",
      "Chill and divide into 5."], "tuna pasta salad", r"pasta salad|tuna"),
    # ---------------- vegetarian ----------------
    ("red_lentil_curry", "Red Lentil Coconut Curry", 35, 6, ["vegetarian"],
     [("red_lentils", 2), ("coconut_milk", 1), ("crushed_tomatoes", 1), ("onion", 1), ("garlic", 4), ("ginger", 1), ("curry_powder", 3), ("spinach", 5), ("rice", 1.5)],
     ["Cook the rice. Soften the onion 5 minutes, then add garlic, ginger and curry powder for 1 minute.",
      "Add the rinsed lentils, crushed tomatoes, coconut milk and 3 cups water; simmer 20 minutes, stirring.",
      "Stir in the spinach until wilted and season with salt.", "Serve over rice; it thickens as it cools."], "lentil curry dal", r"dal|dhal|lentil"),
    ("lentil_sweet_potato_soup", "Lentil & Sweet Potato Soup", 45, 6, ["vegetarian"],
     [("brown_lentils", 1.5), ("sweet_potatoes", 1.5), ("carrots", 2), ("onion", 1), ("broth", 8), ("cumin", 2), ("paprika", 1), ("spinach", 4), ("garlic", 3)],
     ["Soften the chopped onion and carrots 5 minutes; add the garlic and spices.",
      "Add the lentils, diced sweet potatoes and broth; simmer 30 minutes until tender.",
      "Stir in the spinach, season with salt and pepper.", "Portion into 6; freezes well."], "lentil soup", r"lentil"),
    ("black_bean_sweet_potato_bowls", "Black Bean & Sweet Potato Burrito Bowls", 40, 6, ["vegetarian"],
     [("sweet_potatoes", 2), ("black_beans", 3), ("rice", 1), ("greek_yogurt", 1), ("corn", 1), ("salsa", 1), ("lime", 1), ("avocado", 2), ("cumin", 1), ("chili_powder", 1), ("olive_oil", 2)],
     ["Heat the oven to 425°F. Roast cubed sweet potatoes with oil, cumin and chili powder for 25 minutes.",
      "Cook the rice. Warm the drained beans with the corn.", "Pack rice, sweet potatoes, beans and corn, and salsa into 6 containers, with a spoon of Greek yogurt as sour cream.",
      "Add sliced avocado and lime just before eating."], "sweet potato black bean", r"sweet potato|black bean"),
    ("chickpea_spinach_curry", "Chickpea & Spinach Curry", 30, 6, ["vegetarian"],
     [("chickpeas", 3), ("crushed_tomatoes", 1), ("coconut_milk", 1), ("onion", 1), ("garlic", 4), ("ginger", 1), ("curry_powder", 3), ("spinach", 5), ("rice", 1.5)],
     ["Cook the rice. Soften the onion 5 minutes; add garlic, ginger and curry powder.",
      "Add the drained chickpeas, crushed tomatoes and coconut milk; simmer 15 minutes.",
      "Stir in the spinach and season with salt.", "Serve over rice."], "chickpea curry", r"chickpea|chana"),
    ("peanut_tofu_stir_fry", "Peanut Tofu & Veggie Stir-Fry", 30, 5, ["vegetarian"],
     [("tofu", 2), ("broccoli", 1), ("pepper", 2), ("carrots", 2), ("peanut_butter", 4), ("soy", 3), ("honey", 2), ("lime", 1), ("rice", 1.5), ("cornstarch", 2), ("garlic", 3)],
     ["Cook the rice. Press the tofu dry, cube it, and toss with the cornstarch.",
      "Fry the tofu in a non-stick pan until golden on all sides, about 10 minutes.",
      "Stir-fry the vegetables and garlic 5 minutes.", "Whisk peanut butter, soy sauce, honey, lime juice and 1/4 cup hot water; toss everything and pack over rice."],
     "tofu stir fry", r"tofu"),
    ("spanish_chickpeas_rice", "Spanish Chickpeas & Rice", 40, 6, ["vegetarian"],
     [("chickpeas", 2), ("rice", 1.5), ("diced_tomatoes", 1), ("onion", 1), ("pepper", 1), ("paprika", 2), ("broth", 3), ("peas", 1), ("garlic", 3), ("olive_oil", 1)],
     ["Soften the onion and pepper in the oil 5 minutes; add garlic and smoked paprika.",
      "Stir in the rice to coat, then the tomatoes, chickpeas and broth.", "Cover and simmer on low 20 minutes.",
      "Stir in the peas, rest 5 minutes covered, and portion into 6."], "spanish rice chickpeas", r"rice|chickpea|paella"),
    ("veggie_egg_fried_rice", "Veggie Egg Fried Rice", 20, 5, ["vegetarian"],
     [("rice", 2), ("eggs", 6), ("mixed_veg", 2), ("soy", 4), ("green_onions", 1), ("garlic", 3), ("sesame_oil", 2)],
     ["Cook the rice ahead and let it cool.", "Scramble the eggs in a hot pan and push them aside.",
      "Stir-fry the frozen vegetables and garlic 4 minutes.", "Add the rice, soy sauce and sesame oil; fry 4 minutes and finish with green onions."],
     "egg fried rice", r"fried rice"),
    ("greek_chickpea_quinoa_jars", "Greek Chickpea Quinoa Salad Jars", 25, 5, ["vegetarian"],
     [("quinoa", 1), ("chickpeas", 2), ("cucumber", 1), ("cherry_tomatoes", 1), ("red_onion", 0.5), ("feta", 4), ("lemon", 1), ("olive_oil", 3), ("oregano", 1)],
     ["Cook the quinoa in 2 cups water for 15 minutes; cool.", "Whisk lemon juice, olive oil, oregano, salt and pepper in the bottom of 5 jars.",
      "Layer chickpeas, cucumber, red onion, tomatoes, quinoa and feta.", "Shake into a bowl to eat. Keeps 4 days."], "quinoa salad", r"quinoa|chickpea salad"),
    ("white_bean_kale_soup", "White Bean & Kale Soup", 35, 5, ["vegetarian"],
     [("white_beans", 4), ("kale", 1), ("carrots", 2), ("onion", 1), ("garlic", 4), ("diced_tomatoes", 1), ("broth", 6), ("parmesan", 4), ("italian", 1)],
     ["Soften the onion and carrots 6 minutes; add garlic and Italian seasoning.",
      "Add the beans, tomatoes and broth; simmer 15 minutes. Mash a few beans to thicken.",
      "Add the chopped kale for 5 minutes.", "Serve with parmesan on top."], "white bean soup kale", r"bean soup|kale"),
    ("black_bean_quesadillas", "Black Bean & Spinach Quesadillas", 20, 4, ["vegetarian"],
     [("black_beans", 2), ("corn", 0.5), ("cheddar", 6), ("tortillas", 8), ("salsa", 1), ("spinach", 3), ("cumin", 1)],
     ["Mash half the beans with cumin, then stir in the rest with the corn and chopped spinach.",
      "Spread on 4 tortillas, top with cheese, and close with the other 4.",
      "Toast in a dry pan 3 minutes a side until golden and melted.", "Cut into wedges and pack with salsa."], "quesadilla", r"quesadilla"),
    ("lentil_sloppy_joes", "Lentil Sloppy Joes", 35, 6, ["vegetarian"],
     [("brown_lentils", 1.5), ("onion", 1), ("pepper", 1), ("tomato_sauce", 1), ("honey", 2), ("mustard", 1), ("chili_powder", 2), ("buns", 6), ("garlic", 2)],
     ["Simmer the lentils in 3 cups water 20 minutes until tender; drain.", "Soften the onion and pepper 5 minutes with the garlic.",
      "Add the lentils, tomato sauce, honey, mustard and chili powder; simmer 10 minutes until thick.", "Pack with buns on the side."],
     "sloppy joe", r"sloppy"),
    ("pasta_fagioli", "Pasta e Fagioli", 35, 6, ["vegetarian"],
     [("ww_pasta", 0.5), ("white_beans", 2), ("diced_tomatoes", 1), ("carrots", 2), ("celery", 2), ("onion", 1), ("broth", 6), ("spinach", 3), ("parmesan", 4), ("garlic", 3)],
     ["Soften the onion, carrots and celery 6 minutes; add garlic.", "Add the beans, tomatoes and broth; simmer 10 minutes.",
      "Add the pasta and cook 9 minutes, then the spinach.", "Top with parmesan; add a splash of water when reheating."], "pasta e fagioli", r"fagioli|bean soup"),
    ("spinach_baked_ziti", "Cottage Cheese & Spinach Baked Ziti", 45, 8, ["vegetarian"],
     [("ww_pasta", 1), ("marinara", 1.5), ("cottage", 3), ("mozzarella", 8), ("spinach", 5), ("italian", 1), ("eggs", 1)],
     ["Heat the oven to 375°F. Boil the pasta 2 minutes short of done.",
      "Stir the cottage cheese with the egg, chopped spinach and Italian seasoning.",
      "Layer pasta, marinara, the cottage cheese mix and mozzarella in a 9x13 dish.", "Bake 25 minutes until bubbling. Cut into 8."],
     "baked ziti", r"ziti|baked pasta"),
    ("turkey_quinoa_skillet", "Turkey, Zucchini & Quinoa Skillet", 30, 5, [],
     [("ground_turkey", 1.5), ("quinoa", 1), ("zucchini", 2), ("diced_tomatoes", 1), ("onion", 1), ("broth", 2), ("cumin", 1), ("paprika", 1), ("garlic", 2)],
     ["Brown the turkey with onion and garlic.", "Add the rinsed quinoa, tomatoes, broth and spices; cover and simmer 15 minutes.",
      "Stir in diced zucchini, cover, and cook 5 more minutes.", "Portion into 5."], "quinoa skillet", r"quinoa"),
    ("chicken_quinoa_bowls", "Herby Lemon Chicken Quinoa Bowls", 30, 5, [],
     [("chicken_breast", 1.75), ("quinoa", 1), ("cherry_tomatoes", 1), ("cucumber", 1), ("spinach", 3), ("lemon", 1), ("olive_oil", 3), ("italian", 2), ("feta", 3)],
     ["Cook the quinoa. Season the chicken with Italian seasoning and 1 tablespoon oil.",
      "Cook the chicken 6 to 7 minutes a side; rest and slice.", "Whisk the rest of the oil with lemon juice, salt and pepper.",
      "Pack spinach, quinoa, chicken, tomatoes, cucumber and feta; dress when eating."], "chicken quinoa bowl", r"quinoa|chicken"),
]

# better photo searches where the first try matched the wrong dish: id -> (search, must match, must NOT match)
PHOTO = {
    "egg_muffins": ("egg muffin cups", r"frittata|egg (muffin|cup|bite)", r"mcmuffin"),
    "pb_banana_baked_oats": ("baked oatmeal", r"baked oat|oatmeal", r"cookie"),
    "sweet_potato_hash": ("sweet potato hash egg", r"hash", r"duck|waffle"),
    "yogurt_parfait_jars": ("yogurt parfait berries", r"yogh?urt", r"glac"),
    "sheet_pan_chicken_sweet_potato": ("roasted chicken sweet potatoes", r"chicken", r"tandoori|wing"),
    "honey_garlic_chicken": ("honey garlic chicken thighs", r"chicken", r"wing"),
    "lemon_pepper_chicken": ("lemon chicken potatoes", r"lemon.*chicken|chicken.*lemon", r"wing"),
    "buffalo_chicken_potatoes": ("stuffed sweet potato", r"sweet potato", r"burger|wing|fries"),
    "pork_tenderloin_roast": ("roast pork tenderloin", r"pork (tenderloin|loin|roast)|roast pork", r"sandwich"),
    "veggie_egg_fried_rice": ("egg fried rice", r"egg fried rice|fried rice", r"bilao|seafood|pork"),
    "chicken_quinoa_bowls": ("quinoa salad chicken", r"quinoa", r"lamb|beef|wrap"),
    "chicken_spinach_pasta": ("chicken pasta", r"chicken.*(pasta|penne)|(pasta|penne).*chicken", r""),
    "salmon_rice_broccoli": ("salmon fillet", r"salmon", r"sushi|smoked"),
    "spanish_chickpeas_rice": ("chickpeas rice", r"chickpea|garbanzo", r""),
    "turkey_quinoa_skillet": ("quinoa vegetables", r"quinoa", r""),
    "chicken_enchilada_skillet": ("chicken enchiladas", r"enchilada", r"festival"),
    "chicken_burrito_bowls": ("chicken burrito bowl", r"burrito", r"steak"),
}

# health guardrails a recipe must pass (per serving)
LIMITS = {"kcal": (250, 750), "protein": (12, 75)}


def build():
    out, bad = [], []
    for rid, name, minutes, servings, tags, ings, steps, photo, must in R:
        tot = dict(cost=0.0, kcal=0.0, protein=0.0, carbs=0.0, fat=0.0, fiber=0.0)
        rows = []
        for key, amt in ings:
            label, aisle, unit, gpu, cents, kcal, p, c, f, fib = ING[key]
            g = amt * gpu
            tot["cost"] += amt * cents
            for k, v in (("kcal", kcal), ("protein", p), ("carbs", c), ("fat", f), ("fiber", fib)):
                tot[k] += g * v / 100
            rows.append({"item": label, "qty": round(amt, 2), "unit": unit, "aisle": aisle})
        per = {k: tot[k] / servings for k in tot}
        all_tags = list(tags)
        if per["protein"] >= 30: all_tags.append("high-protein")
        if per["cost"] <= 250: all_tags.append("budget")
        if minutes <= 30: all_tags.append("quick")
        if servings >= 5: all_tags.append("classic prep")
        r = {"id": rid, "name": name, "tags": all_tags, "minutes": minutes, "servings": servings,
             "cost_cents": int(round(tot["cost"])), "kcal": int(round(per["kcal"])), "protein": int(round(per["protein"])),
             "carbs": int(round(per["carbs"])), "fat": int(round(per["fat"])), "fiber": int(round(per["fiber"])),
             "ingredients": rows, "steps": steps, "photo": photo, "photo_must": must, "cost_note": "estimate"}
        if rid in PHOTO:
            r["photo"], r["photo_must"], r["photo_not"] = PHOTO[rid]
        for k, (lo, hi) in LIMITS.items():
            if not lo <= r[k] <= hi:
                bad.append(f"{rid}: {k} per serving {r[k]} outside {lo}-{hi}")
        out.append(r)
    ids = [r["id"] for r in out]
    assert len(ids) == len(set(ids)), "duplicate recipe id"
    units = {}
    for r in out:                                  # the grocery list adds amounts per (aisle, item, unit): keep units consistent
        for i in r["ingredients"]:
            units.setdefault(i["item"], set()).add(i["unit"])
    assert all(len(u) == 1 for u in units.values()), units
    return out, bad


if __name__ == "__main__":
    recipes, bad = build()
    print(f"{'recipe':42} {'srv':>3} {'$/srv':>6} {'kcal':>5} {'P':>4} {'C':>4} {'F':>4} {'fib':>4}  tags")
    for r in recipes:
        print(f"{r['name'][:42]:42} {r['servings']:>3} {r['cost_cents'] / r['servings'] / 100:>6.2f} {r['kcal']:>5} {r['protein']:>4} "
              f"{r['carbs']:>4} {r['fat']:>4} {r['fiber']:>4}  {','.join(r['tags'])}")
    print(len(recipes), "recipes")
    if bad:
        print("\n".join(bad)); sys.exit(1)
    if "--write" in sys.argv:
        OUT.write_text(json.dumps({"recipes": recipes, "about": "Costs use 2026 US average prices (BLS where available, store-brand otherwise) for the amount each recipe uses; nutrition from USDA FoodData Central values. Both are estimates."}, indent=1, ensure_ascii=False), encoding="utf-8")
        print("wrote", OUT)
