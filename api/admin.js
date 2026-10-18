const C = require('../lib/core');
module.exports = async (req, res) => {
  const key = new URL(req.url, 'http://x').searchParams.get('key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return C.json(res, 401, { error: 'unauthorized' });
  const { ranked, rows } = await C.board();
  const att = {}; for (const b of await C.listAll('a/')) { const h = b.pathname.split('/')[1]; att[h] = (att[h] || 0) + 1; }
  C.json(res, 200, { closeAt: C.CLOSE_AT, closed: Date.now() >= C.CLOSE_AT, now: Date.now(), ranked: ranked.map(r => ({ ...r, started: att[r.handle] || 0 })), started: att, submissions: rows.length });
};
