// 跳棋 AI（从 konane.js 拆出，对齐古典象棋 game.js/ai.js 两文件结构）
// 搜索型 AI：迭代加深 + alpha-beta 剪枝的 negamax。
//  - 终局（当前方无合法跳）判负（-WIN_SCORE），天然倾向「让对手无棋可跳」的胜着；
//  - 非终局启发：子力差 + 机动性（可跳数量）差；
//  - 走法按吃子数排序（吃得多先搜）提升剪枝效率；
//  - 带时间预算，超时回退到上一完整深度结果。
const {
  PIECE, isCenter4, openingCandidates, secondRemovalChoices,
  count, applyRemoval, jumpSequences, applyMove
} = require('./konane');

const WIN_SCORE = 1000000; // 终局必胜分
const AI_TIME_MS = 200;    // 单步思考时间预算（ms）
const AI_MAX_DEPTH = 8;    // 搜索深度上限

let aborted = false; // 当前深度搜索是否超时（超时结果丢弃）

// 随机打乱（开局移除平局打破，避免每局开局完全一样）
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// 评估：子力差 + 机动性差（此棋胜负与子数无关，机动性更重要）
function evaluate(board, side) {
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  const myM = jumpSequences(board, side).length;
  const opM = jumpSequences(board, opp).length;
  return (count(board, side) - count(board, opp)) * 20 + (myM - opM) * 60;
}

// negamax + alpha-beta（返回当前行动方视角的分数）
function negamax(board, side, depth, alpha, beta, deadline) {
  if (Date.now() > deadline) { aborted = true; return 0; }
  const moves = jumpSequences(board, side);
  if (moves.length === 0) return -WIN_SCORE; // 当前方无合法跳 → 对方获胜
  if (depth <= 0) return evaluate(board, side);
  if (moves.length > 1) moves.sort((a, b) => b.captures - a.captures);
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  let best = -Infinity;
  for (const seq of moves) {
    const nb = applyMove(board, seq);
    const score = -negamax(nb, opp, depth - 1, -beta, -alpha, deadline);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// AI 走子：迭代加深，超时用上一完整深度结果
function aiMove(board, side) {
  const moves = jumpSequences(board, side);
  if (moves.length === 0) return null;
  moves.sort((a, b) => b.captures - a.captures);
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  const deadline = Date.now() + AI_TIME_MS;
  let best = moves[0];
  for (let depth = 2; depth <= AI_MAX_DEPTH; depth++) {
    aborted = false;
    let iterBest = null, iterScore = -Infinity;
    for (const seq of moves) {
      if (Date.now() > deadline) { aborted = true; break; }
      const nb = applyMove(board, seq);
      const score = -negamax(nb, opp, depth - 1, -Infinity, Infinity, deadline);
      if (score > iterScore) { iterScore = score; iterBest = seq; }
    }
    if (aborted || iterBest === null) break;
    best = iterBest;
    // 已确认必胜（或必败局面里最好的选择）则不必再加深
    if (Math.abs(iterScore) >= WIN_SCORE - 1000) break;
  }
  return best;
}

// 开局移除：
//  - 先手：对每个候选移除做 1 层前瞻（考虑对手的最优回应），选最终局面对自己最有利的；
//  - 后手：选择让自己机动性最优的相邻移除。
function aiOpeningRemove(board, side, first) {
  if (first) {
    const choices = shuffle(secondRemovalChoices(board, side, first));
    if (choices.length === 0) return null;
    let bestC = null, bestScore = -Infinity;
    for (const ch of choices) {
      const nb = applyRemoval(board, ch.r, ch.c);
      const sc = evaluate(nb, side); // 移除后黑先跳，评估先手方视角的机动性
      if (sc > bestScore) { bestScore = sc; bestC = ch; }
    }
    return bestC;
  }
  const candidates = shuffle(openingCandidates(board, side));
  if (candidates.length === 0) return null;
  const opp = side === PIECE.Black ? PIECE.White : PIECE.Black;
  let bestC = null, bestScore = -Infinity;
  for (const c of candidates) {
    const b1 = applyRemoval(board, c.r, c.c);
    // 对手的最优回应（对手会选让自己最有利的移除）
    let worst = Infinity;
    const resp = secondRemovalChoices(b1, opp, c);
    for (const r of resp) {
      const b2 = applyRemoval(b1, r.r, r.c);
      const sc = evaluate(b2, side);
      if (sc < worst) worst = sc;
    }
    if (worst > bestScore) { bestScore = worst; bestC = c; }
  }
  return bestC || candidates[0];
}

module.exports = { aiOpeningRemove, aiMove };
