// Tablut AI：Minimax + Alpha-Beta 剪枝（纯数据）

const {
  PieceType,
  SIZE,
  cloneBoard,
  canLandOnThrone,
  isThrone,
  checkCaptures,
  isKingCaptured,
  checkWinCondition
} = require('./game');

let MAX_DEPTH = 3; // 深度 3 平衡最好；更深白方逃边目标太容易被看到（游戏内可调）
const INF = 1000000; // alpha-beta 剪枝边界（远大于任何胜负/估值分值）
const MATE = 100000; // 胜负分值（远大于估值，远小于 INF，避免和剪枝边界撞车）

// 搜索时间软中断（由 getBestMove 设置，minimax 内部检查）
let searchStart = 0;
let searchLimit = 600000; // 取消时间限制：让 AI 搜完当前深度（档位深度 2/3/4 耗时可控）

// ===== 国王逃路硬堵逻辑（黑方专用）：国王有一步能逃时，必须优先堵 =====

// 找国王位置
function findKing(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.King) return { r, c };
    }
  }
  return { r: 4, c: 4 };
}

// 国王畅通逃路方向（沿此方向一步可直达边缘）
function kingEscapeDirs(board) {
  const k = findKing(board);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const open = [];
  for (const d of dirs) {
    let nr = k.r + d[0];
    let nc = k.c + d[1];
    let clear = true;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) { clear = false; break; }
      nr += d[0];
      nc += d[1];
    }
    if (clear) open.push(d);
  }
  return open;
}

// 黑方所有能堵住国王逃路的走法
function kingBlockers(board) {
  const open = kingEscapeDirs(board);
  if (open.length === 0) return [];
  const k = findKing(board);
  const escapeCells = new Set();
  for (const d of open) {
    let nr = k.r + d[0];
    let nc = k.c + d[1];
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
      escapeCells.add(nr * SIZE + nc);
      nr += d[0];
      nc += d[1];
    }
  }
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const blockers = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== PieceType.Attacker) continue;
      for (const d of dirs) {
        let nr = r + d[0];
        let nc = c + d[1];
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
          if (escapeCells.has(nr * SIZE + nc)) {
            blockers.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
          nr += d[0];
          nc += d[1];
        }
      }
    }
  }
  return blockers;
}

// 从堵路走法中选 minimax 最优的一步（深度比正常搜索浅一档，保证快速）
function bestBlockMove(board, blockers) {
  const boardCopy = cloneBoard(board);
  let best = null;
  let bestScore = -INF;
  for (const move of blockers) {
    const nextBoard = simulateMove(boardCopy, move);
    const score = minimax(nextBoard, Math.max(1, MAX_DEPTH - 1), -INF, INF, false).score;
    if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// 黑方所有能一步击杀国王的走法（移动后国王被夹击吃掉）
function kingKillers(board) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const killers = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== PieceType.Attacker) continue;
      for (const d of dirs) {
        let nr = r + d[0];
        let nc = c + d[1];
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
          // 模拟黑子落位，检查国王是否被吃掉
          const nb = simulateMove(board, { from: { r, c }, to: { r: nr, c: nc } });
          let kingAlive = false;
          for (let rr = 0; rr < SIZE; rr++) {
            for (let cc = 0; cc < SIZE; cc++) {
              if (nb[rr][cc] === PieceType.King) { kingAlive = true; break; }
            }
            if (kingAlive) break;
          }
          if (!kingAlive) {
            killers.push({ from: { r, c }, to: { r: nr, c: nc } });
            break; // 该方向找到击杀即可，不继续延伸
          }
          nr += d[0];
          nc += d[1];
        }
      }
    }
  }
  return killers;
}

