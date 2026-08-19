// 跳棋（Kōnane 夏威夷跳棋）：纯数据规则 + 贪心 AI
// 规则：8×8 棋盘开局黑白交替填满；开局黑移除中心 (3,3)、白移除相邻 (3,4)；
//       只能跳跃吃子（跳过相邻敌子到正后方空位，四方向），可连续跳（强制跳到不能再跳）；
//       无合法跳的一方败。

const SIZE = 8;
const PIECE = { None: 0, Black: 1, White: 2 };
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function createEmpty() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(PIECE.None));
}

// 开局：填满交替色，黑移除 (3,3)，白移除 (3,4)，黑先跳
function setup() {
  const board = createEmpty();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      board[r][c] = ((r + c) % 2 === 0) ? PIECE.Black : PIECE.White;
    }
  }
  board[3][3] = PIECE.None;
  board[3][4] = PIECE.None;
  return board;
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

// AI：选吃子最多、且吃完后对方能吃回最少的序列
function aiMove(board, side) {
  const all = jumpSequences(board, side);
  if (all.length === 0) return null;
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  let best = null, bestScore = -Infinity;
  for (const seq of all) {
    const nb = applyMove(board, seq);
    let score = seq.captures * 100;
    // 对方反击能吃回多少（取对方最大单序列吃子）
    let oppMax = 0;
    for (const os of jumpSequences(nb, opp)) oppMax = Math.max(oppMax, os.captures);
    score -= oppMax * 60;
    if (score > bestScore) { bestScore = score; best = seq; }
  }
  return best;
}

module.exports = {
  SIZE, PIECE, DIRS, createEmpty, setup, count,
  jumpSequencesFrom, jumpSequences, hasAnyJump, applyMove, checkWin, aiMove
};
