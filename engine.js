// ============================================================
//  Projekt — ENGINE
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

  function newId(prefix) {
    return (prefix || "s_") + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  // id dello step + tutti i suoi discendenti (per l'eliminazione a cascata).
  function descendantIds(steps, id) {
    const out = [String(id)];
    for (let i = 0; i < out.length; i++) {
      steps.forEach(function (s) {
        if (String(s.parentId || "") === out[i]) out.push(String(s.id));
      });
    }
    return out;
  }

  // Sposta lo step di una posizione tra i fratelli (dir -1 su, +1 giu').
  // Rinumera i fratelli 0..n-1 e ritorna SOLO le copie degli step il cui
  // order e' cambiato (da salvare). Non modifica l'input.
  function moveStep(steps, id, dir) {
    const me = steps.filter(function (s) { return String(s.id) === String(id); })[0];
    if (!me) return [];
    const sibs = steps.filter(function (s) { return String(s.parentId || "") === String(me.parentId || ""); })
      .slice().sort(byOrder);
    const i = sibs.indexOf(me), j = i + dir;
    if (j < 0 || j >= sibs.length) return [];
    sibs[i] = sibs[j]; sibs[j] = me;
    const changed = [];
    sibs.forEach(function (s, k) {
      if (Number(s.order || 0) !== k) changed.push(Object.assign({}, s, { order: k }));
    });
    return changed;
  }

  const API = {
    buildTree: buildTree, computeProgress: computeProgress, nextOrder: nextOrder, newId: newId,
    descendantIds: descendantIds, moveStep: moveStep
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Engine = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
