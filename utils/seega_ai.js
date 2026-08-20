// 塞伽棋 AI（从 seega.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
const { PIECE, placements, moves, applyMove, capturedByMove, threatenedCount, count } = require('./seega');

const oppOf = (side) => (side === PIECE.Black ? PIECE.White : PIECE.Black);

// 无棋可走时：移除对手一子。
// 优先移除与己方棋子相邻的敌子（移除后立刻能打开走法）；
// 其次优先移除边角上的敌子（边角子很难被夹吃，是长期威胁）。
// 返回 { remove: { r, c } }；无对手子时返回 null。
function aiRemove(board, side) {
  const opp = oppOf(side);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let best = null, bestScore = -Infinity;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] !== opp) continue;
      let score = 0;
      for (const d of dirs) {
        const nr = r + d[0], nc = c + d[1];
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && board[nr][nc] === side) score += 60;
      }
      if ((r === 0 || r === 4) && (c === 0 || c === 4)) score += 15;
      else if (r === 0 || r === 4 || c === 0 || c === 4) score += 8;
      if (score > bestScore) { bestScore = score; best = { r, c }; }
    }
  }
  if (!best) {
    outer: for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (board[r][c] === opp) { best = { r, c }; break outer; }
      }
    }
  }
  return best ? { remove: best } : null;
}

// AI 走法：放置阶段优先占边角（边角子很难被夹击）；
// 移动阶段吃子优先、其次避被夹；无棋可走时返回移除对手一子的行动。
function aiMove(board, side, phase) {
  if (phase === 'place') {
    const list = placements(board);
    if (list.length === 0) return null;
    let best = null, bestD = -1;
    for (const m of list) {
      // 离中心越远越靠边角，越安全
      const d = Math.abs(m.place.r - 2) + Math.abs(m.place.c - 2);
      if (d > bestD) { bestD = d; best = m; }
    }
    return best;
  }
  const list = moves(board, side);
  if (list.length === 0) return aiRemove(board, side); // 无棋可走 → 移除对手一子
  const opp = oppOf(side);
  let best = null, bestScore = -Infinity;
  for (const m of list) {
    const res = applyMove(board, m, side);
    const nb = res.board;
    let score = 0;
    score += res.captured * 100;                       // 吃子
    if (count(nb, opp) <= 1) score += 5000;            // 吃掉对手只剩 1 子 → 立刻获胜
    score -= threatenedCount(nb, side) * 30;           // 移动后己方受夹
    // 移动后对方能吃多少
    for (const om of moves(nb, opp)) {
      score -= capturedByMove(nb, opp, om.to.r, om.to.c).length * 40;
    }
    // 避免把对方逼到无棋可走：对方会白嫖移除己方一子，非常亏
    if (moves(nb, opp).length === 0) score -= 200;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

module.exports = { aiMove };
