// Test runner per l'engine (Node). Esegui: node engine.test.js
const E = require("./engine.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

const steps = [
  { id: "a", projectId: "p1", parentId: "",  text: "Prep",      order: 0, done: false, kind: "prep" },
  { id: "b", projectId: "p1", parentId: "a", text: "Postazione", order: 0, done: true,  kind: "action" },
  { id: "c", projectId: "p1", parentId: "a", text: "Pannelli",   order: 1, done: false, kind: "action" },
  { id: "d", projectId: "p1", parentId: "",  text: "Produzione", order: 1, done: false, kind: "action" },
  { id: "e", projectId: "p1", parentId: "d", text: "Tagliare",   order: 0, done: false, kind: "action" },
];

console.log("\n# buildTree");
{
  const tree = E.buildTree(steps);
  ok("2 radici", tree.length === 2, tree.length);
  ok("radici ordinate: Prep poi Produzione", tree[0].id === "a" && tree[1].id === "d");
  ok("Prep ha 2 figli", tree[0].children.length === 2);
  ok("figli ordinati per order", tree[0].children[0].id === "b" && tree[0].children[1].id === "c");
  ok("figlio senza figli ha children []", Array.isArray(tree[0].children[0].children) && tree[0].children[0].children.length === 0);
}

console.log("\n# computeProgress");
{
  const p = E.computeProgress(steps);
  // foglie: b, c, e (a e d hanno figli) => total 3, done 1 (b) => 33%
  ok("total = 3 foglie", p.total === 3, p.total);
  ok("done = 1", p.done === 1, p.done);
  ok("pct = 33", p.pct === 33, p.pct);
  ok("progress vuoto = 0%", E.computeProgress([]).pct === 0);
}

console.log("\n# nextOrder");
{
  ok("nextOrder figli di a = 2", E.nextOrder(steps, "a") === 2, E.nextOrder(steps, "a"));
  ok("nextOrder radici = 2", E.nextOrder(steps, "") === 2, E.nextOrder(steps, ""));
  ok("nextOrder parent senza figli = 0", E.nextOrder(steps, "b") === 0);
}

console.log("\n# newId");
{
  ok("newId genera stringhe diverse", E.newId() !== E.newId());
  ok("newId inizia con s_", E.newId().indexOf("s_") === 0);
}

console.log("\n" + (fail === 0 ? "TUTTI OK (" + pass + ")" : fail + " FALLITI, " + pass + " ok"));
process.exit(fail === 0 ? 0 : 1);
