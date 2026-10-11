// Projekt — service worker minimale: precache del guscio statico.
var CACHE = "projekt-v2";
var SHELL = ["./", "./index.html", "./style.css", "./engine.js",
  "./api.js", "./app.js", "./config.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  var url = e.request.url;
  // le chiamate al GAS passano sempre dalla rete (mai cache)
  if (url.indexOf("script.google.com") !== -1 || url.indexOf("googleusercontent") !== -1) return;
  e.respondWith(
    caches.match(e.request).then(function (r) { return r || fetch(e.request); })
  );
});
