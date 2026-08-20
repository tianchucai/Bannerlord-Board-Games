// 施嘉（Seega 埃及夹棋）：纯数据规则 + 贪心 AI
// 规则：5×5 棋盘，中央十字(中心+上下左右共5格)开局为空且放置阶段禁用；
//       双方各 12 子，先轮流放置，放完后移动（水平/垂直一格）；
//       移动后凡被己方水平/垂直夹住的敌子被吃（中央十字格上的子受保护不可吃）；
//       吃光对方全部棋子或对方无合法移动者胜。

const SIZE = 5;
const PIECE = { None: 0, Black: 1, White: 2 };
const TOTAL = 12;

function isCenterCross(r, c) {
  return (r === 2 && c === 2) || (Math.abs(r - 2) + Math.abs(c - 2) === 1);
}

function createEmpty() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(PIECE.None));
}

function setup() {
  return createEmpty(); // 放置阶段开始，棋盘全空
}

function count(board, side) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] === side) n++;
  return n;
}

// 放置阶段：非中央十字的空位
function placements(board) {
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.None && !isCenterCross(r, c)) list.push({ place: { r, c } });
    }
  }
  return list;
}

// 移动阶段：水平/垂直一格到空位
function moves(board, side) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== side) continue;
      for (const d of dirs) {
        const nr = r + d[0], nc = c + d[1];
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === PIECE.None) {
          list.push({ from: { r, c }, to: { r: nr, c: nc } });
        }
      }
    }
  }
  return list;
}

// 计算移动后会被夹击吃掉的敌子（中心十字上的敌子受保护）
function capturedByMove(board, side, toR, toC) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const out = [];
  for (const d of dirs) {
    let nr = toR + d[0], nc = toC + d[1];
    const chain = [];
    let closed = false;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      const p = board[nr][nc];
      if (p === PIECE.None) break;
      if (p === side) { closed = true; break; }
      if (isCenterCross(nr, nc)) { closed = false; break; } // 中心十字保护
      chain.push({ r: nr, c: nc });
      nr += d[0]; nc += d[1];
    }
    if (closed) out.push(...chain);
  }
  return out;
}

// 走子：放置 或 移动+吃子，返回 { board, captured }
function applyMove(board, move, side) {
  const nb = board.map(row => row.slice());
  let captured = 0;
  if (move.place) {
    nb[move.place.r][move.place.c] = side;
    return { board: nb, captured: 0 };
  }
  nb[move.from.r][move.from.c] = PIECE.None;
  nb[move.to.r][move.to.c] = side;
  const eaten = capturedByMove(nb, side, move.to.r, move.to.c);
  for (const e of eaten) { nb[e.r][e.c] = PIECE.None; captured++; }
  return { board: nb, captured };
}

// 胜负：side 轮到行动；若其子数为 0 或无合法走法则对方胜
function checkWin(board, side, phase) {
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  if (count(board, side) === 0) return opp;
  const legal = (phase === 'place') ? placements(board) : moves(board, side);
  if (legal.length === 0) return opp;
  return null;
}

// 己方棋子被夹击威胁数（评估用）：某轴两侧都是敌子则受威胁
function threatenedCount(board, side) {
  let n = 0;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== side) continue;
      for (const d of dirs) {
        const a = { r: r + d[0], c: c + d[1] };
        const b = { r: r - d[0], c: c - d[1] };
        const inB = (p) => p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE;
        if (inB(a) && inB(b) &&
          board[a.r][a.c] !== PIECE.None && board[a.r][a.c] !== side &&
          board[b.r][b.c] !== PIECE.None && board[b.r][b.c] !== side &&
          !isCenterCross(a.r, a.c) && !isCenterCross(b.r, b.c)) {
          n++;
          break;
        }
      }
    }
  }
  return n;
}

// AI 见 seega_ai.js

module.exports = {
  SIZE, PIECE, TOTAL, isCenterCross, createEmpty, setup, count,
  placements, moves, capturedByMove, applyMove, checkWin, threatenedCount
};
