// 跳棋 AI（从 konane.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
const { PIECE, jumpSequences, applyMove } = require('./konane');

// AI：选吃子最多、且吃完后对方能吃回最少的序列
function aiMove(board, side) {
  const all = jumpSequences(board, side);
  if (all.length === 0) return null;
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  let best = null, bestScore = -Infinity;
  for (const seq of all) {
    const nb = applyMove(board, seq);
    let score = seq.captures * 100;
    // 对方反击能吃回多少（取对方最大单序列吃子）
    let oppMax = 0;
    for (const os of jumpSequences(nb, opp)) oppMax = Math.max(oppMax, os.captures);
    score -= oppMax * 60;
    if (score > bestScore) { bestScore = score; best = seq; }
  }
  return best;
}

module.exports = { aiMove };
