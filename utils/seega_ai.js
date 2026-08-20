// 施嘉 AI（从 seega.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
const { PIECE, placements, moves, applyMove, capturedByMove, threatenedCount } = require('./seega');

// AI：放置阶段占中心附近；移动阶段吃子优先、其次避被夹
function aiMove(board, side, phase) {
  if (phase === 'place') {
    const list = placements(board);
    if (list.length === 0) return null;
    let best = null, bestD = Infinity;
    for (const m of list) {
      const d = Math.abs(m.place.r - 2) + Math.abs(m.place.c - 2);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }
  const list = moves(board, side);
  if (list.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const m of list) {
    const nb = applyMove(board, m, side).board;
    let score = 0;
    const eaten = capturedByMove(nb, side, m.to.r, m.to.c).length;
    score += eaten * 100;                                     // 吃子
    score -= threatenedCount(nb, side) * 30;                  // 移动后己方受夹
    // 移动后对方能吃多少
    const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
    for (const om of moves(nb, opp)) {
      score -= capturedByMove(nb, opp, om.to.r, om.to.c).length * 40;
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

module.exports = { aiMove };
