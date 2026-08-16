// Tablut AI：Minimax + Alpha-Beta 剪枝（纯数据，从 assets/TablutAI.ts 移植）

const {
  PieceType,
  SIZE,
  cloneBoard,
  canLandOnThrone,
  checkCaptures,
  isKingCaptured,
  checkWinCondition
} = require('./game');

const MAX_DEPTH = 3; // 手机上 2-3 层比较合适，太深会卡
const INF = 100000;

// 主入口：返回最佳一步
function getBestMove(board, turn) {
  const boardCopy = cloneBoard(board);
  const result = minimax(boardCopy, MAX_DEPTH, -INF, INF, turn === PieceType.Attacker);
  return result.move;
}

// isMaximizing: true 代表黑方(Attacker)想赢，false 代表白方(Defender)想赢
function minimax(board, depth, alpha, beta, isMaximizing) {
  const win = checkWin(board);
  if (win !== 0) return { score: win, move: null };
  if (depth === 0) return { score: evaluate(board), move: null };

  const side = isMaximizing ? PieceType.Attacker : PieceType.Defender;
  const moves = getAllLegalMoves(board, side);

  if (moves.length === 0) {
    return { score: isMaximizing ? -INF : INF, move: null };
  }

  let bestMove = null;

  if (isMaximizing) {
    let maxEval = -INF;
    for (const move of moves) {
      const nextBoard = simulateMove(board, move);
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, false).score;
      if (evalVal > maxEval) {
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
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, true).score;
      if (evalVal < minEval) {
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

  // 兵力差（白兵更贵重一点）
  score += (blackCount - whiteCount * 1.5) * 10;

  // 国王到边缘距离（胜负手，权重极高）
  const distToEdge = Math.min(kingPos.r, SIZE - 1 - kingPos.r, kingPos.c, SIZE - 1 - kingPos.c);
  score += distToEdge * 100;

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
          // 王座规则：士兵不能停，国王离开后不能回
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

function checkWin(board) {
  // 国王被夹击吃掉 -> 黑胜
  let kingFound = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.King) kingFound = true;
    }
  }
  if (!kingFound) return INF;

  // 国王逃到边缘 -> 白胜
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === PieceType.King && checkWinCondition(board, r, c) === 'white') return -INF;
    }
  }

  return 0;
}

module.exports = { getBestMove, MAX_DEPTH };
