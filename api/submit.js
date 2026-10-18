const C = require('../lib/core');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return C.json(res, 405, { error: 'POST' });
  const b = await C.body(req), t = C.verify(b.token), score = Math.floor(Number(b.score));
  if (!t) return C.json(res, 400, { error: 'Sesión inválida' });
  const now = Date.now();
  if (now >= C.CLOSE_AT) return C.json(res, 403, { error: 'El concurso ya cerró', closed: true });
  if (!Number.isFinite(score) || score < 0 || score > C.MAX_SCORE) return C.json(res, 400, { error: 'Puntaje inválido' });
  const secs = (now - t.t0) / 1000;
  if (secs > 30 * 60) return C.json(res, 400, { error: 'Sesión vencida' });
  if (score > Math.floor(secs / C.MIN_DROP_S) + 1) return C.json(res, 400, { error: 'Ese puntaje es demasiado rápido 🤨' });
  try { await C.put(`s/${t.h}/${t.n}-${score}-${now}-${C.b64(t.name)}.json`, JSON.stringify({ score, secs, ua: String(req.headers['user-agent'] || '').slice(0, 120) }), C.opts); }
  catch (e) { if (/exist/i.test(e.message)) return C.json(res, 409, { error: 'Ese intento ya se registró' }); throw e; }
  const { ranked } = await C.board(); const rank = ranked.findIndex(r => r.handle === t.h) + 1;
  C.json(res, 200, { ok: true, score, rank, best: ranked[rank - 1]?.score, left: C.MAX_ATTEMPTS - t.n });
};
