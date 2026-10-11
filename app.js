// Projekt — orchestrazione UI (home progetti, vista progetto con cose da fare).
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var state = { projects: [], current: null, steps: [], showArchived: false };
  var HIDE_KEY = "projekt.hideDone";

  // ---------- shell ----------
  function showView(id) {
    ["view-home", "view-project"].forEach(function (v) {
      el(v).classList.toggle("hidden", v !== id);
    });
  }

  function toast(msg) {
    var t = el("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.add("hidden"); }, 3500);
  }

  function tacche(pct, n, small) {
    n = n || 10;
    var full = Math.round((pct / 100) * n);
    var html = '<div class="tacche' + (small ? ' small' : '') + '">';
    for (var i = 0; i < n; i++) html += '<div class="tacca' + (i < full ? ' on' : '') + '"></div>';
    return html + '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function isDone(s) { return s.done === true || s.done === "true"; }
  function pct(done, total) { return total ? Math.round((done / total) * 100) : 0; }

  function getHideDone() { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch (e) { return false; } }
  function setHideDone(v) { try { localStorage.setItem(HIDE_KEY, v ? "1" : "0"); } catch (e) {} }

  // ---------- menu azioni (bottom sheet) ----------
  function openSheet(title, actions) {
    el("sheet-title").textContent = title;
    var box = el("sheet-actions");
    box.innerHTML = "";
    actions.forEach(function (a) {
      var b = document.createElement("button");
      b.className = "sheet-btn" + (a.danger ? " danger" : "");
      b.textContent = a.label;
      b.addEventListener("click", function () { closeSheet(); a.fn(); });
      box.appendChild(b);
    });
    var c = document.createElement("button");
    c.className = "sheet-btn ghost"; c.textContent = "ANNULLA";
    c.addEventListener("click", closeSheet);
    box.appendChild(c);
    el("sheet").classList.remove("hidden");
  }
  function closeSheet() { el("sheet").classList.add("hidden"); }

  // ---------- HOME ----------
  function projectCard(p) {
    var total = Number(p.total) || 0, done = Number(p.done) || 0, pc = pct(done, total);
    var meta = total ? done + " DI " + total + " · " + pc + "%" : "VUOTO";
    return '<div class="proj-card' + (p.status === "archived" ? ' archived' : '') + '" data-id="' + escapeHtml(p.id) + '">' +
      '<div class="proj-emoji">' + escapeHtml(p.emoji || "📁") + '</div>' +
      '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="proj-meta">' + meta + '</div>' + (total ? tacche(pc, 10, true) : '') + '</div></div>';
  }

  async function renderHome(reload) {
    showView("view-home");
    var list = el("proj-list");
    if (reload !== false) {
      list.innerHTML = '<div class="loading">CARICAMENTO…</div>';
      try {
        state.projects = await API.listProjects();
      } catch (e) { list.innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>'; return; }
    }
    // più recenti in cima
    var sorted = state.projects.slice().sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    var active = sorted.filter(function (p) { return p.status !== "archived"; });
    var archived = sorted.filter(function (p) { return p.status === "archived"; });
    el("home-count").textContent = active.length + (active.length === 1 ? " progetto" : " progetti");

    var html = "";
    if (!active.length) html += '<div class="empty">Nessun progetto attivo.<br>Creane uno col pulsante qui sotto.</div>';
    html += active.map(projectCard).join("");
    if (archived.length) {
      html += '<button class="link archived-toggle" id="arch-toggle">' +
        (state.showArchived ? "▾" : "▸") + ' ARCHIVIATI (' + archived.length + ')</button>';
      if (state.showArchived) html += archived.map(projectCard).join("");
    }
    list.innerHTML = html;

    Array.prototype.forEach.call(list.querySelectorAll(".proj-card"), function (c) {
      c.addEventListener("click", function () { openProject(c.getAttribute("data-id")); });
    });
    var t = el("arch-toggle");
    if (t) t.addEventListener("click", function () { state.showArchived = !state.showArchived; renderHome(false); });
  }

  async function newProject() {
    var title = prompt("Nome del nuovo progetto:");
    if (title == null) return;
    title = title.trim(); if (!title) return;
    var p = { id: Engine.newId("p_"), title: title, description: "", emoji: "📁",
              color: "#1466c4", status: "doing" };
    showView("view-project");
    el("proj-body").innerHTML = '<div class="loading">CREO…</div>';
    try {
      var saved = await API.saveProject(p);
      state.current = saved; state.steps = [];
      renderProject();
      el("add-input").focus();
    } catch (e) { toast(e.message); renderHome(); }
  }

  // ---------- VISTA PROGETTO ----------
  async function openProject(projectId) {
    showView("view-project");
    el("proj-body").innerHTML = '<div class="loading">CARICAMENTO…</div>';
    try {
      var data = await API.getProject(projectId);
      if (!data.project) throw new Error("Progetto non trovato.");
      state.current = data.project; state.steps = data.steps || [];
      renderProject();
    } catch (e) { el("proj-body").innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>'; }
  }

  function renderProject() {
    var p = state.current;
    var prog = Engine.computeProgress(state.steps);
    var hide = getHideDone();
    var tree = Engine.buildTree(state.steps);

    var html = '<div class="proj-card head" id="proj-head">' +
      '<div class="proj-emoji">' + escapeHtml(p.emoji || "📁") + '</div>' +
      '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="proj-meta">' + (p.status === "archived" ? "ARCHIVIATO · " : "") +
      prog.done + ' DI ' + prog.total + ' FATTI · ' + prog.pct + '%</div></div></div>';
    html += tacche(prog.pct, 10);
    if (p.description) html += '<div class="note" id="proj-note">' + escapeHtml(p.description) + '</div>';

    if (!state.steps.length) {
      html += '<div class="empty">Nessuna cosa da fare.<br>Aggiungila nel campo qui sotto.</div>';
    } else {
      var body = tree.map(function (st) { return renderStep(st, hide); }).join("");
      html += body || '<div class="empty">Tutto fatto! 🎉</div>';
      if (hide && prog.done) html += '<div class="hint">' + prog.done + ' fatti nascosti</div>';
    }

    el("proj-body").innerHTML = html;
    wireProject();
  }

  // Un nodo fatto viene nascosto (con i suoi figli) se "nascondi fatti" è attivo.
  function renderStep(st, hide) {
    var done = isDone(st);
    if (hide && done) return "";
    var html = '<div class="step' + (done ? ' done' : '') + '" data-id="' + escapeHtml(st.id) + '">' +
      '<div class="chk' + (done ? ' done' : '') + '" data-act="toggle">' + (done ? "✓" : "") + '</div>' +
      '<div class="step-text" data-act="menu">' + escapeHtml(st.text) + '</div>' +
      '<button class="mini" data-act="sub" aria-label="Aggiungi sotto-step">＋</button></div>';
    var kids = (st.children || []).map(function (c) { return renderStep(c, hide); }).join("");
    if (kids) html += '<div class="substeps">' + kids + '</div>';
    return html;
  }

  function wireProject() {
    var body = el("proj-body");
    Array.prototype.forEach.call(body.querySelectorAll(".step"), function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="toggle"]').addEventListener("click", function () { onToggle(id); });
      row.querySelector('[data-act="menu"]').addEventListener("click", function () { stepMenu(id); });
      row.querySelector('[data-act="sub"]').addEventListener("click", function () { onAddSub(id); });
    });
    el("proj-head").addEventListener("click", projectMenu);
    var note = el("proj-note");
    if (note) note.addEventListener("click", editNote);
  }

  function findStep(id) { return state.steps.filter(function (s) { return String(s.id) === String(id); })[0]; }

  // ---------- step ----------
  function addStep(text, parentId) {
    var p = state.current;
    var s = { id: Engine.newId("s_"), projectId: p.id, parentId: parentId || "", text: text,
              order: Engine.nextOrder(state.steps, parentId || ""), done: false, kind: "action" };
    state.steps.push(s); renderProject();
    API.saveStep(s).catch(function (e) {
      state.steps = state.steps.filter(function (x) { return x !== s; });
      renderProject(); toast(e.message);
    });
  }

  function onAdd(ev) {
    ev.preventDefault();
    var input = el("add-input");
    var v = input.value.trim(); if (!v || !state.current) return;
    input.value = "";
    addStep(v, "");
    input.focus();
  }

  function onAddSub(id) {
    var s = findStep(id); if (!s) return;
    var v = prompt("Nuovo sotto-step di “" + s.text + "”:");
    if (v == null) return;
    v = v.trim(); if (!v) return;
    addStep(v, s.id);
  }

  async function onToggle(id) {
    var s = findStep(id); if (!s) return;
    var next = !isDone(s);
    s.done = next; renderProject();
    try { await API.toggleStep(id, next); } catch (e) { s.done = !next; renderProject(); toast(e.message); }
  }

  function stepMenu(id) {
    var s = findStep(id); if (!s) return;
    openSheet(s.text, [
      { label: "✎ MODIFICA TESTO", fn: function () { onEdit(id); } },
      { label: "＋ AGGIUNGI SOTTO-STEP", fn: function () { onAddSub(id); } },
      { label: "↑ SPOSTA SU", fn: function () { onMove(id, -1); } },
      { label: "↓ SPOSTA GIÙ", fn: function () { onMove(id, 1); } },
      { label: "✕ ELIMINA", danger: true, fn: function () { onDelete(id); } }
    ]);
  }

  function onEdit(id) {
    var s = findStep(id); if (!s) return;
    var v = prompt("Modifica:", s.text);
    if (v == null) return;
    v = v.trim(); if (!v || v === s.text) return;
    var old = s.text; s.text = v; renderProject();
    API.saveStep(s).catch(function (e) { s.text = old; renderProject(); toast(e.message); });
  }

  function onMove(id, dir) {
    var changed = Engine.moveStep(state.steps, id, dir);
    if (!changed.length) return;
    var old = {};
    changed.forEach(function (c) { var s = findStep(c.id); old[c.id] = s.order; s.order = c.order; });
    renderProject();
    API.saveSteps(changed).catch(function (e) {
      Object.keys(old).forEach(function (k) { findStep(k).order = old[k]; });
      renderProject(); toast(e.message);
    });
  }

  function onDelete(id) {
    var s = findStep(id); if (!s) return;
    var ids = Engine.descendantIds(state.steps, id);
    var msg = "Eliminare “" + s.text + "”" + (ids.length > 1 ? " e i suoi " + (ids.length - 1) + " sotto-step" : "") + "?";
    if (!confirm(msg)) return;
    var set = {}; ids.forEach(function (x) { set[x] = true; });
    var before = state.steps;
    state.steps = state.steps.filter(function (x) { return !set[String(x.id)]; });
    renderProject();
    API.deleteStep(id).catch(function (e) { state.steps = before; renderProject(); toast(e.message); });
  }

  // ---------- progetto ----------
  // Salva il progetto con le modifiche `patch`; in caso di errore ripristina.
  function patchProject(patch) {
    var p = state.current, old = {};
    Object.keys(patch).forEach(function (k) { old[k] = p[k]; p[k] = patch[k]; });
    renderProject();
    return API.saveProject(p).catch(function (e) {
      Object.keys(old).forEach(function (k) { p[k] = old[k]; });
      renderProject(); toast(e.message);
    });
  }

  function editNote() {
    var p = state.current;
    var v = prompt("Nota del progetto (lascia vuoto per toglierla):", p.description || "");
    if (v == null) return;
    patchProject({ description: v.trim() });
  }

  function projectMenu() {
    var p = state.current; if (!p) return;
    var hide = getHideDone();
    var archived = p.status === "archived";
    openSheet(p.title, [
      { label: "✎ RINOMINA", fn: function () {
          var v = prompt("Nome del progetto:", p.title);
          if (v == null) return; v = v.trim(); if (!v || v === p.title) return;
          patchProject({ title: v });
        } },
      { label: "☺ CAMBIA EMOJI", fn: function () {
          var v = prompt("Emoji del progetto:", p.emoji || "");
          if (v == null) return; v = v.trim();
          patchProject({ emoji: v || "📁" });
        } },
      { label: p.description ? "✎ MODIFICA NOTA" : "＋ AGGIUNGI NOTA", fn: editNote },
      { label: hide ? "◉ MOSTRA I FATTI" : "◎ NASCONDI I FATTI", fn: function () { setHideDone(!hide); renderProject(); } },
      { label: archived ? "↺ RIATTIVA" : "▣ ARCHIVIA", fn: function () {
          patchProject({ status: archived ? "doing" : "archived" });
          toast(archived ? "Progetto riattivato." : "Progetto archiviato.");
        } },
      { label: "✕ ELIMINA PROGETTO", danger: true, fn: onDeleteProject }
    ]);
  }

  async function onDeleteProject() {
    var p = state.current;
    if (!confirm("Eliminare il progetto “" + p.title + "” e tutte le sue cose da fare?")) return;
    el("proj-body").innerHTML = '<div class="loading">ELIMINO…</div>';
    try { await API.deleteProject(p.id); state.current = null; renderHome(); }
    catch (e) { renderProject(); toast(e.message); }
  }

  // ---------- wiring globale ----------
  el("btn-new").addEventListener("click", newProject);
  el("proj-back").addEventListener("click", function () { renderHome(); });
  el("proj-menu").addEventListener("click", projectMenu);
  el("add-form").addEventListener("submit", onAdd);
  el("sheet-bg").addEventListener("click", closeSheet);

  renderHome();
})();
