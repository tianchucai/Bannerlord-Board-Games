// 狼羊棋 AI（从 wolf_sheep.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
// 双方都是一步前瞻：狼模拟「羊的最佳应手（轻量模型）」再评估；羊模拟「狼的最佳应手（实战同款）」再评估。
// 羊的对手模型比狼的羊模型更精确（狼用轻量模型，羊用完整狼 AI），因此羊保持略强于狼。
const {
  PIECE, SIZE, SHEEP_TOTAL,
  wolfMoves, sheepLegalMoves, sheepPlacements, sheepMoves, applyMove
} = require('./wolf_sheep');

// —— 公用小工具 ——

// 被完全困住（无任何合法走法）的狼数
function blockedWolves(board) {
  const moved = new Set();
  for (const m of wolfMoves(board)) moved.add(m.from.r + ',' + m.from.c);
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.Wolf && !moved.has(r + ',' + c)) n++;
    }
  }
  return n;
}

// 下一回合会被狼跳吃的羊数（按羊去重）
function threatenedSheep(board) {
  const set = new Set();
  for (const m of wolfMoves(board)) {
    if (m.capture) set.add(m.capture.r + ',' + m.capture.c);
  }
  return set.size;
}

function sheepPositions(board) {
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.Sheep) list.push({ r, c });
    }
  }
  return list;
}

// —— 狼 AI ——
// 跳吃优先（且优先能继续跳的）；无跳吃则一步前瞻：
// 模拟羊的最佳应手（轻量模型）后评估 —— 能制造吃子机会、保持机动、靠近羊群、不被围死。
//
// 轻量羊应手（供狼前瞻，不递归）：放置阶段评估全部空点；
// 移动阶段只评估「离狼最近的 3 只羊」的走法（狼的威胁集中在近处，控制成本）。
function lightSheepReply(board) {
  let placed = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.Sheep) placed++;
    }
  }
  let list;
  if (placed < SHEEP_TOTAL) {
    list = sheepPlacements(board, placed);
  } else {
    const wolves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === PIECE.Wolf) wolves.push({ r, c });
      }
    }
    const moves = sheepMoves(board);
    if (wolves.length === 0) {
      list = moves;
    } else {
      const byDist = [];
      for (const s of sheepPositions(board)) {
        let d = Infinity;
        for (const w of wolves) {
          const dd = Math.abs(w.r - s.r) + Math.abs(w.c - s.c);
          if (dd < d) d = dd;
        }
        byDist.push({ key: s.r + ',' + s.c, d });
      }
      byDist.sort((a, b) => a.d - b.d);
      const near = new Set(byDist.slice(0, 3).map(x => x.key));
      list = moves.filter(m => near.has(m.from.r + ',' + m.from.c));
    }
  }
  if (list.length === 0) return null;
  // 评分：先避免送子，再压狼机动性（轻量版羊应手）
  let best = null, bestScore = Infinity;
  for (const m of list) {
    const nb = applyMove(board, m).board;
    const wl = wolfMoves(nb);
    const score = wl.filter(x => x.capture).length * 1000 + wl.length;
    if (score < bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function wolfAiMove(board) {
  const list = wolfMoves(board);
  if (list.length === 0) return null;
  const jumps = list.filter(m => m.capture);
  if (jumps.length > 0) {
    // 跳吃优先（且优先能继续跳的）——能吃就吃，选连跳潜力最大的
    let best = null, bestScore = -1;
    for (const m of jumps) {
      const nb = applyMove(board, m).board;
      const again = wolfMoves(nb).filter(x => x.capture).length;
      if (again > bestScore) { bestScore = again; best = m; }
    }
    return best;
  }
  // 无跳吃：一步前瞻（评估项均为「羊应手后」的局面）
  let best = null, bestScore = -Infinity;
  for (const m of list) {
    const nb = applyMove(board, m).board;
    const sr = lightSheepReply(nb);
    let nb2 = nb;
    if (sr) nb2 = applyMove(nb, sr).board;
    const wm2 = wolfMoves(nb2);
    const nextCaptures = wm2.filter(x => x.capture).length;
    // 距最近羊的距离（羊应手后）
    let d = Infinity;
    for (const s of sheepPositions(nb2)) {
      const dd = Math.abs(s.r - m.to.r) + Math.abs(s.c - m.to.c);
      if (dd < d) d = dd;
    }
    const score = nextCaptures * 1000   // 羊应手后仍能吃羊 = 真食物
      + wm2.length * 5                  // 保持机动
      - blockedWolves(nb2) * 100        // 别被围死
      - (d === Infinity ? 0 : d * 3);   // 靠近羊群
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// —— 羊 AI：一步前瞻 ——
// 对每个候选落子/走法：模拟狼的最佳应手（游戏内真实狼 AI，含其一步前瞻），再评估：
//   1. 狼应手吃掉的羊数 ×10000（送子重罚）
//   2. 下一回合会被狼跳吃的羊数 ×50（威胁压力：避免被逼救子 / 后期送子）
//   3. 狼总合法走法数 ×8（围困）
//   4. 被困狼数 ×(-60)（困住一狼离胜利近一步）
function sheepAiMove(board, placed) {
  const list = sheepLegalMoves(board, placed);
  if (list.length === 0) return null;
  let bestScore = Infinity;
  let bestList = [];
  for (const m of list) {
    const nb = applyMove(board, m).board;
    const wr = wolfAiMove(nb); // 与实战同款（新版一步前瞻狼）
    let nb2 = nb, wolfCaptured = 0;
    if (wr) {
      const res = applyMove(nb, wr);
      nb2 = res.board;
      wolfCaptured = res.captured;
    }
    const wm2 = wolfMoves(nb2);
    const score = wolfCaptured * 10000
      + threatenedSheep(nb2) * 50
      + wm2.length * 8
      - blockedWolves(nb2) * 60;
    if (score < bestScore) { bestScore = score; bestList = [m]; }
    else if (score === bestScore) bestList.push(m);
  }
  return bestList[Math.floor(Math.random() * bestList.length)];
}

module.exports = { wolfAiMove, sheepAiMove };
