const C = require('../lib/core');
module.exports = async (req, res) => {
  const { ranked } = await C.board();
  const closed = Date.now() >= C.CLOSE_AT;
  C.json(res, 200, { closeAt: C.CLOSE_AT, closed, players: ranked.length, top: ranked.slice(0, 25).map(({ handle, name, score }) => ({ handle, name, score })), winner: closed && ranked[0] ? { handle: ranked[0].handle, name: ranked[0].name, score: ranked[0].score } : null },
    'public, max-age=0, s-maxage=4, stale-while-revalidate=10');
};
