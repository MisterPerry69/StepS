// Projekt — client verso il Google Apps Script. Unico punto che fa fetch.
(function () {
  "use strict";

  async function call(action, payload) {
    const url = window.CONFIG && window.CONFIG.GAS_URL;
    if (!url || url.indexOf("INCOLLA") === 0) {
      throw new Error("CONFIG.GAS_URL non impostato. Vedi gas/SETUP.md.");
    }
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        // text/plain evita la preflight CORS con i Web App GAS
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, payload: payload || {} })
      });
    } catch (e) {
      throw new Error("Nessuna connessione al server.");
    }
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error("Risposta non valida dal server."); }
    if (!json || json.ok !== true) {
      throw new Error((json && json.error) || "Errore sconosciuto dal server.");
    }
    return json.data;
  }

  window.API = {
    listProjects: function () { return call("listProjects"); },
    getProject: function (projectId) { return call("getProject", { projectId: projectId }); },
    saveProject: function (project) { return call("saveProject", { project: project }); },
    deleteProject: function (projectId) { return call("deleteProject", { projectId: projectId }); },
    saveStep: function (step) { return call("saveSteps", { steps: [step] }); },
    saveSteps: function (steps) { return call("saveSteps", { steps: steps }); },
    deleteStep: function (stepId) { return call("deleteStep", { stepId: stepId }); },
    toggleStep: function (stepId, done) { return call("toggleStep", { stepId: stepId, done: done }); }
  };
})();
