/* Titan Check click-through for PrepRep (real browser, no engine). */
const $ = id => document.getElementById(id);
await until(() => $("age"));
ok(!!$("age"), "first run opens the welcome form");
document.querySelector("form .btn").click(); await wait(80);
ok(($("age-error") || {}).textContent.includes("13 to 100"), "a missing age is explained under the field");
$("age").value = "19"; $("height_cm").value = "178"; $("weight_kg").value = "82";
document.querySelector("form .btn").click(); await wait(600);
ok(document.querySelector("h1").textContent === "Build a meal plan", "then lands on Build a meal plan");
ok(document.querySelectorAll(".food").length > 6 && document.querySelectorAll(".tile").length >= 6, "food rows and plan tiles show");
document.querySelector(".food .plus").click(); await wait(100);
ok(!$("buildbar").hidden, "tapping + shows the Build plan pill");
document.querySelector("[data-tab=train]").click(); await wait(400);
ok(/still building|didn't work/.test(document.querySelector("main").textContent), "without the brain, workouts say they're waiting instead of breaking");
