// 跳棋（Kōnane 夏威夷跳棋，骑砍2 斯特吉亚酒馆版）：纯数据规则 + 贪心 AI
// 规则：6×6 棋盘开局黑白交替填满；黑（先手）从「四角 + 中央四格」中的己方棋子
//       （每方恰好 4 枚：2 角 + 2 中央）选一枚移除；白随后移除一枚与空位相邻的棋子，
//       若黑移除的是中央四格内的子，白也必须从中央四格内移除；之后黑先跳。
//       只能跳跃吃子（跳过相邻敌子到正后方空位，四方向），可连续跳（强制跳到不能再跳）；
//       无合法跳的一方败。

const SIZE = 6;
const PIECE = { None: 0, Black: 1, White: 2 };
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// 四角与中央四格（开局可移除的候选区域）
const CORNERS = [[0, 0], [0, SIZE - 1], [SIZE - 1, 0], [SIZE - 1, SIZE - 1]];
const CENTER4 = [[2, 2], [2, 3], [3, 2], [3, 3]];

function isCorner(r, c) {
  return CORNERS.some(p => p[0] === r && p[1] === c);
}

function isCenter4(r, c) {
  return CENTER4.some(p => p[0] === r && p[1] === c);
}

function createEmpty() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(PIECE.None));
}

// 开局：黑白交替填满 6×6（不自动移除，移除由开局阶段完成），黑先移除
function setup() {
  const board = createEmpty();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      board[r][c] = ((r + c) % 2 === 0) ? PIECE.Black : PIECE.White;
    }
  }
  return board;
}

// 先手方可移除的己方棋子：位于四角或中央四格（每方恰好 4 枚）
function openingCandidates(board, side) {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === side && (isCorner(r, c) || isCenter4(r, c))) out.push({ r, c });
    }
  }
  return out;
}

// 后手方可移除的棋子：己方与先手移除位相邻的棋子；
// 若先手移除的是中央四格内的子，后手也只能从中央四格内移除
// side 为后手方（正在移除的一方），first 为先手移除位置
function secondRemovalChoices(board, side, first) {
  const out = [];
  for (const d of DIRS) {
    const r = first.r + d[0], c = first.c + d[1];
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
    if (board[r][c] !== side) continue;
    if (isCenter4(first.r, first.c) && !isCenter4(r, c)) continue;
    out.push({ r, c });
  }
  return out;
}

// 开局移除一枚棋子，返回新棋盘
function applyRemoval(board, r, c) {
  const nb = board.map(row => row.slice());
  nb[r][c] = PIECE.None;
  return nb;
}

function count(board, side) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] === side) n++;
  return n;
}

// 从 (r,c) 出发的所有完整跳跃序列（DFS，强制连跳到尽头）
// 返回 [{ from:{r,c}, path:[{r,c,captured:{r,c}}...], to:{r,c}, captures:n }]
function jumpSequencesFrom(board, side, r, c) {
  const results = [];
  const eaten = new Set(); // "r,c" 已吃子（防重复跳同一子）
  function dfs(cr, cc, path) {
    let advanced = false;
    for (const d of DIRS) {
      const mr = cr + d[0], mc = cc + d[1];   // 被跳敌子
      const lr = cr + d[0] * 2, lc = cc + d[1] * 2; // 落点
      if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
      if (board[mr][mc] === PIECE.None || board[mr][mc] === side) continue; // 须为敌子
      if (board[lr][lc] !== PIECE.None) continue; // 落点须空
      const key = mr * SIZE + mc;
      if (eaten.has(key)) continue; // 同一子不能跳两次
      eaten.add(key);
      path.push({ r: lr, c: lc, captured: { r: mr, c: mc } });
      dfs(lr, lc, path);
      path.pop();
      eaten.delete(key);
      advanced = true;
    }
    if (!advanced && path.length > 0) {
      const last = path[path.length - 1];
      results.push({
        from: { r, c },
        path: path.slice(),
        to: { r: last.r, c: last.c },
        captures: path.length
      });
    }
  }
  dfs(r, c, []);
  return results;
}

// 当前方所有完整跳跃序列
function jumpSequences(board, side) {
  const all = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === side) all.push(...jumpSequencesFrom(board, side, r, c));
    }
  }
  return all;
}

function hasAnyJump(board, side) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === side && jumpSequencesFrom(board, side, r, c).length > 0) return true;
    }
  }
  return false;
}

// 应用完整跳跃序列
function applyMove(board, seq) {
  const side = board[seq.from.r][seq.from.c]; // 移动方 = 起点棋子
  const nb = board.map(row => row.slice());
  nb[seq.from.r][seq.from.c] = PIECE.None; // 清起点
  for (const step of seq.path) nb[step.captured.r][step.captured.c] = PIECE.None; // 吃掉被跳子
  for (let i = 0; i < seq.path.length - 1; i++) {
    nb[seq.path[i].r][seq.path[i].c] = PIECE.None; // 中间落点（会被再跳走）
  }
  nb[seq.to.r][seq.to.c] = side; // 最终落点
  return nb;
}

function checkWin(board, side) {
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  if (!hasAnyJump(board, side)) return opp;
  return null;
}

// AI 见 konane_ai.js

module.exports = {
  SIZE, PIECE, DIRS, createEmpty, setup, count,
  isCorner, isCenter4, openingCandidates, secondRemovalChoices, applyRemoval,
  jumpSequencesFrom, jumpSequences, hasAnyJump, applyMove, checkWin
};
