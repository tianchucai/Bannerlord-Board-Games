// 普鲁克 AI（对齐骑砍二堆叠俘虏规则）
const { PIECE, CELLS, moves, applyMove, landing } = require('./puluc');

// AI：掷出 n 步后，优先回本垒结算(俘虏淘汰)、其次俘虏、再其次推进，进场垫底
function aiMove(state, side, n) {
  const list = moves(state, side, n);
  if (list.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const m of list) {
    const res = applyMove(state, m, side, n);
    if (!res) continue;
    const st = res.state;
    let score = 0;
    if (m.kind === 'enter') {
      score -= 8; // 进场本身收益低（若落点俘虏则加分在下面）
    } else {
      // 回本垒：己方棋子回归 + 俘虏淘汰（巨大收益）
      const cell = state.cells[m.pos];
      const land = landing(m.pos, cell.dir, n, side);
      if (land.homeReturn) score += 300;
    }
    score += res.captured * 120; // 俘虏（含反俘虏整个堆叠、进场落点俘虏）
    // 距离分：越接近折返/离场越好（黑白对称）
    for (let pos = 0; pos < CELLS; pos++) {
      const c = st.cells[pos];
      if (!c || c.side !== side) continue;
      const toFar = (side === PIECE.Black) ? (CELLS - 1 - pos) : pos;
      const toHome = (side === PIECE.Black) ? pos : (CELLS - 1 - pos);
      const isForward = (side === PIECE.Black) ? (c.dir === 1) : (c.dir === -1);
      const dist = isForward ? toFar : toHome;
      score += (CELLS - dist) * 0.5;
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

module.exports = { aiMove };
