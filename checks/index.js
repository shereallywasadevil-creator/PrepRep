/* Titan Check click-through for PrepRep (runs in a real browser, no engine): first run lands on setup,
   bad input is caught under the field, and the gym and kitchen moods switch. */
const $ = id => document.getElementById(id);
await until(() => $("age"));
ok(!!$("age"), "first run opens the setup form");
document.querySelector("form button.primary").click(); await wait(80);
ok(($("age-error") || {}).textContent.includes("13 to 100"), "a missing age is explained under the field");
$("age").value = "19"; $("height_cm").value = "178"; $("weight_kg").value = "82";
document.querySelector("form button.primary").click(); await wait(400);
ok(document.body.dataset.zone === "kitchen", "Today uses the kitchen notebook look");
document.querySelector("[data-view=workouts]").click(); await wait(400);
ok(document.body.dataset.zone === "gym", "Workouts switch to the gym look");
ok(/still building|didn't work/.test(document.querySelector("main").textContent), "without the brain, a feature says it's waiting instead of breaking");
