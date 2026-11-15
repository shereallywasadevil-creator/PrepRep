"""Prepwise: calories that learn, budget meal prep, workouts and a weekly schedule"""
import statistics
from itertools import combinations_with_replacement
from itertools import product
import re
from datetime import datetime


def bmr(sex, age, height_cm, weight_kg):
    if sex == "male":
        base = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    elif sex == "female":
        base = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        raise ValueError("Unknown sex")
    return round(base)


ACTIVITY = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very": 1.9}


def start_tdee(bmr_kcal, activity):
    if activity not in ACTIVITY:
        raise ValueError("Unknown activity")
    return round(bmr_kcal * ACTIVITY[activity])


def daily_target(tdee, goal, sex, rate_kg_per_week=0.5):
    if goal == "lose":
        target = tdee - rate_kg_per_week * 7700 / 7
    elif goal == "gain":
        target = tdee + 250
    elif goal == "maintain":
        target = tdee
    else:
        raise ValueError(f"Invalid goal: {goal}")
    
    floor = 1500 if sex == "male" else 1200
    target = max(floor, target)
    
    return round(target / 10) * 10


def estimate_tdee(log):
    if len(log) < 7:
        return None
    
    days = [entry[0] for entry in log]
    weights = [entry[1] for entry in log]
    calories = [entry[2] for entry in log]
    
    # Calculate weight change using manual linear regression
    n = len(days)
    sum_x = sum(days)
    sum_y = sum(weights)
    sum_xy = sum(x * y for x, y in zip(days, weights))
    sum_xx = sum(x * x for x in days)
    
    weight_change = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
    
    daily_calories = sum(calories) / len(calories)
    
    burned = daily_calories - weight_change * 7700
    return round(burned)


def macros(calories, weight_kg, goal):
    protein = round(weight_kg * 2.0) if goal == "lose" else round(weight_kg * 1.6)
    fat = round(calories * 0.25 / 9)
    carbs = max(0, round((calories - protein * 4 - fat * 9) / 4))
    return {"protein": protein, "fat": fat, "carbs": carbs}


def calculate_total_protein(batches):
    recipes = {
        'chili': {'protein': 30},
        # Add more recipes and their protein content here
    }
    total_protein = sum(recipes.get(batch, {'protein': 0})['protein'] for batch in batches)
    return total_protein


def combo_totals(recipes, combo):
    total_servings = 0
    total_cost = 0
    total_protein = 0
    names = []

    for index in combo:
        recipe = recipes[index]
        total_servings += recipe["servings"]
        total_cost += recipe["cost_cents"]
        total_protein += recipe["protein"] * recipe["servings"]
        names.append(recipe["name"])

    return {
        "servings": total_servings,
        "cost": total_cost,
        "protein": total_protein,
        "names": sorted(names)
    }


def check_no_wasted_batch(recipes, combo, servings_needed):
    no_wasted_batch = all(
        sum(recipes[index]["servings"] for index in combo if index != i) >= servings_needed
        for i in range(len(combo))
    )
    return no_wasted_batch


def fits(recipes, combo, budget_cents, servings_needed):
    t = combo_totals(recipes, combo)
    total_servings = t["servings"]
    total_cost = t["cost"]
    no_wasted_batch = all(
        total_servings - recipes[index]["servings"] < servings_needed
        for index in combo
    )
    return total_servings >= servings_needed and total_cost <= budget_cents and no_wasted_batch


