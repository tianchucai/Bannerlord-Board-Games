// 塞伽棋（Seega 埃及夹棋）：纯数据规则 + 贪心 AI
// 规则（对齐骑砍二 2026 正式版游戏内弹窗）：
//   5×5 棋盘，仅中心格特殊：放置阶段禁止落子，移动阶段可走入；
//   双方各 12 子，先轮流放置，放完后移动（水平/垂直一格，不能斜走）；
//   移动后，横向或竖向夹住对方「单独一枚」棋子即可吃掉（斜向不算；
//   只有你移动造成的夹击才算，对方主动走进你的两子中间不会被吃；
//   两颗连在一起的敌子不能被夹吃）；
//   轮到某方却无棋可走时，该方必须移除对手任意一枚棋子，然后继续自己的回合；
//   将对手除 1 枚以外的全部棋子吃掉（对手只剩 1 枚）即获胜。

const SIZE = 5;
const PIECE = { None: 0, Black: 1, White: 2 };
const TOTAL = 12;

// 仅中心格（2,2）特殊
function isCenter(r, c) {
  return r === 2 && c === 2;
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

// 放置阶段：非中心格的空位（中心格禁落子）
function placements(board) {
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PIECE.None && !isCenter(r, c)) list.push({ place: { r, c } });
    }
  }
  return list;
}

// 移动阶段：水平/垂直一格到空位（中心格可走入）
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

// 移动后会被夹吃掉的敌子：仅「紧邻落点 + 隔一格是己方子」的单独一枚敌子可吃。
// 因此两颗连在一起的敌子无法被夹吃；斜向不算；只检查行棋方（对方走进两子中间不会触发）。
function capturedByMove(board, side, toR, toC) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const out = [];
  const inB = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  for (const d of dirs) {
    const r1 = toR + d[0], c1 = toC + d[1];
    const r2 = toR + 2 * d[0], c2 = toC + 2 * d[1];
    if (inB(r1, c1) && inB(r2, c2) &&
      board[r1][c1] !== PIECE.None && board[r1][c1] !== side &&
      board[r2][c2] === side) {
      out.push({ r: r1, c: c1 });
    }
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

// 无棋可走时的特殊行动：移除对手一枚棋子
function applyRemove(board, target) {
  const nb = board.map(row => row.slice());
  nb[target.r][target.c] = PIECE.None;
  return { board: nb, captured: 0 };
}

// 胜负：side 为即将行动的一方；若其棋子数 ≤1（只剩 1 枚）则另一方胜。
// 放置阶段无胜负（无吃子，子数只增不减）。
function checkWin(board, side, phase) {
  if (phase === 'place') return null;
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  if (count(board, side) <= 1) return opp;
  return null;
}

// 己方棋子受夹威胁数（评估用）：某轴一侧为空、另一侧为敌子，
// 敌子可移入该空位形成夹击吃掉此子，则该子受威胁。
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
          board[a.r][a.c] === PIECE.None &&
          board[b.r][b.c] !== PIECE.None && board[b.r][b.c] !== side) {
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
  SIZE, PIECE, TOTAL, isCenter, createEmpty, setup, count,
  placements, moves, capturedByMove, applyMove, applyRemove, checkWin, threatenedCount
};
