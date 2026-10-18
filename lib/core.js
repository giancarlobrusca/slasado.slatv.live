// Shared logic: Vercel Blob as a tiny append-only store.
// Each attempt and each score is its own blob, so concurrent writes never clobber each other.
//   a/<handle>/<n>.json                      -> attempt n started (n = 1..3), created with allowOverwrite:false
//   s/<handle>/<n>-<score>-<ts>-<name64>.json -> score for attempt n (one per attempt)
const crypto = require('crypto');
const { put, list, del } = require('@vercel/blob');

const CLOSE_AT = Date.parse('2026-10-18T04:30:00Z'); // Sat Oct 17 2026, 9:30 PM PT
const MAX_ATTEMPTS = 3;
const MIN_DROP_S = 0.38;      // game enforces >= ~0.45s between drops; leave margin
const MAX_SCORE = 400;
const SECRET = process.env.TOKEN_SECRET || 'dev-secret';

const normHandle = h => String(h || '').trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').toLowerCase();
const validHandle = h => /^[a-z0-9_]{1,15}$/.test(h);
const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
const b64 = s => Buffer.from(s).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url').toString();
const sign = obj => { const p = b64(JSON.stringify(obj)); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
function verify(tok) {
  const [p, s] = String(tok || '').split('.'); if (!p || !s) return null;
  const want = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (want.length !== s.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(s))) return null;
  try { return JSON.parse(unb64(p)); } catch { return null; }
}
async function listAll(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return out;
}
const opts = { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' };

async function attempts(h) { return (await listAll(`a/${h}/`)).length; }

async function startAttempt(h, name) {
  const used = await attempts(h);
  for (let n = used + 1; n <= MAX_ATTEMPTS; n++) {
    try { await put(`a/${h}/${n}.json`, JSON.stringify({ name, t0: Date.now() }), opts); return n; }
    catch (e) { if (!/exist/i.test(e.message)) throw e; }
  }
  return 0;
}

function parseScore(b) {
  const m = b.pathname.match(/^s\/([a-z0-9_]{1,15})\/(\d)-(\d+)-(\d+)-([A-Za-z0-9_-]*)\.json$/); if (!m) return null;
  let name = ''; try { name = unb64(m[5]); } catch {}
  return { handle: m[1], attempt: +m[2], score: +m[3], at: +m[4], name };
}
async function board() {
  const rows = (await listAll('s/')).map(parseScore).filter(Boolean);
  const best = {};
  for (const r of rows) { const b = best[r.handle];
    if (!b || r.score > b.score || (r.score === b.score && r.at < b.at)) best[r.handle] = { ...r, tries: 0 }; }
  for (const r of rows) best[r.handle].tries++;
  const ranked = Object.values(best).sort((a, b) => b.score - a.score || a.at - b.at);
  return { ranked, rows };
}
function json(res, code, body, cache) {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(body));
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const c of req) s += c; try { return JSON.parse(s || '{}'); } catch { return {}; }
}
module.exports = { CLOSE_AT, MAX_ATTEMPTS, MIN_DROP_S, MAX_SCORE, normHandle, validHandle, cleanName, b64, sign, verify, listAll, attempts, startAttempt, board, json, body, put, del, opts };