// 从击杀走法中选 minimax 最优（都是立即获胜，评估区分快慢/后续）
function bestKillerMove(board, killers) {
  const boardCopy = cloneBoard(board);
  let best = null;
  let bestScore = -INF;
  for (const move of killers) {
    const nextBoard = simulateMove(boardCopy, move);
    const score = minimax(nextBoard, Math.max(1, MAX_DEPTH - 1), -INF, INF, false).score;
    if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// ===== 白方硬性机制：通路一定跑、必杀一定躲 =====

// 白方：国王一步能到边缘获胜的走法
function kingWinMoves(board) {
  const k = findKing(board);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const wins = [];
  for (const d of dirs) {
    let nr = k.r + d[0];
    let nc = k.c + d[1];
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
      if (nr === 0 || nr === SIZE - 1 || nc === 0 || nc === SIZE - 1) {
        wins.push({ from: { r: k.r, c: k.c }, to: { r: nr, c: nc } });
        break; // 该方向找到获胜格即可
      }
      nr += d[0];
      nc += d[1];
    }
  }
  return wins;
}

// 白方走完后黑方无法一击必杀的走法（躲杀）
function safeMoves(board) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const safe = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      const isWhite = (p === PieceType.Defender || p === PieceType.King);
      if (!isWhite) continue;
      for (const d of dirs) {
        let nr = r + d[0];
        let nc = c + d[1];
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
          if (canLandOnThrone(board, p, nr, nc)) {
            const nb = simulateMove(board, { from: { r, c }, to: { r: nr, c: nc } });
            if (kingKillers(nb).length === 0) {
              safe.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
          }
          nr += d[0];
          nc += d[1];
        }
      }
    }
  }
  return safe;
}

// 从安全走法中选 minimax 最优（白方 min 取最低分）
function bestSafeMove(board, moves) {
  const boardCopy = cloneBoard(board);
  let best = null;
  let bestScore = INF;
  for (const move of moves) {
    const nextBoard = simulateMove(boardCopy, move);
    const score = minimax(nextBoard, Math.max(1, MAX_DEPTH - 1), -INF, INF, true).score;
    if (score < bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// 躲不开必杀时的降级：选「黑方必杀选项最少」的走法，至少看起来在挣扎/逃跑
function leastThreatMove(board) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let best = null;
  let bestKillCount = Infinity;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      const isWhite = (p === PieceType.Defender || p === PieceType.King);
      if (!isWhite) continue;
      for (const d of dirs) {
        let nr = r + d[0];
        let nc = c + d[1];
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] !== PieceType.None || isThrone(nr, nc)) break;
          if (canLandOnThrone(board, p, nr, nc)) {
            const nb = simulateMove(board, { from: { r, c }, to: { r: nr, c: nc } });
            const kc = kingKillers(nb).length;
            if (kc < bestKillCount) {
              bestKillCount = kc;
              best = { from: { r, c }, to: { r: nr, c: nc } };
            }
          }
          nr += d[0];
          nc += d[1];
        }
      }
    }
  }
  return best;
}

// 主入口：迭代加深 + 限时搜索，返回一步（同分走法随机，避免对局一成不变）
function getBestMove(board, turn) {
  const boardCopy = cloneBoard(board);
  const isMaximizing = turn === PieceType.Attacker;

  // 黑方回合优先级：击杀国王 > 堵住逃路 > 正常搜索
  if (turn === PieceType.Attacker) {
    const killers = kingKillers(boardCopy);
    if (killers.length > 0) {
      return bestKillerMove(boardCopy, killers);
    }
    const blockers = kingBlockers(boardCopy);
    if (blockers.length > 0) {
      return bestBlockMove(boardCopy, blockers);
    }
  }

  // 白方回合优先级：一步逃边获胜 > 躲开必杀 > 正常搜索
  if (turn === PieceType.Defender) {
    const wins = kingWinMoves(boardCopy);
    if (wins.length > 0) {
      return wins[Math.floor(Math.random() * wins.length)];
    }
    if (kingKillers(boardCopy).length > 0) {
      const safe = safeMoves(boardCopy);
      if (safe.length > 0) {
        return bestSafeMove(boardCopy, safe);
      }
      // 躲不开必杀：至少选黑方必杀选项最少的走法（尽力挣扎）
      const least = leastThreatMove(boardCopy);
      if (least) return least;
    }
  }

  searchStart = Date.now();
  let bestMove = null;
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const result = minimax(boardCopy, depth, -INF, INF, isMaximizing);
    if (result.timedOut) break; // 超时，用上一层的完整结果
    if (result.move) bestMove = result.move;
    if (Date.now() - searchStart > searchLimit) break;
  }
  return bestMove;
}

