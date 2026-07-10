// ============================================================
//  StepS — ENGINE
//  Pura logica. Nessun DOM, nessun fetch, nessuna globale.
//  Riceve array/oggetti, ritorna array/oggetti. Testabile in Node.
// ============================================================
(function (root) {
  "use strict";

  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

  // Costruisce la foresta di alberi dai record step, via parentId.
  function buildTree(steps) {
    const nodes = {};
    steps.forEach(function (s) { nodes[s.id] = Object.assign({}, s, { children: [] }); });
    const roots = [];
    steps.forEach(function (s) {
      const node = nodes[s.id];
      if (s.parentId && nodes[s.parentId]) nodes[s.parentId].children.push(node);
      else roots.push(node);
    });
    Object.keys(nodes).forEach(function (id) { nodes[id].children.sort(byOrder); });
    roots.sort(byOrder);
    return roots;
  }

  // Progresso basato sulle sole FOGLIE (gli step realmente "spuntabili").
  function computeProgress(steps) {
    const hasChild = {};
    steps.forEach(function (s) { if (s.parentId) hasChild[s.parentId] = true; });
    const leaves = steps.filter(function (s) { return !hasChild[s.id]; });
    const total = leaves.length;
    const done = leaves.filter(function (s) { return s.done === true || s.done === "true"; }).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done: done, total: total, pct: pct };
  }

  // Prossimo 'order' per un nuovo figlio di parentId.
  function nextOrder(steps, parentId) {
    const siblings = steps.filter(function (s) { return (s.parentId || "") === (parentId || ""); });
    if (siblings.length === 0) return 0;
    return Math.max.apply(null, siblings.map(function (s) { return s.order || 0; })) + 1;
  }

  function newId() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  const API = { buildTree: buildTree, computeProgress: computeProgress, nextOrder: nextOrder, newId: newId };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Engine = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
