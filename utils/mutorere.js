// 舞棋（Mū tōrere 毛利星盘棋）：纯数据规则，对齐《骑砍 2》酒馆瓦兰迪亚版
// 规则：8 个外围点环形 + 1 中心点(putahi)；双方各 4 子开局交替占满外围，中心空；
//       外围子沿外缘自由移动一格到相邻空点；
//       只有「旁边有对方棋子」的外围子才能跳入中心（中心需空）；
//       中心子可跳到任意空外围点（无「两侧被占」限制）；
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

// 合法移动（对齐游戏内规则弹窗）
function moves(board, side) {
  const list = [];
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== side) continue;
    if (i === CENTER) {
      // 中心 → 任意空外围点（「中心格上的棋子可以移动到任何可用格上」）
      for (let k = 0; k < OUTER; k++) {
        if (board[k] === PIECE.None) list.push({ from: i, to: k });
      }
    } else {
      // 外围 → 相邻外围空点（「每个棋子可以自由沿棋盘外缘移动一格」）
      const a = (i + 1) % 8, b = (i + 7) % 8;
      if (board[a] === PIECE.None) list.push({ from: i, to: a });
      if (board[b] === PIECE.None) list.push({ from: i, to: b });
      // 外围 → 中心：仅当「旁边有对方棋子」（环形相邻点为敌子）且中心空
      if (board[CENTER] === PIECE.None && (board[a] === opp || board[b] === opp)) {
        list.push({ from: i, to: CENTER });
      }
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

// AI 见 mutorere_ai.js

module.exports = {
  PIECE, OUTER, CENTER, createEmpty, setup, count,
  moves, applyMove, checkWin
};
