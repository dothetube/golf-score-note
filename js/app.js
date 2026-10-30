const DEFAULT_PLAYERS = ["사모님","명실장님","박부장님","강차장"];
const FLAG = '<svg class="flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 21V3"/><path d="M6 4l11 3.5L6 11" fill="var(--green)" stroke="var(--green)"/><ellipse cx="9" cy="21" rx="6" ry="1.2"/></svg>';

let store = null, cstore = null, mstore = null, sstore = null, members = {}, settings = {}, memQ = "", memGroup = "", grpEdit = false, memEdit = null, memBusy = false, memMsg = "", hcpBig = null, dlFn = null, assetsFn = null, bigPhoto = null, delPhoto = null, courses = {}, addForm = null, sampleFn = null, photoOK = false, rounds = {}, cur = null, view = "list", tab = "play", hole = 0, home = "rounds", statP = null, editInfo = false, filterClub = "", relMode = false, myName = "";
try { myName = localStorage.getItem("golf-myname") || ""; } catch(e){}
if (!myName) { myName = "강성환"; try { localStorage.setItem("golf-myname", myName); } catch(e){} }
let editMe = false, netTab = "all", tieHigh = true;
try { tieHigh = localStorage.getItem("golf-tie") !== "low"; } catch(e){}
try { relMode = localStorage.getItem("golf-relmode") === "1"; } catch(e){}
const relS = v => v > 0 ? "+"+v : String(v);
let hcpDel = null, installEvt = null, impPending = null, impMsg = "", usageTxt = "", clearAsk = false, packBusy = false, packMsg = "";
let setup = null, confirmDel = false, dirty = false, saving = false, saveTimer = null, saveErr = "";
const app = document.getElementById("app");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const todayStr = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const pars = r => [...r.front.par, ...r.back.par];
const sgn = n => n > 0 ? "+"+n : n === 0 ? "E" : String(n);
function term(rel, par){
  const st = par + rel;
  if (st === 1) return "홀인원";
  if (rel === -3) return "알바트로스";
  if (rel === -2) return "이글";
  if (rel === -1) return "버디";
  if (rel === 0) return "파";
  if (st === par*2) return "양파";
  return ["","보기","더블","트리플","쿼드"][rel] || ("+"+rel);
}
const cls = rel => rel == null ? "" : rel < 0 ? "b" : rel === 0 ? "p" : rel >= 3 ? "x" : "";

function stats(r){
  const P = pars(r);
  return r.players.map((name, i) => {
    const s = r.scores["p"+i] || [];
    let rel = 0, st = 0, n = 0, f = 0, b = 0, fn = 0, bn = 0, bird = 0, parc = 0, fPar = 0, bPar = 0;
    s.forEach((v, h) => { if (v == null) return; n++; rel += v; st += P[h] + v;
      if (h < 9) { f += P[h] + v; fn++; fPar += P[h]; } else { b += P[h] + v; bn++; bPar += P[h]; }
      if (v < 0) bird++; else if (v === 0) parc++; });
    return { i, name, rel, st, n, f, b, fn, bn, bird, parc, fPar, bPar };
  });
}
function ranked(r){ return stats(r).filter(s => s.n).sort((a,b) => a.rel - b.rel || a.st - b.st); }

function toast(msg){ const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 1800); }

/* ---------- storage: js/storage.js (AppStorage) ---------- */
function onData(o){
  rounds = {};
  Object.entries(o).forEach(([id, r]) => { rounds[id] = Object.assign(clone(r), { id }); });
  if (cur && !dirty && !saving && rounds[cur.id]) cur = clone(rounds[cur.id]);
  if (cur && !rounds[cur.id]) rounds[cur.id] = clone(cur);
  if (view !== "setup") render();
}
function scheduleSave(){ dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); }
async function flush(){
  if (saving) { saveTimer = setTimeout(flush, 400); return; }
  if (!dirty || !cur) return;
  saving = true; dirty = false;
  const body = clone(cur); delete body.id; body.updatedAt = Date.now();
  try { await store.save(cur.id, body); saveErr = ""; rounds[cur.id] = Object.assign(clone(body), { id: cur.id }); }
  catch(e){ saveErr = e && e.code === "invalid_argument" ? "이 화면에서는 저장 권한이 없어요." : "저장하지 못했어요. 잠시 후 다시 입력해 주세요."; dirty = true; }
  saving = false; updateStatus();
  if (dirty && !saveErr) flush();
}
function updateStatus(){ fixStatus(); }
function statusText(){
  if (saveErr) return '<span style="color:var(--bad)">'+esc(saveErr)+'</span>';
  if (dirty || saving) return "저장 중…";
  return store && store.shared ? "저장됨" : "이 기기에 저장됨";
}

/* ---------- views ---------- */
function render(){
  if (view === "list") return home === "stats" ? renderStats() : home === "hcp" ? renderHcp() : home === "settings" ? renderSettings() : renderList();
  if (view === "setup") return renderSetup();
  if (view === "addclub") return renderAddClub();
  if (view === "play") return tab === "play" ? renderPlay() : renderCard();
}

function homeTabs(){
  return '<div class="tabs" role="tablist" style="margin-bottom:14px"><button role="tab" class="'+(home==="rounds"?"on":"")+'" data-a="home" data-t="rounds">라운드</button><button role="tab" class="'+(home==="stats"?"on":"")+'" data-a="home" data-t="stats">통계</button><button role="tab" class="'+(home==="hcp"?"on":"")+'" data-a="home" data-t="hcp">핸디</button><button role="tab" class="'+(home==="settings"?"on":"")+'" data-a="home" data-t="settings">설정</button></div>';
}
function renderList(){
  let list = Object.values(rounds).sort((a,b) => (b.date||"").localeCompare(a.date||"") || (b.updatedAt||0) - (a.updatedAt||0));
  let h = '<header class="top"><div class="brand">'+FLAG+'라운드 스코어 노트</div><button class="btn primary" data-a="new">+ 새 라운드</button></header>' + homeTabs();
  const clubs = [...new Set(list.map(r => r.club || "").filter(Boolean))].sort();
  if (clubs.length > 1) h += '<div class="chips" style="margin-bottom:10px"><button class="chip'+(filterClub?'':' on')+'" data-a="fclub" data-c="">전체</button>'+clubs.map(c => '<button class="chip'+(filterClub===c?' on':'')+'" data-a="fclub" data-c="'+esc(c)+'">'+esc(c)+'</button>').join("")+'</div>';
  if (filterClub) list = list.filter(r => r.club === filterClub);
  if (!list.length && !filterClub) {
    h += '<div class="empty"><p style="margin:0 0 4px;font-weight:600;color:var(--ink)">아직 기록한 라운드가 없어요</p><p style="margin:0 0 16px">코스와 동반자를 고르고 홀마다 파 대비 타수만 누르면 돼요.</p><button class="btn primary" data-a="new">첫 라운드 시작</button></div>';
  } else {
    h += '<div class="sec-label">지난 라운드 '+list.length+'</div>';
    list.forEach(r => {
      const d = (r.date || "").split("-"); const rk = ranked(r); const w = rk[0];
      const filled = Math.max(0, ...stats(r).map(s => s.n));
      h += '<button class="round" data-a="open" data-id="'+esc(r.id)+'"><div class="d">'+esc(d[1]||"")+'월<b>'+esc(+d[2]||"")+'</b></div>'
        + '<div class="t"><div class="c">'+(r.club?esc(r.club)+' <span style="font-weight:400;color:var(--muted)">':'')+esc(r.front.name)+' · '+esc(r.back.name)+(r.club?'</span>':'')+'</div><div class="p">'+(r.event?esc(r.event)+' · ':'')+esc(r.players.join(", "))+((r.photos||[]).length?' · 📷'+(r.photos.length):'')+'</div></div>'
        + '<div class="w">'+(w ? esc(w.name)+'<b class="num">'+(filled===18?w.st:sgn(w.rel))+'</b>' : '기록 전')+(filled<18&&filled>0?'<br>'+filled+'/18홀':'')+'</div></button>';
    });
  }
  app.innerHTML = '<div class="wrap">'+h+'</div>';
}

