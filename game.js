// SLASADO · Choripán Stack. Canvas game + entry/leaderboard glue. No deps.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const CLOSE_AT = Date.parse('2026-10-18T04:30:00Z');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- audio ----------
let ac = null, master = null;
function audio() { if (ac) { ac.state === 'suspended' && ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .6; master.connect(ac.destination); } catch (_) {} }
function tone(f, d, type = 'sine', v = .3, f2) { if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .02); }
function sizzle(d = .25, v = .18) { if (!ac) return; const n = ac.sampleRate * d, b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'highpass'; f.frequency.value = 2500; g.gain.value = v; s.buffer = b; s.connect(f).connect(g).connect(master); s.start(); }
const sfx = {
  drop: () => { tone(180, .12, 'sine', .45, 70); tone(90, .18, 'triangle', .25, 50); },
  cut: () => { sfx.drop(); sizzle(.28, .16); },
  perfect: c => { const base = 523 * Math.pow(1.06, Math.min(c, 12)); tone(base, .18, 'triangle', .22); setTimeout(() => tone(base * 1.5, .25, 'sine', .2), 70); },
  fail: () => { tone(300, .5, 'sawtooth', .15, 60); sizzle(.4, .12); },
};
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

// ---------- game ----------
const cv = $('cv'), cx = cv.getContext('2d'), stage = $('stage');
let W = 0, H = 0, DPR = 1, S = 1;
function resize() { const r = stage.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(2, devicePixelRatio || 1); S = Math.min(1.3, W / 380);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cx.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener('resize', resize); resize();

const G = { state: 'idle', stack: [], cur: null, falling: [], parts: [], score: 0, combo: 0, cam: 0, lock: 0, t: 0, onOver: null, shake: 0, flash: 0 };
const LH = () => 30 * S, BASEY = () => 70 * S;
function reset() { const bw = Math.min(W * .62, 250 * S);
  G.stack = [{ x: W / 2, w: bw, seed: 0 }]; G.falling = []; G.parts = []; G.score = 0; G.combo = 0; G.cam = 0; G.lock = 0; G.flash = 0; spawn(); $('score').textContent = '0'; }
function spawn() { const top = G.stack[G.stack.length - 1], lvl = G.stack.length, dir = lvl % 2 ? 1 : -1;
  G.cur = { x: dir > 0 ? -top.w * .2 : W + top.w * .2, w: top.w, dir, v: Math.min(430, 150 + lvl * 9) * S, seed: lvl }; }
function start(onOver) { reset(); G.onOver = onOver; G.state = 'play'; G.lock = performance.now() + 250; }
function drop() {
  if (G.state !== 'play' || performance.now() < G.lock) return; audio();
  G.lock = performance.now() + 420;
  const top = G.stack[G.stack.length - 1], c = G.cur, dx = c.x - top.x, ad = Math.abs(dx), y = G.stack.length * LH();
  if (ad <= 4 * S) { // perfect
    G.combo++; const w = G.combo >= 3 ? Math.min(G.stack[0].w, c.w + 6 * S) : c.w;
    G.stack.push({ x: top.x, w, seed: c.seed, perfect: 1 }); sfx.perfect(G.combo); buzz([12, 30, 12]); burst(top.x, y, w, '#39f688', 22); G.flash = 1;
  } else if (ad >= c.w) { // miss
    G.falling.push({ x: c.x, y, w: c.w, vy: 0, vx: c.dir * 60, r: 0, vr: c.dir * 2.5, seed: c.seed }); G.cur = null; over(); return;
  } else {
    G.combo = 0; const ow = c.w - ad, nx = top.x + dx / 2, cutX = dx > 0 ? nx + ow / 2 + ad / 2 : nx - ow / 2 - ad / 2;
    G.stack.push({ x: nx, w: ow, seed: c.seed }); G.falling.push({ x: cutX, y, w: ad, vy: 0, vx: Math.sign(dx) * 90, r: 0, vr: Math.sign(dx) * 3, seed: c.seed });
    sfx.cut(); buzz(18); burst(dx > 0 ? nx + ow / 2 : nx - ow / 2, y, 10, '#ff9a3c', 12); G.shake = 4;
  }
  G.score++; $('score').textContent = G.score; spawn();
}
function over() { G.state = 'over'; sfx.fail(); buzz([60, 40, 160]); G.shake = 10; setTimeout(() => G.onOver && G.onOver(G.score), 1000); }
function burst(x, y, w, col, n) { for (let i = 0; i < n; i++) G.parts.push({ x: x + (Math.random() - .5) * w, y: y + LH() * .6, vx: (Math.random() - .5) * 260 * S, vy: (Math.random() * 260 + 80) * S, l: 1, col, s: (2 + Math.random() * 3) * S }); }

stage.addEventListener('pointerdown', e => { if (!$('ov').hidden) return; e.preventDefault(); drop(); });
addEventListener('keydown', e => { if ((e.code === 'Space' || e.key === 'Enter') && $('ov').hidden && G.state === 'play') { e.preventDefault(); drop(); } });

// drawing
const rr = (x, y, w, h, r) => { r = Math.min(r, h / 2, w / 2); cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); };
function chori(x, yb, w, seed, glow) { // x center, yb = screen y of bottom
  const h = LH(), l = x - w / 2;
  // bread
  const bh = h * .58, by = yb - bh; let g = cx.createLinearGradient(0, by, 0, yb); g.addColorStop(0, '#f6c27a'); g.addColorStop(.5, '#d99347'); g.addColorStop(1, '#9c5a22');
  cx.fillStyle = g; rr(l, by, w, bh, bh * .45); cx.fill();
  cx.fillStyle = 'rgba(255,240,200,.35)'; rr(l + 3 * S, by + 2 * S, Math.max(0, w - 6 * S), 2.5 * S, 2 * S); cx.fill();
  // chorizo
  const ch = h * .5, cy = yb - bh - ch * .55, cw = Math.max(2, w - 4 * S); g = cx.createLinearGradient(0, cy, 0, cy + ch);
  g.addColorStop(0, '#d2563a'); g.addColorStop(.45, '#9b2c1c'); g.addColorStop(1, '#5d160d'); cx.fillStyle = g; rr(x - cw / 2, cy, cw, ch, ch / 2); cx.fill();
  cx.fillStyle = 'rgba(255,200,170,.35)'; rr(x - cw / 2 + 5 * S, cy + 2.5 * S, Math.max(0, cw - 10 * S), 2 * S, 1 * S); cx.fill();
  cx.strokeStyle = 'rgba(40,8,4,.55)'; cx.lineWidth = 2 * S; cx.beginPath();
  for (let i = l + 10 * S; i < l + w - 8 * S; i += 16 * S) { cx.moveTo(i, cy + ch * .25); cx.lineTo(i + 6 * S, cy + ch * .8); } cx.stroke();
  // chimi
  let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  cx.fillStyle = '#5fbf3a'; for (let i = 0; i < Math.max(1, w / (14 * S)); i++) { cx.fillRect(l + rnd() * w, cy + rnd() * ch * .5, 2.2 * S, 2.2 * S); }
  if (glow) { cx.shadowColor = '#39f688'; cx.shadowBlur = 18 * glow; cx.strokeStyle = `rgba(57,246,136,${.8 * glow})`; cx.lineWidth = 1.5; rr(l - 2, cy - 2, w + 4, yb - cy + 4, 10 * S); cx.stroke(); cx.shadowBlur = 0; }
}
function frame(now) {
  const dt = Math.min(.033, (now - (G.t || now)) / 1000); G.t = now;
  if (G.state === 'play' && G.cur) { const c = G.cur, lo = -c.w * .25, hi = W + c.w * .25; c.x += c.dir * c.v * dt; if (c.x > hi) { c.x = hi; c.dir = -1; } if (c.x < lo) { c.x = lo; c.dir = 1; } }
  const target = Math.max(0, G.stack.length * LH() - H * .42); G.cam += (target - G.cam) * Math.min(1, dt * 6);
  for (const f of G.falling) { f.vy -= 1500 * S * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.r += f.vr * dt; }
  G.falling = G.falling.filter(f => f.y - G.cam > -200);
  for (const p of G.parts) { p.vy -= 700 * S * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 1.4; } G.parts = G.parts.filter(p => p.l > 0);
  G.shake *= .85; G.flash *= .92;
  draw(now / 1000); requestAnimationFrame(frame);
}
function draw(t) {
  const ground = H - BASEY(), sy = y => ground - (y - G.cam), lvl = G.stack.length;
  // sky: night -> deeper with height, ember glow at grill
  const k = Math.min(1, lvl / 40); let g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${2 + k * 6},${12 + k * 4},${8 + k * 26})`); g.addColorStop(.7, '#05150d'); g.addColorStop(1, '#0a0603'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = ((i * 57.1 + G.cam * .3) % (H * 1.2)) - H * .1, a = (.3 + .3 * Math.sin(t * 2 + i)) * (0.4 + k);
    cx.fillStyle = `rgba(234,255,243,${a})`; cx.fillRect(x, H - y, 1.4, 1.4); }
  cx.save(); if (G.shake > .3 && !reduce) cx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
  // grill
  const gy = sy(0); g = cx.createRadialGradient(W / 2, gy + 30 * S, 0, W / 2, gy + 30 * S, W * .7); g.addColorStop(0, 'rgba(255,110,20,.45)'); g.addColorStop(1, 'rgba(255,110,20,0)');
  cx.fillStyle = g; cx.fillRect(0, gy - W * .4, W, W);
  cx.fillStyle = '#1b1f1d'; rr(W / 2 - W * .42, gy, W * .84, 12 * S, 4 * S); cx.fill();
  cx.strokeStyle = '#3a403c'; cx.lineWidth = 2 * S; cx.beginPath(); for (let i = -6; i <= 6; i++) { const x = W / 2 + i * W * .065; cx.moveTo(x, gy + 2 * S); cx.lineTo(x, gy + 10 * S); } cx.stroke();
  for (let i = 0; i < 18; i++) { const x = W / 2 + (((i * 73) % 100) / 100 - .5) * W * .8, fl = .5 + .5 * Math.sin(t * 6 + i * 1.7);
    cx.fillStyle = `rgba(255,${110 + fl * 80},30,${.5 + fl * .5})`; cx.beginPath(); cx.arc(x, gy + 20 * S + (i % 3) * 5 * S, (3 + fl * 2) * S, 0, 7); cx.fill(); }
  // stack
  G.stack.forEach((s, i) => { if (i === 0) { chori(s.x, gy, s.w, 0); return; } const yb = sy(i * LH()); if (yb < -LH() || yb > H + LH()) return;
    chori(s.x, yb, s.w, s.seed, i === lvl - 1 ? G.flash : 0); });
  if (G.state === 'play' && G.cur) chori(G.cur.x, sy(lvl * LH()), G.cur.w, G.cur.seed);
  for (const f of G.falling) { cx.save(); const yb = sy(f.y); cx.translate(f.x, yb - LH() / 2); cx.rotate(f.r); chori(0, LH() / 2, f.w, f.seed); cx.restore(); }
  for (const p of G.parts) { cx.globalAlpha = Math.max(0, p.l); cx.fillStyle = p.col; cx.fillRect(p.x, sy(p.y), p.s, p.s); } cx.globalAlpha = 1;
  cx.restore();
  if (G.combo >= 2 && G.state === 'play') { cx.font = `600 ${14 * S}px "Geist Mono",monospace`; cx.textAlign = 'center'; cx.fillStyle = '#39f688'; cx.fillText(`COMBO x${G.combo} 🔥`, W / 2, 96 * S); }
}
reset(); requestAnimationFrame(frame);

// ---------- entry / API ----------
const me = JSON.parse(localStorage.getItem('slasado.me') || '{}');
if (me.name) $('name').value = me.name; if (me.handle) $('handle').value = me.handle;
const norm = h => String(h || '').trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').toLowerCase();
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }));
let token = null, practice = false;
const regHTML = $('reg').outerHTML;

function showPanel(html) { const ov = $('ov'); ov.hidden = false; ov.innerHTML = html; }
function play(tok, prac, info) { token = tok; practice = prac; $('ov').hidden = true; $('hud').textContent = prac ? 'PRÁCTICA · NO SUMA' : `INTENTO ${info.attempt}/3`;
  start(score => finish(score)); }
async function finish(score) {
  $('hud').textContent = 'TOCÁ PARA SOLTAR';
  if (practice || !token) return result({ score, practice: true });
  showPanel(`<div class="panel res"><p class="mono eyebrow">GUARDANDO…</p><div class="big">${score}</div></div>`);
  const r = await post('/api/submit', { token, score }).catch(() => ({ ok: false, error: 'Sin conexión, probá de nuevo' })); token = null;
  result({ score, ...r }); loadBoard();
}
function result(r) {
  const left = r.left ?? me.left ?? 0; if (r.left != null) { me.left = r.left; save(); }
  const closed = Date.now() >= CLOSE_AT;
  showPanel(`<div class="panel res">
    <p class="mono eyebrow">${r.practice ? 'PRÁCTICA' : r.ok ? '¡PUNTAJE GUARDADO!' : 'UPS'}</p>
    <div class="big">${r.score}</div>
    <p>${r.score === 1 ? 'chori apilado' : 'choris apilados'}</p>
    ${r.ok && r.rank ? `<p>Vas <b>#${r.rank}</b> en el ranking · tu mejor: <b>${r.best}</b></p>` : ''}
    ${!r.ok && !r.practice ? `<p class="err">${esc(r.error || 'No se pudo guardar')}</p>` : ''}
    ${!closed && left > 0 ? `<button class="btn primary big" id="again">Jugar de nuevo · quedan ${left}</button>` : ''}
    ${!closed && left <= 0 && !r.practice ? `<p class="small">Usaste tus 3 intentos. ¡Suerte en el ranking!</p>` : ''}
    <button class="link" id="prac">Practicar sin sumar</button>
    <button class="link" id="other">Jugar con otro usuario</button></div>`);
  $('again') && ($('again').onclick = begin); $('prac').onclick = () => { audio(); play(null, true, {}); }; $('other').onclick = () => { showPanel(regHTML); bindReg(); };
}
function save() { localStorage.setItem('slasado.me', JSON.stringify(me)); }
async function begin() { audio();
  const name = (($('name') || {}).value || me.name || '').trim(), handle = norm(($('handle') || {}).value || me.handle);
  if (!name || !handle) { showPanel(regHTML); bindReg(); return; }
  if (me.handle !== handle) me.left = undefined; me.name = name; me.handle = handle; save();
  const btn = $('play') || $('again'); if (btn) { btn.disabled = true; btn.textContent = 'Prendiendo el fuego…'; }
  const r = await post('/api/start', { name, handle }).catch(() => ({ ok: false, error: 'Sin conexión, probá de nuevo' }));
  if (!r.ok) { me.left = r.left ?? me.left; save(); showPanel(regHTML); bindReg(); $('err').textContent = r.error || 'Error'; if (r.left === 0) $('left').textContent = 'Podés seguir practicando, pero no suma.'; return; }
  if (r.practice) { $('banner').hidden = false; return play(null, true, {}); }
  me.left = r.left; save(); play(r.token, false, r);
}
function bindReg() { const f = $('reg'); if (!f) return; if (me.name) $('name').value = me.name; if (me.handle) $('handle').value = me.handle;
  if (me.left != null && me.handle) $('left').textContent = me.left > 0 ? `@${me.handle}: te quedan ${me.left} intento${me.left > 1 ? 's' : ''}` : `@${me.handle} ya usó sus 3 intentos`;
  f.onsubmit = e => { e.preventDefault(); begin(); }; $('practice').onclick = () => { audio(); play(null, true, {}); }; }
bindReg();

// ---------- leaderboard + countdown ----------
let lastBoard = null;
async function loadBoard() { try { const d = await fetch('/api/leaderboard', { cache: 'no-store' }).then(r => r.json()); lastBoard = d; renderBoard(d); } catch (_) {} }
function renderBoard(d) {
  $('players').textContent = d.players ? `${d.players} JUGADOR${d.players > 1 ? 'ES' : ''}` : '';
  $('lb').innerHTML = d.top.length ? d.top.map((r, i) => `<li class="${r.handle === me.handle ? 'me' : ''}"><span class="pos">${i + 1}</span>
    <img src="https://unavatar.io/x/${encodeURIComponent(r.handle)}" alt="" loading="lazy" width="36" height="36" onerror="this.outerHTML='<span class=ph>${esc(r.name[0] || '?').toUpperCase()}</span>'">
    <span class="who"><b>${esc(r.name)}</b><small>@${esc(r.handle)}</small></span><span class="pts">${r.score}</span></li>`).join('')
    : '<li class="empty">Todavía nadie apiló un chori. ¡Estrenalo!</li>';
  banner(d);
}
function banner(d) { const b = $('banner'); if (Date.now() < CLOSE_AT) { b.hidden = true; return; } b.hidden = false;
  b.innerHTML = d && d.winner ? `🏆 <b>¡Cerró el concurso!</b> La remera de SLA es para <b>${esc(d.winner.name)}</b> (@${esc(d.winner.handle)}) con <b>${d.winner.score}</b> choris. Podés seguir jugando por diversión.`
    : '🏆 <b>¡Cerró el concurso!</b> Podés seguir jugando por diversión, pero ya no suma.'; }
function tick() { const ms = CLOSE_AT - Date.now(), c = $('count');
  if (ms <= 0) { if (c) c.innerHTML = 'CERRADO<small>GANADOR EN EL RANKING</small>'; banner(lastBoard); return; }
  const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60, p = n => String(n).padStart(2, '0');
  if (c) c.innerHTML = `${h ? p(h) + ':' : ''}${p(m)}:${p(s)}<small>PARA QUE CIERRE EL CONCURSO</small>`; }
tick(); setInterval(tick, 1000); loadBoard(); setInterval(() => document.hidden || loadBoard(), 8000);
})();
