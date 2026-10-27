/* storage.js — 기기 내부 저장 계층 (IndexedDB, 없으면 localStorage)
 * 앱 본체(app.js)는 이 파일의 AppStorage 만 쓴다.
 * 2단계(클라우드 동기화)에서는 makeStore()가 돌려주는 객체의
 * watch / save / remove 세 함수만 서버 버전으로 바꾸면 된다.
 */
(function (global) {
  const DB_NAME = "round-score-note", DB_VER = 1;
  const STORES = ["rounds", "courses", "members", "settings"];
  const hasIDB = !!global.indexedDB;
  let dbP = null;

  function open() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = () => { const db = rq.result; STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); }); };
      rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => db.close(); res(db); };
      rq.onerror = () => { dbP = null; rej(rq.error); };
      rq.onblocked = () => { dbP = null; rej(new Error("blocked")); };
    });
    return dbP;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = (db, name, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(name, mode); fn(t.objectStore(name));
    t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("abort"));
  });
  async function idbGetAll(name) {
    const db = await open(); const st = db.transaction(name, "readonly").objectStore(name);
    const [keys, vals] = await Promise.all([req(st.getAllKeys()), req(st.getAll())]);
    const o = {}; keys.forEach((k, i) => { o[k] = vals[i]; }); return o;
  }
  async function idbPut(name, id, body) { const db = await open(); await tx(db, name, "readwrite", st => st.put(body, id)); }
  async function idbDel(name, id) { const db = await open(); await tx(db, name, "readwrite", st => st.delete(id)); }
  async function idbClear(name) { const db = await open(); await tx(db, name, "readwrite", st => st.clear()); }

  /* localStorage 대체 (IndexedDB 를 못 쓰는 아주 오래된 브라우저용) */
  const LKEY = n => "golf-" + n + "-v1";
  const localRead = n => { try { return JSON.parse(localStorage.getItem(LKEY(n)) || "{}"); } catch (e) { return {}; } };
  const localWrite = (n, o) => { try { localStorage.setItem(LKEY(n), JSON.stringify(o)); } catch (e) { throw { message: "이 브라우저에 저장할 수 없어요" }; } };

  async function readAll(name) { return hasIDB ? idbGetAll(name) : localRead(name); }
  async function putOne(name, id, body) { if (hasIDB) return idbPut(name, id, body); const o = localRead(name); o[id] = body; localWrite(name, o); }
  async function delOne(name, id) { if (hasIDB) return idbDel(name, id); const o = localRead(name); delete o[id]; localWrite(name, o); }
  async function clearOne(name) { if (hasIDB) return idbClear(name); localWrite(name, {}); }

  /* 앱이 쓰는 저장소 객체: watch(cb) 는 전체 데이터를 한 번 돌려주고, save/remove 는 Promise */
  function makeStore(name) {
    return {
      shared: false,
      kind: hasIDB ? "idb" : "local",
      watch(cb) { readAll(name).then(cb, e => { console.error("load failed", name, e); cb({}); }); },
      save(id, body) { return putOne(name, id, body); },
      remove(id) { return delOne(name, id); }
    };
  }

  /* 백업 파일 (JSON) 만들기 / 읽기 */
  async function exportAll(extra) {
    const data = {}; for (const s of STORES) data[s] = await readAll(s);
    return Object.assign({ app: "round-score-note", format: 1, exportedAt: new Date().toISOString() }, extra || {}, { data });
  }
  function summarize(obj) {
    const d = (obj && obj.data) || {}; const n = s => Object.keys(d[s] || {}).length;
    const photos = Object.values(d.rounds || {}).reduce((a, r) => a + ((r && r.photos) || []).length, 0) + (((d.settings || {}).hcp || {}).photos || []).length;
    return { rounds: n("rounds"), courses: n("courses"), members: n("members"), settings: n("settings"), photos, exportedAt: obj && obj.exportedAt || "" };
  }
  function isBackup(obj) { return !!(obj && typeof obj === "object" && obj.data && typeof obj.data === "object" && (obj.app === "round-score-note" || obj.data.rounds)); }
  async function importAll(obj, mode) {
    const d = obj.data || {};
    for (const s of STORES) {
      if (mode === "replace") await clearOne(s);
      for (const [id, body] of Object.entries(d[s] || {})) { if (!body || typeof body !== "object") continue; const b = Object.assign({}, body); delete b.id; await putOne(s, id, b); }
    }
  }
  async function clearAll() { for (const s of STORES) await clearOne(s); }
  async function usage() { try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } } catch (e) { } return null; }
  async function persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { } return false; }

  global.AppStorage = { STORES, hasIDB, makeStore, readAll, exportAll, importAll, clearAll, summarize, isBackup, usage, persist };
})(window);