function allPlayers(){
  const m = {};
  Object.values(rounds).forEach(r => r.players.forEach((n,i) => { if ((r.scores["p"+i]||[]).some(v => v != null)) m[n] = (m[n]||0)+1; }));
  return Object.entries(m).sort((a,b) => b[1]-a[1]).map(e => e[0]);
}
function playerRounds(name){
  return Object.values(rounds).map(r => { const i = r.players.indexOf(name); if (i < 0) return null; const s = stats(r)[i]; if (s.n !== 18) return null; return { r, s }; })
    .filter(Boolean).sort((a,b) => (a.r.date||"").localeCompare(b.r.date||""));
}
function trendSvg(pts){
  if (pts.length < 2) return "";
  const W = 320, H = 110, px = 10, py = 12;
  const vals = pts.map(p => p.s.st); const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
  const x = i => px + i * (W - 2*px) / (pts.length - 1), y = v => py + (hi - v) * (H - 2*py) / (hi - lo);
  const d = pts.map((p,i) => (i?"L":"M") + x(i).toFixed(1) + " " + y(p.s.st).toFixed(1)).join(" ");
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:100%;display:block" role="img" aria-label="라운드별 타수 추세"><line x1="'+px+'" x2="'+(W-px)+'" y1="'+y(avg).toFixed(1)+'" y2="'+y(avg).toFixed(1)+'" stroke="var(--line)" stroke-dasharray="4 4"/><path d="'+d+'" fill="none" stroke="var(--pen)" stroke-width="2"/>'
    + pts.map((p,i) => '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.s.st).toFixed(1)+'" r="3.5" fill="var(--paper)" stroke="var(--pen)" stroke-width="2"/><text x="'+x(i).toFixed(1)+'" y="'+(y(p.s.st)-8).toFixed(1)+'" text-anchor="middle" font-size="11" font-family="var(--display)" fill="var(--ink)">'+p.s.st+'</text>').join("")
    + '<text x="'+px+'" y="'+(H-1)+'" font-size="10" fill="var(--muted)">'+esc((pts[0].r.date||"").slice(2).replace(/-/g,"."))+'</text><text x="'+(W-px)+'" y="'+(H-1)+'" text-anchor="end" font-size="10" fill="var(--muted)">'+esc((pts[pts.length-1].r.date||"").slice(2).replace(/-/g,"."))+'</text></svg>';
}
function renderStats(){
  const names = allPlayers();
  let h = '<header class="top"><div class="brand">'+FLAG+'라운드 스코어 노트</div><button class="btn primary" data-a="new">+ 새 라운드</button></header>' + homeTabs();
  if (!names.length) { h += '<div class="empty">아직 통계를 낼 라운드가 없어요.</div>'; app.innerHTML = '<div class="wrap">'+h+'</div>'; return; }
  if (!statP || !names.includes(statP)) statP = names[0];
  h += '<div class="sec-label">전체 요약 (18홀 완료 라운드)</div><div class="sc-wrap"><table class="sc"><thead><tr><th>이름</th><th>라운드</th><th>평균</th><th>베스트</th><th>최근</th></tr></thead><tbody>';
  names.forEach(n => { const pr = playerRounds(n); if (!pr.length) { h += '<tr><td>'+esc(n)+'</td><td colspan="4" style="color:var(--muted)">완료 라운드 없음</td></tr>'; return; }
    const v = pr.map(p => p.s.st); const avg = v.reduce((a,b)=>a+b,0)/v.length;
    h += '<tr><td>'+esc(n)+'</td><td class="num">'+v.length+'</td><td class="num">'+avg.toFixed(1)+'</td><td class="num b">'+Math.min(...v)+'</td><td class="num">'+v[v.length-1]+'</td></tr>'; });
  h += '</tbody></table></div>';
  h += '<div class="sec-label">개인 기록</div><div class="chips" style="margin-bottom:12px">'+names.map(n => '<button class="chip'+(statP===n?' on':'')+'" data-a="statp" data-n="'+esc(n)+'">'+esc(n)+'</button>').join("")+'</div>';
  const pr = playerRounds(statP);
  if (!pr.length) h += '<div class="empty">'+esc(statP)+' 님은 아직 18홀을 끝낸 라운드가 없어요.</div>';
  else {
    const v = pr.map(p => p.s.st); const avg = v.reduce((a,b)=>a+b,0)/v.length; const best = pr.reduce((a,b) => b.s.st < a.s.st ? b : a);
    const birds = pr.reduce((a,p)=>a+p.s.bird,0), parsC = pr.reduce((a,p)=>a+p.s.parc,0);
    const last5 = v.slice(-5); const avg5 = last5.reduce((a,b)=>a+b,0)/last5.length;
    const dist = {}; pr.forEach(p => { const sc = p.r.scores["p"+p.s.i]; sc.forEach(x => { const k = x < -1 ? "이글-" : x === -1 ? "버디" : x === 0 ? "파" : x === 1 ? "보기" : x === 2 ? "더블" : "트리플+"; dist[k] = (dist[k]||0)+1; }); });
    const dk = ["이글-","버디","파","보기","더블","트리플+"].filter(k => dist[k]); const tot = Object.values(dist).reduce((a,b)=>a+b,0);
    h += '<div class="rank" style="grid-template-columns:repeat(2,minmax(0,1fr))">'
      + '<div class="rk" style="grid-template-columns:1fr"><div class="meta">평균 ('+v.length+'라운드)</div><div class="s" style="text-align:left"><b class="num">'+avg.toFixed(1)+'</b><span class="num">'+sgn(Math.round(avg)-72)+'</span></div></div>'
      + '<div class="rk first" style="grid-template-columns:1fr"><div class="meta">베스트 · '+esc((best.r.date||"").slice(5).replace("-","/"))+'</div><div class="s" style="text-align:left"><b class="num">'+best.s.st+'</b><span class="num">'+sgn(best.s.rel)+'</span></div></div>'
      + '<div class="rk" style="grid-template-columns:1fr"><div class="meta">최근 '+last5.length+'라운드 평균</div><div class="s" style="text-align:left"><b class="num">'+avg5.toFixed(1)+'</b><span class="num">'+(avg5 < avg ? "▼ 좋아짐" : avg5 > avg ? "▲" : "=")+'</span></div></div>'
      + '<div class="rk" style="grid-template-columns:1fr"><div class="meta">버디 / 파 (누적)</div><div class="s" style="text-align:left"><b class="num">'+birds+'</b><span class="num"> / '+parsC+'</span></div></div></div>';
    h += '<div class="card" style="margin-bottom:12px"><div class="sec-label" style="margin:0 0 6px">라운드별 타수</div>'+trendSvg(pr)+'</div>';
    h += '<div class="card" style="margin-bottom:12px"><div class="sec-label" style="margin:0 0 8px">홀 결과 분포 ('+tot+'홀)</div><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;gap:1px">'
      + dk.map(k => '<div style="flex:'+dist[k]+';background:'+(k==="파"?"var(--par)":k==="버디"||k==="이글-"?"var(--birdie)":k==="보기"?"var(--line)":k==="더블"?"var(--bad-bg)":"var(--bad)")+'"></div>').join("")+'</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px;font-size:12px;color:var(--muted)">'+dk.map(k => '<span style="white-space:nowrap">'+k+' <b class="num" style="color:var(--ink)">'+dist[k]+'</b> ('+Math.round(dist[k]/tot*100)+'%)</span>').join("")+'</div></div>';
    const byClub = {}; pr.forEach(p => { const k = p.r.club || (p.r.front.name+" · "+p.r.back.name); (byClub[k] = byClub[k]||[]).push(p.s.st); });
    if (Object.keys(byClub).length) {
      h += '<div class="sc-wrap"><table class="sc"><thead><tr><th>골프장</th><th>라운드</th><th>평균</th><th>베스트</th></tr></thead><tbody>'
        + Object.entries(byClub).sort((a,b)=>b[1].length-a[1].length).map(([k,v]) => '<tr><td>'+esc(k)+'</td><td class="num">'+v.length+'</td><td class="num">'+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)+'</td><td class="num">'+Math.min(...v)+'</td></tr>').join("")+'</tbody></table></div>';
    }
    h += '<div class="sc-wrap"><table class="sc"><thead><tr><th>날짜</th><th>골프장</th><th>전</th><th>후</th><th>합계</th></tr></thead><tbody>'
      + pr.slice().reverse().map(p => '<tr><td><button data-a="open" data-id="'+esc(p.r.id)+'" style="color:var(--pen);text-decoration:underline">'+esc((p.r.date||"").slice(2).replace(/-/g,"."))+'</button></td><td style="text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">'+esc(p.r.club||p.r.front.name+"·"+p.r.back.name)+'</td><td class="num">'+p.s.f+'</td><td class="num">'+p.s.b+'</td><td class="num tot">'+p.s.st+' <span style="font-size:11px;color:var(--muted)">'+sgn(p.s.rel)+'</span></td></tr>').join("")+'</tbody></table></div>';
  }
  h += '<div class="row-actions"><button class="btn" data-a="csv">전체 기록 복사 (엑셀용)</button></div><textarea id="copybox" readonly hidden style="width:100%;height:140px;margin-top:10px;font:inherit;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:10px"></textarea>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
}
const DEFAULT_GROUP = "BV월례회";
function groupList(){ const g = (settings.hcp && settings.hcp.groups) || []; return g.length ? g : [DEFAULT_GROUP]; }
function curGroup(){ const gs = groupList(); if (!memGroup || !gs.includes(memGroup)) memGroup = gs[0]; return memGroup; }
const memGroupOf = m => m.group || DEFAULT_GROUP;
function memberRows(){
  const g = curGroup(), q = norm(memQ);
  return Object.values(members).filter(m => memGroupOf(m) === g).filter(m => !q || norm(m.name).includes(q) || (m.aliases||[]).some(a => norm(a).includes(q))).sort((a,b) => a.name.localeCompare(b.name, "ko"));
}
function memberTable(){
  const list = memberRows(); const total = Object.values(members).filter(m => memGroupOf(m) === curGroup()).length;
  if (!total) return '<div class="empty">이 모임에는 아직 회원이 없어요. "+ 회원"으로 이름과 핸디를 추가하세요.</div>';
  let h = '<div class="sec-label">회원 '+list.length+(memQ?' / '+total:'')+'</div><div class="sc-wrap"><table class="sc"><thead><tr><th style="text-align:left">이름</th><th>핸디</th><th>최근 조정</th><th></th></tr></thead><tbody>';
  list.forEach(m => {
    if (memEdit === m.id) { h += '<tr><td colspan="4" style="text-align:left;padding:8px">'+memForm(m, m.id)+'</td></tr>'; return; }
    const last = (m.history||[]).slice(-1)[0];
    h += '<tr><td style="text-align:left;font-weight:600">'+esc(m.name)+(m.aliases&&m.aliases.length?' <span style="font-weight:400;color:var(--muted);font-size:11px">'+esc(m.aliases.join(", "))+'</span>':'')+'</td><td class="num" style="font-size:17px">'+(m.hcp ?? "-")+'</td><td style="font-size:11px;color:var(--muted)">'+(last && last.note ? esc(last.note) : '')+'</td><td><button class="btn sm" data-a="medit" data-id="'+esc(m.id)+'">수정</button></td></tr>';
  });
  return h + '</tbody></table></div>';
}
function renderHcp(){
  let h = '<header class="top"><div class="brand">'+FLAG+'라운드 스코어 노트</div><button class="btn primary" data-a="new">+ 새 라운드</button></header>' + homeTabs();
  const gs = groupList(), g = curGroup();
  h += '<div class="chips" style="margin-bottom:10px">'+gs.map(x => '<button class="chip'+(x===g?' on':'')+'" data-a="mgroup" data-g="'+esc(x)+'">'+esc(x)+' <span style="font-weight:400;opacity:.7">'+Object.values(members).filter(m => memGroupOf(m) === x).length+'</span></button>').join("")+'<button class="chip" data-a="gadd">+ 모임</button></div>';
  if (grpEdit) h += '<div class="card" style="padding:10px;margin-bottom:10px"><div style="display:flex;gap:6px"><input type="text" id="g-name" placeholder="새 모임 이름 (예: 동호회, 거래처 모임)" style="flex:1;min-width:0"><button class="btn sm primary" data-a="gsave">추가</button><button class="btn sm" data-a="gcancel">취소</button></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-weight:600">'+esc(g)+' 핸디표</div>'+(gs.length>1 && !Object.values(members).some(m => memGroupOf(m) === g) ? '<button class="btn sm danger" data-a="gdel" data-g="'+esc(g)+'">모임 삭제</button>' : '')+'</div><p class="note" style="margin:4px 0 10px">여기 있는 핸디가 새 라운드 만들 때 이름에 맞춰 자동으로 들어가요. 별명(예: 강차장)으로 적어도 연결돼요.</p>';
  h += '<label class="btn sm" for="h-photo" style="width:100%">'+(memBusy ? (photoOK ? '표 읽는 중…' : '저장 중…') : (photoOK ? '핸디표 사진으로 갱신 → ' : '핸디표 사진 보관 → ')+esc(g))+'</label><input type="file" id="h-photo" accept="image/*" hidden>';
  if (memMsg) h += '<p class="note" style="margin:8px 0 0">'+esc(memMsg)+'</p>';
  const phs = ((settings.hcp && settings.hcp.photos) || []).map((ph,i) => [ph,i]).filter(([ph]) => (ph.group || DEFAULT_GROUP) === g);
  if (phs.length) {
    h += '<div class="sec-label" style="margin:12px 0 6px">저장된 핸디표 '+phs.length+'</div><div class="pgrid">'+phs.map(([ph,i]) => '<button class="pth" data-a="hopen" data-i="'+i+'"><img src="'+esc(photoUrl(ph))+'" alt=""><span>'+esc(ph.label||new Date(ph.at||0).toLocaleDateString("ko-KR"))+'</span></button>').join("")+'</div>';
    const big = settings.hcp.photos[hcpBig];
    if (hcpBig != null && big) h += '<div style="margin-top:4px"><img src="'+esc(photoUrl(big))+'" alt="핸디표" style="width:100%;border-radius:8px;border:1px solid var(--line)"><div class="row-actions" style="margin-top:6px"><button class="btn sm" data-a="hclose">닫기</button>'+(hcpDel === hcpBig ? '<button class="btn sm danger" data-a="hdel" data-i="'+hcpBig+'">정말 삭제</button><button class="btn sm" data-a="hnodel">취소</button>' : '<button class="btn sm danger" data-a="haskdel" data-i="'+hcpBig+'">삭제</button>')+'</div></div>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:8px"><input type="search" id="m-q" value="'+esc(memQ)+'" placeholder="이름 검색" autocomplete="off" style="flex:1;min-width:0"><button class="btn sm" data-a="madd">+ 회원</button></div>';
  if (memEdit === "new") h += memForm({ name: "", hcp: "", aliases: [], group: g }, "new");
  h += '<div id="mtable">'+memberTable()+'</div>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
}
function memForm(m, id){
  return '<div class="card" style="padding:10px;margin-bottom:8px"><div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" id="m-name" value="'+esc(m.name)+'" placeholder="이름" style="flex:1;min-width:0"><input type="number" inputmode="decimal" step="0.5" min="0" max="54" id="m-hcp" value="'+esc(m.hcp ?? "")+'" placeholder="핸디" style="width:84px"></div>'
    + '<input type="text" id="m-alias" value="'+esc((m.aliases||[]).join(", "))+'" placeholder="별명 (쉼표로 구분, 예: 강차장)" style="margin-bottom:6px">'
    + '<select id="m-group" style="width:100%;min-height:40px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;padding:0 10px;margin-bottom:8px">'+groupList().map(x => '<option value="'+esc(x)+'"'+((m.group||DEFAULT_GROUP)===x?' selected':'')+'>'+esc(x)+'</option>').join("")+'</select>'
    + '<div class="row-actions"><button class="btn sm primary" data-a="msave" data-id="'+esc(id)+'">저장</button><button class="btn sm" data-a="mcancel">취소</button>'+(id!=="new"?'<button class="btn sm danger" data-a="mdel" data-id="'+esc(id)+'">삭제</button>':'')+'</div></div>';
}
async function saveMember(id, body){ await mstore.save(id, body); members[id] = Object.assign(clone(body), { id }); }
async function hcpPhoto(file){
  memBusy = true; memMsg = ""; render();
  try {
    const r = await sampleFn.json('This image is a Korean golf club handicap table (핸디표). Columns: member name (회원명), starting handicap, and one or more adjustment columns (핸디 조정) with dates in their headers; a cell in an adjustment column is filled only when that member\'s handicap changed. For EVERY row give the name, the starting handicap, and the current handicap = the rightmost filled adjustment cell, or the starting value if no adjustment. Also give the header text of the column the current value came from. Reply with only JSON like {"members":[{"name":"김제연","start":7,"hcp":7,"note":"26년 시작"},{"name":"고경석","start":16,"hcp":18,"note":"3/23 조정"}]}.', { images: file });
    const rows = (r && Array.isArray(r.members) ? r.members : []).map(x => ({ name: String(x.name||"").trim(), hcp: Number(x.hcp), note: String(x.note||"") })).filter(x => x.name && !isNaN(x.hcp));
    if (!rows.length) { memMsg = "표에서 이름과 핸디를 읽지 못했어요. 표 전체가 또렷하게 나오게 찍어 주세요."; }
    else {
      let added = 0, changed = 0, same = 0; const today = todayStr();
      for (const x of rows) {
        const m = findMember(x.name, curGroup());
        if (!m) { const id = "m-" + Math.random().toString(36).slice(2,8); await saveMember(id, { name: x.name, group: curGroup(), hcp: x.hcp, aliases: [], history: [{ date: today, hcp: x.hcp, note: x.note }] }); added++; }
        else if (m.hcp !== x.hcp) { const b = clone(m); delete b.id; b.hcp = x.hcp; (b.history = b.history||[]).push({ date: today, hcp: x.hcp, note: x.note }); await saveMember(m.id, b); changed++; }
        else same++;
      }
      try { const { blob } = await shrink(file, assetsFn ? 1600 : 900, assetsFn ? 0.85 : 0.7); const ph = { at: Date.now(), group: curGroup(), label: "핸디표 "+today.slice(5).replace("-","/") };
        if (assetsFn) { const u = await assetsFn.upload(blob, { type: "image/jpeg" }); ph.id = u.id; } else ph.data = (await shrink(file, 900, 0.7)).dataUrl;
        const st = clone(settings.hcp || {}); delete st.id; (st.photos = st.photos||[]).push(ph); await sstore.save("hcp", st); settings.hcp = Object.assign(st, { id: "hcp" }); } catch(e) {}
      memMsg = rows.length+"명 읽음 · 추가 "+added+" · 변경 "+changed+" · 동일 "+same+". 표 사진도 저장했어요.";
    }
  } catch(e) {
    memMsg = e && e.code === "not_granted" ? "Claude 사용을 허용하지 않아 표를 읽을 수 없어요." : e && e.code === "rate_limited" ? "잠시 후 다시 시도해 주세요." : "표를 읽지 못했어요. 다시 시도해 주세요.";
  }
  memBusy = false; if (view === "list" && home === "hcp") render();
}
function csvText(){
  const rows = [["날짜","골프장","전반코스","후반코스","이름","전반","후반","합계","파대비","버디","파","H1","H2","H3","H4","H5","H6","H7","H8","H9","H10","H11","H12","H13","H14","H15","H16","H17","H18"]];
  Object.values(rounds).sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(r => { const P = pars(r); stats(r).forEach(s => { if (!s.n) return;
    rows.push([r.date, r.club||"", r.front.name, r.back.name, s.name, s.fn?s.f:"", s.bn?s.b:"", s.n===18?s.st:"", s.n===18?sgn(s.rel):"", s.bird, s.parc, ...(r.scores["p"+s.i]||[]).map((v,h) => v==null?"":P[h]+v)]); }); });
  return rows.map(r => r.map(c => '"'+String(c??"").replace(/"/g,'""')+'"').join(",")).join("\n");
}
function findMember(name, group){
  const k = norm(name); if (!k) return null;
  const hit = m => norm(m.name) === k || (m.aliases||[]).some(a => norm(a) === k);
  const all = Object.values(members);
  if (group) { const g = all.find(m => memGroupOf(m) === group && hit(m)); if (g) return g; }
  return all.find(hit) || null;
}
function lastHcp(name){
  if (!name) return "";
  const m = findMember(name, setup && setup.group); if (m && m.hcp != null) return m.hcp;
  const rs = Object.values(rounds).filter(r => r.hcp && r.players.includes(name)).sort((a,b) => (b.date||"").localeCompare(a.date||""));
  for (const r of rs) { const v = r.hcp[r.players.indexOf(name)]; if (v != null && v !== "") return v; }
  return "";
}
const UNITS = [0, 5000, 10000, 50000, 100000];
const unitLabel = u => u ? (u >= 10000 ? (u/10000)+"만" : (u/1000)+"천") : "없음";
function olyForm(o, pre){
  o = o || {}; const unit = +o.unit || 0, pen = o.pen == null ? 1 : +o.pen, method = o.method || "pair";
  return '<div class="field"><label>올림픽 게임 (선택) · 단가가 "없음"이면 게임 없이 진행해요</label>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">'
    + '<div><div class="note" style="margin:0 0 3px">1점 단가 (누를 때마다 바뀜)</div><button type="button" class="btn cyc'+(unit?' on':'')+'" id="'+pre+'-ounit" data-a="ounit" data-pre="'+pre+'" data-v="'+unit+'" style="width:100%">'+unitLabel(unit)+'</button></div>'
    + '<div><div class="note" style="margin:0 0 3px">3퍼트 벌점 (퍼트 추가마다)</div><button type="button" class="btn cyc" id="'+pre+'-open" data-a="openalty" data-pre="'+pre+'" data-v="'+pen+'" style="width:100%">'+(pen ? "−"+pen+"점" : "없음")+'</button></div></div>'
    + '<div class="note" style="margin:0 0 3px">정산 방식</div><div class="chips" id="'+pre+'-omethod" data-v="'+esc(method)+'">'
    + [["pair","상대마다 1:1 차이"],["avg","평균 대비"]].map(([k,l]) => '<button type="button" class="chip'+(method===k?' on':'')+'" data-a="omethod" data-pre="'+pre+'" data-m="'+k+'">'+l+'</button>').join("")+'</div>'
    + '<p class="note" style="margin:6px 0 0">홀에서 가까운 순으로 1~4점, 칩인 5점, 2퍼트 0점. 이월하면 다음 홀 점수가 배수로 커져요.</p></div>';
}
function readOly(pre){
  const g = id => document.getElementById(id); if (!g(pre+"-ounit")) return undefined;
  const u = +g(pre+"-ounit").dataset.v || 0; const pen = +g(pre+"-open").dataset.v || 0;
  const m = (g(pre+"-omethod") || {}).dataset ? g(pre+"-omethod").dataset.v : "pair";
  const o = { unit: u, pen, method: m === "avg" ? "avg" : "pair" };
  return u > 0 ? o : Object.assign(o, { off: true });
}
const OLY = { "1":["1점",1], "2":["2점",2], "3":["3점",3], "4":["4점",4], "5":["칩인 5",5], z:["2퍼",0], "3p":["3퍼",-1], "4p":["4퍼",-2] };
const LEGACY = { f:"1", b:"2", s:"3", g:"4", d:"5" };
const ocode = c => c == null ? null : (LEGACY[c] || c);
function olyMult(h){
  const c = (cur.oly && cur.oly.carry) || []; let m = 1;
  for (let k = 0; k < h; k++) m = (c[k]||0) > 0 ? m + (c[k]||0) : 1;
  return m;
}
function olyPts(i, h){
  const code = ocode((cur.oly && cur.oly.m && cur.oly.m["p"+i] || [])[h]); if (!code || !OLY[code]) return null;
  const pen = cur.oly.pen == null ? 1 : +cur.oly.pen;
  if (code === "3p") return -pen; if (code === "4p") return -2*pen;
  return OLY[code][1] * olyMult(h);
}
function olyStats(){
  const N = cur.players.length; const rows = cur.players.map((name,i) => { let pts = 0, n = 0; const cnt = {};
    for (let h = 0; h < 18; h++) { const v = olyPts(i,h); if (v == null) continue; pts += v; n++; const c = ocode(cur.oly.m["p"+i][h]); cnt[c] = (cnt[c]||0)+1; }
    return { i, name, pts, n, cnt }; });
  const total = rows.reduce((a,r)=>a+r.pts,0), avg = N ? total/N : 0, U = cur.oly.unit || 0;
  rows.forEach(r => { r.money = cur.oly.method === "avg" ? (r.pts - avg) * U : (r.pts * N - total) * U; });
  return rows.sort((a,b) => b.pts - a.pts);
}
const won = v => (v < 0 ? "−" : v > 0 ? "+" : "") + Math.round(Math.abs(v)).toLocaleString();
function newSetup(){
  const last = Object.values(rounds).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0))[0];
  const names = last ? last.players.slice() : DEFAULT_PLAYERS.slice();
  while (names.length < 4) names.push("");
  const hcp = names.map(n => lastHcp(n));
  const s = { date: todayStr(), clubId: null, custom: false, q: "", front: null, back: null, players: names, hcp, err: "", group: (last && last.group) || groupList()[0], oly: last && last.oly ? { unit: last.oly.unit, pen: last.oly.pen, method: last.oly.method } : null };
  if (last && last.clubId && courses[last.clubId]) pickClub(s, last.clubId);
  return s;
}
function pickClub(s, id){
  const c = courses[id]; s.clubId = id; s.custom = false; s.q = "";
  const n = c.nines || [];
  s.front = { name: n[0].name, par: n[0].par.slice() };
  const b = n[1] || n[0];
  s.back = { name: b.name, par: b.par.slice() };
}
function clubMatches(q){
  const t = q.trim().toLowerCase();
  return Object.entries(courses).filter(([id,c]) => !t || [c.name, c.nameKo, c.region, ...(c.aliases||[]), ...(c.nines||[]).map(n=>n.name)].some(x => String(x||"").toLowerCase().includes(t)))
    .sort((a,b) => String(a[1].name).localeCompare(String(b[1].name)));
}
function resultsHtml(){
  const list = clubMatches(setup.q);
  let h = list.map(([id,c]) => '<button type="button" class="club" data-a="club" data-id="'+esc(id)+'"><b>'+esc(c.name)+(c.nameKo?' <span class="ko">'+esc(c.nameKo)+'</span>':'')+'</b><span>'+esc(c.region||"")+(c.region?' · ':'')+(c.nines||[]).map(n=>esc(n.name)).join(" / ")+'</span></button>').join("");
  if (!list.length) h = '<p class="note" style="margin:4px 0 8px">'+(Object.keys(courses).length ? '"'+esc(setup.q)+'"에 맞는 골프장이 없어요.' : '아직 등록된 골프장이 없어요.')+'</p>';
  h += '<div class="row-actions" style="margin-top:6px"><button type="button" class="btn sm" data-a="addclub">+ 골프장 등록</button><button type="button" class="btn sm" data-a="custom">목록 없이 직접 입력</button></div>';
  return h;
}
function nineChips(side){
  const c = courses[setup.clubId];
  return '<div class="chips">'+c.nines.map((n,i) => '<button type="button" class="chip'+(setup[side].name===n.name?' on':'')+'" data-a="nine" data-side="'+side+'" data-i="'+i+'">'+esc(n.name)+(n.checked===false?' ·?':'')+'</button>').join("")+'</div>';
}
function parGrid(side){
  const c = setup[side];
  return '<div class="pars">'+c.par.map((p,i) => '<button type="button" data-a="par" data-side="'+side+'" data-i="'+i+'" aria-label="'+(i+1)+'번홀 파 '+p+'"><small>'+(i+1)+'</small><span>'+p+'</span></button>').join("")+'</div>';
}
function libNine(name){ const c = courses[setup.clubId]; return c && c.nines.find(n => n.name === name); }
function renderSetup(){
  const s = setup;
  let h = '<header class="top"><button class="btn sm" data-a="list">← 목록</button><div class="brand">새 라운드</div><span style="width:64px"></span></header>';
  h += '<div class="card"><div class="field"><label for="f-date">날짜</label><input type="date" id="f-date" value="'+esc(s.date)+'"></div>';
  if (photoOK) {
    h += '<div class="field"><label>모임 공지로 자동 설정</label>';
    if (!s.notice) h += '<label class="btn sm" for="n-photo" style="width:100%">'+(s.nbusy ? '공지 읽는 중…' : '공지 사진 올리기 (날짜 · 골프장 · 조 편성 · 코스)')+'</label><input type="file" id="n-photo" accept="image/*" hidden>';
    if (s.nmsg) h += '<p class="note" style="margin:6px 0 0">'+esc(s.nmsg)+'</p>';
    if (s.notice) {
      const n = s.notice;
      h += '<div class="picked" style="margin-bottom:8px"><div style="min-width:0"><b>'+esc(n.event||"모임")+'</b><span>'+esc(n.date||"")+(n.club?' · '+esc(n.club):'')+(n.lunch?' · 점심 '+esc(n.lunch):'')+'</span></div><button type="button" class="btn sm" data-a="nclear">지우기</button></div>';
      h += '<p class="note" style="margin:0 0 6px">조를 고르면 동반자와 코스가 채워져요.</p><div class="chips">'+(n.groups||[]).map((g,i) => '<button type="button" class="chip'+(s.gi===i?' on':'')+'" data-a="ngroup" data-i="'+i+'">'+esc(g.name||((i+1)+"조"))+(g.teeOff?' '+esc(g.teeOff):'')+(myName && (g.players||[]).some(x=>x.includes(myName))?' ★':'')+'</button>').join("")+'</div>';
      if (s.gi != null && n.groups[s.gi]) { const g = n.groups[s.gi]; h += '<p class="note" style="margin:6px 0 0">'+esc((g.players||[]).join(", "))+(g.courses&&g.courses.length?' · '+esc(g.courses.join(" → ")):'')+'</p>'; }
    }
    h += '</div>';
  }
  h += '<div class="field"><label for="f-q">골프장</label>';
  if (s.clubId && courses[s.clubId]) {
    const c = courses[s.clubId];
    h += '<div class="picked"><div style="min-width:0"><b>'+esc(c.name)+'</b><span>'+esc(c.region||"")+'</span></div><button type="button" class="btn sm" data-a="unclub">변경</button></div>';
    if (photoOK) {
      const unv = c.nines.filter(n => n.checked === false).length;
      h += '<div style="margin-top:8px"><label class="btn sm" for="v-photo" style="width:100%">'+(s.vbusy ? '사진 읽는 중…' : '스코어카드 사진으로 파 대조'+(unv ? ' (미확인 '+unv+'개)' : ''))+'</label><input type="file" id="v-photo" accept="image/*" hidden></div>';
      if (s.vmsg) h += '<p class="note" style="margin:6px 0 0">'+esc(s.vmsg)+'</p>';
      if (s.verify && s.verify.length) {
        h += '<div class="vlist">' + s.verify.map((v,i) => {
          if (!v.found) return '<div class="vrow"><b>'+esc(v.name)+'</b><span class="note">등록된 코스 중에 같은 이름이 없어요. 새 코스로 추가하려면 → </span><button type="button" class="btn sm" data-a="vadd" data-i="'+i+'">코스 추가</button></div>';
          if (v.same) return '<div class="vrow ok"><b>'+esc(v.found)+'</b><span>사진과 같아요'+(v.done ? ' · 확인 저장됨' : '')+'</span>'+(v.done ? '' : '<button type="button" class="btn sm" data-a="vok" data-i="'+i+'">확인 저장</button>')+'</div>';
          return '<div class="vrow diff"><b>'+esc(v.found)+'</b><span>등록 '+v.old.join(" ")+'<br>사진 '+v.par.map((x,k)=> x!==v.old[k] ? '<u>'+x+'</u>' : x).join(" ")+(v.done ? '<br>사진 값으로 저장됨' : '')+'</span>'+(v.done ? '' : '<button type="button" class="btn sm" data-a="vapply" data-i="'+i+'">사진 값으로 저장</button>')+'</div>';
        }).join("") + '</div>';
      }
    }
    h += '</div>';
    ["front","back"].forEach(side => {
      const ln = libNine(s[side].name); const changed = ln && ln.par.join() !== s[side].par.join();
      h += '<div class="field"><label>'+(side==="front"?"전반":"후반")+' 코스</label>'+nineChips(side)+parGrid(side)
        + (ln && ln.checked===false ? '<p class="warn">이 코스 파는 아직 확인되지 않은 값이에요(인터넷 자료 또는 Claude 기억). 스코어카드와 비교해서 다르면 숫자를 눌러 고치고 저장해 주세요.</p>' : '')
        + (changed ? '<button type="button" class="btn sm" style="margin-top:8px" data-a="savepar" data-side="'+side+'">바꾼 파를 '+esc(s[side].name)+' 코스 정보에 저장</button>'
           : ln && ln.checked===false ? '<button type="button" class="btn sm" style="margin-top:8px" data-a="savepar" data-side="'+side+'">스코어카드와 같아요 · 확인 저장</button>' : '')
        + '</div>';
    });
  } else if (s.custom) {
    h += '<div class="picked"><div><b>직접 입력</b><span>목록에 없는 코스</span></div><button type="button" class="btn sm" data-a="unclub">골프장 검색</button></div></div>';
    h += '<div class="field"><label for="f-front">전반 코스 이름</label><input type="text" id="f-front" value="'+esc(s.front.name)+'">'+parGrid("front")+'</div>'
       + '<div class="field"><label for="f-back">후반 코스 이름</label><input type="text" id="f-back" value="'+esc(s.back.name)+'">'+parGrid("back")+'</div>';
  } else {
    h += '<input type="search" id="f-q" value="'+esc(s.q)+'" placeholder="골프장 이름이나 코스 이름 (예: twin, 스텔라)" autocomplete="off"><div id="results" class="results">'+resultsHtml()+'</div></div>';
  }
  if (s.front) h += '<p class="note" style="margin:-4px 0 14px">파 숫자를 누르면 3 → 4 → 5로 바뀌어요. 파 합계 <b class="num">'+(s.front.par.concat(s.back.par).reduce((a,b)=>a+b,0))+'</b></p>';
  if (groupList().length > 1) h += '<div class="field"><label>핸디 적용 모임</label><div class="chips">'+groupList().map(x => '<button type="button" class="chip'+(s.group===x?' on':'')+'" data-a="sgroup" data-g="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div>';
  h += '<div class="field"><label>동반자 (최대 4명, 빈칸은 제외) · 핸디는 18홀 기준, 없으면 비워 두세요</label><div class="players" style="grid-template-columns:1fr">'
    + s.players.map((n,i) => '<div style="display:flex;gap:6px"><input type="text" id="f-p'+i+'" value="'+esc(n)+'" placeholder="'+(i+1)+'번 플레이어" style="flex:1;min-width:0"><input type="number" inputmode="decimal" step="0.5" min="0" max="54" id="f-h'+i+'" value="'+esc(s.hcp[i])+'" placeholder="핸디" aria-label="'+(i+1)+'번 핸디" style="width:84px"></div>').join("")
    + '</div></div>'
    + olyForm(s.oly, "f")
    + (photoOK ? (editMe
        ? '<div class="field"><label for="f-me">내 이름 (공지에서 내 조를 찾는 데 써요)</label><div style="display:flex;gap:6px"><input type="text" id="f-me" value="'+esc(myName)+'" placeholder="공지에 적히는 이름" style="flex:1;min-width:0"><button type="button" class="btn sm" data-a="saveme">저장</button><button type="button" class="btn sm" data-a="cancelme">취소</button></div></div>'
        : '<div class="field"><label>내 이름 (공지에서 내 조를 찾는 데 써요)</label><div class="picked" style="background:var(--bg);border-color:var(--line)"><div><b style="color:var(--ink)">'+esc(myName)+'</b></div><button type="button" class="btn sm" data-a="editme">변경</button></div></div>') : '')
    + (s.err ? '<p class="err">'+esc(s.err)+'</p>' : '')
    + '<button class="btn primary" style="width:100%;min-height:48px" data-a="start">라운드 시작</button></div>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
}
function readSetupInputs(){
  if (!setup) return;
  const g = id => document.getElementById(id);
  if (g("f-date")) setup.date = g("f-date").value;
  if (g("f-q")) setup.q = g("f-q").value;

  if (g("f-front")) setup.front.name = g("f-front").value.trim() || setup.front.name;
  if (g("f-back")) setup.back.name = g("f-back").value.trim() || setup.back.name;
  for (let i = 0; i < 4; i++) { if (g("f-p"+i)) setup.players[i] = g("f-p"+i).value; if (g("f-h"+i)) setup.hcp[i] = g("f-h"+i).value; }
  const ov = readOly("f"); if (ov !== undefined) setup.oly = ov;
}

/* ---------- add a golf club ---------- */
function newClubForm(){ return { name: "", look: "", nameKo: "", region: "", fromLookup: false, nines: [{ name: "", par: Array(9).fill(4) }, { name: "", par: Array(9).fill(4) }], err: "", busy: false, msg: "" }; }
function readClubInputs(){
  const g = id => document.getElementById(id); const f = addForm;
  if (g("c-name")) f.name = g("c-name").value; if (g("c-look")) f.look = g("c-look").value; if (g("c-ko")) f.nameKo = g("c-ko").value; if (g("c-region")) f.region = g("c-region").value;
  f.nines.forEach((n,i) => { if (g("c-n"+i)) n.name = g("c-n"+i).value; });
}
function renderAddClub(){
  const f = addForm;
  let h = '<header class="top"><button class="btn sm" data-a="backsetup">← 뒤로</button><div class="brand">골프장 등록</div><span style="width:64px"></span></header>';
  if (sampleFn) {
    h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:4px">Claude에게 찾아보기</div><p class="note" style="margin:0 0 10px">골프장 이름을 넣고 누르면 Claude가 아는 범위에서 코스 이름과 홀별 파를 채워요. 인터넷을 직접 검색하는 건 아니라서 틀릴 수 있어요. 저장 전에 꼭 스코어카드와 비교해 주세요.</p>'
      + '<div style="display:flex;gap:6px"><input type="text" id="c-look" value="'+esc(f.look||f.name)+'" placeholder="예: Long Thanh Golf Club" style="flex:1;min-width:0"><button type="button" class="btn" data-a="lookup" '+(f.busy?'disabled':'')+'>'+(f.busy?'찾는 중…':'찾기')+'</button></div>'
      + (photoOK ? '<label class="btn" for="c-photo" style="width:100%;margin-top:8px">스코어카드 사진으로 읽기</label><input type="file" id="c-photo" accept="image/*" hidden>' : '')
      + (f.msg ? '<p class="note">'+esc(f.msg)+'</p>' : '') + '</div>';
  }
  if (GOLF_API) {
    h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:4px">골프장 데이터베이스에서 찾기</div><p class="note" style="margin:0 0 10px">전세계 3만 곳 자료(GolfCourseAPI)에서 찾아 코스와 홀별 파를 채워요. 인터넷이 필요하고, 자료가 틀릴 수 있으니 저장 전에 스코어카드와 비교해 주세요.</p>'
      + '<div style="display:flex;gap:6px"><input type="search" id="c-api" value="'+esc(f.apiQ ?? (f.name||""))+'" placeholder="골프장 영문 이름 (예: Twin Doves)" autocomplete="off" style="flex:1;min-width:0"><button type="button" class="btn" data-a="apisearch" '+(f.apiBusy?'disabled':'')+'>'+(f.apiBusy?'찾는 중…':'찾기')+'</button></div>';
    if (f.apiRes && f.apiRes.length) h += '<div class="results">'+f.apiRes.map(c => '<button type="button" class="club" data-a="apipick" data-id="'+esc(c.id)+'"><b>'+esc(c.club)+(c.course && c.course !== c.club ? ' <span class="ko">'+esc(c.course)+'</span>' : '')+'</b><span>'+esc(c.where)+'</span></button>').join("")+'</div>';
    if (f.apiMsg) h += '<p class="note" style="margin:8px 0 0">'+esc(f.apiMsg)+'</p>';
    h += '</div>';
  }
  h += '<div class="card"><div class="field"><label for="c-name">골프장 이름</label><input type="text" id="c-name" value="'+esc(f.name)+'" placeholder="Twin Doves Golf Club"></div>'
    + '<div class="players" style="margin-bottom:14px"><div class="field" style="margin:0"><label for="c-ko">한글 이름 (선택)</label><input type="text" id="c-ko" value="'+esc(f.nameKo)+'" placeholder="트윈도브스"></div><div class="field" style="margin:0"><label for="c-region">지역 (선택)</label><input type="text" id="c-region" value="'+esc(f.region)+'" placeholder="Binh Duong"></div></div>';
  f.nines.forEach((n,i) => {
    h += '<div class="field"><label for="c-n'+i+'">'+(i+1)+'번째 9홀 코스</label><div style="display:flex;gap:6px"><input type="text" id="c-n'+i+'" value="'+esc(n.name)+'" placeholder="'+(["Stella","Sole","Luna","East"][i])+'">'
      + (f.nines.length>1?'<button type="button" class="btn sm" data-a="rmnine" data-i="'+i+'" aria-label="코스 삭제">삭제</button>':'')+'</div>'
      + '<div class="pars">'+n.par.map((p,k) => '<button type="button" data-a="cpar" data-n="'+i+'" data-i="'+k+'"><small>'+(k+1)+'</small><span>'+p+'</span></button>').join("")+'</div>'
      + '<p class="note" style="margin:4px 0 0">파 합계 '+n.par.reduce((a,b)=>a+b,0)+'</p></div>';
  });
  if (f.nines.length < 4) h += '<button type="button" class="btn sm" data-a="addnine" style="margin-bottom:14px">+ 9홀 코스 추가</button>';
  h += (f.err ? '<p class="err">'+esc(f.err)+'</p>' : '') + '<button class="btn primary" style="width:100%;min-height:48px" data-a="saveclub">골프장 저장</button></div>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
}
function applyNines(r, src){
  const nines = (r && Array.isArray(r.nines) ? r.nines : []).map(n => ({ name: String(n.name||"").trim(), par: (Array.isArray(n.par)?n.par:[]).map(Number) }))
    .filter(n => n.name && n.par.length === 9 && n.par.every(p => p >= 3 && p <= 6));
  if (!nines.length) return false;
  if (r.club && (src === "lookup" || !addForm.name.trim())) addForm.name = String(r.club);
  if (r.nameKo && !addForm.nameKo.trim()) addForm.nameKo = String(r.nameKo);
  if (r.region && !addForm.region.trim()) addForm.region = String(r.region);
  addForm.nines = nines.slice(0,4); addForm.fromLookup = src === "lookup";
  return nines.length;
}
async function lookupClub(){
  readClubInputs(); const q = (addForm.look||"").trim();
  if (!q) { addForm.msg = "골프장 이름을 먼저 입력하세요."; render(); return; }
  addForm.busy = true; addForm.msg = ""; render();
  try {
    const r = await sampleFn.json('You are a golf course database. Golf club: "'+q.replace(/"/g,"")+'". If you know this club, reply with its official English name, Korean name if commonly used, region/city, and every 9-hole course (nine) with its name as printed on the scorecard and the par of holes 1-9 (each 3-5, total usually 36). For an 18-hole course with no named nines use "OUT" and "IN". Reply with only JSON like {"club":"Long Thanh Golf Club","nameKo":"롱탄","region":"Dong Nai","nines":[{"name":"Lake OUT","par":[4,4,3,5,4,5,4,3,4]}]}. If you do not know the hole-by-hole par of this club, reply {"club":"","nines":[]} and nothing else; never guess.', { modelTier: "default" });
    const n = applyNines(r, "lookup");
    addForm.msg = n ? n+"개 코스를 찾았어요. Claude의 기억으로 채운 값이라 저장 뒤에도 \"?\" 표시가 붙어요. 스코어카드와 비교해서 맞으면 한 번 저장해 주세요." : "Claude가 이 골프장의 홀별 파를 알지 못해요. 사진으로 읽거나 직접 입력해 주세요.";
  } catch(e) {
    addForm.msg = e && e.code === "not_granted" ? "Claude 사용을 허용하지 않아 찾을 수 없어요. 직접 입력해 주세요."
      : e && e.code === "rate_limited" ? "잠시 후 다시 시도해 주세요." : e && e.code === "invalid_json" ? "답을 읽지 못했어요. 한 번 더 눌러 보세요." : "찾지 못했어요. 다시 시도하거나 직접 입력해 주세요.";
  }
  addForm.busy = false; if (view === "addclub") render();
}
/* ---------- 골프장 데이터베이스 (중계 서버 → GolfCourseAPI) ---------- */
const GOLF_API = (window.GOLF_API_BASE || "").replace(/\/$/, "");
async function apiFetch(path){
  const r = await fetch(GOLF_API + path, { headers: { "Accept": "application/json" } });
  if (r.status === 429) throw { code: "rate_limited" };
  if (!r.ok) throw { code: "http", status: r.status };
  return r.json();
}
async function apiSearch(){
  readClubInputs(); const q = ((document.getElementById("c-api") || {}).value || "").trim(); addForm.apiQ = q;
  if (q.length < 2) { addForm.apiMsg = "골프장 이름을 두 글자 이상 입력하세요."; render(); return; }
  addForm.apiBusy = true; addForm.apiMsg = ""; addForm.apiRes = null; render();
  try {
    const r = await apiFetch("/search?q=" + encodeURIComponent(q));
    const list = (r && Array.isArray(r.courses) ? r.courses : []).map(c => { const L = c.location || {};
      return { id: c.id, club: String(c.club_name || ""), course: String(c.course_name || ""), where: [L.city, L.state, L.country].filter(Boolean).join(", ") }; }).filter(c => c.id && c.club);
    addForm.apiRes = list.slice(0, 15);
    addForm.apiMsg = list.length ? list.length + "곳 찾음. 골프장을 누르면 코스·파가 채워져요." : '"' + q + '"에 맞는 골프장이 없어요. 영문 이름을 다르게 써 보거나 직접 입력해 주세요.';
  } catch(e) {
    addForm.apiMsg = e && e.code === "rate_limited" ? "오늘 조회 한도를 다 썼어요. 내일 다시 시도하거나 직접 입력해 주세요." : !navigator.onLine ? "인터넷에 연결되어 있지 않아요." : "찾지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  addForm.apiBusy = false; if (view === "addclub") render();
}
function teeToNines(course, nineName){
  const tees = course.tees || {}; const all = [].concat(tees.male || [], tees.female || [], Array.isArray(tees) ? tees : []);
  const usable = all.filter(t => Array.isArray(t.holes) && t.holes.length >= 9 && t.holes.every(h => +h.par >= 3 && +h.par <= 6));
  if (!usable.length) return [];
  const pref = ["white", "blue", "regular", "men", "yellow", "gold", "black"];
  usable.sort((a,b) => { const ia = pref.findIndex(p => String(a.tee_name||"").toLowerCase().includes(p)), ib = pref.findIndex(p => String(b.tee_name||"").toLowerCase().includes(p)); return (ia<0?99:ia) - (ib<0?99:ib); });
  const holes = usable[0].holes.map(h => +h.par); const nines = [];
  for (let i = 0; i + 9 <= holes.length && nines.length < 4; i += 9) nines.push({ name: ["OUT","IN","3rd","4th"][nines.length], par: holes.slice(i, i+9) });
  if (nines.length === 1 && nineName) nines[0].name = nineName;
  return nines;
}
async function apiPick(id){
  readClubInputs(); addForm.apiBusy = true; addForm.apiMsg = ""; render();
  try {
    const r = await apiFetch("/course/" + encodeURIComponent(id)); const c = (r && r.course) || r || {};
    const L = c.location || {};
    const club = String(c.club_name || "").trim(), cnameRaw = String(c.course_name || "").trim();
    let cname = cnameRaw; if (club && cname.toLowerCase().startsWith(club.toLowerCase())) cname = cname.slice(club.length).replace(/^[\s\-–:]+/, "").trim();
    const nines = teeToNines(c, cname && cname.toLowerCase() !== club.toLowerCase() ? cname : "");
    const n = applyNines({ club, region: [L.city, L.country].filter(Boolean).join(", "), nines }, "lookup");
    if (n) { addForm.apiRes = null; addForm.apiMsg = n + "개 9홀 코스를 채웠어요. 코스 이름은 스코어카드에 적힌 이름으로 고쳐도 돼요 (9홀씩 따로 등록된 골프장은 '+ 9홀 코스 추가'로 다른 코스를 손으로 더 넣을 수 있어요). 숫자를 확인하고 아래 '골프장 저장'을 누르세요."; }
    else addForm.apiMsg = "이 골프장은 홀별 파 자료가 없어요. 직접 입력해 주세요.";
  } catch(e) { addForm.apiMsg = e && e.code === "rate_limited" ? "오늘 조회 한도를 다 썼어요. 내일 다시 시도해 주세요." : "자료를 받지 못했어요. 잠시 후 다시 시도해 주세요."; }
  addForm.apiBusy = false; if (view === "addclub") render();
}
async function shrink(file, max, q){
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth*r); c.height = Math.round(im.naturalHeight*r);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, "image/jpeg", q));
    return { blob, dataUrl: assetsFn ? null : c.toDataURL("image/jpeg", q) };
  } finally { URL.revokeObjectURL(url); }
}
async function addPhoto(file, kind){
  const { blob, dataUrl } = await shrink(file, assetsFn ? 1600 : 900, assetsFn ? 0.85 : 0.7);
  const ph = { kind, at: Date.now() };
  if (assetsFn) { const r = await assetsFn.upload(blob, { type: "image/jpeg" }); ph.id = r.id; }
  else ph.data = dataUrl;
  (cur.photos = cur.photos || []).push(ph); scheduleSave();
}
const photoUrl = ph => ph.id ? "/_blob/" + ph.id : (ph.data || "");
const kindLabel = k => k === "notice" ? "조편성 공지" : k === "card" ? "스코어카드" : "사진";
function norm(x){ return String(x||"").toLowerCase().replace(/[^a-z0-9가-힣]/g,""); }
function findClub(name){
  const k = norm(name); if (!k) return null;
  const hit = Object.entries(courses).find(([id,c]) => [c.name, c.nameKo, ...(c.aliases||[])].some(a => { const n = norm(a); return n && (n === k || n.includes(k) || k.includes(n)); }));
  return hit ? hit[0] : null;
}
function findNine(clubId, name){
  const c = courses[clubId]; if (!c) return null; const k = norm(name); if (!k) return null;
  return c.nines.find(x => { const n = norm(x.name); return n === k || n.includes(k) || k.includes(n); }) || null;
}
async function noticePhoto(file){
  readSetupInputs(); setup.nbusy = true; setup.nmsg = ""; render();
  try {
    const r = await sampleFn.json('This image is a Korean golf outing notice (골프 모임 공지). Extract: event name (내용), date as YYYY-MM-DD (일자), golf club name as written (골프장), lunch place if any (점심식사), and every group (조): its label (e.g. "1조"), the player names in order (keep names exactly as written, including any text in parentheses), its tee-off time (TEE-OFF, as HH:MM), and its course order (e.g. "Luna-Stella" -> ["Luna","Stella"]). Reply with only JSON like {"event":"BV월례회","date":"2026-10-25","club":"트윈도브스","lunch":"청담골","groups":[{"name":"1조","players":["김제연","박효정"],"teeOff":"06:42","courses":["Luna","Stella"]}]}. Use "" or [] for anything missing.', { images: file });
    const groups = (r && Array.isArray(r.groups) ? r.groups : []).map(g => ({ name: String(g.name||""), players: (Array.isArray(g.players)?g.players:[]).map(x => String(x).trim()).filter(Boolean), teeOff: String(g.teeOff||""), courses: (Array.isArray(g.courses)?g.courses:[]).map(String) })).filter(g => g.players.length);
    if (!groups.length) { setup.nmsg = "공지에서 조 편성을 찾지 못했어요. 표가 잘 보이게 다시 찍어 주세요."; }
    else {
      setup.notice = { event: String(r.event||""), date: String(r.date||""), club: String(r.club||""), lunch: String(r.lunch||""), groups };
      if (/^\d{4}-\d{2}-\d{2}$/.test(setup.notice.date)) setup.date = setup.notice.date;
      const cid = findClub(setup.notice.club);
      if (cid) pickClub(setup, cid); else { setup.clubId = null; setup.custom = true; setup.front = { name: "전반", par: Array(9).fill(4) }; setup.back = { name: "후반", par: Array(9).fill(4) }; }
      const mine = myName ? groups.findIndex(g => g.players.some(x => x.includes(myName))) : -1;
      setup.gi = null; if (mine >= 0) applyGroup(mine);
      setup.nmsg = (cid ? courses[cid].name+" 골프장으로 설정했어요. " : (setup.notice.club ? '"'+setup.notice.club+'" 골프장이 등록돼 있지 않아 직접 입력 상태예요. ' : "")) + (mine >= 0 ? "" : "본인 조를 선택하세요.");
    }
  } catch(e) {
    setup.nmsg = e && e.code === "not_granted" ? "Claude 사용을 허용하지 않아 공지를 읽을 수 없어요." : e && e.code === "rate_limited" ? "잠시 후 다시 시도해 주세요." : "공지를 읽지 못했어요. 다시 시도해 주세요.";
  }
  setup.nbusy = false; if (view === "setup") render();
}
function applyGroup(i){
  const g = setup.notice.groups[i]; setup.gi = i;
  const names = g.players.slice(0,4).map(x => x.replace(/\s*\(.*?\)\s*/g,"").trim() || x); while (names.length < 4) names.push("");
  setup.players = names; setup.hcp = names.map(n => lastHcp(n)); setup.teeOff = g.teeOff || ""; setup.event = setup.notice.event || "";
  if (setup.clubId && g.courses.length) {
    const a = findNine(setup.clubId, g.courses[0]), b = findNine(setup.clubId, g.courses[1] || g.courses[0]);
    if (a) setup.front = { name: a.name, par: a.par.slice() };
    if (b) setup.back = { name: b.name, par: b.par.slice() };
  } else if (setup.custom && g.courses.length) { setup.front.name = g.courses[0]; setup.back.name = g.courses[1] || g.courses[0]; }
}
async function verifyPhoto(file){
  readSetupInputs(); setup.vbusy = true; setup.vmsg = ""; setup.verify = null; render();
  try {
    const r = await sampleFn.json('This image is a golf course scorecard. Read every 9-hole course (nine) on it. For each nine give its name as printed (e.g. "Stella", "OUT", "IN", "A") and the PAR of holes 1-9 from the PAR row only, never from handwritten scores or yardage rows. Reply with only JSON like {"nines":[{"name":"Stella","par":[4,4,4,4,3,5,4,4,4]}]}.', { images: file });
    const nines = (r && Array.isArray(r.nines) ? r.nines : []).map(n => ({ name: String(n.name||"").trim(), par: (Array.isArray(n.par)?n.par:[]).map(Number) })).filter(n => n.par.length === 9 && n.par.every(p => p >= 3 && p <= 6));
    if (!nines.length) setup.vmsg = "사진에서 PAR 줄을 찾지 못했어요. 파 줄이 잘 보이게 다시 찍어 주세요.";
    else {
      const c = courses[setup.clubId];
      setup.verify = nines.map(n => {
        const key = n.name.toLowerCase().replace(/[^a-z0-9가-힣]/g,"");
        const m = c.nines.find(x => { const k = x.name.toLowerCase().replace(/[^a-z0-9가-힣]/g,""); return k && key && (k === key || k.includes(key) || key.includes(k)); });
        return { name: n.name, par: n.par, found: m ? m.name : null, old: m ? m.par.slice() : null, same: m ? m.par.join() === n.par.join() : false, done: false };
      });
      const ok = setup.verify.filter(v => v.same).length, df = setup.verify.filter(v => v.found && !v.same).length, nf = setup.verify.filter(v => !v.found).length;
      setup.vmsg = nines.length+"개 코스를 읽었어요 · 일치 "+ok+" · 다름 "+df+(nf ? " · 미등록 "+nf : "")+". 아래에서 확인해 주세요.";
    }
  } catch(e) {
    setup.vmsg = e && e.code === "not_granted" ? "Claude 사용을 허용하지 않아 사진을 읽을 수 없어요." : e && e.code === "rate_limited" ? "잠시 후 다시 시도해 주세요." : "사진을 읽지 못했어요. 다시 시도해 주세요.";
  }
  setup.vbusy = false; if (view === "setup") render();
}
async function saveNine(clubId, name, par){
  const c = clone(courses[clubId]); let n = c.nines.find(x => x.name === name);
  if (n) { n.par = par.slice(); n.checked = true; } else c.nines.push({ name, par: par.slice(), checked: true });
  c.updatedAt = Date.now();
  await cstore.save(clubId, c); courses[clubId] = c;
  ["front","back"].forEach(side => { if (setup[side] && setup[side].name === name) setup[side].par = par.slice(); });
}
async function readPhoto(file){
  addForm.busy = true; addForm.msg = ""; readClubInputs(); render();
  try {
    const r = await sampleFn.json('This image is a golf course scorecard. Read the golf club name (if printed) and every 9-hole course on it. For each nine give its name as printed (e.g. "Stella", "OUT", "IN") and the PAR for holes 1-9 from the PAR row only. Reply with only JSON like {"club":"Twin Doves Golf Club","nines":[{"name":"Stella","par":[4,4,4,4,3,5,4,4,4]}]}. Use "" for a club name you cannot see.', { images: file });
    const n = applyNines(r, "photo");
    addForm.msg = n ? n+"개 코스를 읽었어요. 숫자를 스코어카드와 비교해 보고 저장하세요." : "사진에서 홀별 파를 찾지 못했어요. 파 줄이 잘 보이게 다시 찍거나 직접 입력해 주세요.";
  } catch(e) {
    addForm.msg = e && e.code === "not_granted" ? "Claude 사용을 허용하지 않아 사진을 읽을 수 없어요. 직접 입력해 주세요."
      : e && e.code === "rate_limited" ? "잠시 후 다시 시도해 주세요." : e && e.code === "image_rejected" ? "이 사진은 읽을 수 없어요. 다른 사진을 골라 주세요." : "사진을 읽지 못했어요. 다시 시도하거나 직접 입력해 주세요.";
  }
  addForm.busy = false; if (view === "addclub") render();
}

function topBar(){
  const d = (cur.date||"").split("-");
  return '<header class="top"><button class="btn sm" data-a="list">← 목록</button>'
    + '<div style="text-align:right;min-width:0"><div style="font-weight:600">'+esc(cur.front.name)+' · '+esc(cur.back.name)+'</div><div class="status" id="status">'+(d.length===3?(+d[1])+"/"+(+d[2])+" · ":"")+'</div></div></header>'
    + '<div class="tabs" role="tablist"><button role="tab" class="'+(tab==="play"?"on":"")+'" data-a="tab" data-t="play">홀별 입력</button><button role="tab" class="'+(tab==="card"?"on":"")+'" data-a="tab" data-t="card">스코어카드 · 순위</button></div>';
}
function fixStatus(){ const el = document.getElementById("status"); if (el) { const d=(cur.date||"").split("-"); el.innerHTML = (d.length===3?(+d[1])+"/"+(+d[2])+" · ":"") + statusText(); } }

function renderPlay(){
  const P = pars(cur), st = stats(cur);
  const holeDone = h => cur.players.every((_,i) => (cur.scores["p"+i]||[])[h] != null);
  const strip = side => '<div class="strip">'+[0,1,2,3,4,5,6,7,8].map(k => { const h = k + (side ? 9 : 0);
    return '<button class="'+(holeDone(h)?"done ":"")+(h===hole?"cur":"")+'" data-a="hole" data-h="'+h+'" aria-label="'+(side?cur.back.name:cur.front.name)+' '+(k+1)+'번홀">'+(k+1)+'</button>'; }).join("")+'</div>';
  const courseName = hole < 9 ? cur.front.name : cur.back.name;
  let h = topBar();
  h += '<div class="strip-l">'+esc(cur.front.name)+'</div>'+strip(0)+'<div class="strip-l">'+esc(cur.back.name)+'</div>'+strip(1);
  const olyOn = cur.oly && cur.oly.unit > 0; const mult = olyOn ? olyMult(hole) : 1; const carry = olyOn ? ((cur.oly.carry||[])[hole]||0) : 0;
  h += '<div class="hole"><div class="h">'+((hole%9)+1)+'<small>'+esc(courseName)+' '+(hole<9?'전반':'후반')+' · '+(hole+1)+'/18</small></div><div class="pr">'+(olyOn && mult > 1 ? '<span class="mult">올림픽 ×'+mult+'</span>' : '')+'PAR<b>'+P[hole]+'</b></div></div>';
  cur.players.forEach((name, i) => {
    const v = (cur.scores["p"+i]||[])[hole];
    const s = st[i];
    const val = v == null
      ? '<button class="val" data-a="setpar" data-p="'+i+'" aria-label="'+esc(name)+' 파로 입력"><span class="hint">탭 = 파</span></button>'
      : '<div class="val set '+cls(v)+'" aria-live="polite"><span class="r">'+(v===0?"0":sgn(v))+'</span><span class="k">'+term(v,P[hole])+' · '+(P[hole]+v)+'타</span></div>';
    h += '<div class="prow"><div style="min-width:0"><div class="nm">'+esc(name)+'</div><div class="sub">'+(s.n ? '<span class="num" style="font-size:15px">'+sgn(s.rel)+'</span> · '+s.st+'타 · '+s.n+'홀' : '기록 전')+'</div></div>'
      + '<div class="ctl"><button class="pm" data-a="dec" data-p="'+i+'" aria-label="'+esc(name)+' 한 타 빼기">−</button>'+val+'<button class="pm" data-a="inc" data-p="'+i+'" aria-label="'+esc(name)+' 한 타 더하기">+</button></div>'
      + (olyOn ? '<div class="oly" style="grid-column:1/-1">'+["z","3p","4p","1","2","3","4","5"].map(k => { const on = ocode((cur.oly.m["p"+i]||[])[hole]) === k; return '<button class="oc k'+k+(on?' on':'')+'" data-a="oly" data-p="'+i+'" data-k="'+k+'">'+OLY[k][0]+'</button>'; }).join("")+'<span class="opts num">'+(olyPts(i,hole) != null ? (olyPts(i,hole)>0?"+":"")+olyPts(i,hole) : "")+'</span></div>' : '')
      + '</div>';
  });
  if (olyOn) h += '<div class="row-actions" style="align-items:center;margin-top:4px"><button class="btn sm'+(carry?' primary':'')+'" data-a="carry">이월'+(carry ? ' ×'+(mult+carry)+' → 다음 홀' : '')+'</button>'+(carry ? '<button class="btn sm" data-a="uncarry">이월 취소</button>' : '<span class="note" style="margin:0">동점이면 이월을 누르세요. 누를 때마다 다음 홀 배수가 올라가요.</span>')+'</div>';
  h += '<p class="note">파 대비로 입력해요 (파 0, 보기 +1, 버디 −1). 숫자 칸을 길게 누르면 지워져요.</p>';
  h += '<nav class="nav"><div class="in"><button class="btn" data-a="prev" '+(hole===0?'aria-disabled="true" style="opacity:.45"':'')+'>← 이전 홀</button><button class="btn primary" data-a="next">'+(hole===17?'스코어카드 보기':'다음 홀 →')+'</button></div></nav>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
  fixStatus();
}

function scTable(side){
  const c = side ? cur.back : cur.front, off = side ? 9 : 0;
  let h = '<div class="sc-wrap"><table class="sc"><thead><tr><th>'+esc(c.name)+'</th>'+c.par.map((_,k)=>'<th>'+(k+1)+'</th>').join("")+'<th class="tot">계</th></tr></thead><tbody>';
  h += '<tr class="parrow"><td>PAR</td>'+c.par.map(p=>'<td class="num">'+p+'</td>').join("")+'<td class="tot num">'+c.par.reduce((a,b)=>a+b,0)+'</td></tr>';
  cur.players.forEach((name,i) => {
    const s = (cur.scores["p"+i]||[]).slice(off, off+9); let t = 0, n = 0;
    h += '<tr><td>'+esc(name)+'</td>'+c.par.map((p,k) => { const v = s[k]; if (v == null) return '<td class="num" style="color:var(--muted)">·</td>'; t += relMode ? v : p+v; n++; return '<td class="num '+cls(v)+'">'+(relMode ? relS(v) : p+v)+'</td>'; }).join("")
      + '<td class="tot num">'+(n ? (relMode ? relS(t) : t) : "")+'</td></tr>';
  });
  return h + '</tbody></table></div>';
}
function renderCard(){
  const rk = ranked(cur);
  let h = topBar() + '<div style="display:flex;align-items:center;justify-content:space-between;margin:22px 0 8px"><div class="sec-label" style="margin:0">순위 · 파 '+pars(cur).reduce((a,b)=>a+b,0)+'</div>'
    + '<div class="tabs" style="padding:2px;gap:2px"><button class="'+(relMode?"":"on")+'" data-a="mode" data-m="0" style="min-height:28px;font-size:12px;padding:0 10px;white-space:nowrap;flex:none">타수</button><button class="'+(relMode?"on":"")+'" data-a="mode" data-m="1" style="min-height:28px;font-size:12px;padding:0 10px;white-space:nowrap;flex:none">파 대비</button></div></div><div class="rank">';
  if (!rk.length) h += '<div class="empty">아직 입력한 스코어가 없어요. 홀별 입력 탭에서 시작하세요.</div>';
  rk.forEach((s,k) => {
    h += '<div class="rk'+(k===0?' first':'')+'"><div class="n">'+(k+1)+'</div><div style="min-width:0"><div style="font-weight:600">'+esc(s.name)+'</div><div class="meta">전반 '+(s.fn?(relMode?relS(s.f-s.fPar):s.f):"-")+' · 후반 '+(s.bn?(relMode?relS(s.b-s.bPar):s.b):"-")+(s.bird?' · 버디 '+s.bird:'')+' · 파 '+s.parc+(s.n<18?' · '+s.n+'/18홀':'')+'</div></div>'
      + '<div class="s"><b class="num">'+(relMode ? sgn(s.rel) : s.st)+'</b><span class="num">'+(relMode ? s.st+"타" : sgn(s.rel))+'</span></div></div>';
  });
  h += '</div>';
  const hasH = (cur.hcp||[]).some(v => v != null);
  if (hasH) {
    const st = stats(cur);
    const rowsN = st.map(s => { const hc = (cur.hcp||[])[s.i]; const h9 = hc == null ? null : hc/2;
      return { name: s.name, hc, f: s.fn===9 ? s.f : null, b: s.bn===9 ? s.b : null, all: s.n===18 ? s.st : null, h9,
        nf: s.fn===9 && hc != null ? s.f - h9 : null, nb: s.bn===9 && hc != null ? s.b - h9 : null, nall: s.n===18 && hc != null ? s.st - hc : null }; });
    const key = netTab === "front" ? "nf" : netTab === "back" ? "nb" : "nall", gkey = netTab === "front" ? "f" : netTab === "back" ? "b" : "all";
    const hk = netTab === "all" ? "hc" : "h9";
    const done = rowsN.filter(r => r[key] != null).sort((a,b) => a[key]-b[key] || (tieHigh ? b.hc-a.hc : a.hc-b.hc)), wait = rowsN.filter(r => r[key] == null);
    const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px"><div class="sec-label" style="margin:0">핸디 순위 (네트)</div>'
      + '<div class="tabs" style="padding:2px;gap:2px">'+[["front","전반"],["back","후반"],["all","전체"]].map(([k,l]) => '<button class="'+(netTab===k?"on":"")+'" data-a="nettab" data-t="'+k+'" style="min-height:28px;font-size:12px;padding:0 10px;white-space:nowrap;flex:none">'+l+'</button>').join("")+'</div></div>';
    h += '<div class="sc-wrap"><table class="sc"><thead><tr><th>순위</th><th style="text-align:left">이름</th><th>그로스</th><th>핸디</th><th>네트</th></tr></thead><tbody>';
    done.forEach((r,k) => { h += '<tr'+(k===0?' style="background:var(--green-soft)"':'')+'><td class="num" style="font-weight:600;color:'+(k===0?"var(--green)":"var(--muted)")+'">'+(k+1)+'</td><td style="text-align:left;font-weight:600">'+esc(r.name)+'</td><td class="num">'+r[gkey]+'</td><td class="num" style="color:var(--muted)">−'+fmt(r[hk])+'</td><td class="num tot">'+fmt(r[key])+'</td></tr>'; });
    wait.forEach(r => { h += '<tr><td class="num" style="color:var(--muted)">·</td><td style="text-align:left">'+esc(r.name)+'</td><td colspan="3" style="color:var(--muted);font-size:12px">'+(r.hc == null ? "핸디 없음" : (netTab==="all" ? "18홀" : "9홀")+" 완료 후 집계")+'</td></tr>'; });
    h += '</tbody></table></div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-6px 0 12px"><span class="note" style="margin:0">9홀은 핸디 절반 적용 · 동타 우선:</span><div class="tabs" style="padding:2px;gap:2px"><button class="'+(tieHigh?"on":"")+'" data-a="tie" data-t="high" style="min-height:26px;font-size:12px;padding:0 10px;white-space:nowrap;flex:none">하이 핸디</button><button class="'+(tieHigh?"":"on")+'" data-a="tie" data-t="low" style="min-height:26px;font-size:12px;padding:0 10px;white-space:nowrap;flex:none">로우 핸디</button></div></div>';
  }
  if (cur.oly && cur.oly.unit > 0) {
    const os = olyStats(); const medal = ["5","4","3","2","1"];
    h += '<div class="sec-label" style="margin-top:18px">올림픽 · 1점 '+cur.oly.unit.toLocaleString()+' · '+(cur.oly.method==="avg"?"평균 대비":"1:1 차이")+' 정산</div>';
    h += '<div class="sc-wrap"><table class="sc"><thead><tr><th style="text-align:left">이름</th><th>득점 내역</th><th>3퍼+</th><th>점수</th><th>정산</th></tr></thead><tbody>';
    os.forEach((r,k) => { const bad = (r.cnt["3p"]||0)+(r.cnt["4p"]||0);
      h += '<tr><td style="text-align:left;font-weight:600">'+esc(r.name)+'</td><td style="font-size:11px;white-space:nowrap">'+medal.filter(m=>r.cnt[m]).map(m => (m==="5"?"칩인":m+"점")+"×"+r.cnt[m]).join(" ")+'</td><td class="num" style="color:var(--bad)">'+(bad||"")+'</td><td class="num tot">'+(r.pts>0?"+":"")+r.pts+'</td><td class="num" style="font-weight:600;color:'+(r.money>0?"var(--par)":r.money<0?"var(--bad)":"var(--muted)")+'">'+won(r.money)+'</td></tr>'; });
    h += '</tbody></table></div><p class="note" style="margin:-6px 0 12px">'+(cur.oly.method==="avg" ? "정산 = (내 점수 − 평균) × 단가" : "정산 = 상대마다 (내 점수 − 상대 점수) × 단가, 합산")+' · 3퍼트 벌점 '+(cur.oly.pen==null?1:cur.oly.pen)+'점/퍼트</p>';
  }
  h += scTable(0) + scTable(1);
  h += '<p class="note" style="margin-bottom:12px"><span class="sc"><span class="b" style="padding:1px 6px;border-radius:4px">버디 이하</span> <span class="p" style="padding:1px 6px;border-radius:4px">파</span> <span class="x" style="padding:1px 6px;border-radius:4px">트리플 이상</span></span></p>';
  const phs = cur.photos || [];
  h += '<div class="sec-label">사진 '+(phs.length||"")+'</div>';
  if (bigPhoto != null && phs[bigPhoto]) {
    const ph = phs[bigPhoto];
    h += '<div class="card" style="padding:10px;margin-bottom:10px"><img src="'+esc(photoUrl(ph))+'" alt="'+kindLabel(ph.kind)+'" style="width:100%;border-radius:8px;display:block">'
      + '<div class="row-actions" style="margin-top:8px;align-items:center"><span class="note" style="margin:0;flex:1">'+kindLabel(ph.kind)+' · '+new Date(ph.at||0).toLocaleDateString("ko-KR")+'</span><button class="btn sm" data-a="pclose">닫기</button>'
      + (delPhoto === bigPhoto ? '<button class="btn sm danger" data-a="pdel" data-i="'+bigPhoto+'">정말 삭제</button><button class="btn sm" data-a="pnodel">취소</button>' : '<button class="btn sm danger" data-a="paskdel" data-i="'+bigPhoto+'">삭제</button>')+'</div></div>';
  }
  h += '<div class="pgrid">'+phs.map((ph,i) => '<button class="pth" data-a="popen" data-i="'+i+'" aria-label="'+kindLabel(ph.kind)+' 열기"><img src="'+esc(photoUrl(ph))+'" alt=""><span>'+kindLabel(ph.kind)+'</span></button>').join("")
    + '<label class="pth add" for="r-photo"><span style="font-size:24px;line-height:1">+</span><span>사진 추가</span></label><input type="file" id="r-photo" accept="image/*" multiple hidden></div>';
  if (editInfo) {
    h += '<div class="card" style="margin-bottom:12px"><div class="field"><label for="e-date">날짜</label><input type="date" id="e-date" value="'+esc(cur.date)+'"></div><div class="field"><label>동반자 이름 · 핸디 (18홀 기준)</label><div class="players" style="grid-template-columns:1fr">'+cur.players.map((n,i)=>'<div style="display:flex;gap:6px"><input type="text" id="e-p'+i+'" value="'+esc(n)+'" style="flex:1;min-width:0"><input type="number" inputmode="decimal" step="0.5" min="0" max="54" id="e-h'+i+'" value="'+esc((cur.hcp||[])[i] ?? "")+'" placeholder="핸디" style="width:84px"></div>').join("")+'</div></div>'
      + olyForm(cur.oly, "e")
      + '<div class="row-actions"><button class="btn primary" data-a="saveinfo">저장</button><button class="btn" data-a="cancelinfo">취소</button></div></div>';
  }
  h += '<div class="row-actions"><button class="btn primary" data-a="img" data-k="card">스코어카드 이미지</button>' + ((cur.hcp||[]).some(v => v != null) || (cur.oly && cur.oly.unit > 0) ? '<button class="btn primary" data-a="img" data-k="bet">내기 결과 이미지</button>' : '') + '<button class="btn" data-a="copy">텍스트 복사</button>' + (editInfo ? '' : '<button class="btn" data-a="editinfo">정보 수정</button>')
    + (confirmDel ? '<button class="btn danger" data-a="del">정말 삭제</button><button class="btn" data-a="nodel">취소</button>' : '<button class="btn danger" data-a="askdel">라운드 삭제</button>') + '</div>';
  h += '<div id="imgbox" hidden style="margin-top:12px"><p class="note" style="margin:0 0 6px" id="imgnote"></p><img id="imgout" alt="라운드 결과 이미지" style="width:100%;border-radius:10px;border:1px solid var(--line)"></div>';
  h += '<textarea id="copybox" readonly hidden style="width:100%;height:140px;margin-top:10px;font:inherit;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:10px"></textarea>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
  fixStatus();
}
const IMG_F = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif', IMG_D = '"Barlow Condensed",'+IMG_F;
function imgHeader(g, W, H){
  g.fillStyle = "#F3F5F1"; g.fillRect(0,0,W,H);
  g.fillStyle = "#1E5B43"; g.fillRect(0,0,W,92);
  g.fillStyle = "#fff"; g.font = "600 24px "+IMG_F; g.fillText((cur.club||"")||(cur.front.name+" · "+cur.back.name), 24, 40);
  g.font = "400 15px "+IMG_F; g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText((cur.event?cur.event+"  ·  ":"")+(cur.date||"").replace(/-/g,".")+"  ·  "+cur.front.name+" / "+cur.back.name+(cur.teeOff?"  ·  "+cur.teeOff:"")+"  ·  PAR "+pars(cur).reduce((a,b)=>a+b,0), 24, 68);
}
function resultImage(){
  const S = 2, W = 540; const rk = ranked(cur);
  const rows = 1 + cur.players.length; const tH = 28, rowH = 34;
  const H = 150 + rk.length*44 + 2*(24 + tH + rows*rowH + 16) + 40;
  const c = document.createElement("canvas"); c.width = W*S; c.height = H*S; const g = c.getContext("2d"); g.scale(S,S);
  const F = IMG_F, D = IMG_D;
  imgHeader(g, W, H);
  let y = 112;
  g.fillStyle = "#66706A"; g.font = "500 12px "+F; g.fillText("순위", 24, y); y += 10;
  rk.forEach((s,k) => {
    g.fillStyle = k===0 ? "#E3EEE7" : "#fff"; roundRect(g, 24, y, W-48, 38, 8); g.fill();
    if (k===0) { g.strokeStyle = "#1E5B43"; g.lineWidth = 1.5; roundRect(g, 24, y, W-48, 38, 8); g.stroke(); }
    g.fillStyle = k===0 ? "#1E5B43" : "#888"; g.font = "700 22px "+D; g.fillText(String(k+1), 38, y+27);
    g.fillStyle = "#1C2420"; g.font = "600 16px "+F; g.fillText(s.name, 66, y+24);
    g.fillStyle = "#66706A"; g.font = "400 12px "+F; g.fillText("전 "+(s.fn?(relMode?relS(s.f-s.fPar):s.f):"-")+" · 후 "+(s.bn?(relMode?relS(s.b-s.bPar):s.b):"-")+(s.bird?" · 버디 "+s.bird:"")+" · 파 "+s.parc+((cur.hcp||[])[s.i] != null && s.n===18 ? " · 네트 "+(Number.isInteger(s.st-cur.hcp[s.i]) ? s.st-cur.hcp[s.i] : (s.st-cur.hcp[s.i]).toFixed(1)) : ""), 180, y+24);
    g.textAlign = "right"; g.fillStyle = "#1C2420"; g.font = "700 26px "+D; g.fillText(relMode ? sgn(s.rel) : String(s.st), W-84, y+28);
    g.fillStyle = "#66706A"; g.font = "600 14px "+D; g.fillText(relMode ? s.st+"타" : sgn(s.rel), W-36, y+27); g.textAlign = "left";
    y += 44;
  });
  y += 8;
  [["front",0],["back",9]].forEach(([side,off]) => {
    const co = cur[side]; const x0 = 24, nameW = 86, cw = (W-48-nameW-50)/9, totW = 50;
    g.fillStyle = "#1C2420"; g.font = "600 14px "+F; g.fillText(co.name+(off?" (후반)":" (전반)"), x0, y+14); y += 24;
    g.fillStyle = "#fff"; roundRect(g, x0, y, W-48, tH+rows*rowH, 8); g.fill();
    g.fillStyle = "#EEF1EC"; g.fillRect(x0, y, W-48, tH);
    g.fillStyle = "#66706A"; g.font = "500 12px "+F; g.textAlign = "center";
    for (let i=0;i<9;i++) g.fillText(String(i+1), x0+nameW+cw*i+cw/2, y+18);
    g.fillText("계", x0+nameW+cw*9+totW/2, y+18);
    g.textAlign = "left"; g.fillText("PAR", x0+10, y+tH+22);
    g.textAlign = "center"; g.font = "500 14px "+D;
    for (let i=0;i<9;i++) g.fillText(String(co.par[i]), x0+nameW+cw*i+cw/2, y+tH+23);
    g.fillText(String(co.par.reduce((a,b)=>a+b,0)), x0+nameW+cw*9+totW/2, y+tH+23);
    cur.players.forEach((name,pi) => {
      const ry = y+tH+rowH*(pi+1); const sc = (cur.scores["p"+pi]||[]).slice(off,off+9); let t=0,n=0;
      g.strokeStyle = "#E4E8E1"; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, ry); g.lineTo(x0+W-48, ry); g.stroke();
      g.textAlign = "left"; g.fillStyle = "#1C2420"; g.font = "500 13px "+F; g.fillText(name.length>6?name.slice(0,6):name, x0+10, ry+22);
      g.textAlign = "center";
      for (let i=0;i<9;i++) { const v = sc[i]; const cx = x0+nameW+cw*i;
        if (v==null) { g.fillStyle = "#B4B2A9"; g.font = "500 14px "+D; g.fillText("·", cx+cw/2, ry+23); continue; }
        const st = co.par[i]+v; t += relMode ? v : st; n++;
        const bg = v<0 ? "#DCE8FA" : v===0 ? "#E1F1E6" : v>=3 ? "#FBE5E2" : null; const fg = v<0 ? "#1F5FBF" : v===0 ? "#2E7A4E" : v>=3 ? "#B23A32" : "#1C2420";
        if (bg) { g.fillStyle = bg; g.fillRect(cx+2, ry+4, cw-4, rowH-8); }
        g.fillStyle = fg; g.font = (v<0?"700":"500")+" 16px "+D; g.fillText(relMode ? relS(v) : String(st), cx+cw/2, ry+23);
      }
      g.fillStyle = "#1C2420"; g.font = "700 16px "+D; g.fillText(n ? (relMode ? relS(t) : String(t)) : "", x0+nameW+cw*9+totW/2, ry+23);
    });
    g.textAlign = "left"; y += tH+rows*rowH+16;
  });
  g.fillStyle = "#97A39C"; g.font = "400 11px "+F; g.fillText("라운드 스코어 노트", 24, H-14);
  return c;
}
/* 내기 결과 이미지: 핸디 순위(네트) + 올림픽 정산. 아직 집계할 내용이 없으면 null */
function betImage(){
  const S = 2, W = 540, x0 = 24, tW = W-48, tH = 28, rowH = 34, F = IMG_F, D = IMG_D;
  const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
  const st = stats(cur), hasH = (cur.hcp||[]).some(v => v != null);
  const nets = !hasH ? [] : [["전반",s=>s.fn===9?s.f:null,0.5],["후반",s=>s.bn===9?s.b:null,0.5],["전체",s=>s.n===18?s.st:null,1]].map(([lab,get,m]) => ({ lab,
    rows: st.map(s => { const gr = get(s), hc = (cur.hcp||[])[s.i]; return gr != null && hc != null ? { n: s.name, gr, hc: hc*m, net: gr - hc*m } : null; }).filter(Boolean).sort((a,b)=>a.net-b.net || (tieHigh ? b.hc-a.hc : a.hc-b.hc)) })).filter(t => t.rows.length);
  const os = cur.oly && cur.oly.unit > 0 ? olyStats() : null, hasO = !!os && os.some(r => r.n);
  if (!nets.length && !hasO) return null;
  const sec = n => 24 + tH + n*rowH + 16;
  const H = 146 + nets.reduce((a,t)=>a+sec(t.rows.length),0) + (nets.length ? 22 : 0) + (hasO ? sec(os.length)+22 : 0) + 30;
  const c = document.createElement("canvas"); c.width = W*S; c.height = H*S; const g = c.getContext("2d"); g.scale(S,S);
  imgHeader(g, W, H);
  g.fillStyle = "#1C2420"; g.font = "600 16px "+F; g.fillText("내기 결과", x0, 120);
  let y = 134;
  const cell = (t, x, w, align, font, color) => { // 칸보다 긴 글자는 줄여서 넣는다
    let size = font[1]; g.font = font[0]+" "+size+"px "+font[2];
    while (size > 9 && g.measureText(t).width > w-12) { size--; g.font = font[0]+" "+size+"px "+font[2]; }
    if (g.measureText(t).width > w-12) { while (t.length > 1 && g.measureText(t+"…").width > w-12) t = t.slice(0,-1); t += "…"; }
    g.fillStyle = color; g.textAlign = align; g.fillText(t, align === "left" ? x+10 : x+w/2, y);
  };
  const table = (title, cols, rows) => {
    g.textAlign = "left"; g.fillStyle = "#1C2420"; g.font = "600 14px "+F; g.fillText(title, x0, y+14); y += 24;
    g.fillStyle = "#fff"; roundRect(g, x0, y, tW, tH+rows.length*rowH, 8); g.fill();
    g.fillStyle = "#EEF1EC"; g.fillRect(x0, y, tW, tH);
    const yTop = y; let x = x0; y = yTop+18;
    cols.forEach(co => { cell(co.t, x, co.w, co.a, ["500",12,F], "#66706A"); x += co.w; });
    rows.forEach((r,ri) => { const ry = yTop+tH+rowH*ri;
      if (r.hi) { g.fillStyle = "#E3EEE7"; g.fillRect(x0, ry, tW, rowH); }
      g.strokeStyle = "#E4E8E1"; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, ry); g.lineTo(x0+tW, ry); g.stroke();
      x = x0; y = ry+23;
      r.cells.forEach((v,k) => { cell(v[0], x, cols[k].w, cols[k].a, v[1], v[2]); x += cols[k].w; });
    });
    g.textAlign = "left"; y = yTop+tH+rows.length*rowH+16;
  };
  const note = t => { g.fillStyle = "#66706A"; g.font = "400 11px "+F; g.fillText(t, x0, y+2); y += 22; };
  const NUM = ["500",16,D], BOLD = ["700",16,D], INK = "#1C2420", MUTED = "#66706A";
  nets.forEach(t => table("핸디 순위 · "+t.lab,
    [{t:"순위",w:50,a:"center"},{t:"이름",w:202,a:"left"},{t:"그로스",w:80,a:"center"},{t:"핸디",w:80,a:"center"},{t:"네트",w:80,a:"center"}],
    t.rows.map((r,k) => ({ hi: k===0, cells: [[String(k+1),BOLD,k===0?"#1E5B43":MUTED],[r.n,["600",14,F],INK],[String(r.gr),NUM,INK],["−"+fmt(r.hc),NUM,MUTED],[fmt(r.net),BOLD,INK]] }))));
  if (nets.length) note("9홀은 핸디 절반 적용 · 동타 우선: "+(tieHigh ? "하이" : "로우")+" 핸디");
  if (hasO) {
    const medal = ["5","4","3","2","1"];
    table("올림픽 · 1점 "+cur.oly.unit.toLocaleString()+" · "+(cur.oly.method==="avg"?"평균 대비":"1:1 차이")+" 정산",
      [{t:"이름",w:110,a:"left"},{t:"득점 내역",w:190,a:"left"},{t:"3퍼+",w:42,a:"center"},{t:"점수",w:60,a:"center"},{t:"정산",w:90,a:"center"}],
      os.map(r => { const bad = (r.cnt["3p"]||0)+(r.cnt["4p"]||0);
        return { cells: [[r.name,["600",14,F],INK],[medal.filter(m=>r.cnt[m]).map(m => (m==="5"?"칩인":m+"점")+"×"+r.cnt[m]).join(" "),["400",12,F],INK],[bad?String(bad):"",NUM,"#B23A32"],[(r.pts>0?"+":"")+r.pts,BOLD,INK],[won(r.money),BOLD,r.money>0?"#2E7A4E":r.money<0?"#B23A32":MUTED]] }; }));
    note((cur.oly.method==="avg" ? "정산 = (내 점수 − 평균) × 단가" : "정산 = 상대마다 (내 점수 − 상대 점수) × 단가, 합산")+" · 3퍼트 벌점 "+(cur.oly.pen==null?1:cur.oly.pen)+"점/퍼트");
  }
  g.fillStyle = "#97A39C"; g.font = "400 11px "+F; g.fillText("라운드 스코어 노트", 24, H-14);
  return c;
}
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
let lastBlob = null;
async function shareImage(kind){
  const box = document.getElementById("imgbox"), img = document.getElementById("imgout"), note = document.getElementById("imgnote");
  try { if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('600 16px "IBM Plex Sans KR"')]); } catch(e){}
  const c = kind === "bet" ? betImage() : resultImage();
  if (!c) { toast("아직 집계할 내기 결과가 없어요"); return; }
  const blob = await new Promise(res => c.toBlob(res, "image/png")); lastBlob = blob;
  img.src = c.toDataURL("image/png"); box.hidden = false;
  const fname = "golf_"+(cur.date||"").replace(/-/g,"")+"_"+(cur.club||cur.front.name).replace(/[^\w가-힣]+/g,"").slice(0,20)+(kind === "bet" ? "_bet" : "_scorecard")+".png";
  if (dlFn) {
    note.textContent = "공유 창이 뜨면 카카오톡을 고르거나 저장을 누르세요. 공유 창이 없는 브라우저는 다운로드 폴더에 저장돼요.";
    try { await dlFn.save({ filename: fname, data: blob }); toast("저장했어요"); note.textContent = "저장했어요. 카톡에서 사진 첨부로 보내세요. 다시 저장하려면 버튼을 한 번 더 누르세요."; }
    catch(e) {
      if (e && e.code === "declined") note.textContent = "저장을 취소했어요. 다시 하려면 버튼을 한 번 더 누르세요.";
      else if (e && e.code === "rate_limited") note.textContent = "잠시 후 다시 눌러 주세요.";
      else note.textContent = "저장 기능을 쓸 수 없는 화면이에요. 아래 그림을 길게 눌러 '이미지 저장' 또는 '공유'를 누르세요.";
    }
  } else {
    let copied = false;
    try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); copied = true; } } catch(e){}
    note.textContent = (copied ? "클립보드에도 복사해 봤지만 카톡에 붙여 넣기가 안 될 수 있어요. " : "") + "아래 그림을 길게 눌러 '이미지 저장' 또는 '공유'를 누르면 카톡으로 보낼 수 있어요.";
  }
  img.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function resultText(){
  const d = (cur.date||"").replace(/-/g,".");
  const lines = ["⛳ "+(cur.event?cur.event+" · ":"")+d+" "+(cur.club||"")+" "+cur.front.name+" · "+cur.back.name+" (파 "+pars(cur).reduce((a,b)=>a+b,0)+")"];
  ranked(cur).forEach((s,k) => lines.push((k+1)+". "+s.name+" "+s.st+" ("+sgn(s.rel)+") 전 "+(s.fn?s.f:"-")+" / 후 "+(s.bn?s.b:"-")+(s.bird?" · 버디 "+s.bird:"")));
  if ((cur.hcp||[]).some(v => v != null)) {
    const st = stats(cur); const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
    [["전반",s=>s.fn===9?s.f:null,0.5],["후반",s=>s.bn===9?s.b:null,0.5],["전체",s=>s.n===18?s.st:null,1]].forEach(([lab,get,m]) => {
      const rows = st.map(s => { const g = get(s), hc = (cur.hcp||[])[s.i]; return g != null && hc != null ? { n: s.name, g, hc: hc*m, net: g - hc*m } : null; }).filter(Boolean).sort((a,b)=>a.net-b.net || (tieHigh ? b.hc-a.hc : a.hc-b.hc));
      if (rows.length) lines.push("[핸디 "+lab+"] "+rows.map((r,k) => (k+1)+"위 "+r.n+" "+fmt(r.net)+"("+r.g+"-"+fmt(r.hc)+")").join(" · "));
    });
  }
  if (cur.oly && cur.oly.unit > 0) { const os = olyStats(); lines.push("[올림픽] "+os.map(r => r.name+" "+(r.pts>0?"+":"")+r.pts+"점 "+won(r.money)).join(" · ")); }
  return lines.join("\n");
}


