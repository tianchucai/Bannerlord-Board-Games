// 狼羊棋 AI（从 wolf_sheep.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
const { PIECE, SIZE, wolfMoves, sheepLegalMoves, applyMove } = require('./wolf_sheep');

// 狼 AI：跳吃优先（且优先能继续跳的）；无跳吃则向最近的羊靠拢
function wolfAiMove(board) {
  const list = wolfMoves(board);
  if (list.length === 0) return null;
  const jumps = list.filter(m => m.capture);
  if (jumps.length > 0) {
    let best = null, bestScore = -1;
    for (const m of jumps) {
      const nb = applyMove(board, m).board;
      const again = wolfMoves(nb).filter(x => x.capture).length;
      if (again > bestScore) { bestScore = again; best = m; }
    }
    return best;
  }
  const sheep = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.Sheep) sheep.push({ r, c });
    }
  }
  if (sheep.length === 0) return list[Math.floor(Math.random() * list.length)];
  let best = null, bestD = Infinity;
  for (const m of list) {
    let d = Infinity;
    for (const s of sheep) {
      const dd = Math.abs(m.to.r - s.r) + Math.abs(m.to.c - s.c);
      if (dd < d) d = dd;
    }
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// 羊 AI：放置/移动都选「让狼合法移动数最少」的位置（围困），同分随机
function sheepAiMove(board, placed) {
  const list = sheepLegalMoves(board, placed);
  if (list.length === 0) return null;
  let bestScore = Infinity;
  let bestList = [];
  for (const m of list) {
    const nb = applyMove(board, m).board;
    const score = wolfMoves(nb).length;
    if (score < bestScore) { bestScore = score; bestList = [m]; }
    else if (score === bestScore) bestList.push(m);
  }
  return bestList[Math.floor(Math.random() * bestList.length)];
}

module.exports = { wolfAiMove, sheepAiMove };
