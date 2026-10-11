// Projekt — orchestrazione UI (home progetti, vista progetto con cose da fare).
//
// Dati: all'avvio si scarica TUTTO (getAll) e si tiene in memoria, così la
// navigazione è istantanea. Una copia va in localStorage per mostrare subito
// i dati al prossimo avvio; lo Sheet resta la fonte ufficiale. Le modifiche
// sono ottimistiche (subito a schermo, salvate in sottofondo).
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var state = { projects: [], steps: [], currentId: null, showArchived: false, loaded: false };
  var HIDE_KEY = "projekt.hideDone";
  var CACHE_KEY = "projekt.cache";
  var REFRESH_AFTER_MS = 30000;   // al ritorno sull'app, riaggiorna se l'ultimo sync è più vecchio
  var sync = { pending: 0, writeSeq: 0, again: false, running: false, lastAt: 0 };

  // ---------- shell ----------
  function showView(id) {
    ["view-home", "view-project"].forEach(function (v) {
      el(v).classList.toggle("hidden", v !== id);
    });
  }
  function currentView() { return el("view-project").classList.contains("hidden") ? "home" : "project"; }

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
  function nowIso() { return new Date().toISOString(); }

  function getHideDone() { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch (e) { return false; } }
  function setHideDone(v) { try { localStorage.setItem(HIDE_KEY, v ? "1" : "0"); } catch (e) {} }

  // ---------- dati in memoria ----------
  function current() {
    return state.projects.filter(function (p) { return String(p.id) === String(state.currentId); })[0] || null;
  }
  function stepsOf(projectId) {
    return state.steps.filter(function (s) { return String(s.projectId) === String(projectId); });
  }
  function projSteps() { return stepsOf(state.currentId); }
  function findStep(id) { return state.steps.filter(function (s) { return String(s.id) === String(id); })[0]; }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ projects: state.projects, steps: state.steps })); }
    catch (e) {}
  }
  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c && Array.isArray(c.projects) && Array.isArray(c.steps)) {
        state.projects = c.projects; state.steps = c.steps; state.loaded = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Ridisegna la vista attiva e aggiorna la copia locale.
  function render() {
    if (currentView() === "project" && current()) renderProject();
    else renderHome();
    saveCache();
  }

  // ---------- sync col server ----------
  // Ogni scrittura passa da qui: conta le scritture in corso, così un
  // riaggiornamento non sovrascrive modifiche non ancora salvate.
  function write(promise) {
    sync.pending++; sync.writeSeq++;
    return promise.finally(function () {
      sync.pending--;
      if (sync.pending === 0 && sync.again) refresh();
    });
  }

  function setSyncing(on) { el("sync").classList.toggle("hidden", !on); }

  async function refresh() {
    if (sync.pending > 0 || sync.running) { sync.again = true; return; }
    sync.again = false; sync.running = true;
    var seq = sync.writeSeq;
    setSyncing(true);
    try {
      var data = await API.getAll();
      // una scrittura è partita durante il fetch: il risultato potrebbe essere vecchio, si riprova
      if (sync.writeSeq !== seq || sync.pending > 0) { sync.again = true; return; }
      state.projects = data.projects || []; state.steps = data.steps || [];
      state.loaded = true; sync.lastAt = Date.now();
      if (state.currentId && !current()) { state.currentId = null; showView("view-home"); }
      render();
    } catch (e) {
      if (!state.loaded) el("proj-list").innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>';
      else toast("Sync non riuscito: " + e.message);
    } finally {
      sync.running = false; setSyncing(false);
      if (sync.again && sync.pending === 0) refresh();
    }
  }

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
    var prog = Engine.computeProgress(stepsOf(p.id));
    var meta = prog.total ? prog.done + " DI " + prog.total + " · " + prog.pct + "%" : "VUOTO";
    return '<div class="proj-card' + (p.status === "archived" ? ' archived' : '') + '" data-id="' + escapeHtml(p.id) + '">' +
      '<div class="proj-emoji">' + escapeHtml(p.emoji || "📁") + '</div>' +
      '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="proj-meta">' + meta + '</div>' + (prog.total ? tacche(prog.pct, 10, true) : '') + '</div></div>';
  }

  function renderHome() {
    showView("view-home");
    var list = el("proj-list");
    if (!state.loaded) { list.innerHTML = '<div class="loading">CARICAMENTO…</div>'; return; }
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
    if (t) t.addEventListener("click", function () { state.showArchived = !state.showArchived; renderHome(); });
  }

  function goHome() { state.currentId = null; closeSheet(); render(); }

  function newProject() {
    var title = prompt("Nome del nuovo progetto:");
    if (title == null) return;
    title = title.trim(); if (!title) return;
    var now = nowIso();
    var p = { id: Engine.newId("p_"), title: title, description: "", emoji: "📁",
              color: "#1466c4", status: "doing", createdAt: now, updatedAt: now };
    state.projects.push(p);
    openProject(p.id);
    el("add-input").focus();
    write(API.saveProject(p)).catch(function (e) {
      state.projects = state.projects.filter(function (x) { return x !== p; });
      toast(e.message); goHome();
    });
  }

  // ---------- VISTA PROGETTO ----------
  function openProject(projectId) {
    state.currentId = projectId;
    showView("view-project");
    render();
    window.scrollTo(0, 0);
  }

  function renderProject() {
    var p = current();
    if (!p) { goHome(); return; }
    showView("view-project");
    var steps = projSteps();
    var prog = Engine.computeProgress(steps);
    var hide = getHideDone();
    var tree = Engine.buildTree(steps);

    var html = '<div class="proj-card head" id="proj-head">' +
      '<div class="proj-emoji">' + escapeHtml(p.emoji || "📁") + '</div>' +
      '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="proj-meta">' + (p.status === "archived" ? "ARCHIVIATO · " : "") +
      prog.done + ' DI ' + prog.total + ' FATTI · ' + prog.pct + '%</div></div></div>';
    html += tacche(prog.pct, 10);
    if (p.description) html += '<div class="note" id="proj-note">' + escapeHtml(p.description) + '</div>';

    if (!steps.length) {
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

  // ---------- step ----------
  function addStep(text, parentId) {
    var s = { id: Engine.newId("s_"), projectId: state.currentId, parentId: parentId || "", text: text,
              order: Engine.nextOrder(projSteps(), parentId || ""), done: false, kind: "action" };
    state.steps.push(s); render();
    write(API.saveStep(s)).catch(function (e) {
      state.steps = state.steps.filter(function (x) { return x !== s; });
      render(); toast(e.message);
    });
  }

  function onAdd(ev) {
    ev.preventDefault();
    var input = el("add-input");
    var v = input.value.trim(); if (!v || !current()) return;
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

  function onToggle(id) {
    var s = findStep(id); if (!s) return;
    var next = !isDone(s);
    s.done = next; render();
    write(API.toggleStep(id, next)).catch(function (e) { s.done = !next; render(); toast(e.message); });
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
    var old = s.text; s.text = v; render();
    write(API.saveStep(s)).catch(function (e) { s.text = old; render(); toast(e.message); });
  }

  function onMove(id, dir) {
    var changed = Engine.moveStep(projSteps(), id, dir);
    if (!changed.length) return;
    var old = {};
    changed.forEach(function (c) { var s = findStep(c.id); old[c.id] = s.order; s.order = c.order; });
    render();
    write(API.saveSteps(changed)).catch(function (e) {
      Object.keys(old).forEach(function (k) { var s = findStep(k); if (s) s.order = old[k]; });
      render(); toast(e.message);
    });
  }

  function onDelete(id) {
    var s = findStep(id); if (!s) return;
    var ids = Engine.descendantIds(projSteps(), id);
    var msg = "Eliminare “" + s.text + "”" + (ids.length > 1 ? " e i suoi " + (ids.length - 1) + " sotto-step" : "") + "?";
    if (!confirm(msg)) return;
    var set = {}; ids.forEach(function (x) { set[x] = true; });
    var removed = state.steps.filter(function (x) { return set[String(x.id)]; });
    state.steps = state.steps.filter(function (x) { return !set[String(x.id)]; });
    render();
    write(API.deleteStep(id)).catch(function (e) {
      state.steps = state.steps.concat(removed); render(); toast(e.message);
    });
  }

  // ---------- progetto ----------
  // Salva il progetto con le modifiche `patch`; in caso di errore ripristina.
  function patchProject(patch) {
    var p = current(), old = {};
    if (!p) return;
    patch.updatedAt = nowIso();
    Object.keys(patch).forEach(function (k) { old[k] = p[k]; p[k] = patch[k]; });
    render();
    write(API.saveProject(p)).catch(function (e) {
      Object.keys(old).forEach(function (k) { p[k] = old[k]; });
      render(); toast(e.message);
    });
  }

  function editNote() {
    var p = current(); if (!p) return;
    var v = prompt("Nota del progetto (lascia vuoto per toglierla):", p.description || "");
    if (v == null) return;
    patchProject({ description: v.trim() });
  }

  function projectMenu() {
    var p = current(); if (!p) return;
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
      { label: hide ? "◉ MOSTRA I FATTI" : "◎ NASCONDI I FATTI", fn: function () { setHideDone(!hide); render(); } },
      { label: archived ? "↺ RIATTIVA" : "▣ ARCHIVIA", fn: function () {
          patchProject({ status: archived ? "doing" : "archived" });
          toast(archived ? "Progetto riattivato." : "Progetto archiviato.");
        } },
      { label: "✕ ELIMINA PROGETTO", danger: true, fn: onDeleteProject }
    ]);
  }

  function onDeleteProject() {
    var p = current(); if (!p) return;
    if (!confirm("Eliminare il progetto “" + p.title + "” e tutte le sue cose da fare?")) return;
    var removedSteps = stepsOf(p.id);
    state.projects = state.projects.filter(function (x) { return x !== p; });
    state.steps = state.steps.filter(function (x) { return String(x.projectId) !== String(p.id); });
    goHome();
    write(API.deleteProject(p.id)).catch(function (e) {
      state.projects.push(p); state.steps = state.steps.concat(removedSteps);
      render(); toast(e.message);
    });
  }

  // ---------- wiring globale ----------
  el("btn-new").addEventListener("click", newProject);
  el("proj-back").addEventListener("click", goHome);
  el("proj-menu").addEventListener("click", projectMenu);
  el("add-form").addEventListener("submit", onAdd);
  el("sheet-bg").addEventListener("click", closeSheet);
  // tornando sull'app (es. dopo averla usata da un altro dispositivo) riaggiorna in silenzio
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && Date.now() - sync.lastAt > REFRESH_AFTER_MS) refresh();
  });

  loadCache();   // se c'è una copia locale la mostra subito
  renderHome();
  refresh();
})();