/* ---------- 설정 · 백업 (PWA 전용 추가) ---------- */
const APP_VERSION = "1.1.0";
function prefs(){ return { myName, tieHigh, relMode, memGroup }; }
function renderSettings(){
  let h = '<header class="top"><div class="brand">'+FLAG+'라운드 스코어 노트</div><button class="btn primary" data-a="new">+ 새 라운드</button></header>' + homeTabs();
  const nR = Object.keys(rounds).length, nC = Object.keys(courses).length, nM = Object.keys(members).length;
  const nP = Object.values(rounds).reduce((a,r)=>a+((r.photos||[]).length),0) + (((settings.hcp||{}).photos)||[]).length;
  h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">내 이름</div><p class="note" style="margin:0 0 8px">기록에서 나를 찾을 때 써요.</p><div style="display:flex;gap:6px"><input type="text" id="s-me" value="'+esc(myName)+'" placeholder="이름" style="flex:1;min-width:0"><button class="btn sm" data-a="saveme2">저장</button></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">백업 · 다른 기기로 옮기기</div>'
    + '<p class="note" style="margin:0 0 10px">라운드·골프장·회원·핸디표 사진은 지금 쓰는 휴대폰(브라우저) 안에만 저장돼요. 휴대폰을 바꾸거나 PC에서도 보려면 파일로 내보낸 뒤 그 기기에서 가져오세요. 가끔 내보내 두면 안전해요.</p>'
    + '<div class="row-actions"><button class="btn primary" data-a="export">파일로 내보내기</button><label class="btn" for="i-file">파일 가져오기</label><input type="file" id="i-file" accept=".json,application/json" hidden></div>';
  if (impPending) { const s = AppStorage.summarize(impPending);
    h += '<div class="picked" style="margin-top:10px;display:block"><b>가져올 파일</b><span>라운드 '+s.rounds+' · 골프장 '+s.courses+' · 회원 '+s.members+' · 사진 '+s.photos+(s.exportedAt?' · '+esc(s.exportedAt.slice(0,10)):'')+'</span></div>'
      + '<p class="note" style="margin:8px 0 6px">합치기: 같은 기록은 파일 쪽으로 덮어쓰고 나머지는 그대로 둬요. 모두 바꾸기: 지금 기기 데이터를 지우고 파일 내용만 남겨요.</p>'
      + '<div class="row-actions"><button class="btn primary" data-a="impmerge">합치기</button><button class="btn danger" data-a="impreplace">모두 바꾸기</button><button class="btn" data-a="impcancel">취소</button></div>'; }
  if (impMsg) h += '<p class="note" style="margin:8px 0 0">'+esc(impMsg)+'</p>';
  h += '</div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">골프장 목록 불러오기</div><p class="note" style="margin:0 0 10px">두실장이 공식 홈페이지를 보고 정리한 골프장 목록(남부 베트남 등)을 앱에 넣어요. 이미 있는 골프장은 건드리지 않고 새 골프장만 추가해요. 인터넷이 필요해요.</p>'
    + '<button class="btn" data-a="loadpack" '+(packBusy?'disabled':'')+' style="width:100%">'+(packBusy ? '불러오는 중…' : '골프장 목록 불러오기')+'</button>'
    + (packMsg ? '<p class="note" style="margin:8px 0 0">'+esc(packMsg)+'</p>' : '') + '</div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">저장 현황</div><p class="note" style="margin:0">라운드 <b class="num" style="color:var(--ink)">'+nR+'</b> · 골프장 <b class="num" style="color:var(--ink)">'+nC+'</b> · 회원 <b class="num" style="color:var(--ink)">'+nM+'</b> · 사진 <b class="num" style="color:var(--ink)">'+nP+'</b><br>저장 방식: '+(store && store.kind === "idb" ? "기기 내부 데이터베이스" : "브라우저 간이 저장")+(usageTxt ? ' · '+esc(usageTxt) : '')+'</p></div>';
  const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  h += '<div class="card" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">홈 화면에 추가</div>';
  if (standalone) h += '<p class="note" style="margin:0">이미 앱으로 설치되어 있어요.</p>';
  else if (installEvt) h += '<button class="btn primary" data-a="install" style="width:100%">앱으로 설치</button>';
  else h += '<p class="note" style="margin:0">아이폰(Safari): 아래 공유 버튼 → "홈 화면에 추가".<br>안드로이드(Chrome): 오른쪽 위 ⋮ 메뉴 → "홈 화면에 추가" 또는 "앱 설치".</p>';
  h += '</div>';
  h += '<div class="card"><div style="font-weight:600;margin-bottom:6px">초기화</div><p class="note" style="margin:0 0 8px">이 기기에 저장된 모든 기록을 지워요. 지우기 전에 파일로 내보내 두세요.</p>'
    + (clearAsk ? '<div class="row-actions"><button class="btn danger" data-a="clearall">정말 모두 지우기</button><button class="btn" data-a="clearno">취소</button></div>' : '<button class="btn danger" data-a="clearask">모든 데이터 지우기</button>') + '</div>';
  h += '<p class="note" style="text-align:center">라운드 스코어 노트 v'+APP_VERSION+' · 단독 웹앱 (PWA)</p>';
  app.innerHTML = '<div class="wrap">'+h+'</div>';
  if (!usageTxt) AppStorage.usage().then(u => { if (u && u.used) { usageTxt = "사용 " + (u.used/1048576).toFixed(1) + "MB"; if (view === "list" && home === "settings") render(); } });
}
async function reloadAll(){
  const [r, c, m, s] = await Promise.all(["rounds","courses","members","settings"].map(n => AppStorage.readAll(n)));
  onData(r); courses = c; members = m; settings = s; render();
}
async function exportData(){
  const obj = await AppStorage.exportAll({ prefs: prefs() });
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const fname = "round_score_note_backup_" + todayStr().replace(/-/g,"") + ".json";
  try { await dlFn.save({ filename: fname, data: blob }); impMsg = "내보냈어요: " + fname; }
  catch(e) { impMsg = e && e.code === "declined" ? "내보내기를 취소했어요." : "내보내지 못했어요."; }
  render();
}
function importPick(file){
  const rd = new FileReader();
  rd.onload = () => { try { const o = JSON.parse(rd.result); if (!AppStorage.isBackup(o)) throw 0; impPending = o; impMsg = ""; } catch(e) { impPending = null; impMsg = "라운드 스코어 노트 백업 파일이 아니에요."; } render(); };
  rd.onerror = () => { impMsg = "파일을 읽지 못했어요."; render(); };
  rd.readAsText(file);
}
async function importData(mode){
  if (!impPending) return;
  try { await AppStorage.importAll(impPending, mode); const p = impPending.prefs || {};
    if (p.myName) { myName = p.myName; try { localStorage.setItem("golf-myname", myName); } catch(e){} }
    impPending = null; impMsg = mode === "replace" ? "파일 내용으로 모두 바꿨어요." : "파일 내용을 합쳤어요."; await reloadAll(); toast("가져왔어요"); }
  catch(e) { impMsg = "가져오지 못했어요: " + (e && e.message || e); render(); }
}
/* 내장 골프장 목록 (app/data/courses_pack.json) 불러오기: 새 골프장만 추가, 기존 것은 유지 */
async function loadPack(){
  packBusy = true; packMsg = ""; render();
  try {
    const r = await fetch("data/courses_pack.json", { cache: "no-store" }); if (!r.ok) throw new Error("http " + r.status);
    const pack = await r.json(); const list = pack && pack.courses ? Object.entries(pack.courses) : [];
    let added = 0, kept = 0, fixed = 0, bad = 0;
    for (const [id, c] of list) {
      const nines = (Array.isArray(c.nines) ? c.nines : []).map(n => ({ name: String(n.name||"").trim(), par: (Array.isArray(n.par)?n.par:[]).map(Number), checked: n.checked !== false })).filter(n => n.name && n.par.length === 9 && n.par.every(p => p >= 3 && p <= 6));
      if (!id || !c.name || !nines.length) { bad++; continue; }
      if (courses[id]) {
        // 이미 있는 골프장: 아직 확인 안 된(?) 코스만 목록의 확인된 값으로 고친다. 사용자가 확인 저장한 코스는 그대로.
        const ex = clone(courses[id]); let ch = 0;
        nines.filter(n => n.checked).forEach(n => { const o = (ex.nines||[]).find(x => norm(x.name) === norm(n.name)); if (o && o.checked !== true && (o.par.join() !== n.par.join() || !o.checked)) { o.par = n.par.slice(); o.checked = true; ch++; } });
        if (ch) { ex.updatedAt = Date.now(); delete ex.id; await cstore.save(id, ex); courses[id] = ex; fixed++; } else kept++;
        continue;
      }
      const body = { name: String(c.name), nameKo: String(c.nameKo||""), region: String(c.region||""), aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : [], nines, updatedAt: Date.now(), pack: pack.updatedAt || "" };
      await cstore.save(id, body); courses[id] = body; added++;
    }
    packMsg = (pack.name ? pack.name + " (" + (pack.updatedAt||"") + "): " : "") + "새로 추가 " + added + " · 이미 있음 " + kept + (fixed ? " · 파 확인·보정 " + fixed : "") + (bad ? " · 건너뜀 " + bad : "") + ". 새 라운드에서 골프장 검색에 바로 나와요.";
  } catch(e) { packMsg = !navigator.onLine ? "인터넷에 연결되어 있지 않아요." : "목록을 받지 못했어요. 잠시 후 다시 시도해 주세요."; }
  packBusy = false; if (view === "list" && home === "settings") render();
}
async function hcpPhotoStore(file){
  memBusy = true; memMsg = ""; render();
  try {
    const { dataUrl } = await shrink(file, 900, 0.7); const today = todayStr();
    const ph = { at: Date.now(), group: curGroup(), label: "핸디표 "+today.slice(5).replace("-","/"), data: dataUrl };
    const st = clone(settings.hcp || {}); delete st.id; (st.photos = st.photos||[]).push(ph); await sstore.save("hcp", st); settings.hcp = Object.assign(st, { id: "hcp" });
    memMsg = "핸디표 사진을 저장했어요. 핸디 숫자는 '+ 회원' 또는 '수정'으로 입력해 주세요.";
  } catch(e) { memMsg = "사진을 저장하지 못했어요."; }
  memBusy = false; if (view === "list" && home === "hcp") render();
}
function makeDownloader(){
  return { async save({ filename, data }){
    const file = new File([data], filename, { type: data.type || "application/octet-stream" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; }
      catch(e) { if (e && e.name === "AbortError") throw { code: "declined" }; }
    }
    const u = URL.createObjectURL(data); const a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  } };
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (view === "list" && home === "settings") render(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("홈 화면에 추가했어요"); if (view === "list" && home === "settings") render(); });