// isMaximizing: true 代表黑方(Attacker)想赢，false 代表白方(Defender)想赢
function minimax(board, depth, alpha, beta, isMaximizing) {
  // 时间软中断：超时立刻返回，由上层捕获并停止加深
  if (Date.now() - searchStart > searchLimit) {
    return { score: 0, move: null, timedOut: true };
  }
  const win = checkWin(board);
  if (win !== 0) {
    // 让 AI 偏好「更快获胜」：离根越近检测到的胜负，|分值|越大
    return { score: win > 0 ? win + depth : win - depth, move: null };
  }
  if (depth === 0) return { score: evaluate(board), move: null };

  const side = isMaximizing ? PieceType.Attacker : PieceType.Defender;
  const moves = getAllLegalMoves(board, side);

  if (moves.length === 0) {
    return { score: isMaximizing ? -MATE : MATE, move: null };
  }

  let bestMove = null;

  if (isMaximizing) {
    let maxEval = -INF;
    for (const move of moves) {
      const nextBoard = simulateMove(board, move);
      const child = minimax(nextBoard, depth - 1, alpha, beta, false);
      if (child.timedOut) return { score: 0, move: null, timedOut: true };
      const evalVal = child.score;
      if (evalVal > maxEval || (evalVal === maxEval && Math.random() < 0.5)) {
        maxEval = evalVal;
        bestMove = move;
      }
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = INF;
    for (const move of moves) {
      const nextBoard = simulateMove(board, move);
      const child = minimax(nextBoard, depth - 1, alpha, beta, true);
      if (child.timedOut) return { score: 0, move: null, timedOut: true };
      const evalVal = child.score;
      if (evalVal < minEval || (evalVal === minEval && Math.random() < 0.5)) {
        minEval = evalVal;
        bestMove = move;
      }
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

// 估值函数：正分利于黑方，负分利于白方
// 核心认知：Tablut 棋子走直线，国王在中心只要路径畅通，也能一步直达边缘获胜
// 所以「路径通不通」比「离边缘几格」重要得多——用逃路评估做主心骨
function evaluate(board) {
  let score = 0;
  let kingPos = { r: 4, c: 4 };
  let blackCount = 0;
  let whiteCount = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p === PieceType.Attacker) blackCount++;
      if (p === PieceType.Defender) whiteCount++;
      if (p === PieceType.King) kingPos = { r, c };
    }
  }

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  // 1. 国王逃路评估（主心骨）：四个方向能否畅通直达边缘（国王一步可到边缘 = 白方随时能赢）
  for (const d of dirs) {
    let nr = kingPos.r + d[0];
    let nc = kingPos.c + d[1];
    let blockedBy = 0; // 0=畅通直达边缘, 1=黑子堵, 2=白子堵/王座
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] !== PieceType.None) {
        blockedBy = (board[nr][nc] === PieceType.Attacker) ? 1 : 2;
        break;
      }
      if (isThrone(nr, nc)) { blockedBy = 2; break; } // 王座是障碍
      nr += d[0];
      nc += d[1];
    }
    if (blockedBy === 0) score -= 120;      // 逃路畅通直达边缘：白方随时一步赢
    else if (blockedBy === 1) score += 40;  // 黑子堵路：黑方好
    else score += 20;                       // 白子堵路/王座挡路：白方被自己人挡路会误事，黑方得利
  }

  // 2. 国王被击杀威胁：四邻黑子数 + 夹击格局（黑子+黑子 / 黑子+空王座）
  let kingThreat = 0;
  let kingFork = 0;
  for (const d of dirs) {
    const nr = kingPos.r + d[0];
    const nc = kingPos.c + d[1];
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] === PieceType.Attacker) {
        kingThreat++;
        const fr = kingPos.r + d[0] * 2;
        const fc = kingPos.c + d[1] * 2;
        if (fr >= 0 && fr < SIZE && fc >= 0 && fc < SIZE) {
          if (board[fr][fc] === PieceType.Attacker) kingFork++;
          else if (isThrone(fr, fc) && board[fr][fc] === PieceType.None) kingFork++;
        }
      }
    }
  }
  score += kingFork * 80;   // 国王被夹住：极危险，黑方大优
  score += kingThreat * 15; // 四邻黑子：威胁基础

  // 3. 子力安全：统计双方普通棋子中处于「被夹击威胁」的数量
  let blackThreat = 0;
  let whiteThreat = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p !== PieceType.Attacker && p !== PieceType.Defender) continue;
      const isBlack = (p === PieceType.Attacker);
      let threatened = false;
      for (const d of dirs) {
        const nr = r + d[0], nc = c + d[1];
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        const adj = board[nr][nc];
        const adjEnemy = isBlack ? (adj === PieceType.Defender || adj === PieceType.King) : (adj === PieceType.Attacker);
        if (!adjEnemy) continue;
        const fr = r + d[0] * 2, fc = c + d[1] * 2;
        if (fr < 0 || fr >= SIZE || fc < 0 || fc >= SIZE) continue;
        const far = board[fr][fc];
        const farEnemy = isBlack ? (far === PieceType.Defender || far === PieceType.King) : (far === PieceType.Attacker);
        if (farEnemy || (isThrone(fr, fc) && far === PieceType.None)) {
          threatened = true;
          break;
        }
      }
      if (threatened) {
        if (isBlack) blackThreat++;
        else whiteThreat++;
      }
    }
  }
  score += (whiteThreat - blackThreat) * 25;

  // 4. 兵力差（白兵略贵重，因为要保护国王）
  score += (blackCount - whiteCount * 1.5) * 10;

  // 5. 黑子逼近国王：黑子离国王越近越利于黑方（黑方天然目标就是围杀国王，
  //    否则远离国王的闲子会无方向地乱走，甚至溜到棋盘边上）
  let blackDist = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.Attacker) {
        blackDist += Math.abs(r - kingPos.r) + Math.abs(c - kingPos.c);
      }
    }
  }
  score -= blackDist * 2;

  return score;
}

