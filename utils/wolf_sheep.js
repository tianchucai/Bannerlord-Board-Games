// 狼羊棋（Bagh-Chal 尼泊尔虎棋）：纯数据规则 + 贪心 AI
// 对齐骑砍二酒馆「狼羊棋（尼泊尔虎棋）」
// 规则：5×5 点阵，狼(虎)4 只 vs 羊 20 只；羊先手（先放置后移动）；
//       狼走一格或跳过相邻羊吃子；狼吃 5 只羊获胜，羊困住 4 只狼获胜。

const SIZE = 5;
const PIECE = { None: 0, Wolf: 1, Sheep: 2 };
const SHEEP_TOTAL = 20;
const WOLF_WIN_CAPTURES = 5;
const MAX_MOVES = 300;

// 邻居：8 方向一步（正交 + 对角，棋盘内）
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const NEIGH = [];
for (let r = 0; r < SIZE; r++) {
  NEIGH[r] = [];
  for (let c = 0; c < SIZE; c++) {
    const list = [];
    for (const d of DIRS) {
      const nr = r + d[0], nc = c + d[1];
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) list.push({ r: nr, c: nc });
    }
    NEIGH[r][c] = list;
  }
}

function createEmpty() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(PIECE.None));
}

// 开局：4 只狼在中央十字四臂
function setup() {
  const board = createEmpty();
  [[0, 2], [2, 0], [2, 4], [4, 2]].forEach(p => { board[p[0]][p[1]] = PIECE.Wolf; });
  return board;
}

// —— 走法 ——

// 狼：走一格到相邻空点，或跳过相邻羊到正后方空点（吃羊）
function wolfMoves(board) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== PIECE.Wolf) continue;
      for (const n of NEIGH[r][c]) {
        const t = board[n.r][n.c];
        if (t === PIECE.None) {
          moves.push({ from: { r, c }, to: { r: n.r, c: n.c }, capture: null });
        } else if (t === PIECE.Sheep) {
          const dr = n.r - r, dc = n.c - c;
          const rr = n.r + dr, cc = n.c + dc;
          if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === PIECE.None) {
            moves.push({ from: { r, c }, to: { r: rr, c: cc }, capture: { r: n.r, c: n.c } });
          }
        }
      }
    }
  }
  return moves;
}

// 羊放置：所有空点
function sheepPlacements(board, placed) {
  if (placed >= SHEEP_TOTAL) return [];
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.None) list.push({ place: { r, c } });
    }
  }
  return list;
}

// 羊移动：走一格到相邻空点
function sheepMoves(board) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== PIECE.Sheep) continue;
      for (const n of NEIGH[r][c]) {
        if (board[n.r][n.c] === PIECE.None) moves.push({ from: { r, c }, to: { r: n.r, c: n.c } });
      }
    }
  }
  return moves;
}

function sheepLegalMoves(board, placed) {
  return placed < SHEEP_TOTAL ? sheepPlacements(board, placed) : sheepMoves(board);
}

// —— 走子 ——
function applyMove(board, move) {
  const nb = board.map(row => row.slice());
  let captured = 0;
  if (move.place) {
    nb[move.place.r][move.place.c] = PIECE.Sheep;
    return { board: nb, captured: 0 };
  }
  const p = nb[move.from.r][move.from.c];
  nb[move.from.r][move.from.c] = PIECE.None;
  nb[move.to.r][move.to.c] = p;
  if (move.capture) {
    nb[move.capture.r][move.capture.c] = PIECE.None;
    captured = 1;
  }
  return { board: nb, captured };
}

// —— 胜负 ——
function wolfHasAnyMove(board) {
  return wolfMoves(board).length > 0;
}

function checkWin(board, sheepCaptured) {
  if (sheepCaptured >= WOLF_WIN_CAPTURES) return 'wolf'; // 狼吃满 5 只
  if (!wolfHasAnyMove(board)) return 'sheep';            // 4 狼全被困住
  return null;
}

// —— AI ——

// 狼 AI：跳吃优先（且优先能继续跳的）；无跳吃则向最近的羊靠拢
function wolfAiMove(board) {
  const moves = wolfMoves(board);
  if (moves.length === 0) return null;
  const jumps = moves.filter(m => m.capture);
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
  if (sheep.length === 0) return moves[Math.floor(Math.random() * moves.length)];
  let best = null, bestD = Infinity;
  for (const m of moves) {
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
  const moves = sheepLegalMoves(board, placed);
  if (moves.length === 0) return null;
  let bestScore = Infinity;
  let bestList = [];
  for (const m of moves) {
    const nb = applyMove(board, m).board;
    const score = wolfMoves(nb).length;
    if (score < bestScore) { bestScore = score; bestList = [m]; }
    else if (score === bestScore) bestList.push(m);
  }
  return bestList[Math.floor(Math.random() * bestList.length)];
}

module.exports = {
  SIZE, PIECE, NEIGH, createEmpty, setup,
  wolfMoves, sheepPlacements, sheepMoves, sheepLegalMoves,
  applyMove, checkWin, wolfHasAnyMove,
  wolfAiMove, sheepAiMove,
  SHEEP_TOTAL, WOLF_WIN_CAPTURES, MAX_MOVES
};
