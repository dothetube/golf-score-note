/* 서비스 워커: 앱 파일을 기기에 캐시해 오프라인에서도 열리게 한다.
 * 앱 파일을 고쳐서 다시 올릴 때는 아래 VERSION 을 올려야 휴대폰이 새 파일을 받는다. */
const VERSION = "2026-10-31a";
const CACHE = "round-score-note-" + VERSION;
const SHELL = ["./", "./index.html", "./css/style.css", "./js/config.js", "./js/storage.js", "./js/ai.js", "./js/app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // 골프장 목록: 파일만 바꿔 올려도 새 내용을 받도록 네트워크 우선 (앱 파일 캐시와 분리)
    if (url.pathname.includes("/data/")) { e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }))); return; }
    // 앱 파일: 캐시 우선, 없으면 네트워크에서 받아 캐시
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === "navigate" ? caches.match("./index.html") : undefined)));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    // 글꼴: 캐시된 것을 먼저 주고 뒤에서 갱신. 오프라인이면 기본 글꼴로 표시됨
    e.respondWith(caches.open(CACHE + "-fonts").then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