function getAllLegalMoves(board, side) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      let isMine = false;
      if (side === PieceType.Attacker) isMine = (p === PieceType.Attacker);
      else isMine = (p === PieceType.Defender || p === PieceType.King);

      if (!isMine) continue;

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const d of dirs) {
        let nr = r + d[0];
        let nc = c + d[1];
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] !== PieceType.None) break;
          if (isThrone(nr, nc)) break; // 王座是障碍，不能进入也不能穿过
          if (canLandOnThrone(board, p, nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
          nr += d[0];
          nc += d[1];
        }
      }
    }
  }
  return moves;
}

function simulateMove(board, move) {
  const newBoard = cloneBoard(board);
  const p = newBoard[move.from.r][move.from.c];
  newBoard[move.to.r][move.to.c] = p;
  newBoard[move.from.r][move.from.c] = PieceType.None;
  // 模拟吃子，让 AI 能看到吃子收益
  checkCaptures(newBoard, move.to.r, move.to.c);
  return newBoard;
}

// 国王「双通路必胜」判定：国王站在 ≥2 条畅通直达边缘的逃路上，且黑方无一步击杀
// 依据：黑方一轮只能落一子，最多堵住一条路，另一条必通；无击杀则无法阻止国王逃边
function isKingForcedWin(board) {
  if (kingEscapeDirs(board).length < 2) return false;
  return kingKillers(board).length === 0;
}

function checkWin(board) {
  // 国王被夹击吃掉 -> 黑胜
  let kingFound = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.King) kingFound = true;
    }
  }
  if (!kingFound) return MATE;

  // 国王逃到边缘 -> 白胜
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.King && checkWinCondition(board, r, c) === 'white') return -MATE;
    }
  }

  // 国王在「双通路且无威胁」点：黑方一轮只能堵一条，另一条必通 -> 白方必胜
  if (isKingForcedWin(board)) return -MATE;

  return 0;
}

const api = { getBestMove, MAX_DEPTH };
// 允许外部调整思考时间上限（便于快速批量测试/调试）
Object.defineProperty(api, 'searchLimit', {
  get() { return searchLimit; },
  set(v) { searchLimit = v; }
});
// 允许外部调整搜索深度（游戏内难度按钮用）
Object.defineProperty(api, 'maxDepth', {
  get() { return MAX_DEPTH; },
  set(v) { MAX_DEPTH = v; }
});
module.exports = api;
