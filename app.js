// StepS — orchestrazione UI (home, creazione guidata, piano).
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var state = { projects: [], current: null, steps: [] };
  var create = { description: "", questions: [], answers: [], qi: 0 };

  // ---------- shell ----------
  function showView(id) {
    ["view-home", "view-create", "view-plan"].forEach(function (v) {
      el(v).classList.toggle("hidden", v !== id);
    });
  }

  function toast(msg) {
    var t = el("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.add("hidden"); }, 3500);
  }

  function tacche(pct, n) {
    n = n || 10;
    var full = Math.round((pct / 100) * n);
    var html = '<div class="tacche">';
    for (var i = 0; i < n; i++) html += '<div class="tacca' + (i < full ? ' on' : '') + '"></div>';
    return html + '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  // ---------- HOME ----------
  async function renderHome() {
    showView("view-home");
    var list = el("proj-list");
    list.innerHTML = '<div class="loading">CARICAMENTO…</div>';
    try {
      state.projects = await API.listProjects();
    } catch (e) { list.innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>'; return; }
    el("home-count").textContent = state.projects.length + " progetti";
    if (!state.projects.length) {
      list.innerHTML = '<div class="empty">Nessun progetto.<br>Creane uno col pulsante qui sotto.</div>';
      return;
    }
    list.innerHTML = state.projects.map(function (p) {
      return '<div class="proj-card" data-id="' + escapeHtml(p.id) + '">' +
        '<div class="proj-emoji">' + (p.emoji || "📈") + '</div>' +
        '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="proj-meta">' + escapeHtml(String(p.status || "").toUpperCase()) + '</div></div></div>';
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".proj-card"), function (c) {
      c.addEventListener("click", function () { openPlan(c.getAttribute("data-id")); });
    });
  }

  // ---------- CREAZIONE GUIDATA ----------
  function startCreate() {
    create = { description: "", questions: [], answers: [], qi: 0 };
    showView("view-create");
    el("create-step-label").textContent = "DESCRIVI";
    el("create-body").innerHTML =
      '<p class="qtext">Descrivi il progetto: cosa vuoi fare, a che punto sei, cosa hai già, cosa ti blocca.</p>' +
      '<textarea id="desc" placeholder="Es. Sto facendo un muro di mattoni di polistirolo…"></textarea>' +
      '<button class="btn" id="desc-next">AVANTI</button>';
    el("desc-next").addEventListener("click", askQuestions);
  }

  async function askQuestions() {
    var d = el("desc").value.trim();
    if (d.length < 5) { toast("Scrivi qualche dettaglio in più."); return; }
    create.description = d;
    el("create-body").innerHTML = '<div class="loading">L’AI sta preparando le domande…</div>';
    try {
      var r = await API.generateQuestions(d);
      create.questions = r.questions; create.answers = []; create.qi = 0;
      renderQuestion();
    } catch (e) {
      el("create-body").innerHTML =
        '<div class="empty">' + escapeHtml(e.message) + '</div>' +
        '<button class="btn ghost" id="retry">RIPROVA</button>';
      el("retry").addEventListener("click", askQuestions);
    }
  }

  function renderQuestion() {
    var i = create.qi, n = create.questions.length;
    el("create-step-label").textContent = "DOMANDE";
    el("create-body").innerHTML =
      '<div class="qprog">' + (i + 1) + ' DI ' + n + '</div>' +
      '<p class="qtext">' + escapeHtml(create.questions[i]) + '</p>' +
      '<textarea id="ans" placeholder="La tua risposta…"></textarea>' +
      '<button class="btn" id="q-next">' + (i + 1 < n ? "AVANTI" : "CREA IL PIANO") + '</button>';
    el("ans").value = create.answers[i] || "";
    el("q-next").addEventListener("click", nextQuestion);
  }

  function nextQuestion() {
    create.answers[create.qi] = el("ans").value.trim();
    if (create.qi + 1 < create.questions.length) { create.qi++; renderQuestion(); }
    else generate();
  }

  async function generate() {
    el("create-step-label").textContent = "GENERO";
    el("create-body").innerHTML = '<div class="loading">Sto costruendo il piano…</div>';
    var qa = create.questions.map(function (q, i) { return { q: q, a: create.answers[i] || "" }; });
    try {
      var r = await API.generatePlan(create.description, qa);
      openPlan(r.project.id, r);
    } catch (e) {
      el("create-body").innerHTML =
        '<div class="empty">' + escapeHtml(e.message) + '</div>' +
        '<button class="btn ghost" id="retry2">RIPROVA</button>';
      el("retry2").addEventListener("click", generate);
    }
  }

  // ---------- VISTA PIANO ----------
  async function openPlan(projectId, preloaded) {
    showView("view-plan");
    el("plan-body").innerHTML = '<div class="loading">CARICAMENTO…</div>';
    try {
      var data = preloaded || await API.getPlan(projectId);
      if (!data.project) throw new Error("Progetto non trovato.");
      state.current = data.project; state.steps = data.steps || [];
      renderPlan();
    } catch (e) { el("plan-body").innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>'; }
  }

  function renderPlan() {
    var p = state.current;
    var prog = Engine.computeProgress(state.steps);
    el("plan-pct").textContent = prog.pct + "%";
    var tree = Engine.buildTree(state.steps);

    var html = '';
    html += '<div class="proj-card" style="cursor:default">' +
      '<div class="proj-emoji">' + (p.emoji || "📈") + '</div>' +
      '<div class="proj-main"><div class="proj-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="proj-meta">' + prog.done + ' DI ' + prog.total + ' FATTI · ' + prog.pct + '%</div></div></div>';
    html += tacche(prog.pct, 10);

    tree.forEach(function (sec, i) {
      html += '<div class="fase"><div class="quota"><div class="bar"></div>' +
        '<div class="lab">FASE ' + pad2(i + 1) + '</div><div class="bar"></div></div>' +
        '<div class="fase-body"><div class="pill">' + escapeHtml(sec.text) + '</div>';
      sec.children.forEach(function (st) { html += renderStep(st); });
      html += '</div></div>';
    });

    html += '<div class="cartiglio"><div class="code">1B</div>' +
      '<div class="meta"><div class="t">' + escapeHtml(String(p.title || "").toUpperCase()) + '</div>' +
      '<div class="s">STEPS · PROGETTO PERSONALE · ' + prog.total + ' STEP</div></div></div>';

    el("plan-body").innerHTML = html;
    wirePlan();
  }

  function renderStep(st) {
    var kids = st.children && st.children.length;
    var done = st.done === true || st.done === "true";
    var html = '<div class="step' + (done ? ' done' : '') + '" data-id="' + escapeHtml(st.id) + '">' +
      '<div class="grow">' +
      '<div class="chk' + (done ? ' done' : '') + '" data-act="toggle">' + (done ? "✓" : "") + '</div>' +
      '<div class="step-text" data-act="edit">' + escapeHtml(st.text) + '</div></div>' +
      '<button class="mini" data-act="decompose">⊕ SCOMPONI</button></div>';
    if (kids) {
      html += '<div class="substeps">';
      st.children.forEach(function (c) { html += renderStep(c); });
      html += '</div>';
    }
    return html;
  }

  function wirePlan() {
    Array.prototype.forEach.call(el("plan-body").querySelectorAll(".step"), function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="toggle"]').addEventListener("click", function (e) { e.stopPropagation(); onToggle(id); });
      row.querySelector('[data-act="edit"]').addEventListener("click", function (e) { e.stopPropagation(); onEdit(id); });
      var dec = row.querySelector('[data-act="decompose"]');
      if (dec) dec.addEventListener("click", function (e) { e.stopPropagation(); onDecompose(id); });
    });
  }

  function findStep(id) { return state.steps.filter(function (s) { return String(s.id) === String(id); })[0]; }

  async function onToggle(id) {
    var s = findStep(id); if (!s) return;
    var next = !(s.done === true || s.done === "true");
    s.done = next; renderPlan();
    try { await API.toggleStep(id, next); } catch (e) { s.done = !next; renderPlan(); toast(e.message); }
  }

  function onEdit(id) {
    var s = findStep(id); if (!s) return;
    var v = prompt("Modifica step:", s.text);
    if (v == null) return;
    v = v.trim(); if (!v) return;
    var old = s.text; s.text = v; renderPlan();
    API.saveStep(s).catch(function (e) { s.text = old; renderPlan(); toast(e.message); });
  }

  async function onDecompose(id) {
    var s = findStep(id); if (!s) return;
    toast("Scompongo…");
    try {
      var r = await API.decomposeStep(state.current.id, id, s.text);
      r.steps.forEach(function (ns) { state.steps.push(ns); });
      renderPlan();
    } catch (e) { toast(e.message); }
  }

  // ---------- wiring globale ----------
  el("btn-new").addEventListener("click", startCreate);
  el("create-back").addEventListener("click", renderHome);
  el("plan-back").addEventListener("click", renderHome);

  renderHome();
})();
