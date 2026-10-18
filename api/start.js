const C = require('../lib/core');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return C.json(res, 405, { error: 'POST' });
  const b = await C.body(req), h = C.normHandle(b.handle), name = C.cleanName(b.name);
  if (!name) return C.json(res, 400, { error: 'Poné tu nombre' });
  if (!C.validHandle(h)) return C.json(res, 400, { error: 'Ese usuario de X no parece válido' });
  const now = Date.now();
  if (now >= C.CLOSE_AT) return C.json(res, 200, { ok: true, practice: true, closed: true, left: 0 });
  const n = await C.startAttempt(h, name);
  if (!n) return C.json(res, 403, { error: 'Ya usaste tus 3 intentos con @' + h, left: 0 });
  C.json(res, 200, { ok: true, token: C.sign({ h, n, name, t0: now }), attempt: n, left: C.MAX_ATTEMPTS - n, handle: h });
};