/* ---------- actions ---------- */
function setScore(p, fn){
  const key = "p"+p; const arr = cur.scores[key] || (cur.scores[key] = Array(18).fill(null));
  const P = pars(cur)[hole]; let v = fn(arr[hole]);
  if (v != null) v = Math.max(1 - P, Math.min(P + 6, v));
  arr[hole] = v; scheduleSave(); render();
}
app.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a;
  if (a === "new") { setup = newSetup(); editMe = false; view = "setup"; render(); window.scrollTo(0,0); }
  else if (a === "list") { if (dirty) await flush(); view = "list"; cur = null; confirmDel = false; editInfo = false; bigPhoto = null; render(); window.scrollTo(0,0); }
  else if (a === "open") { cur = clone(rounds[b.dataset.id]); view = "play"; tab = "card"; hole = firstOpenHole(); confirmDel = false; editInfo = false; bigPhoto = null; render(); window.scrollTo(0,0); }
  else if (a === "club") { readSetupInputs(); pickClub(setup, b.dataset.id); setup.err = ""; render(); }
  else if (a === "unclub") { readSetupInputs(); setup.clubId = null; setup.custom = false; setup.front = null; setup.back = null; render(); setTimeout(() => { const q = document.getElementById("f-q"); if (q) q.focus(); }, 0); }
  else if (a === "custom") { readSetupInputs(); setup.clubId = null; setup.custom = true; setup.front = { name: "전반", par: Array(9).fill(4) }; setup.back = { name: "후반", par: Array(9).fill(4) }; render(); }
  else if (a === "nine") { readSetupInputs(); const n = courses[setup.clubId].nines[+b.dataset.i]; setup[b.dataset.side] = { name: n.name, par: n.par.slice() }; render(); }
  else if (a === "par") { readSetupInputs(); const s = setup[b.dataset.side]; const i = +b.dataset.i; s.par[i] = s.par[i] >= 5 ? 3 : s.par[i] + 1; render(); }
  else if (a === "savepar") {
    readSetupInputs(); const side = setup[b.dataset.side]; const c = clone(courses[setup.clubId]); const n = c.nines.find(x => x.name === side.name);
    n.par = side.par.slice(); n.checked = true; c.updatedAt = Date.now();
    try { await cstore.save(setup.clubId, c); courses[setup.clubId] = c; toast(side.name+" 코스 파를 저장했어요"); } catch(e) { toast("저장하지 못했어요"); }
    render();
  }
  else if (a === "addclub") { readSetupInputs(); addForm = newClubForm(); if (setup.q.trim()) addForm.name = setup.q.trim(); view = "addclub"; render(); window.scrollTo(0,0); }
  else if (a === "backsetup") { view = "setup"; render(); }
  else if (a === "editme") { readSetupInputs(); editMe = true; render(); setTimeout(() => { const i = document.getElementById("f-me"); if (i) { i.focus(); i.select(); } }, 0); }
  else if (a === "cancelme") { readSetupInputs(); editMe = false; render(); }
  else if (a === "saveme") { readSetupInputs(); const v = (document.getElementById("f-me").value || "").trim(); if (!v) { toast("이름을 입력하세요"); return; }
    myName = v; try { localStorage.setItem("golf-myname", v); } catch(e){} editMe = false; render(); toast("내 이름을 "+v+"(으)로 저장했어요"); }
  else if (a === "ngroup") { readSetupInputs(); applyGroup(+b.dataset.i); render(); }
  else if (a === "nclear") { readSetupInputs(); setup.notice = null; setup.noticeFile = null; setup.gi = null; setup.nmsg = ""; setup.teeOff = ""; setup.event = ""; render(); }
  else if (a === "vok" || a === "vapply") { const v = setup.verify[+b.dataset.i]; readSetupInputs();
    try { await saveNine(setup.clubId, v.found, v.par); v.done = true; toast(v.found+" 코스 저장했어요"); } catch(e) { toast("저장하지 못했어요"); } render(); }
  else if (a === "vadd") { const v = setup.verify[+b.dataset.i]; readSetupInputs();
    try { await saveNine(setup.clubId, v.name, v.par); v.found = v.name; v.same = true; v.done = true; toast(v.name+" 코스를 추가했어요"); } catch(e) { toast("저장하지 못했어요"); } render(); }
  else if (a === "lookup") { if (!addForm.busy) lookupClub(); }
  else if (a === "apisearch") { if (!addForm.apiBusy) apiSearch(); }
  else if (a === "apipick") { if (!addForm.apiBusy) apiPick(b.dataset.id); }
  else if (a === "cpar") { readClubInputs(); addForm.fromLookup = false; const n = addForm.nines[+b.dataset.n]; const i = +b.dataset.i; n.par[i] = n.par[i] >= 5 ? 3 : n.par[i] + 1; render(); }
  else if (a === "addnine") { readClubInputs(); addForm.nines.push({ name: "", par: Array(9).fill(4) }); render(); }
  else if (a === "rmnine") { readClubInputs(); addForm.nines.splice(+b.dataset.i, 1); render(); }
  else if (a === "saveclub") {
    readClubInputs(); const f = addForm;
    const nines = f.nines.map(n => ({ name: n.name.trim(), par: n.par.slice(), checked: !f.fromLookup }));
    if (!f.name.trim()) { f.err = "골프장 이름을 입력하세요."; render(); return; }
    if (nines.some(n => !n.name)) { f.err = "9홀 코스마다 이름을 입력하세요. (예: Stella, OUT)"; render(); return; }
    let id = f.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
    if (!id || courses[id]) id = (id || "club") + "-" + Math.random().toString(36).slice(2,6);
    const body = { name: f.name.trim(), nameKo: f.nameKo.trim(), region: f.region.trim(), nines, updatedAt: Date.now() };
    try { await cstore.save(id, body); } catch(e) { f.err = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."; render(); return; }
    courses[id] = body; pickClub(setup, id); addForm = null; view = "setup"; render(); toast("골프장을 등록했어요");
  }
  else if (a === "start") {
    readSetupInputs();
    const hcpAll = setup.players.map((n,i) => [n.trim(), setup.hcp[i]]).filter(x => x[0]).map(x => x[1] === "" || x[1] == null || isNaN(+x[1]) ? null : +x[1]);
    const players = setup.players.map(n => n.trim()).filter(Boolean);
    if (!players.length) { setup.err = "동반자 이름을 한 명 이상 입력하세요."; render(); return; }
    if (!setup.date) { setup.err = "날짜를 선택하세요."; render(); return; }
    if (!setup.front) { setup.err = "골프장을 고르거나 직접 입력을 선택하세요."; render(); return; }
    const id = "r" + setup.date.replace(/-/g,"") + "-" + Math.random().toString(36).slice(2,6);
    const scores = {}; players.forEach((_,i) => scores["p"+i] = Array(18).fill(null));
    const clubName = setup.clubId && courses[setup.clubId] ? courses[setup.clubId].name : "";
    cur = { id, date: setup.date, club: clubName, clubId: setup.clubId || null, event: setup.event || "", teeOff: setup.teeOff || "", group: setup.group || "", front: clone(setup.front), back: clone(setup.back), players, hcp: hcpAll, scores, updatedAt: Date.now() };
    const ol = readOly("f"); if (ol && !ol.off) { delete ol.off; cur.oly = Object.assign(ol, { m: {}, carry: [] }); players.forEach((_,i) => cur.oly.m["p"+i] = Array(18).fill(null)); }
    const pend = [setup.noticeFile && setup.notice ? [setup.noticeFile, "notice"] : null, setup.cardFile ? [setup.cardFile, "card"] : null].filter(Boolean);
    rounds[id] = clone(cur); setup = null; view = "play"; tab = "play"; hole = 0; scheduleSave(); render(); window.scrollTo(0,0);
    if (pend.length) (async () => { for (const [f,k] of pend) { try { await addPhoto(f, k); } catch(e) {} } toast("공지·스코어카드 사진을 라운드에 저장했어요"); })();
  }
  else if (a === "tab") { tab = b.dataset.t; confirmDel = false; render(); }
  else if (a === "hole") { hole = +b.dataset.h; render(); }
  else if (a === "prev") { if (hole > 0) { hole--; render(); } }
  else if (a === "next") { if (hole < 17) { hole++; render(); } else { tab = "card"; render(); window.scrollTo(0,0); } }
  else if (a === "oly") { const i = +b.dataset.p, k = b.dataset.k; const arr = cur.oly.m["p"+i] || (cur.oly.m["p"+i] = Array(18).fill(null)); arr[hole] = arr[hole] === k ? null : k; scheduleSave(); render(); }
  else if (a === "carry") { const c = cur.oly.carry || (cur.oly.carry = []); c[hole] = (c[hole]||0) + 1; scheduleSave(); render(); toast("다음 홀 올림픽 ×"+olyMult(hole+1)); }
  else if (a === "uncarry") { const c = cur.oly.carry || (cur.oly.carry = []); c[hole] = 0; scheduleSave(); render(); }
  else if (a === "setpar") setScore(+b.dataset.p, () => 0);
  else if (a === "inc") setScore(+b.dataset.p, v => (v == null ? 0 : v) + 1);
  else if (a === "dec") setScore(+b.dataset.p, v => (v == null ? 0 : v) - 1);
  else if (a === "img") { b.disabled = true; try { await shareImage(b.dataset.k); } catch(err) { toast("이미지를 만들지 못했어요"); } b.disabled = false; }
  else if (a === "copy") {
    const txt = resultText(); const box = document.getElementById("copybox");
    try { await navigator.clipboard.writeText(txt); toast("복사했어요. 단톡방에 붙여 넣으세요."); }
    catch(err) { box.value = txt; box.hidden = false; box.focus(); box.select(); toast("텍스트를 길게 눌러 복사하세요."); }
  }
  else if (a === "askdel") { confirmDel = true; render(); }
  else if (a === "mode") { relMode = b.dataset.m === "1"; try { localStorage.setItem("golf-relmode", relMode ? "1" : "0"); } catch(e){} render(); }
  else if (a === "home") { home = b.dataset.t; memEdit = null; hcpBig = null; hcpDel = null; clearAsk = false; render(); window.scrollTo(0,0); }
  else if (a === "hopen") { hcpBig = +b.dataset.i; render(); }
  else if (a === "hclose") { hcpBig = null; hcpDel = null; render(); }
  else if (a === "ounit") { const i = UNITS.indexOf(+b.dataset.v); const v = UNITS[(i+1) % UNITS.length]; b.dataset.v = v; b.textContent = unitLabel(v); b.classList.toggle("on", v > 0); }
  else if (a === "openalty") { const v = ((+b.dataset.v || 0) + 1) % 6; b.dataset.v = v; b.textContent = v ? "−"+v+"점" : "없음"; }
  else if (a === "omethod") { const box = document.getElementById(b.dataset.pre+"-omethod"); box.dataset.v = b.dataset.m; box.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.m === b.dataset.m)); }
  else if (a === "sgroup") { readSetupInputs(); setup.group = b.dataset.g; setup.hcp = setup.players.map(n => lastHcp(n.trim())); render(); }
  else if (a === "mgroup") { memGroup = b.dataset.g; memQ = ""; memEdit = null; hcpBig = null; memMsg = ""; render(); }
  else if (a === "gadd") { grpEdit = true; render(); setTimeout(() => { const i = document.getElementById("g-name"); if (i) i.focus(); }, 0); }
  else if (a === "gcancel") { grpEdit = false; render(); }
  else if (a === "gsave") { const v = (document.getElementById("g-name").value || "").trim(); if (!v) { toast("모임 이름을 입력하세요"); return; }
    const st = clone(settings.hcp || {}); delete st.id; st.groups = groupList().slice(); if (!st.groups.includes(v)) st.groups.push(v);
    try { await sstore.save("hcp", st); settings.hcp = Object.assign(st, { id: "hcp" }); memGroup = v; grpEdit = false; toast("모임을 추가했어요"); } catch(e) { toast("저장하지 못했어요"); } render(); }
  else if (a === "gdel") { const v = b.dataset.g; const st = clone(settings.hcp || {}); delete st.id; st.groups = groupList().filter(x => x !== v);
    try { await sstore.save("hcp", st); settings.hcp = Object.assign(st, { id: "hcp" }); memGroup = ""; toast("모임을 삭제했어요"); } catch(e) { toast("삭제하지 못했어요"); } render(); }
  else if (a === "madd") { memEdit = "new"; render(); setTimeout(() => { const i = document.getElementById("m-name"); if (i) i.focus(); }, 0); }
  else if (a === "medit") { memEdit = b.dataset.id; render(); }
  else if (a === "mcancel") { memEdit = null; render(); }
  else if (a === "msave") {
    const name = document.getElementById("m-name").value.trim(), hv = document.getElementById("m-hcp").value, al = document.getElementById("m-alias").value.split(/[,，]/).map(x => x.trim()).filter(Boolean);
    if (!name) { toast("이름을 입력하세요"); return; }
    const grp = (document.getElementById("m-group") || {}).value || curGroup();
    const hcp = hv === "" || isNaN(+hv) ? null : +hv; const id = b.dataset.id === "new" ? "m-" + Math.random().toString(36).slice(2,8) : b.dataset.id;
    const old = members[id]; const body = { name, group: grp, hcp, aliases: al, history: (old && old.history) ? clone(old.history) : [] };
    if (!old || old.hcp !== hcp) body.history.push({ date: todayStr(), hcp, note: "직접 수정" });
    try { await saveMember(id, body); memEdit = null; toast("저장했어요"); } catch(e) { toast("저장하지 못했어요"); } render();
  }
  else if (a === "mdel") { const id = b.dataset.id; try { await mstore.remove(id); delete members[id]; memEdit = null; toast("삭제했어요"); } catch(e) { toast("삭제하지 못했어요"); } render(); }
  else if (a === "fclub") { filterClub = b.dataset.c; render(); }
  else if (a === "statp") { statP = b.dataset.n; render(); }
  else if (a === "editinfo") { editInfo = true; render(); }
  else if (a === "nettab") { netTab = b.dataset.t; render(); }
  else if (a === "tie") { tieHigh = b.dataset.t === "high"; try { localStorage.setItem("golf-tie", tieHigh ? "high" : "low"); } catch(e){} render(); }
  else if (a === "popen") { bigPhoto = +b.dataset.i; delPhoto = null; render(); }
  else if (a === "pclose") { bigPhoto = null; delPhoto = null; render(); }
  else if (a === "paskdel") { delPhoto = +b.dataset.i; render(); }
  else if (a === "pnodel") { delPhoto = null; render(); }
  else if (a === "pdel") { const i = +b.dataset.i; const ph = (cur.photos||[])[i]; if (!ph) return;
    cur.photos.splice(i, 1); bigPhoto = null; delPhoto = null; scheduleSave(); render();
    if (ph.id && assetsFn) { try { await assetsFn.delete(ph.id); } catch(e) {} } toast("사진을 삭제했어요"); }
  else if (a === "cancelinfo") { editInfo = false; render(); }
  else if (a === "saveinfo") {
    const d = document.getElementById("e-date").value; if (!d) { toast("날짜를 선택하세요"); return; }
    cur.date = d; cur.players = cur.players.map((n,i) => (document.getElementById("e-p"+i).value.trim() || n));
    cur.hcp = cur.players.map((_,i) => { const v = document.getElementById("e-h"+i).value; return v === "" || isNaN(+v) ? null : +v; });
    const ol = readOly("e"); if (ol && ol.off) { delete ol.off; ol.unit = 0; }
    if (ol && ol.unit > 0) { if (cur.oly) Object.assign(cur.oly, ol); else { cur.oly = Object.assign(ol, { m: {}, carry: [] }); cur.players.forEach((_,i) => cur.oly.m["p"+i] = Array(18).fill(null)); } if (!cur.oly.m) cur.oly.m = {}; cur.players.forEach((_,i) => { if (!cur.oly.m["p"+i]) cur.oly.m["p"+i] = Array(18).fill(null); }); }
    else if (cur.oly) { cur.oly.unit = 0; }
    editInfo = false; scheduleSave(); render(); toast("저장했어요");
  }
  else if (a === "csv") {
    const txt = csvText(); const box = document.getElementById("copybox");
    try { await navigator.clipboard.writeText(txt); toast("복사했어요. 엑셀에 붙여 넣으세요."); }
    catch(err) { box.value = txt; box.hidden = false; box.focus(); box.select(); toast("텍스트를 길게 눌러 복사하세요."); }
  }
  else if (a === "saveme2") { const v = (document.getElementById("s-me").value || "").trim(); if (!v) { toast("이름을 입력하세요"); return; } myName = v; try { localStorage.setItem("golf-myname", v); } catch(e){} toast("저장했어요"); }
  else if (a === "export") { b.disabled = true; await exportData(); }
  else if (a === "impmerge") { await importData("merge"); }
  else if (a === "impreplace") { await importData("replace"); }
  else if (a === "impcancel") { impPending = null; impMsg = ""; render(); }
  else if (a === "install") { if (installEvt) { const ev = installEvt; installEvt = null; ev.prompt(); try { await ev.userChoice; } catch(e){} render(); } }
  else if (a === "loadpack") { if (!packBusy) loadPack(); }
  else if (a === "clearask") { clearAsk = true; render(); }
  else if (a === "clearno") { clearAsk = false; render(); }
  else if (a === "clearall") { try { await AppStorage.clearAll(); clearAsk = false; cur = null; await reloadAll(); toast("모두 지웠어요"); } catch(e) { toast("지우지 못했어요"); render(); } }
  else if (a === "haskdel") { hcpDel = +b.dataset.i; render(); }
  else if (a === "hnodel") { hcpDel = null; render(); }
  else if (a === "hdel") { const i = +b.dataset.i; const st = clone(settings.hcp || {}); delete st.id; if (!(st.photos||[])[i]) return; st.photos.splice(i,1);
    try { await sstore.save("hcp", st); settings.hcp = Object.assign(st, { id: "hcp" }); hcpBig = null; hcpDel = null; toast("사진을 삭제했어요"); } catch(e) { toast("삭제하지 못했어요"); } render(); }
  else if (a === "nodel") { confirmDel = false; render(); }
  else if (a === "del") {
    const id = cur.id; clearTimeout(saveTimer); dirty = false;
    if (assetsFn) for (const ph of (cur.photos||[])) { if (ph.id) { try { await assetsFn.delete(ph.id); } catch(e) {} } }
    try { await store.remove(id); } catch(err) {}
    delete rounds[id]; cur = null; view = "list"; confirmDel = false; render(); toast("라운드를 삭제했어요.");
  }
});
app.addEventListener("input", e => {
  if (e.target.id === "m-q") { memQ = e.target.value; const t = document.getElementById("mtable"); if (t) t.innerHTML = memberTable(); }
  if (e.target.id === "f-q" && setup) { setup.q = e.target.value; const r = document.getElementById("results"); if (r) r.innerHTML = resultsHtml(); }
});
app.addEventListener("compositionend", e => {
  if (e.target.id === "m-q") { memQ = e.target.value; const t = document.getElementById("mtable"); if (t) t.innerHTML = memberTable(); }
  if (e.target.id === "f-q" && setup) { setup.q = e.target.value; const r = document.getElementById("results"); if (r) r.innerHTML = resultsHtml(); }
});
app.addEventListener("keydown", e => {
  if (e.target.id === "c-look" && e.key === "Enter") { e.preventDefault(); if (addForm && !addForm.busy) lookupClub(); }
  if (e.target.id === "c-api" && e.key === "Enter") { e.preventDefault(); if (addForm && !addForm.apiBusy) apiSearch(); }
  if (e.target.id === "f-q" && e.key === "Enter") { e.preventDefault(); const first = app.querySelector("[data-a=club]"); if (first) first.click(); }
});
app.addEventListener("change", e => {
  if (/^f-p\d$/.test(e.target.id) && setup) { const i = +e.target.id.slice(3); const hv = lastHcp(e.target.value.trim()); const hf = document.getElementById("f-h"+i); if (hf && hv !== "") { hf.value = hv; setup.hcp[i] = hv; toast(e.target.value.trim()+" 핸디 "+hv+" 적용"); } }
  if (e.target.id === "h-photo" && e.target.files && e.target.files[0] && !memBusy) { (photoOK ? hcpPhoto : hcpPhotoStore)(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "i-file" && e.target.files && e.target.files[0]) { importPick(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "n-photo" && e.target.files && e.target.files[0] && sampleFn && setup && !setup.nbusy) { setup.noticeFile = e.target.files[0]; noticePhoto(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "v-photo" && e.target.files && e.target.files[0] && sampleFn && setup && !setup.vbusy) { setup.cardFile = e.target.files[0]; verifyPhoto(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "r-photo" && e.target.files && e.target.files.length && cur) { const files = [...e.target.files]; e.target.value = ""; (async () => { let ok = 0; for (const f of files) { try { await addPhoto(f, "photo"); ok++; } catch(err) {} } render(); toast(ok ? ok+"장 저장했어요" : "사진을 저장하지 못했어요"); })(); }
  if (e.target.id === "c-photo" && e.target.files && e.target.files[0] && sampleFn && addForm && !addForm.busy) readPhoto(e.target.files[0]);
});
let pressT = null;
app.addEventListener("pointerdown", e => {
  const v = e.target.closest(".val.set"); if (!v) return;
  const row = v.closest(".prow"); const p = [...app.querySelectorAll(".prow")].indexOf(row);
  pressT = setTimeout(() => { setScore(p, () => null); toast("지웠어요"); }, 600);
});
["pointerup","pointerleave","pointercancel"].forEach(t => app.addEventListener(t, () => clearTimeout(pressT)));
function firstOpenHole(){
  for (let h = 0; h < 18; h++) if (!cur.players.every((_,i) => (cur.scores["p"+i]||[])[h] != null)) return h;
  return 0;
}

/* ---------- boot ---------- */
(async () => {
  store = AppStorage.makeStore("rounds");
  cstore = AppStorage.makeStore("courses");
  mstore = AppStorage.makeStore("members");
  sstore = AppStorage.makeStore("settings");
  dlFn = makeDownloader();
  /* AI 사진 읽기(핸디표·공지·스코어카드)는 2단계에서 중간 서버를 통해 연결한다.
     window.AI_PROVIDER 가 { json(prompt, {images}), limits() } 모양으로 주어지면 원본 기능이 그대로 살아난다. */
  sampleFn = window.AI_PROVIDER || null; assetsFn = null;
  if (sampleFn) { try { const l = await sampleFn.limits(); photoOK = !!(l && l.images); } catch(e){ photoOK = false; } }
  AppStorage.persist();
  mstore.watch(o => { members = o; if (view === "list" || view === "setup") render(); });
  sstore.watch(o => { settings = o; if (view === "list" && home === "hcp") render(); });
  cstore.watch(o => { courses = o; if (view === "setup" || view === "list") render(); });
  store.watch(onData);
})();