def plan_meals(recipes, budget_cents, servings_needed):
    if not recipes:
        return None
    
    max_batches = -(-servings_needed // min(r['servings'] for r in recipes))
    
    best_combo = None
    best_key = (-1, 0, float('inf'))
    
    for k in range(1, max_batches + 1):
        for combo in combinations_with_replacement(range(len(recipes)), k):
            if fits(recipes, combo, budget_cents, servings_needed):
                t = combo_totals(recipes, combo)
                key = (t["protein"], -t["cost"], -len(combo))
                if key > best_key:
                    best_key = key
                    best_combo = combo
    
    if best_combo is None:
        return None
    
    t = combo_totals(recipes, best_combo)
    return {
        "recipes": t["names"],
        "cost": t["cost"],
        "servings": t["servings"],
        "protein": t["protein"]
    }


def grocery_list(recipes):
    ingredient_counts = {}

    for recipe in recipes:
        for ingredient in recipe["ingredients"]:
            item = ingredient["item"].strip().lower()
            unit = ingredient["unit"]
            aisle = ingredient["aisle"]
            key = (item, unit, aisle)

            if key in ingredient_counts:
                ingredient_counts[key]["qty"] += ingredient["qty"]
            else:
                ingredient_counts[key] = {
                    "item": item,
                    "qty": ingredient["qty"],
                    "unit": unit,
                    "aisle": aisle
                }

    grocery_list = [
        {"aisle": info["aisle"], "item": info["item"], "qty": round(info["qty"], 2), "unit": info["unit"]}
        for info in ingredient_counts.values()
    ]

    return sorted(grocery_list, key=lambda x: (x["aisle"], x["item"], x["unit"]))


def plan_day(days, day_index):
    if days < 1:
        raise ValueError("Number of days must be at least 1")
    if day_index < 0 or day_index >= days:
        raise ValueError("Day index is out of range")
    
    if days == 1 or days == 2:
        return 'push'
    else:
        muscle_groups = ['push', 'pull', 'legs']
        return muscle_groups[day_index % len(muscle_groups)]


def day_muscle_group(days, i):
    if days >= 3:
        muscle_groups = ['push', 'pull', 'legs']
        return muscle_groups[i % 3]
    else:
        return plan_day(days, i)


def day_muscle_full_body(days, i):
    if days == 1 or days == 2:
        return 'any'
    else:
        muscle_groups = ['push', 'pull', 'legs']
        return muscle_groups[i % 3]


def day_muscle(days, i):
    if days >= 3:
        return day_muscle_group(days, i)
    else:
        return day_muscle_full_body(days, i)


def test_day_muscle():
    test_cases = [
        (1, 0, 'any'),
        (2, 0, 'any'),
        (3, 0, 'push'),
        (3, 1, 'pull'),
        (3, 2, 'legs'),
        (4, 0, 'push'),
        (4, 1, 'pull'),
        (4, 2, 'legs'),
        (4, 3, 'push'),
    ]
    
    for days, i, expected in test_cases:
        assert day_muscle(days, i) == expected


def pick_day(exercises, muscle, equipment, minutes):
    time_left = minutes
    selected_exercises = []

    for exercise in exercises:
        if (muscle == "any" or exercise["muscle"] == muscle) and \
           (exercise["equipment"] == "none" or exercise["equipment"] in equipment) and \
           exercise["minutes"] <= time_left and \
           exercise["name"] not in selected_exercises:
            selected_exercises.append(exercise["name"])
            time_left -= exercise["minutes"]

    return selected_exercises


def build_workout(exercises, days, equipment, minutes):
    workout_plan = []
    for i in range(days):
        day_muscle_type = day_muscle(days, i)
        selected_exercises = pick_day(exercises, day_muscle_type, equipment, minutes)
        workout_plan.append(selected_exercises)
    return workout_plan


EQUIPMENT_TAGS = {
    "dumbbells": ["dumbbell", "db"],
    "barbell": ["barbell", "squat rack", "power rack"],
    "pull-up bar": ["pull-up bar", "pullup bar", "pull up bar", "chin-up bar", "chin up bar"],
    "bands": ["band", "resistance band"],
    "kettlebell": ["kettlebell", "kettle bell"],
    "bench": ["bench"],
    "machines": ["machine", "cable"]
}


def parse_equipment(text):
    text = text.lower()
    equipment = []

    for tag, words in EQUIPMENT_TAGS.items():
        for word in words:
            if re.search(r"\b" + re.escape(word) + r"s?\b", text):
                equipment.append(tag)
                break

    if "gym" in text:
        equipment = ["dumbbells", "barbell", "pull-up bar", "bands", "kettlebell", "bench", "machines"]

    return equipment


def swap_options(exercises, name, equipment):
    if not equipment:
        return []

    muscle = next((e["muscle"] for e in exercises if e["name"] == name), None)
    if muscle is None:
        return []

    available_exercises = [e["name"] for e in exercises if e["muscle"] == muscle and (e["equipment"] in equipment or e["equipment"] == "none")]
    if name in available_exercises:
        available_exercises.remove(name)
    return available_exercises


def review_workout(exercises, week, minutes):
    by_name = {e["name"]: e for e in exercises}
    
    tips = []
    
    for muscle in ["push", "pull", "legs"]:
        if not any(by_name[n]["muscle"] == muscle for n in sum(week, []) if n in by_name):
            tips.append(f"No {muscle} exercises this week: add one so your body is trained evenly.")
    
    for day_index, day in enumerate(week, 1):
        if not day:
            tips.append(f"Day {day_index} is empty: add at least one exercise.")
        else:
            total_minutes = sum(by_name[n]["minutes"] for n in day if n in by_name)
            if total_minutes > minutes:
                tips.append(f"Day {day_index} takes {total_minutes} minutes, more than your {minutes}: remove or swap one exercise.")
    
    if len(week) >= 3 and len(set(tuple(day) if day else () for day in week)) == 1:
        tips.append("Every day is the same: mix it up so muscles get time to rest.")
    
    return tips


def time_to_minutes(time_str):
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes


def minutes_to_time(minutes):
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02}:{mins:02}"


def schedule(free, tasks):
    """Put each task (name, minutes), in priority order, into the earliest free slot that still has room.

    free is a list of (day, "HH:MM", "HH:MM"). A slot is used up from its start: after a task is placed there,
    the slot's free time begins where that task ended, so the next task in the same slot goes right after it.
    Returns {"placed": [{"task", "day", "start", "end"}], "unplaced": [names that fit nowhere]}.
    """
    # Copy each slot into a small list we are allowed to change: [day, start_min, end_min].
    slots = [[day, time_to_minutes(start), time_to_minutes(end)] for day, start, end in free]
    placed, unplaced = [], []
    for name, minutes in tasks:                 # tasks are in priority order, so earlier ones get first pick
        for slot in slots:
            day, start, end = slot
            if end - start >= minutes:          # enough room left in this slot
                placed.append({"task": name, "day": day,
                               "start": minutes_to_time(start), "end": minutes_to_time(start + minutes)})
                slot[1] = start + minutes       # the slot now starts where this task ended
                break
        else:                                   # the loop never hit "break": no slot had room
            unplaced.append(name)
    return {"placed": placed, "unplaced": unplaced}


def adherence(planned, done):
    """Percent of this week's planned items that were done, as a whole number; None when nothing was planned.

    Extra ids in done that weren't planned don't count, and doing one item twice still counts once.
    """
    if not planned:
        return None                             # 0 would claim a bad week; None says "nothing to measure"
    done_set = set(done)                        # a set: fast "is it in there?" and duplicates collapse
    hits = sum(1 for item in planned if item in done_set)
    return round(100 * hits / len(planned))
