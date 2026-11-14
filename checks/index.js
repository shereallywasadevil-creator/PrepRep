/* Titan Check click-through for PrepRep's week board (real browser, no engine): first run opens the welcome sheet,
   bad input is explained under the field, the flip switches kitchen and gym, and the dock opens sheets. */
const $ = id => document.getElementById(id);
await until(() => $("age"));
ok($("sheet").open, "first run opens the welcome sheet over the board");
document.querySelector("#sheet form button.go").click(); await wait(80);
ok(($("age-error") || {}).textContent.includes("13 to 100"), "a missing age is explained under the field");
$("age").value = "19"; $("height_cm").value = "178"; $("weight_kg").value = "82";
document.querySelector("#sheet form button.go").click(); await wait(700);
ok(document.querySelectorAll(".col").length === 7, "the board shows the 7 days");
ok(document.body.dataset.zone === "kitchen", "it starts on the kitchen side");
$("to-gym").click(); await wait(400);
ok(document.body.dataset.zone === "gym" && $("to-gym").getAttribute("aria-pressed") === "true", "the flip switches to the gym side");
document.querySelector("[data-sheet=pantry]").click(); await wait(400);
ok($("sheet").open && document.querySelectorAll(".sticker").length > 0, "the dock opens the Pantry with meals in it");
