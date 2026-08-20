// 舞棋 AI（从 mutorere.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
const { PIECE, moves, applyMove } = require('./mutorere');

// AI：1 层贪心——选移动后对方合法移动数最少的走法，同分随机
function aiMove(board, side) {
  const list = moves(board, side);
  if (list.length === 0) return null;
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  let bestScore = Infinity, bestList = [];
  for (const m of list) {
    const nb = applyMove(board, m);
    const score = moves(nb, opp).length;
    if (score < bestScore) { bestScore = score; bestList = [m]; }
    else if (score === bestScore) bestList.push(m);
  }
  return bestList[Math.floor(Math.random() * bestList.length)];
}

module.exports = { aiMove };
