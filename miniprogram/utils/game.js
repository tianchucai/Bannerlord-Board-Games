// Tablut 游戏核心逻辑（纯数据，不依赖任何渲染层）
// 从 assets/BoardManager.ts 移植

const PieceType = {
  None: 0,
  Attacker: 1, // 黑方（进攻）
  Defender: 2, // 白方（防守）
  King: 3      // 国王
};

const SIZE = 9;
const THRONE = { r: 4, c: 4 };

// 城堡/营寨格：黑方初始站立的位置
const STRONGHOLDS = [
  [0, 3], [0, 4], [0, 5], [1, 4],
  [8, 3], [8, 4], [8, 5], [7, 4],
  [3, 0], [4, 0], [5, 0], [4, 1],
  [3, 8], [4, 8], [5, 8], [4, 7]
];

function isThrone(r, c) {
  return r === THRONE.r && c === THRONE.c;
}

function isStronghold(r, c) {
  return STRONGHOLDS.some(p => p[0] === r && p[1] === c);
}

function createEmptyBoard() {
  const board = [];
  for (let r = 0; r < SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < SIZE; c++) {
      board[r][c] = PieceType.None;
    }
  }
  return board;
}

function setupFormation(board) {
  board[4][4] = PieceType.King;
  // 白方防御者
  [
    [4, 2], [4, 3], [4, 5], [4, 6], [2, 4], [3, 4], [5, 4], [6, 4]
  ].forEach(p => { board[p[0]][p[1]] = PieceType.Defender; });
  // 黑方进攻者
  [
    [0, 3], [0, 4], [0, 5], [1, 4],
    [8, 3], [8, 4], [8, 5], [7, 4],
    [3, 0], [4, 0], [5, 0], [4, 1],
    [3, 8], [4, 8], [5, 8], [4, 7]
  ].forEach(p => { board[p[0]][p[1]] = PieceType.Attacker; });
}

function isValidPos(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function isEnemy(me, target) {
  if (target === PieceType.None) return false;
  if (me === PieceType.Attacker) return target === PieceType.Defender || target === PieceType.King;
  return target === PieceType.Attacker;
}

function isFriend(me, target) {
  if (me === PieceType.Attacker) return target === PieceType.Attacker;
  return target === PieceType.Defender || target === PieceType.King;
}

// 当前回合可操作的棋子类型
function checkSide(type, currentTurn) {
  if (currentTurn === PieceType.Attacker) return type === PieceType.Attacker;
  return type === PieceType.Defender || type === PieceType.King;
}

// 判断某棋子能否停在目标格（王座规则）
// 规则：只有国王能停王座，且国王一旦离开王座就不能再回来
function canLandOnThrone(board, mover, tr, tc) {
  if (!isThrone(tr, tc)) return true;
  if (mover !== PieceType.King) return false; // 士兵不能停王座
  // 国王仍在王座上（即尚未离开）才允许；已离开则不能回
  return board[THRONE.r][THRONE.c] === PieceType.King;
}

// 车走直线，中间不能有子
function isValidMove(board, fr, fc, tr, tc) {
  if (fr !== tr && fc !== tc) return false;
  const mover = board[fr][fc];
  if (!canLandOnThrone(board, mover, tr, tc)) return false;
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  let cr = fr + dr;
  let cc = fc + dc;
  while (cr !== tr || cc !== tc) {
    if (board[cr][cc] !== PieceType.None) return false;
    cr += dr;
    cc += dc;
  }
  return true;
}

// 走棋后检查吃子，就地修改 board，返回被吃掉的棋子列表
function checkCaptures(board, r, c) {
  const directions = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  const myType = board[r][c];
  const captured = [];

  for (const dir of directions) {
    const nr = r + dir[0];
    const nc = c + dir[1];
    const fr = r + dir[0] * 2;
    const fc = c + dir[1] * 2;

    if (!isValidPos(nr, nc)) continue;
    if (!isEnemy(myType, board[nr][nc])) continue;
    if (!isValidPos(fr, fc)) continue;

    let isAnvil = false;
    const farType = board[fr][fc];

    // 夹击条件：远端是友军，或空王座（中心点）当砧板
    if (isFriend(myType, farType)) {
      isAnvil = true;
    } else if (fr === THRONE.r && fc === THRONE.c && farType === PieceType.None) {
      isAnvil = true;
    }

    if (isAnvil) {
      captured.push({ r: nr, c: nc, type: board[nr][nc] });
      board[nr][nc] = PieceType.None;
    }
  }

  return captured;
}

function isKingCaptured(captured) {
  return captured.some(p => p.type === PieceType.King);
}

// 国王逃到边缘即白胜，返回 'white' 或 null
function checkWinCondition(board, r, c) {
  if (board[r][c] === PieceType.King) {
    if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) {
      return 'white';
    }
  }
  return null;
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

module.exports = {
  PieceType,
  SIZE,
  THRONE,
  STRONGHOLDS,
  isThrone,
  isStronghold,
  createEmptyBoard,
  setupFormation,
  isValidPos,
  isEnemy,
  isFriend,
  checkSide,
  isValidMove,
  canLandOnThrone,
  checkCaptures,
  isKingCaptured,
  checkWinCondition,
  cloneBoard
};
