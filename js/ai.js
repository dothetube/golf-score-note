/* AI 사진 읽기: 사진을 줄여 중계 서버(/ai)로 보내고, Claude 가 읽은 JSON 을 받는다.
 * API 키는 서버에만 있다. 서버에 키가 없으면 limits() 가 images:false 를 돌려 화면이 그대로 유지된다.
 * 오류는 { code } 로 던진다. 안내 문구는 app.js 의 aiErr() 에 있다. */
(function(){
  const BASE = (window.GOLF_API_BASE || "").replace(/\/$/, "");
  if (!BASE) return;
  const KEY = "golf-ai-ready";
  const STATUS_TIMEOUT = 2500, READ_TIMEOUT = 120000;
  const MAX_EDGE = 2576, MAX_PIXELS = 3.6e6;   // 이보다 크면 Claude 쪽에서 어차피 줄인다 (약 4,800토큰)
  const MAX_B64 = 2.2e6;                       // 서버 상한(3MB) 안쪽, 약한 신호에서도 올라가는 크기
  const STEPS = [[1, .85], [1, .72], [.8, .72], [.65, .7]];   // [배율, JPEG 화질]. 표 글자가 읽히는 선까지만 낮춘다

  function known(){ try { return localStorage.getItem(KEY) === "1"; } catch(e){ return false; } }
  function remember(ok){ try { localStorage.setItem(KEY, ok ? "1" : "0"); } catch(e){} }
  async function timed(url, init, ms){
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, Object.assign({ signal: ctl.signal }, init)); }
    finally { clearTimeout(t); }
  }
  /* 서버 확인에 실패하면(오프라인, 약한 신호, 서버 오류) 마지막으로 확인한 값을 쓴다. 절대 실패로 끝나지 않는다 */
  async function limits(){
    if (navigator.onLine === false) return { images: known() };
    try {
      const r = await timed(BASE + "/ai/status", { headers: { "Accept": "application/json" }, cache: "no-store" }, STATUS_TIMEOUT);
      if (!r.ok) return { images: known() };
      const ok = !!(await r.json()).ready;
      remember(ok);
      return { images: ok };
    } catch(e) { return { images: known() }; }
  }
  function toB64(blob){
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  }
  async function prepare(file){
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const w = im.naturalWidth, h = im.naturalHeight;
      const fit = Math.min(1, MAX_EDGE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
      for (const [scale, q] of STEPS) {
        const c = document.createElement("canvas"); c.width = Math.round(w * fit * scale); c.height = Math.round(h * fit * scale);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);   // 투명 PNG 가 검게 나오지 않게
        g.drawImage(im, 0, 0, c.width, c.height);
        const blob = await new Promise(res => c.toBlob(res, "image/jpeg", q));
        if (blob && blob.size * 4 / 3 <= MAX_B64) return { media_type: "image/jpeg", data: await toB64(blob) };
      }
    } catch(e) { throw { code: "image_rejected" }; }
    finally { URL.revokeObjectURL(url); }
    throw { code: "image_rejected" };
  }
  async function json(prompt, opts){
    const file = opts && opts.images;
    if (!file) throw { code: "image_rejected" };
    if (navigator.onLine === false) throw { code: "offline" };
    const image = await prepare(file);
    let res;
    try { res = await timed(BASE + "/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image }) }, READ_TIMEOUT); }
    catch(e) { throw { code: e && e.name === "AbortError" ? "timeout" : navigator.onLine === false ? "offline" : "network" }; }
    const r = await res.json().catch(() => ({}));
    if (res.ok && r.result) return r.result;
    if (r.error === "no_key") remember(false);
    throw { code: r.error || "http" };
  }
  window.AI_PROVIDER = { known, limits, json };
})();
