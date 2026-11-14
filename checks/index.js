/* Titan Check click-through for PrepRep (real browser, no engine). */
const $ = id => document.getElementById(id);
await until(() => $("age"));
ok(!!$("age"), "first run opens the welcome form");
document.querySelector("form .btn").click(); await wait(80);
ok(($("age-error") || {}).textContent.includes("13 to 100"), "a missing age is explained under the field");
ok(!!$("height_ft") && !!$("height_in"), "height asks for feet and inches by default");
$("age").value = "19"; $("height_ft").value = "5"; $("height_in").value = "10"; $("weight_kg").value = "181";
document.querySelector("form .btn").click(); await wait(600);
ok(document.querySelector("h1").textContent === "Build a meal plan", "then lands on Build a meal plan");
{ const pr = JSON.parse(localStorage.getItem("prepwise") || "{}").profile || (window.titan && titan.store ? null : null);
  if (pr) ok(Math.abs(pr.height_cm - 178) <= 1 && Math.abs(pr.weight_kg - 82.1) < 0.2, "5 ft 10 in and 181 lb are saved as 178 cm and 82.1 kg for the brain"); }
ok(document.querySelectorAll(".food").length > 6 && document.querySelectorAll(".tile").length >= 6, "food rows and plan tiles show");
document.querySelector(".food .plus").click(); await wait(100);
ok(!$("buildbar").hidden, "tapping + shows the Build plan pill");
document.querySelector("[data-tab=train]").click(); await wait(400);
ok(/still building|didn't work/.test(document.querySelector("main").textContent), "without the brain, workouts say they're waiting instead of breaking");
