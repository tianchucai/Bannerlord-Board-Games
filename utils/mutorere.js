// 舞棋（Mū tōrere 毛利星盘棋）：纯数据规则 + 贪心 AI
// 规则：8 个外围点环形 + 1 中心点(putahi)；双方各 4 子开局交替占外围，中心空；
//       外围子可移到相邻外围空点，或移入中心(空时)；
//       中心子只能移到「两侧外围点都被占据」的外围空点；
//       无吃子；轮到某方无合法移动即败。

const PIECE = { None: 0, Black: 1, White: 2 };
const OUTER = 8;   // 外围点数 0..7（环形）
const CENTER = 8;  // 中心索引

function createEmpty() {
  return Array(9).fill(PIECE.None);
}

function setup() {
  const b = createEmpty();
  // 黑白交替占外围：黑 0,2,4,6；白 1,3,5,7
  for (let i = 0; i < OUTER; i++) b[i] = (i % 2 === 0) ? PIECE.Black : PIECE.White;
  b[CENTER] = PIECE.None;
  return b;
}

function count(board, side) {
  return board.filter(p => p === side).length;
}

// 合法移动
function moves(board, side) {
  const list = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] !== side) continue;
    if (i === CENTER) {
      // 中心 → 外围 k：两侧(k-1,k+1)都被占据(任意色)且 k 空
      for (let k = 0; k < OUTER; k++) {
        if (board[k] !== PIECE.None) continue;
        const prev = board[(k + 7) % 8];
        const next = board[(k + 1) % 8];
        if (prev !== PIECE.None && next !== PIECE.None) {
          list.push({ from: i, to: k });
        }
      }
    } else {
      // 外围 → 相邻外围空点
      const a = (i + 1) % 8, b = (i + 7) % 8;
      if (board[a] === PIECE.None) list.push({ from: i, to: a });
      if (board[b] === PIECE.None) list.push({ from: i, to: b });
      // 外围 → 中心
      if (board[CENTER] === PIECE.None) list.push({ from: i, to: CENTER });
    }
  }
  return list;
}

function applyMove(board, move) {
  const nb = board.slice();
  nb[move.to] = nb[move.from];
  nb[move.from] = PIECE.None;
  return nb;
}

function checkWin(board, side) {
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  if (moves(board, side).length === 0) return opp;
  return null;
}

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

module.exports = {
  PIECE, OUTER, CENTER, createEmpty, setup, count,
  moves, applyMove, checkWin, aiMove
};
