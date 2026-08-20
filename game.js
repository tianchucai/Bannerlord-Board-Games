// 帝国板棋（Tablut）微信小游戏
// 棋规与 AI 复用 utils/game.js 与 utils/ai.js，界面用 Canvas 渲染

const game = require('./utils/game');
const ai = require('./utils/ai');
const sound = require('./utils/sound');
const wsmod = require('./utils/wolf_sheep');
const wsai = require('./utils/wolf_sheep_ai');
const seega = require('./utils/seega');
const seegaAi = require('./utils/seega_ai');
const mutorere = require('./utils/mutorere');
const mutorereAi = require('./utils/mutorere_ai');
const konane = require('./utils/konane');
const konaneAi = require('./utils/konane_ai');
const puluc = require('./utils/puluc');
const pulucAi = require('./utils/puluc_ai');

const PieceType = game.PieceType;
const SIZE = game.SIZE;

// ---------- 屏幕 ----------
let winInfo;
try {
  winInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (e) {
  winInfo = wx.getSystemInfoSync();
}
const W = winInfo.windowWidth;
const H = winInfo.windowHeight;
const DPR = winInfo.pixelRatio || 1;
const SAFE_TOP = (winInfo.safeArea && winInfo.safeArea.top) || (winInfo.statusBarHeight || 24);

const canvas = wx.createCanvas();
canvas.width = W * DPR;
canvas.height = H * DPR;
const ctx = canvas.getContext('2d');
ctx.scale(DPR, DPR);

// ---------- 配色 ----------
const C = {
  bg: '#3d2310',
  boardBg: '#d9b382',
  cell: '#c79a66',
  throne: '#8a5a2b',
  stronghold: '#b98950',
  attacker: '#222222',
  defender: '#f5f5f5',
  king: '#f0c060',
  gold: '#f0c060',
  text: '#eeeeee',
  dim: '#cccccc',
  parchment: '#f5e6c8',
  parchmentText: '#5a3e1a',
  parchmentTitle: '#6b4a1f',
  overlay: 'rgba(0,0,0,0.6)'
};

// ---------- 布局 ----------
const MARGIN = 10;
const TITLE_H = 40;
const STATUS_H = 30;
const BTN_H = 42;
const BTN_GAP = 10;
const BTN_AREA_H = BTN_H * 3 + BTN_GAP * 2 + 18;

// ---------- 主菜单：骑砍二酒馆六种棋局 ----------
const GAMES = [
  { id: 1, name: '古典象棋', origin: '萨米板棋' },
  { id: 2, name: '狼羊棋', origin: '尼泊尔虎棋' },
  { id: 3, name: '施嘉', origin: '埃及夹棋' },
  { id: 4, name: '舞棋', origin: '毛利星盘棋' },
  { id: 5, name: '跳棋', origin: '夏威夷跳棋' },
  { id: 6, name: '普鲁克', origin: '玛雅折返戏' }
];
GAMES.forEach(g => { g.full = g.name + '（' + g.origin + '）'; });

// ---------- 主菜单状态 ----------
let showMenu = true;       // 主菜单显示状态
let menuTip = '';          // 菜单底部提示文字
let menuTipTimer = null;   // 提示定时器
let menuButtons = [];      // 主菜单按钮 { gameId, x, y, w, h }

const layout = {};
function computeLayout() {
  const avail = H - SAFE_TOP - TITLE_H - STATUS_H - BTN_AREA_H - 24;
  layout.boardSize = Math.max(200, Math.min(W - MARGIN * 2, avail));
  layout.boardX = (W - layout.boardSize) / 2;
  layout.boardY = SAFE_TOP + TITLE_H + STATUS_H;
  layout.cell = layout.boardSize / SIZE;
  layout.btnY1 = layout.boardY + layout.boardSize + 16;
  layout.btnY2 = layout.btnY1 + BTN_H + BTN_GAP;
  layout.btnY3 = layout.btnY2 + BTN_H + BTN_GAP;
}
computeLayout();
computeMenuLayout();

// 狼羊棋布局：5×5 点阵棋盘（点间距 cell，5 点 4 段）
function computeWsLayout() {
  const availH = H - SAFE_TOP - TITLE_H - STATUS_H - BTN_AREA_H - 30;
  const cell = Math.floor(Math.min((W - 60) / 4, availH / 4));
  wsLayout.cell = cell;
  wsLayout.bx = (W - cell * 4) / 2;
  wsLayout.by = SAFE_TOP + TITLE_H + STATUS_H + 10;
}

// 狼羊棋底部按钮：执狼/执羊 toggle + 重新开始 + 规则
function buildWsButtons() {
  const margin = 16;
  const gap = 10;
  const usableW = W - margin * 2;
  const toggleW = Math.min(220, usableW);
  const row2W = (usableW - gap) / 2;
  const y1 = wsLayout.by + wsLayout.cell * 4 + 16;
  const y2 = y1 + BTN_H + gap;
  wsButtons = [
    { id: 'ws-toggle', x: (W - toggleW) / 2, y: y1, w: toggleW, h: BTN_H },
    { id: 'ws-restart', text: '重新开始', x: margin, y: y2, w: row2W, h: BTN_H },
    { id: 'ws-rules', text: '规则', x: margin + row2W + gap, y: y2, w: row2W, h: BTN_H }
  ];
}

// 主菜单按钮布局：两列三行
function computeMenuLayout() {
  const margin = 24;
  const gap = 14;
  const btnW = (W - margin * 2 - gap) / 2;
  const btnH = 58;
  const rowGap = 16;
  const startY = SAFE_TOP + 170;
  menuButtons = GAMES.map((g, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    return {
      gameId: g.id,
      x: margin + col * (btnW + gap),
      y: startY + row * (btnH + rowGap),
      w: btnW,
      h: btnH
    };
  });
}

// ---------- 固定按钮 ----------
function buildButtons() {
  const gap = 6;
  const margin = 16;
  const usableW = W - margin * 2;
  const row2W = (usableW - gap * 2) / 3;
  const row3W = (usableW - gap * 2) / 3;
  const toggleW = Math.min(230, usableW - 40);
  return [
    // 第一行：执黑/执白 拨动滑块
    { id: 'side-toggle', type: 'toggle', x: (W - toggleW) / 2, y: layout.btnY1, w: toggleW, h: BTN_H },
    // 第二行：操作
    { id: 'restart', text: '重新开始', x: margin, y: layout.btnY2, w: row2W, h: BTN_H },
    { id: 'rules', text: '规则', x: margin + row2W + gap, y: layout.btnY2, w: row2W, h: BTN_H },
    { id: 'log', text: '日志', x: margin + (row2W + gap) * 2, y: layout.btnY2, w: row2W, h: BTN_H },
    // 第三行：难度
    { id: 'diff1', text: '简单', x: margin, y: layout.btnY3, w: row3W, h: BTN_H },
    { id: 'diff2', text: '普通', x: margin + row3W + gap, y: layout.btnY3, w: row3W, h: BTN_H },
    { id: 'diff3', text: '困难', x: margin + (row3W + gap) * 2, y: layout.btnY3, w: row3W, h: BTN_H }
  ];
}
const buttons = buildButtons();

// ---------- 游戏状态 ----------
let board;
let currentTurn;
let selected;       // { r, c } 或 null
let gameMode;       // 1: 玩家执黑, 2: 玩家执白, 3: AI 对战
let difficulty = 2; // 1: 简单, 2: 普通, 3: 困难
let toggleAnim = null; // 滑块胶囊滑动动画
const DIFF_DEPTH = { 1: 1, 2: 2, 3: 3 }; // 三档难度对应的 AI 搜索深度
let isGameOver;
let winnerText;
let isThinking;
let moveLog;        // 字符串数组
let moveCount;
let showRules;
let showLog;
let modalButtons = []; // 弹窗内按钮，用于命中检测
let copyTip = '';      // 复制操作的反馈文字
let anim = null;       // 棋子移动动画状态
let animFrame = null;  // requestAnimationFrame 句柄
let movableCells = []; // 当前选中棋子的可走格子

const LOG_KEY = 'tablut_last_log';

// ---------- 狼羊棋状态（Bagh-Chal）----------
let wsActive = false;    // 狼羊棋页面激活
let ws = null;           // 对局状态 { board, turn, phase, placed, captured }
let wsSide = 2;          // 1=玩家执狼, 2=玩家执羊
let wsSelected = null;   // 选中的点 { r, c }
let wsMoves = [];        // 当前选中棋子的合法目标
let wsGameOver = false;
let wsWinner = '';
let wsThinking = false;
let wsMoveCount = 0;
let wsShowRules = false;
let wsModalButtons = []; // 狼羊棋弹窗按钮
let wsLayout = { bx: 0, by: 0, cell: 60 };
let wsButtons = [];      // 狼羊棋底部按钮

const WS_RULES = [
  '狼羊棋（尼泊尔虎棋 Bagh-Chal）：5×5 棋盘，狼(虎) 4 只 vs 羊 20 只。',
  '羊先手：先把 20 只羊逐一放到棋盘空点上，放完后改为走棋（沿连线走一格）。',
  '狼每回合走一格到相邻空点；或跳过相邻的羊到正后方空点，吃掉被跳的羊（可斜跳）。',
  '狼获胜：吃掉 5 只羊。',
  '羊获胜：困住 4 只狼，使狼无法走格也无法跳吃。'
];

// ---------- 四款新棋（施嘉/舞棋/跳棋/普鲁克）通用状态 ----------
const GG_MODS = {
  seega: { name: '施嘉', mod: seega, rules: [
    '施嘉（Seega 埃及夹棋）：5×5 棋盘，中央十字（中心+上下左右）开局为空且禁止放置。',
    '双方各 12 子，先轮流把子放到非中央十字的空位，放完 12 子后改为移动（水平/垂直一格）。',
    '移动后，凡被己方水平或垂直夹住的敌子全部被吃；中央十字格上的棋子受保护不可被吃。',
    '吃光对方全部棋子，或对方无合法移动者获胜。'
  ]},
  mutorere: { name: '舞棋', mod: mutorere, rules: [
    '舞棋（Mū tōrere 毛利星盘棋）：8 个外围点环形 + 1 个中心点。',
    '双方各 4 子，开局交替占据外围 8 点，中心空。',
    '外围子可移到相邻外围空点，或移入中心（空时）。',
    '中心子只能移到「两侧外围点都被占据」的外围空点。',
    '无吃子；轮到某方无合法移动即败。'
  ]},
  konane: { name: '跳棋', mod: konane, rules: [
    '跳棋（Kōnane 夏威夷跳棋）：8×8 棋盘，开局黑白交替填满。',
    '开局黑方移除中心一子，白方再移除相邻一子，然后黑方先跳。',
    '只能跳跃吃子：跳过相邻的敌子到正后方空位（四方向），可连续跳且必须跳到不能再跳。',
    '轮到某方无合法跳即败。'
  ]},
  puluc: { name: '普鲁克', mod: puluc, rules: [
    '普鲁克（Puluc 玛雅折返戏）：一条 11 格道路，双方各 6 枚棋子从两端出发。',
    '掷骰：投掷 4 根双色棍，红面数即步数；0 红（全白）=5 步。',
    '棋子向对手大本营前进，到达最后一格后折返，向自己本垒返回。',
    '俘虏：落点有对方棋子时，对方整个堆叠被俘、叠在己方棋子下面，且该堆叠必须掉头往回走（不能再前进）。',
    '返回本垒：堆叠落在自己本垒时，己方棋子可重新使用，被俘敌子被淘汰出局。',
    '同色棋子不能叠同一格；对方无可用棋子即获胜。'
  ]}
};

let gActive = null;   // 'seega'|'mutorere'|'konane'|'puluc'
let gState = null;    // 当前游戏状态（模块格式）
let gTurn = null;     // 当前行动方
let gSide = 1;        // 玩家执 1(黑/先手) 或 2(白/后手)
let gSel = null;      // 选中
let gMoves = [];      // 候选走法
let gOver = false;
let gWinner = '';
let gThink = false;
let gCount = 0;
let gShowRules = false;
let gShowLog = false;
let gLog = [];       // 行棋日志（字符串数组）
let gLogTip = '';    // 日志复制反馈
let gModal = [];
let gPulucRoll = -1;  // 普鲁克当前掷出的步数（-1 待掷）
let gPulucPhase = 'roll'; // 'roll' 待掷 / 'anim' 掷棍动画中 / 'move' 选子移动
let gStickAnim = null;  // 掷棍动画 { start, dur, result }
let gPulucAnim = null;  // 棋子移动动画 { fromY, toY, pieces, side, fromPos, start, dur, onDone }
let gLayout = { bx: 0, by: 0, cell: 40, r: 120, cx: 0, cy: 0, road: 44 };

const RULES = [
  '黑方 16 枚进攻子，白方 8 枚防御子加 1 枚国王。',
  '所有棋子沿直线移动，不可跳过其它棋子。',
  '只有国王能停在中央王座，士兵只能路过；国王一旦离开王座，就不能再回来。',
  '吃子：移动后，把敌方棋子夹在己方棋子与另一侧（己方棋子或空王座）之间，即可吃掉。',
  '所有棋子（包括国王）都按夹击方式吃子。',
  '白方胜利：国王抵达棋盘边缘。',
  '黑方胜利：国王被夹击吃掉。'
];

function pieceName(t) {
  if (t === PieceType.Attacker) return '黑';
  if (t === PieceType.Defender) return '白';
  if (t === PieceType.King) return '王';
  return '空';
}

function sideName(t) {
  return t === PieceType.Attacker ? '黑' : '白';
}

function pos(r, c) {
  return '(' + r + ',' + c + ')';
}

function logLine(text) {
  moveLog.push(text);
  try {
    wx.setStorageSync(LOG_KEY, moveLog.join('\n'));
  } catch (e) {}
}

function startGame() {
  showMenu = false; // 从主菜单进入对局
  board = game.createEmptyBoard();
  game.setupFormation(board);
  currentTurn = PieceType.Attacker;
  selected = null;
  movableCells = []; // 清掉选中棋子的可走格标注，防止重开后残留
  moveLog = [];
  moveCount = 0;
  isGameOver = false;
  winnerText = '';
  isThinking = false;
  showRules = false;
  showLog = false;
  anim = null;
  if (animFrame != null) { cancelAnimationFrame(animFrame); animFrame = null; }
  const modeLabel = gameMode === 1 ? '玩家执黑' : (gameMode === 2 ? '玩家执白' : 'AI 对战');
  logLine('===== 新对局开始（' + modeLabel + '）=====');
  checkAiTurn();
  draw();
}

// 返回主菜单
function backToMenu() {
  showMenu = true;
  wsActive = false;
  gActive = null;
  isThinking = false;
  wsThinking = false;
  gThink = false;
  gStickAnim = null;
  gPulucAnim = null;
  selected = null;
  movableCells = [];
  anim = null;
  if (animFrame != null) { cancelAnimationFrame(animFrame); animFrame = null; }
  draw();
}

function switchTurn() {
  currentTurn = (currentTurn === PieceType.Attacker) ? PieceType.Defender : PieceType.Attacker;
  checkAiTurn();
}

function checkAiTurn() {
  let isAiTurn = false;
  if (gameMode === 1 && currentTurn === PieceType.Defender) isAiTurn = true;
  if (gameMode === 2 && currentTurn === PieceType.Attacker) isAiTurn = true;
  if (gameMode === 3) isAiTurn = true; // AI 对战：双方都是 AI

  if (isAiTurn && !isGameOver) {
    isThinking = true;
    draw();
    setTimeout(() => executeAiMove(), gameMode === 3 ? 200 : 350);
  } else {
    isThinking = false;
  }
}

function executeAiMove() {
  if (showMenu || isGameOver) return; // 已返回菜单/对局结束则忽略残留定时器
  const bestMove = ai.getBestMove(board, currentTurn);
  if (bestMove) {
    movePiece(bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
  } else {
    showGameOver(currentTurn === PieceType.Attacker ? '白方胜利！' : '黑方胜利！');
    draw();
  }
}

function movePiece(fromR, fromC, toR, toC) {
  const type = board[fromR][fromC];
  const mover = pieceName(type);
  board[toR][toC] = type;
  board[fromR][fromC] = PieceType.None;
  selected = null;
  movableCells = [];

  const captured = game.checkCaptures(board, toR, toC);

  // 音效：吃子用更脆的"啪"，普通落子用"嗒"
  if (captured.length > 0) sound.playCapture();
  else sound.playMove();

  moveCount += 1;
  let line = moveCount + '. ' + sideName(type) + '[' + mover + '] ' +
    pos(fromR, fromC) + ' → ' + pos(toR, toC);
  if (captured.length > 0) {
    line += '　吃：' + captured.map(p => pieceName(p.type) + pos(p.r, p.c)).join('、');
  }
  logLine(line);

  // 先播放移动动画，动画结束后再做胜负判定与回合切换
  startAnim(type, fromR, fromC, toR, toC, function () {
    if (game.isKingCaptured(captured)) {
      showGameOver('黑方胜利！');
    } else if (game.checkWinCondition(board, toR, toC) === 'white') {
      showGameOver('白方胜利！');
    } else if (moveCount >= 200) {
      showGameOver('平局（步数上限）', true);
    } else {
      switchTurn();
    }
    draw();
  });
}

function showGameOver(msg, isDraw) {
  isGameOver = true;
  winnerText = msg;
  selected = null;
  isThinking = false;
  if (!isDraw) sound.playWin();
  logLine('===== 对局结束：' + msg + ' =====');
}

function onCellTap(r, c) {
  if (isGameOver || isThinking || anim) return;
  if (gameMode === 3) return; // AI 对战模式，玩家不操作
  if (gameMode === 1 && currentTurn === PieceType.Defender) return;
  if (gameMode === 2 && currentTurn === PieceType.Attacker) return;

  const clickedType = board[r][c];
  const isSameSide = game.checkSide(clickedType, currentTurn);

  if (!selected) {
    if (clickedType !== PieceType.None && isSameSide) {
      selected = { r, c };
      movableCells = game.getPieceMoves(board, r, c);
    }
    draw();
    return;
  }

  if (r === selected.r && c === selected.c) {
    selected = null;
    movableCells = [];
    draw();
    return;
  }

  if (clickedType !== PieceType.None && isSameSide) {
    selected = { r, c };
    movableCells = game.getPieceMoves(board, r, c);
    draw();
    return;
  }

  if (clickedType === PieceType.None) {
    if (game.isValidMove(board, selected.r, selected.c, r, c)) {
      movePiece(selected.r, selected.c, r, c);
    }
    draw();
  }
}

function changeMode(mode) {
  if (mode === gameMode) return;
  toggleAnim = { from: gameMode, to: mode, start: Date.now() };
  gameMode = mode;
  startGame();
  animateToggle();
}

function changeDifficulty(d) {
  difficulty = d;
  ai.maxDepth = DIFF_DEPTH[d]; // 三档对应搜索深度 1/2/3
  startGame();
}

// ================= 狼羊棋 =================

// 从主菜单进入狼羊棋
function enterWolfSheep() {
  wsActive = true;
  showMenu = false;
  startWsGame();
}

// 开新一局（保留执狼/执羊设置）
function startWsGame() {
  ws = {
    board: wsmod.setup(),
    turn: wsmod.PIECE.Sheep, // 羊先手
    phase: 'place',           // 'place' 放置阶段 / 'move' 移动阶段
    placed: 0,
    captured: 0
  };
  wsSelected = null;
  wsMoves = [];
  wsGameOver = false;
  wsWinner = '';
  wsThinking = false;
  wsMoveCount = 0;
  wsShowRules = false;
  checkWsAiTurn();
  draw();
}

// 回合切换 + AI 触发
function switchWsTurn() {
  ws.turn = (ws.turn === wsmod.PIECE.Wolf) ? wsmod.PIECE.Sheep : wsmod.PIECE.Wolf;
  // 羊放满 20 只后自动从放置转入移动
  if (ws.turn === wsmod.PIECE.Sheep && ws.phase === 'place' && ws.placed >= wsmod.SHEEP_TOTAL) {
    ws.phase = 'move';
  }
  checkWsAiTurn();
}

function checkWsAiTurn() {
  if (wsGameOver || !ws) return;
  let isAi = false;
  if (wsSide === 1 && ws.turn === wsmod.PIECE.Sheep) isAi = true; // 玩家执狼，AI 执羊
  if (wsSide === 2 && ws.turn === wsmod.PIECE.Wolf) isAi = true;  // 玩家执羊，AI 执狼
  if (isAi) {
    wsThinking = true;
    draw();
    setTimeout(() => executeWsAiMove(), 350);
  } else {
    wsThinking = false;
  }
}

function executeWsAiMove() {
  if (!ws || wsGameOver || showMenu || !wsActive) return;
  let move = null;
  if (ws.turn === wsmod.PIECE.Wolf) move = wsai.wolfAiMove(ws.board);
  else move = wsai.sheepAiMove(ws.board, ws.placed);
  if (move) {
    applyWsMove(move);
  } else {
    // 无棋可走：对方胜
    wsGameOver = true;
    wsWinner = (ws.turn === wsmod.PIECE.Wolf) ? '羊方胜利！' : '狼方胜利！';
    sound.playWin();
    draw();
  }
}

function applyWsMove(move) {
  const res = wsmod.applyMove(ws.board, move);
  ws.board = res.board;
  if (move.place) ws.placed++;
  ws.captured += res.captured;
  wsMoveCount++;
  wsSelected = null;
  wsMoves = [];

  // 音效：跳吃更脆，其余落子/放子用"嗒"
  if (res.captured > 0) sound.playCapture();
  else sound.playMove();

  const win = wsmod.checkWin(ws.board, ws.captured);
  if (win === 'wolf') {
    wsGameOver = true; wsWinner = '狼方胜利！'; sound.playWin();
  } else if (win === 'sheep') {
    wsGameOver = true; wsWinner = '羊方胜利！'; sound.playWin();
  } else if (wsMoveCount >= wsmod.MAX_MOVES) {
    wsGameOver = true; wsWinner = '平局（步数上限）';
  } else {
    switchWsTurn();
  }
  draw();
}

// 玩家触摸狼羊棋棋盘（r, c 为 0..4 点阵坐标）
function onWsTap(r, c) {
  if (wsGameOver || wsThinking || !ws) return;
  const isWolfTurn = ws.turn === wsmod.PIECE.Wolf;
  const playerWolf = wsSide === 1;

  // 玩家执狼回合：选狼 → 走格/跳吃
  if (isWolfTurn && playerWolf) {
    if (!wsSelected) {
      if (ws.board[r][c] === wsmod.PIECE.Wolf) {
        wsSelected = { r, c };
        wsMoves = wsmod.wolfMoves(ws.board).filter(m => m.from.r === r && m.from.c === c);
      }
    } else if (r === wsSelected.r && c === wsSelected.c) {
      wsSelected = null; wsMoves = [];
    } else if (ws.board[r][c] === wsmod.PIECE.Wolf) {
      wsSelected = { r, c };
      wsMoves = wsmod.wolfMoves(ws.board).filter(m => m.from.r === r && m.from.c === c);
    } else {
      const mv = wsMoves.find(m => m.to.r === r && m.to.c === c);
      if (mv) applyWsMove(mv);
      else { wsSelected = null; wsMoves = []; }
    }
    draw();
    return;
  }

  // 玩家执羊回合
  if (!isWolfTurn && !playerWolf) {
    // 放置阶段：点空点放羊
    if (ws.phase === 'place') {
      if (ws.board[r][c] === wsmod.PIECE.None) {
        applyWsMove({ place: { r, c } });
      }
      draw();
      return;
    }
    // 移动阶段：选羊 → 走一格
    if (!wsSelected) {
      if (ws.board[r][c] === wsmod.PIECE.Sheep) {
        wsSelected = { r, c };
        wsMoves = wsmod.sheepMoves(ws.board).filter(m => m.from.r === r && m.from.c === c);
      }
    } else if (r === wsSelected.r && c === wsSelected.c) {
      wsSelected = null; wsMoves = [];
    } else if (ws.board[r][c] === wsmod.PIECE.Sheep) {
      wsSelected = { r, c };
      wsMoves = wsmod.sheepMoves(ws.board).filter(m => m.from.r === r && m.from.c === c);
    } else {
      const mv = wsMoves.find(m => m.to.r === r && m.to.c === c);
      if (mv) applyWsMove(mv);
      else { wsSelected = null; wsMoves = []; }
    }
    draw();
    return;
  }
}

// ================= 四款新棋通用页 =================

// 布局：各游戏棋盘参数
function computeGgLayout() {
  const availH = H - SAFE_TOP - TITLE_H - STATUS_H - BTN_AREA_H - 30;
  const size = Math.max(180, Math.min(W - 60, availH));
  gLayout.size = size;
  gLayout.bx = (W - size) / 2;
  gLayout.by = SAFE_TOP + TITLE_H + STATUS_H + 10;
  gLayout.cell = size / 8; // 8×8（跳棋）用满；5×5（施嘉）按需缩放
  gLayout.cx = W / 2;
  gLayout.cy = gLayout.by + size / 2;
  gLayout.r = size / 2 - 10; // 舞棋星盘半径
  // 普鲁克竖版：上下两端家区 + 中间 11 格纵向道路（格宽大幅加宽，棋子一行排开）
  gLayout.homeH = 46;
  gLayout.pulucRoad = Math.max(20, Math.min(34, Math.floor((H - SAFE_TOP - TITLE_H - STATUS_H - BTN_AREA_H - gLayout.homeH * 2 - 110) / 11)));
  gLayout.pulucW = Math.min(180, W - 48); // 格宽：横向 2.5 倍（约 180px）
  gLayout.pulucX = (W - gLayout.pulucW) / 2;
  gLayout.pulucY = SAFE_TOP + TITLE_H + STATUS_H + 8;
}

// 进入某款棋（id: 3-6 对应 GAMES）
function enterGG(id) {
  gActive = id;
  showMenu = false;
  startGG();
}

// 开新一局
function startGG() {
  const mod = GG_MODS[gActive].mod;
  if (gActive === 'seega') {
    gState = { board: seega.setup(), phase: 'place', placed: { 1: 0, 2: 0 } };
    gTurn = seega.PIECE.Black;
  } else if (gActive === 'mutorere') {
    gState = mutorere.setup();
    gTurn = mutorere.PIECE.Black;
  } else if (gActive === 'konane') {
    gState = konane.setup();
    gTurn = konane.PIECE.Black;
  } else if (gActive === 'puluc') {
    gState = puluc.createState();
    gTurn = puluc.PIECE.Black;
    gPulucRoll = -1;      // 等待玩家/AI 掷棍
    gPulucPhase = 'roll';
  }
  gSel = null;
  gMoves = [];
  if (gActive === 'puluc') gMoves = [];
  gOver = false;
  gWinner = '';
  gThink = false;
  gCount = 0;
  gShowRules = false;
  gShowLog = false;
  gLog = [];
  gLogTip = '';
  gStickAnim = null;
  gPulucAnim = null;
  ggCheckAi();
  draw();
}

// 各游戏 AI 走法
function ggAiMove() {
  if (gActive === 'seega') return seegaAi.aiMove(gState.board, gTurn, gState.phase);
  if (gActive === 'mutorere') return mutorereAi.aiMove(gState, gTurn);
  if (gActive === 'konane') return konaneAi.aiMove(gState, gTurn);
  if (gActive === 'puluc') {
    if (gPulucRoll < 0) gPulucRoll = puluc.roll();
    return pulucAi.aiMove(gState, gTurn, gPulucRoll);
  }
  return null;
}

// 胜负判定
function ggCheckWin() {
  if (gActive === 'seega') return seega.checkWin(gState.board, gTurn, gState.phase);
  if (gActive === 'mutorere') return mutorere.checkWin(gState, gTurn);
  if (gActive === 'konane') return konane.checkWin(gState, gTurn);
  if (gActive === 'puluc') return puluc.checkWin(gState);
  return null;
}

// 应用走法（返回 { captured }）
function ggApply(move) {
  let captured = 0;
  if (gActive === 'seega') {
    const res = seega.applyMove(gState.board, move, gTurn);
    gState.board = res.board;
    captured = res.captured;
    if (move.place) {
      gState.placed[gTurn]++;
      gLog.push((gCount + 1) + '. ' + (gTurn === 1 ? '黑' : '白') + ' 放置(' + move.place.r + ',' + move.place.c + ')');
    } else {
      gLog.push((gCount + 1) + '. ' + (gTurn === 1 ? '黑' : '白') + ' (' + move.from.r + ',' + move.from.c + ')→(' + move.to.r + ',' + move.to.c + ')' + (res.captured > 0 ? ' 吃' + res.captured : ''));
    }
    if (gState.placed[1] >= 12 && gState.placed[2] >= 12) gState.phase = 'move';
  } else if (gActive === 'mutorere') {
    gState = mutorere.applyMove(gState, move);
    const nm = (i) => i === mutorere.CENTER ? '中心' : '点' + i;
    gLog.push((gCount + 1) + '. ' + (gTurn === 1 ? '黑' : '白') + ' ' + nm(move.from) + '→' + nm(move.to));
  } else if (gActive === 'konane') {
    gState = konane.applyMove(gState, move);
    captured = move.captures;
    gLog.push((gCount + 1) + '. ' + (gTurn === 1 ? '黑' : '白') + ' (' + move.from.r + ',' + move.from.c + ')→(' + move.to.r + ',' + move.to.c + ') 吃' + move.captures);
  } else if (gActive === 'puluc') {
    // 移动动画：堆叠从起点滑到落点（或家区），动画结束后应用状态并切换回合
    // 顺序关键：动画参数必须用「移动前」的 dir 计算——applyMove 浅拷贝共享格子对象，
    // 俘虏/远端折返时会原地翻转 dir，若先 applyMove 再取 dir，动画会朝反方向滑（抽动）。
    const road = gLayout.pulucRoad, homeH = gLayout.homeH, y0 = gLayout.pulucY;
    const homeY = (gTurn === 1) ? y0 + homeH / 2 : y0 + homeH + puluc.CELLS * road + homeH / 2;
    const fromCell = (move.kind === 'enter') ? null : gState.cells[move.pos];
    const pieces = move.kind === 'enter' ? [gTurn] : (fromCell ? fromCell.captives.slice().concat([fromCell.side]) : [gTurn]);
    let fromY = (move.kind === 'enter') ? homeY : y0 + homeH + move.pos * road + road / 2;
    const land = (move.kind === 'enter') ? puluc.enterLanding(gTurn, gPulucRoll) : puluc.landing(move.pos, fromCell.dir, gPulucRoll, gTurn);
    const toY = land.homeReturn ? homeY : y0 + homeH + land.p * road + road / 2;
    const res = puluc.applyMove(gState, move, gTurn, gPulucRoll);
    if (!res) {
      // 防御：异常时不冻结——按本轮无子可动处理（轮空换边，解除思考锁）
      ggSwitchTurn();
      draw();
      return;
    }
    gSel = null;
    gMoves = [];
    // 移动前落点的对方堆叠（判断夺回数）
    const targetBefore = (move.kind === 'enter' || !land.homeReturn) ? gState.cells[land.p] : null;
    // 行棋日志：进场写落点、俘虏注明夺回
    let desc;
    if (move.kind === 'enter') desc = (gTurn === 1 ? '黑' : '白') + ' 掷' + gPulucRoll + ' 进场→格' + land.p;
    else if (land.homeReturn) desc = (gTurn === 1 ? '黑' : '白') + ' 掷' + gPulucRoll + ' 回家';
    else desc = (gTurn === 1 ? '黑' : '白') + ' 掷' + gPulucRoll + ' 格' + move.pos + '→格' + land.p;
    if (res.captured > 0) {
      const recaptured = (targetBefore && targetBefore.captives) ? targetBefore.captives.length : 0;
      desc += ' 俘虏' + res.captured + (recaptured > 0 ? '（夺回' + recaptured + '）' : '');
    }
    if (res.captured > 0) sound.playCapture();
    else sound.playMove();
    gPulucAnim = {
      fromY, toY, pieces, side: gTurn,
      fromPos: move.kind === 'enter' ? null : move.pos,
      toPos: land.homeReturn ? null : land.p,
      start: Date.now(), dur: 380,
      onDone: () => {
        gState = res.state;
        gPulucRoll = -1;
        gPulucPhase = 'roll';
        gCount++;
        gLog.push(gCount + '. ' + desc);
        const win = ggCheckWin();
        if (win) {
          gOver = true;
          gWinner = (win === 1) ? '黑方胜利！' : '白方胜利！';
          sound.playWin();
        } else if (gCount >= 300) {
          gOver = true;
          gWinner = '平局（步数上限）';
        } else {
          ggSwitchTurn();
        }
        draw();
      }
    };
    draw();
    pulucAnimTick();
    return; // 跳过公共尾部（动画完成后统一结算）
  }
  gCount++;
  gSel = null;
  gMoves = [];
  if (captured > 0) sound.playCapture();
  else sound.playMove();

  const win = ggCheckWin();
  if (win) {
    gOver = true;
    gWinner = (win === 1) ? '黑方胜利！' : '白方胜利！';
    sound.playWin();
  } else if (gCount >= 300) {
    gOver = true;
    gWinner = '平局（步数上限）';
  } else {
    ggSwitchTurn();
  }
  draw();
}

function ggSwitchTurn() {
  gTurn = (gTurn === 1) ? 2 : 1;
  if (gActive === 'puluc') {
    gPulucRoll = -1;      // 新回合重新掷棍
    gPulucPhase = 'roll';
    gMoves = [];
  }
  ggCheckAi();
}

// AI 回合调度
function ggCheckAi() {
  if (gOver || !gActive) return;
  const isAi = (gSide === 1 && gTurn === 2) || (gSide === 2 && gTurn === 1);
  if (isAi) {
    gThink = true;
    draw();
    setTimeout(() => ggExecAi(), 350);
  } else {
    gThink = false;
  }
}

function ggExecAi() {
  if (gOver || !gActive || showMenu) return;
  if (gActive === 'puluc') {
    if (gPulucRoll < 0) {
      aiStickThrow(); // AI 也播放掷棍动画
      return;
    }
    const move = ggAiMove();
    if (move) {
      ggApply(move);
    } else {
      // 无子可动 → 轮空
      gPulucRoll = -1;
      ggSwitchTurn();
      draw();
    }
    return;
  }
  const move = ggAiMove();
  if (move) {
    ggApply(move);
  } else {
    // 无棋可走
    gOver = true;
    gWinner = (gTurn === 1) ? '白方胜利！' : '黑方胜利！';
    sound.playWin();
    draw();
  }
}

// AI 掷棍动画：木棍翻转后继续走子
function aiStickThrow() {
  if (gActive !== 'puluc' || gPulucRoll >= 0 || gOver) return;
  const result = puluc.roll();
  gPulucPhase = 'anim';
  gStickAnim = { start: Date.now(), dur: 550, result };
  draw();
  const tick = () => {
    if (!gActive || gActive !== 'puluc') return;
    draw();
    if (gStickAnim && Date.now() - gStickAnim.start < gStickAnim.dur) {
      setTimeout(tick, 50);
    } else {
      gPulucRoll = result;
      gPulucPhase = 'move';
      gStickAnim = null;
      ggExecAi(); // 动画结束，继续 AI 走子
    }
  };
  setTimeout(tick, 50);
}

// 棋子移动动画 tick
function pulucAnimTick() {
  if (!gPulucAnim) return;
  draw();
  if (Date.now() - gPulucAnim.start < gPulucAnim.dur) {
    setTimeout(pulucAnimTick, 33);
  } else {
    const done = gPulucAnim.onDone;
    gPulucAnim = null;
    if (done) done();
  }
}

// 玩家触摸：按游戏分发（r, c 为棋盘坐标）
function onGGTap(r, c) {
  if (gOver || gThink || !gActive) return;
  if (gActive === 'seega') onGgSeegaTap(r, c);
  else if (gActive === 'mutorere') onGgMuTap(r, c);
  else if (gActive === 'konane') onGgKoTap(r, c);
  else if (gActive === 'puluc') onGgPuTap(r, c);
}

// —— 施嘉：放置 / 选子移动 ——
function onGgSeegaTap(r, c) {
  if (gSide === 2 && gTurn === seega.PIECE.Black) return; // AI 回合
  if (gSide === 1 && gTurn === seega.PIECE.White) return;
  const me = gTurn;
  if (gState.phase === 'place') {
    if (gState.board[r][c] === seega.PIECE.None && !seega.isCenterCross(r, c)) {
      ggApply({ place: { r, c } });
    }
    draw();
    return;
  }
  if (!gSel) {
    if (gState.board[r][c] === me) {
      gSel = { r, c };
      gMoves = seega.moves(gState.board, me).filter(m => m.from.r === r && m.from.c === c);
    }
  } else if (r === gSel.r && c === gSel.c) {
    gSel = null; gMoves = [];
  } else if (gState.board[r][c] === me) {
    gSel = { r, c };
    gMoves = seega.moves(gState.board, me).filter(m => m.from.r === r && m.from.c === c);
  } else {
    const mv = gMoves.find(m => m.to.r === r && m.to.c === c);
    if (mv) ggApply(mv);
    else { gSel = null; gMoves = []; }
  }
  draw();
}

// —— 舞棋：选子移动（点索引 0..8：0-7 外围，8 中心）——
function onGgMuTap(r, c) {
  const idx = r * 3 + c; // 9 点网格：0..8
  if (gSide === 2 && gTurn === mutorere.PIECE.Black) return;
  if (gSide === 1 && gTurn === mutorere.PIECE.White) return;
  const me = gTurn;
  if (!gSel) {
    if (gState[idx] === me) {
      gSel = idx;
      gMoves = mutorere.moves(gState, me).filter(m => m.from === idx);
    }
  } else if (idx === gSel) {
    gSel = null; gMoves = [];
  } else if (gState[idx] === me) {
    gSel = idx;
    gMoves = mutorere.moves(gState, me).filter(m => m.from === idx);
  } else {
    const mv = gMoves.find(m => m.to === idx);
    if (mv) ggApply(mv);
    else { gSel = null; gMoves = []; }
  }
  draw();
}

// —— 跳棋：选子 → 连跳目标 ——
function onGgKoTap(r, c) {
  if (gSide === 2 && gTurn === konane.PIECE.Black) return;
  if (gSide === 1 && gTurn === konane.PIECE.White) return;
  const me = gTurn;
  if (!gSel) {
    if (gState[r][c] === me) {
      const seqs = konane.jumpSequencesFrom(gState, me, r, c);
      if (seqs.length > 0) {
        gSel = { r, c };
        gMoves = seqs;
      }
    }
  } else if (r === gSel.r && c === gSel.c) {
    gSel = null; gMoves = [];
  } else if (gState[r][c] === me) {
    const seqs = konane.jumpSequencesFrom(gState, me, r, c);
    if (seqs.length > 0) {
      gSel = { r, c };
      gMoves = seqs;
    }
  } else {
    const mv = gMoves.find(m => m.to.r === r && m.to.c === c);
    if (mv) ggApply(mv);
    else { gSel = null; gMoves = []; }
  }
  draw();
}

// —— 普鲁克：掷棍后点选棋子 → 标注可走位置 → 点落点移动（古典象棋风格）——
function onGgPuTap(r, c) {
  if (gOver || gThink || !gActive || gPulucAnim) return; // 动画中不可操作
  if (gSide === 2 && gTurn === puluc.PIECE.Black) return;
  if (gSide === 1 && gTurn === puluc.PIECE.White) return;
  if (gPulucPhase === 'roll') { startStickThrow(); return; } // 点击掷棍
  if (gPulucRoll < 0) return;
  // 无任何合法移动 → 轮空
  const allMoves = puluc.moves(gState, gTurn, gPulucRoll);
  if (allMoves.length === 0) {
    gPulucRoll = -1;
    gPulucPhase = 'roll';
    ggSwitchTurn();
    draw();
    return;
  }
  // 已选中：点落点行棋（进场落点在对应格、「回家」落点在自己家区），点其它取消
  if (gSel) {
    const m = gMoves.find(x => {
      if (x.kind === 'enter') {
        if (r < 0) return false;
        return c === puluc.enterLanding(gTurn, gPulucRoll).p;
      }
      const cell = gState.cells[x.pos];
      if (!cell) return false;
      const land = puluc.landing(x.pos, cell.dir, gPulucRoll, gTurn);
      if (land.homeReturn) return r < 0; // 回家：点自家家区
      if (r < 0) return false;
      return c === land.p;
    });
    if (m) {
      ggApply(m);
      return;
    }
    gSel = null;
    gMoves = [];
    draw();
    return;
  }
  // 未选中：点自家家区 → 选中进场；点己方控制堆叠 → 选中该堆叠
  if (r < 0) {
    const m = allMoves.find(x => x.kind === 'enter');
    if (m) { gSel = { kind: 'enter' }; gMoves = [m]; }
    draw();
    return;
  }
  const cell = gState.cells[c];
  if (cell && cell.side === gTurn) {
    const ms = allMoves.filter(x => x.kind === 'move' && x.pos === c);
    if (ms.length > 0) { gSel = { kind: 'stack', pos: c }; gMoves = ms; }
  }
  draw();
}

// 玩家掷棍：4 根木棍翻转动画，结束后出步数
function startStickThrow() {
  if (gActive !== 'puluc' || gPulucPhase !== 'roll' || gPulucRoll >= 0 || gThink || gOver) return;
  const result = puluc.roll();
  gPulucPhase = 'anim';
  gStickAnim = { start: Date.now(), dur: 550, result };
  draw(); // 立即显示「掷棍中…」
  const tick = () => {
    if (!gActive || gActive !== 'puluc') return;
    draw();
    if (gStickAnim && Date.now() - gStickAnim.start < gStickAnim.dur) {
      setTimeout(tick, 50);
    } else {
      gPulucRoll = result;
      gPulucPhase = 'move';
      gMoves = puluc.moves(gState, gTurn, gPulucRoll);
      gStickAnim = null;
      sound.playMove();
      draw();
    }
  };
  setTimeout(tick, 50);
}

// ================= 渲染 =================

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRoundRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(x, y, w, h, r, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth || 1;
  roundRect(x, y, w, h, r);
  ctx.stroke();
}

function drawText(text, x, y, color, size, align, baseline) {
  ctx.fillStyle = color;
  ctx.font = size + 'px sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = baseline || 'middle';
  ctx.fillText(text, x, y);
}

// 按宽度自动换行，返回行数组
function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const test = line + ch;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawBoard() {
  const { boardX, boardY, boardSize, cell } = layout;
  fillRoundRect(boardX - 6, boardY - 6, boardSize + 12, boardSize + 12, 10, C.boardBg);

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = boardX + c * cell;
      const y = boardY + r * cell;
      let color = C.cell;
      if (game.isThrone(r, c)) color = C.throne;
      else if (game.isStronghold(r, c)) color = C.stronghold;
      fillRoundRect(x + 1, y + 1, cell - 2, cell - 2, 3, color);

      // 王座中心标记
      if (game.isThrone(r, c)) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        ctx.fillStyle = C.gold;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cell * 0.12);
        ctx.lineTo(cx + cell * 0.12, cy);
        ctx.lineTo(cx, cy + cell * 0.12);
        ctx.lineTo(cx - cell * 0.12, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawMovableCells() {
  if (movableCells.length === 0) return;
  const { boardX, boardY, cell } = layout;
  ctx.fillStyle = 'rgba(240, 192, 96, 0.75)';
  for (const m of movableCells) {
    const cx = boardX + m.c * cell + cell / 2;
    const cy = boardY + m.r * cell + cell / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPieceAt(cx, cy, type, rad, isSelected) {
  let color = C.attacker;
  if (type === PieceType.Defender) color = C.defender;
  else if (type === PieceType.King) color = C.king;

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2);
    ctx.fillStyle = C.gold;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPieces() {
  const { boardX, boardY, cell } = layout;
  const rad = cell * 0.40;

  // 移动中棋子的插值位置
  let animX = null;
  let animY = null;
  if (anim) {
    const t = Math.min((Date.now() - anim.start) / anim.duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    animX = anim.x0 + (anim.x1 - anim.x0) * ease;
    animY = anim.y0 + (anim.y1 - anim.y0) * ease;
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      // 正在移动的棋子跳过静态绘制，稍后画在插值位置
      if (anim && anim.toR === r && anim.toC === c) continue;
      const p = board[r][c];
      if (p === PieceType.None) continue;
      const cx = boardX + c * cell + cell / 2;
      const cy = boardY + r * cell + cell / 2;
      const sel = !!(selected && selected.r === r && selected.c === c);
      drawPieceAt(cx, cy, p, rad, sel);
    }
  }

  // 画移动中的棋子
  if (anim && animX != null) {
    drawPieceAt(animX, animY, anim.type, rad, false);
  }
}

function startAnim(type, fromR, fromC, toR, toC, onDone) {
  const { boardX, boardY, cell } = layout;
  anim = {
    type,
    toR,
    toC,
    x0: boardX + fromC * cell + cell / 2,
    y0: boardY + fromR * cell + cell / 2,
    x1: boardX + toC * cell + cell / 2,
    y1: boardY + toR * cell + cell / 2,
    start: Date.now(),
    duration: 220,
    onDone: onDone || null
  };
  draw();
  if (animFrame == null) {
    animFrame = requestAnimationFrame(animTick);
  }
}

function animTick() {
  animFrame = null;
  if (!anim) return;
  if (Date.now() - anim.start >= anim.duration) {
    const done = anim.onDone;
    anim = null;
    if (done) done();
    else draw();
    return;
  }
  draw();
  animFrame = requestAnimationFrame(animTick);
}

function drawButton(b) {
  if (b.type === 'toggle') {
    drawToggle(b);
    return;
  }
  const isDiff = b.id === 'diff1' || b.id === 'diff2' || b.id === 'diff3';
  if (isDiff) {
    const active = (b.id === 'diff1' && difficulty === 1) || (b.id === 'diff2' && difficulty === 2) || (b.id === 'diff3' && difficulty === 3);
    if (active) {
      fillRoundRect(b.x, b.y, b.w, b.h, 22, C.gold);
      drawText(b.text, b.x + b.w / 2, b.y + b.h / 2, '#2b2b2b', 15, 'center', 'middle');
    } else {
      fillRoundRect(b.x, b.y, b.w, b.h, 22, '#3a3a3a');
      drawText(b.text, b.x + b.w / 2, b.y + b.h / 2, '#999999', 15, 'center', 'middle');
    }
  } else {
    strokeRoundRect(b.x, b.y, b.w, b.h, 22, '#666666', 1);
    drawText(b.text, b.x + b.w / 2, b.y + b.h / 2, C.dim, 15, 'center', 'middle');
  }
}

// 执黑/执白拨动滑块（带滑动动画）
function drawToggle(b) {
  const r = b.h / 2;
  fillRoundRect(b.x, b.y, b.w, b.h, r, '#4a2f18'); // 轨道（深棕）
  const half = b.w / 2;

  // 胶囊位置：0=左(执黑)，1=右(执白)，200ms 缓动
  let pos = (gameMode === 1) ? 0 : 1;
  if (toggleAnim) {
    const t = Math.min((Date.now() - toggleAnim.start) / 200, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const fromPos = (toggleAnim.from === 1) ? 0 : 1;
    const toPos = (toggleAnim.to === 1) ? 0 : 1;
    pos = fromPos + (toPos - fromPos) * ease;
  }

  const leftCx = b.x + half / 2;
  const rightCx = b.x + half * 1.5;
  const cx = leftCx + (rightCx - leftCx) * pos;
  const capW = half - 8;
  fillRoundRect(cx - capW / 2, b.y + 4, capW, b.h - 8, (b.h - 8) / 2, C.gold);

  drawText('执黑', b.x + half / 2, b.y + b.h / 2, gameMode === 1 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
  drawText('执白', b.x + half + half / 2, b.y + b.h / 2, gameMode === 2 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
}

// 滑块动画驱动（200ms 缓动，定时重绘）
function animateToggle() {
  if (!toggleAnim) return;
  const t = (Date.now() - toggleAnim.start) / 200;
  if (t < 1) {
    draw();
    setTimeout(animateToggle, 16);
  } else {
    toggleAnim = null;
    draw();
  }
}

// 深色木纹背景
function drawWoodBackground() {
  // 基底：深木棕
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // 横向木纹：深浅交替的波浪线
  const lineCount = Math.ceil(H / 20);
  for (let i = 0; i < lineCount; i++) {
    const y = i * 20 + 4;
    const dark = (i % 2 === 0);
    ctx.strokeStyle = dark ? 'rgba(30, 14, 5, 0.55)' : 'rgba(150, 100, 55, 0.18)';
    ctx.lineWidth = dark ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const segments = 8;
    for (let s = 1; s <= segments; s++) {
      const x = (W / segments) * s;
      ctx.lineTo(x, y + Math.sin(i * 1.9 + s * 0.8) * 2.5);
    }
    ctx.stroke();
  }

  // 粗纹理：几条起伏更明显的木纹带（模拟年轮感）
  for (let i = 0; i < 5; i++) {
    const y = (i * 173 + 30) % H;
    ctx.strokeStyle = 'rgba(25, 12, 4, 0.28)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const segments = 5;
    for (let s = 1; s <= segments; s++) {
      const x = (W / segments) * s;
      ctx.lineTo(x, y + Math.sin(i * 2.6 + s * 1.3) * 7);
    }
    ctx.stroke();
  }
}

// 主菜单：酒馆招牌 + 六种棋局入口
function drawMainMenu() {
  // 招牌标题
  drawText('骑砍二的小酒馆', W / 2, SAFE_TOP + 78, C.gold, 30, 'center', 'middle');
  // 装饰分隔线
  ctx.strokeStyle = 'rgba(240, 192, 96, 0.45)';
  ctx.lineWidth = 1.5;
  const lineW = 180;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lineW / 2, SAFE_TOP + 106);
  ctx.lineTo(W / 2 + lineW / 2, SAFE_TOP + 106);
  ctx.stroke();
  drawText('—— 选个棋局，来一局 ——', W / 2, SAFE_TOP + 128, C.dim, 13, 'center', 'middle');

  // 六个棋局按钮：全部已开放，金色高亮
  for (const b of menuButtons) {
    const g = GAMES[b.gameId - 1];
    const open = true;
    fillRoundRect(b.x, b.y, b.w, b.h, 12, open ? '#4a2f18' : '#35261a');
    strokeRoundRect(b.x, b.y, b.w, b.h, 12, open ? C.gold : '#6b5a3a', open ? 1.6 : 1);
    drawText(g.name, b.x + b.w / 2, b.y + b.h / 2 - 10, open ? C.parchment : '#9a8a6a', 16, 'center', 'middle');
    drawText('（' + g.origin + '）', b.x + b.w / 2, b.y + b.h / 2 + 12, open ? '#c9a86a' : '#7a6a4a', 12, 'center', 'middle');
  }

  // 底部提示
  drawText(menuTip || '选择棋局开始游戏', W / 2, H - SAFE_TOP - 36, menuTip ? C.gold : C.dim, 13, 'center', 'middle');
}

// ================= 狼羊棋渲染 =================

function drawWolfSheep() {
  // 标题
  drawText('狼羊棋', W / 2, SAFE_TOP + TITLE_H / 2, C.text, 22, 'center', 'middle');
  drawText('‹ 菜单', 14, SAFE_TOP + TITLE_H / 2, C.gold, 15, 'left', 'middle');

  // 状态行
  let status = '';
  let statusColor = C.dim;
  if (wsThinking) {
    status = 'AI 思考中…';
    statusColor = C.gold;
  } else if (wsGameOver) {
    status = '对局结束';
    statusColor = C.dim;
  } else if (ws.turn === wsmod.PIECE.Wolf) {
    status = '狼方回合';
  } else {
    status = '羊方回合' + (ws.phase === 'place' ? '（放置 ' + ws.placed + '/20）' : '（移动）');
  }
  status += ' · 已吃羊 ' + ws.captured + '/5';
  drawText(status, W / 2, SAFE_TOP + TITLE_H + STATUS_H / 2, statusColor, 14, 'center', 'middle');

  drawWsBoard();
  drawWsToggle(wsButtons[0]);
  for (let i = 1; i < wsButtons.length; i++) drawButton(wsButtons[i]);

  // 弹窗
  wsModalButtons = [];
  if (wsGameOver) drawWsGameOverModal();
  else if (wsShowRules) drawWsRulesModal();
}

function drawWsBoard() {
  const { bx, by, cell } = wsLayout;

  // 棋盘底板
  fillRoundRect(bx - 14, by - 14, cell * 4 + 28, cell * 4 + 28, 10, C.boardBg);

  // 连线：正交 + 每个 2×2 方格两条对角线（对应 8 方向移动）
  ctx.strokeStyle = 'rgba(90, 60, 25, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = bx + c * cell, y = by + r * cell;
      if (c < 4) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (r < 4) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      if (r < 4 && c < 4) {
        ctx.moveTo(x, y); ctx.lineTo(x + cell, y + cell);
        ctx.moveTo(x + cell, y); ctx.lineTo(x, y + cell);
      }
    }
  }
  ctx.stroke();

  // 落点
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = bx + c * cell, y = by + r * cell;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#5a3e1a';
      ctx.fill();
    }
  }

  if (!ws) return;

  // 羊放置阶段提示（玩家执羊时显示可放点）
  if (!wsGameOver && !wsThinking && wsSide === 2 && ws.turn === wsmod.PIECE.Sheep && ws.phase === 'place') {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.45)';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (ws.board[r][c] === wsmod.PIECE.None) {
          ctx.beginPath();
          ctx.arc(bx + c * cell, by + r * cell, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // 选中棋子的可走/可跳点
  if (wsSelected) {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.8)';
    for (const m of wsMoves) {
      ctx.beginPath();
      ctx.arc(bx + m.to.c * cell, by + m.to.r * cell, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 棋子：狼=深色大圆（金色眼），羊=白色小圆
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const p = ws.board[r][c];
      if (p === wsmod.PIECE.None) continue;
      const x = bx + c * cell, y = by + r * cell;
      if (p === wsmod.PIECE.Wolf) {
        if (wsSelected && wsSelected.r === r && wsSelected.c === c) {
          ctx.beginPath(); ctx.arc(x, y, cell * 0.36, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, cell * 0.30, 0, Math.PI * 2); ctx.fillStyle = C.attacker; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.arc(x - cell * 0.09, y - cell * 0.05, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + cell * 0.09, y - cell * 0.05, 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, y, cell * 0.21, 0, Math.PI * 2); ctx.fillStyle = C.defender; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }
}

// 执狼/执羊拨动滑块（与古典象棋同款风格）
function drawWsToggle(b) {
  const r = b.h / 2;
  fillRoundRect(b.x, b.y, b.w, b.h, r, '#4a2f18');
  const half = b.w / 2;
  const pos = (wsSide === 1) ? 0 : 1;
  const cx = b.x + half / 2 + half * pos;
  const capW = half - 8;
  fillRoundRect(cx - capW / 2, b.y + 4, capW, b.h - 8, (b.h - 8) / 2, C.gold);
  drawText('执狼', b.x + half / 2, b.y + b.h / 2, wsSide === 1 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
  drawText('执羊', b.x + half + half / 2, b.y + b.h / 2, wsSide === 2 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
}

function drawWsGameOverModal() {
  drawOverlay();
  const bw = Math.min(W - 80, 300);
  const bh = 150;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, '#ffffff');
  drawText(wsWinner, bx + bw / 2, by + 46, '#333333', 22, 'center', 'middle');
  const btnW = bw - 64;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 20;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#c0392b');
  drawText('再来一局', btnX + btnW / 2, btnY + btnH / 2, '#ffffff', 16, 'center', 'middle');
  wsModalButtons.push({ id: 'ws-again', x: btnX, y: btnY, w: btnW, h: btnH });
}

function drawWsRulesModal() {
  drawOverlay();
  const bw = Math.min(W - 48, 340);
  const bh = Math.min(H - 80, 520);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, C.parchment);
  drawText('规则', bx + bw / 2, by + 32, C.parchmentTitle, 20, 'center', 'middle');
  const font = '14px sans-serif';
  const pad = 22;
  const lineH = 24;
  const maxWidth = bw - pad * 2;
  let ty = by + 62;
  const maxTY = by + bh - 70;
  for (const item of WS_RULES) {
    const lines = wrapText(item, maxWidth, font);
    for (const ln of lines) {
      if (ty > maxTY) break;
      drawText(ln, bx + pad, ty, C.parchmentText, 14, 'left', 'middle');
      ty += lineH;
    }
  }
  const btnW = bw - 48;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 16;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('知道了', btnX + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 16, 'center', 'middle');
  wsModalButtons.push({ id: 'ws-rules-close', x: btnX, y: btnY, w: btnW, h: btnH });
}

// ================= 四款新棋渲染 =================

function drawGG() {
  const info = GG_MODS[gActive];
  // 标题
  drawText(info.name, W / 2, SAFE_TOP + TITLE_H / 2, C.text, 22, 'center', 'middle');
  drawText('‹ 菜单', 14, SAFE_TOP + TITLE_H / 2, C.gold, 15, 'left', 'middle');

  // 状态行
  let status = '';
  let statusColor = C.dim;
  if (gThink) {
    status = 'AI 思考中…';
    statusColor = C.gold;
  } else if (gOver) {
    status = '对局结束';
    statusColor = C.dim;
  } else {
    status = (gTurn === 1 ? '黑方回合' : '白方回合');
    if (gActive === 'seega' && gState.phase === 'place') status += '（放置 ' + gState.placed[1] + '/' + gState.placed[2] + '）';
    if (gActive === 'puluc') {
      if (gPulucPhase === 'roll') status += ' · 等待掷棍';
      else if (gPulucPhase === 'anim') status += ' · 掷棍中…';
      else status += ' · 掷出 ' + gPulucRoll + ' 步';
    }
  }
  drawText(status, W / 2, SAFE_TOP + TITLE_H + STATUS_H / 2, statusColor, 14, 'center', 'middle');

  // 棋盘
  if (gActive === 'seega') drawGgSeega();
  else if (gActive === 'mutorere') drawGgMu();
  else if (gActive === 'konane') drawGgKonane();
  else if (gActive === 'puluc') drawGgPuluc();

  // 按钮：执黑/执白 toggle（第一行）+ 重新开始/规则/日志（第二行）
  const y1 = (gActive === 'puluc')
    ? (gLayout.pulucY + gLayout.homeH * 2 + puluc.CELLS * gLayout.pulucRoad + 22 + 74)
    : (gLayout.by + gLayout.size + 16);
  const y2 = y1 + BTN_H + BTN_GAP;
  const toggleW = Math.min(220, W - 32);
  const row3W = (W - 32 - BTN_GAP * 2) / 3;
  drawGgToggle((W - toggleW) / 2, y1, toggleW);
  drawButton({ id: 'gg-restart', text: '重新开始', x: 16, y: y2, w: row3W, h: BTN_H });
  drawButton({ id: 'gg-rules', text: '规则', x: 16 + (row3W + BTN_GAP), y: y2, w: row3W, h: BTN_H });
  drawButton({ id: 'gg-log', text: '日志', x: 16 + (row3W + BTN_GAP) * 2, y: y2, w: row3W, h: BTN_H });

  // 弹窗
  gModal = [];
  if (gOver) drawGgGameOverModal();
  else if (gShowRules) drawGgRulesModal();
  else if (gShowLog) drawGgLogModal();
}

function drawGgPiece(cx, cy, rad, color, sel) {
  if (sel) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2);
    ctx.fillStyle = C.gold;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 施嘉：5×5 方格
function drawGgSeega() {
  const size = gLayout.size, cell = size / 5;
  const bx = gLayout.bx, by = gLayout.by;
  fillRoundRect(bx - 6, by - 6, size + 12, size + 12, 10, C.boardBg);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = bx + c * cell, y = by + r * cell;
      fillRoundRect(x + 1, y + 1, cell - 2, cell - 2, 3, seega.isCenterCross(r, c) ? C.throne : C.cell);
      if (seega.isCenterCross(r, c)) {
        ctx.fillStyle = C.gold;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 放置阶段可放点提示
  if (!gOver && !gThink && gState.phase === 'place') {
    const playerTurn = (gSide === 1 && gTurn === 1) || (gSide === 2 && gTurn === 2);
    if (playerTurn) {
      ctx.fillStyle = 'rgba(240, 192, 96, 0.5)';
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (gState.board[r][c] === seega.PIECE.None && !seega.isCenterCross(r, c)) {
            ctx.beginPath();
            ctx.arc(bx + c * cell + cell / 2, by + r * cell + cell / 2, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
  // 可走格
  if (gSel) {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.8)';
    for (const m of gMoves) {
      ctx.beginPath();
      ctx.arc(bx + m.to.c * cell + cell / 2, by + m.to.r * cell + cell / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 棋子
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const p = gState.board[r][c];
      if (p === seega.PIECE.None) continue;
      const cx = bx + c * cell + cell / 2, cy = by + r * cell + cell / 2;
      const sel = !!(gSel && gSel.r === r && gSel.c === c);
      if (p === seega.PIECE.Black) drawGgPiece(cx, cy, cell * 0.38, C.attacker, sel);
      else drawGgPiece(cx, cy, cell * 0.38, C.defender, sel);
    }
  }
}

// 舞棋：8 外围点 + 中心
function drawGgMu() {
  const { cx, cy, r } = gLayout;
  fillRoundRect(cx - r - 18, cy - r - 18, r * 2 + 36, r * 2 + 36, 12, C.boardBg);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  ctx.strokeStyle = 'rgba(90, 60, 25, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const p = pts[i], q = pts[(i + 1) % 8];
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // 可移动提示
  if (gSel != null) {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.8)';
    for (const m of gMoves) {
      if (m.to === 8) { ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(pts[m.to].x, pts[m.to].y, 8, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // 棋子
  for (let i = 0; i < 9; i++) {
    const p = gState[i];
    if (p === mutorere.PIECE.None) continue;
    const x = (i === 8) ? cx : pts[i].x;
    const y = (i === 8) ? cy : pts[i].y;
    const sel = (gSel === i);
    if (p === mutorere.PIECE.Black) drawGgPiece(x, y, 16, C.attacker, sel);
    else drawGgPiece(x, y, 16, C.defender, sel);
  }
}

// 跳棋：8×8 方格
function drawGgKonane() {
  const size = gLayout.size, cell = size / 8;
  const bx = gLayout.bx, by = gLayout.by;
  fillRoundRect(bx - 6, by - 6, size + 12, size + 12, 10, C.boardBg);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = bx + c * cell, y = by + r * cell;
      fillRoundRect(x + 1, y + 1, cell - 2, cell - 2, 2, ((r + c) % 2 === 0) ? C.cell : '#b9884f');
    }
  }
  // 可跳目标提示
  if (gSel) {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.85)';
    for (const s of gMoves) {
      ctx.beginPath();
      ctx.arc(bx + s.to.c * cell + cell / 2, by + s.to.r * cell + cell / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 棋子
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = gState[r][c];
      if (p === konane.PIECE.None) continue;
      const cx = bx + c * cell + cell / 2, cy = by + r * cell + cell / 2;
      const sel = !!(gSel && gSel.r === r && gSel.c === c);
      if (p === konane.PIECE.Black) drawGgPiece(cx, cy, cell * 0.38, C.attacker, sel);
      else drawGgPiece(cx, cy, cell * 0.38, C.defender, sel);
    }
  }
}

// 普鲁克（竖版）：上下两端家区 + 中间 11 格纵向宽格 + 木棍 + 掷棍按钮
function drawGgPuluc() {
  const road = gLayout.pulucRoad, cellW = gLayout.pulucW, homeH = gLayout.homeH;
  const x = gLayout.pulucX, y0 = gLayout.pulucY;
  const pieceR = Math.max(6, Math.min(road * 0.36, cellW * 0.14));

  // 上家区（黑）
  drawHomeZone(x, y0, cellW, homeH, 1, !!(gSel && gSel.kind === 'enter' && gSide === 1));
  // 中间 11 格纵向道路（堆叠：顶部控制者 + 下方俘虏，垂直摞放边缘微覆盖）
  for (let i = 0; i < puluc.CELLS; i++) {
    const y = y0 + homeH + i * road;
    fillRoundRect(x + 1, y + 1, cellW - 2, road - 2, 3, (i % 2 === 0) ? C.cell : '#b9884f');
    // 动画中的堆叠在原位置不画（画在插值位置）
    if (gPulucAnim && gPulucAnim.fromPos === i) continue;
    const cell = gState.cells[i];
    if (cell) {
      const pieces = cell.captives.slice().concat([cell.side]); // 从左到右：俘虏 → 控制者
      const sel = !!(gSel && gSel.kind === 'stack' && gSel.pos === i);
      // 移动动画中，落点格的对方堆叠半透明（将被俘虏，避免重叠抽搐）
      let alpha = 1;
      if (gPulucAnim && gPulucAnim.toPos === i && cell.side !== gPulucAnim.side) alpha = 0.35;
      drawStack(pieces, x + cellW / 2, y + road / 2, pieceR, sel, alpha);
    }
  }
  // 移动动画中的堆叠（从起点滑到落点）
  if (gPulucAnim) {
    const t = Math.min((Date.now() - gPulucAnim.start) / gPulucAnim.dur, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const cy = gPulucAnim.fromY + (gPulucAnim.toY - gPulucAnim.fromY) * ease;
    drawStack(gPulucAnim.pieces, x + cellW / 2, cy, pieceR, false);
  }
  // 下家区（白）
  drawHomeZone(x, y0 + homeH + puluc.CELLS * road, cellW, homeH, 2, !!(gSel && gSel.kind === 'enter' && gSide === 2));

  // 选中棋子可走的落点标注（古典象棋风格：金色圆点）
  // 进场/普通移动 → 落点在对应格；「回家」→ 落点在自己那端的家区
  if (gSel && gMoves.length > 0 && gPulucPhase === 'move') {
    ctx.fillStyle = 'rgba(240, 192, 96, 0.85)';
    for (const m of gMoves) {
      let px2 = x + cellW / 2, py;
      if (m.kind === 'enter') {
        const p = puluc.enterLanding(gTurn, gPulucRoll).p;
        py = y0 + homeH + p * road + road / 2;
      } else {
        const cell = gState.cells[m.pos];
        if (!cell) continue;
        const land = puluc.landing(m.pos, cell.dir, gPulucRoll, gTurn);
        if (land.homeReturn) {
          // 回家：落点在自己那端的家区
          py = (gTurn === 1) ? y0 + homeH / 2 : y0 + homeH + puluc.CELLS * road + homeH / 2;
        } else {
          py = y0 + homeH + land.p * road + road / 2;
        }
      }
      ctx.beginPath();
      ctx.arc(px2, py, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4 根木棍 + 掷棍按钮/结果
  const stickY = y0 + homeH * 2 + puluc.CELLS * road + 22;
  drawSticks(W / 2, stickY);
  if (gPulucPhase === 'roll' && !gOver && !gThink) {
    const bw = 110, bh = 32;
    fillRoundRect(W / 2 - bw / 2, stickY + 24, bw, bh, 16, '#4a2f18');
    strokeRoundRect(W / 2 - bw / 2, stickY + 24, bw, bh, 16, C.gold, 1.5);
    drawText('掷棍', W / 2, stickY + 24 + bh / 2, C.parchment, 15, 'center', 'middle');
  } else if (gPulucPhase === 'anim') {
    drawText('掷棍中…', W / 2, stickY + 40, C.gold, 14, 'center', 'middle');
  } else if (gPulucRoll >= 0) {
    drawText('掷出 ' + gPulucRoll + ' 步', W / 2, stickY + 40, C.gold, 14, 'center', 'middle');
  }
}

// 堆叠渲染：左右横向排布 = 俘虏(对方色)在左 → 控制者(己方色)在右，边缘微覆盖；sel 时控制者金圈
function drawStack(pieces, cx, cy, r, sel, alpha) {
  if (pieces.length === 0) return;
  if (alpha != null && alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  const offset = r * 1.35;
  const leftX = cx - (pieces.length - 1) * offset / 2;
  for (let j = 0; j < pieces.length; j++) {
    const px = leftX + j * offset;
    const s = pieces[j];
    const isLast = (j === pieces.length - 1); // 最右 = 控制者
    if (s === puluc.PIECE.Black) drawGgPiece(px, cy, r, C.attacker, !!(sel && isLast));
    else drawGgPiece(px, cy, r, C.defender, !!(sel && isLast));
  }
  if (alpha != null && alpha < 1) ctx.restore();
}

// 家区：横向 6 槽位（槽距随格宽自适应），显示在家等待的棋子（加大，槽内不重合）；sel 时金描边
function drawHomeZone(x, y, w, h, side, sel) {
  fillRoundRect(x + 1, y + 1, w - 2, h - 2, 6, '#6b4a2a');
  if (sel) strokeRoundRect(x, y, w, h, 6, C.gold, 2);
  const slots = gState.home[side];
  const slotGap = Math.min(30, (w - 24) / 5);
  const r = Math.min(10, slotGap * 0.35); // 在家棋子加大（不超槽距一半 → 不重合）
  for (let i = 0; i < 6; i++) {
    const px = x + w / 2 + (i - 2.5) * slotGap;
    const py = y + h / 2;
    if (i < slots) {
      drawGgPiece(px, py, r, side === 1 ? C.attacker : C.defender, false);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// 4 根木棍：动画中翻转预览，结算后按步数显示标记面
function drawSticks(cx, y) {
  for (let i = 0; i < 4; i++) {
    const x = cx - 54 + i * 36;
    let angle = 0, marked = false;
    if (gStickAnim) {
      const t = Date.now() - gStickAnim.start;
      angle = Math.sin(t / 45 + i * 1.7) * 1.1;
      marked = (Math.floor(t / 90) + i) % 2 === 0;
    } else if (gPulucRoll >= 0) {
      marked = (i < gPulucRoll);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    fillRoundRect(-17, -5, 34, 10, 4, '#8a6a3a');
    if (marked) {
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(12, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 执黑/执白拨动滑块（同款金色胶囊）
function drawGgToggle(x, y, w) {
  const r = BTN_H / 2;
  fillRoundRect(x, y, w, BTN_H, r, '#4a2f18');
  const half = w / 2;
  const pos = (gSide === 1) ? 0 : 1;
  const cx = x + half / 2 + half * pos;
  const capW = half - 8;
  fillRoundRect(cx - capW / 2, y + 4, capW, BTN_H - 8, (BTN_H - 8) / 2, C.gold);
  drawText('执黑', x + half / 2, y + BTN_H / 2, gSide === 1 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
  drawText('执白', x + half + half / 2, y + BTN_H / 2, gSide === 2 ? '#2b2b2b' : '#a08060', 15, 'center', 'middle');
}

function drawGgGameOverModal() {
  drawOverlay();
  const bw = Math.min(W - 80, 300);
  const bh = 150;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, '#ffffff');
  drawText(gWinner, bx + bw / 2, by + 46, '#333333', 22, 'center', 'middle');
  const btnW = bw - 64;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 20;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#c0392b');
  drawText('再来一局', btnX + btnW / 2, btnY + btnH / 2, '#ffffff', 16, 'center', 'middle');
  gModal.push({ id: 'gg-again', x: btnX, y: btnY, w: btnW, h: btnH });
}

function drawGgRulesModal() {
  drawOverlay();
  const bw = Math.min(W - 48, 340);
  const bh = Math.min(H - 80, 520);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, C.parchment);
  drawText(GG_MODS[gActive].name, bx + bw / 2, by + 32, C.parchmentTitle, 20, 'center', 'middle');
  const font = '14px sans-serif';
  const pad = 22;
  const lineH = 24;
  const maxWidth = bw - pad * 2;
  let ty = by + 62;
  const maxTY = by + bh - 70;
  for (const item of GG_MODS[gActive].rules) {
    const lines = wrapText(item, maxWidth, font);
    for (const ln of lines) {
      if (ty > maxTY) break;
      drawText(ln, bx + pad, ty, C.parchmentText, 14, 'left', 'middle');
      ty += lineH;
    }
  }
  const btnW = bw - 48;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 16;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('知道了', btnX + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 16, 'center', 'middle');
  gModal.push({ id: 'gg-rules-close', x: btnX, y: btnY, w: btnW, h: btnH });
}

// 行棋日志弹窗（样式同古典象棋）
function drawGgLogModal() {
  drawOverlay();
  const bw = Math.min(W - 48, 340);
  const bh = Math.min(H - 80, 520);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, C.parchment);
  drawText('行棋记录', bx + bw / 2, by + 32, C.parchmentTitle, 20, 'center', 'middle');
  if (gLogTip) {
    drawText(gLogTip, bx + bw / 2, by + 50, '#c0392b', 12, 'center', 'middle');
  }
  const all = (gLog && gLog.length) ? gLog : ['（暂无行棋记录）'];
  let shown = all;
  if (all.length > 24) {
    shown = ['…（前面省略，可复制查看完整）'].concat(all.slice(-23));
  }
  const font = '12px sans-serif';
  const pad = 20;
  const lineH = 19;
  const maxWidth = bw - pad * 2;
  let ty = by + 58;
  const maxTY = by + bh - 84;
  ctx.font = font;
  for (const raw of shown) {
    const lines = wrapText(raw, maxWidth, font);
    for (const ln of lines) {
      if (ty > maxTY) break;
      drawText(ln, bx + pad, ty, C.parchmentText, 12, 'left', 'middle');
      ty += lineH;
    }
  }
  const gap = 10;
  const btnH = 44;
  const btnW = (bw - 48 - gap) / 2;
  const btnX1 = bx + 24;
  const btnX2 = btnX1 + btnW + gap;
  const btnY = by + bh - btnH - 16;
  fillRoundRect(btnX1, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('复制日志', btnX1 + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 15, 'center', 'middle');
  fillRoundRect(btnX2, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('关闭', btnX2 + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 15, 'center', 'middle');
  gModal.push({ id: 'gg-copy', x: btnX1, y: btnY, w: btnW, h: btnH });
  gModal.push({ id: 'gg-log-close', x: btnX2, y: btnY, w: btnW, h: btnH });
}

// 复制日志
function ggCopyLog() {
  const text = (gLog && gLog.length) ? gLog.join('\n') : '（暂无行棋记录）';
  gLogTip = '已触发复制…';
  draw();
  if (typeof wx.setClipboardData !== 'function') {
    gLogTip = '当前环境不支持复制';
    draw();
    return;
  }
  wx.setClipboardData({
    data: text,
    success() {
      gLogTip = '已复制到剪贴板';
      draw();
      wx.showToast({ title: '已复制', icon: 'success' });
    },
    fail() {
      gLogTip = '复制失败（请真机重试）';
      draw();
    }
  });
}

function draw() {
  // 背景（木纹）
  drawWoodBackground();

  // 主菜单
  if (showMenu) {
    drawMainMenu();
    return;
  }

  // 狼羊棋页面
  if (wsActive) {
    drawWolfSheep();
    return;
  }

  // 四款新棋页面
  if (gActive) {
    drawGG();
    return;
  }

  // 标题
  drawText('古典象棋', W / 2, SAFE_TOP + TITLE_H / 2, C.text, 22, 'center', 'middle');
  drawText('‹ 菜单', 14, SAFE_TOP + TITLE_H / 2, C.gold, 15, 'left', 'middle');

  // 状态行
  let status = '';
  let statusColor = C.dim;
  if (isThinking) {
    status = 'AI 思考中…';
    statusColor = C.gold;
  } else if (isGameOver) {
    status = '对局结束';
    statusColor = C.dim;
  } else {
    status = currentTurn === PieceType.Attacker ? '黑方走棋' : '白方走棋';
    statusColor = C.dim;
  }
  drawText(status, W / 2, SAFE_TOP + TITLE_H + STATUS_H / 2, statusColor, 14, 'center', 'middle');

  drawBoard();
  drawMovableCells();
  drawPieces();

  for (const b of buttons) drawButton(b);

  // 弹窗
  modalButtons = [];
  if (isGameOver) drawGameOverModal();
  else if (showRules) drawRulesModal();
  else if (showLog) drawLogModal();
}

// ================= 弹窗 =================

function drawOverlay() {
  ctx.fillStyle = C.overlay;
  ctx.fillRect(0, 0, W, H);
}

function drawGameOverModal() {
  drawOverlay();
  const bw = Math.min(W - 80, 300);
  const bh = 150;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, '#ffffff');
  drawText(winnerText, bx + bw / 2, by + 46, '#333333', 22, 'center', 'middle');

  const btnW = bw - 64;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 20;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#c0392b');
  drawText('再来一局', btnX + btnW / 2, btnY + btnH / 2, '#ffffff', 16, 'center', 'middle');
  modalButtons.push({ id: 'again', x: btnX, y: btnY, w: btnW, h: btnH });
}

function drawRulesModal() {
  drawOverlay();
  const bw = Math.min(W - 48, 340);
  const bh = Math.min(H - 80, 520);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, C.parchment);
  drawText('规则', bx + bw / 2, by + 32, C.parchmentTitle, 20, 'center', 'middle');

  const font = '14px sans-serif';
  const pad = 22;
  const lineH = 24;
  const maxWidth = bw - pad * 2;
  let ty = by + 62;
  const maxTY = by + bh - 70;
  for (const item of RULES) {
    const lines = wrapText(item, maxWidth, font);
    for (const ln of lines) {
      if (ty > maxTY) break;
      drawText(ln, bx + pad, ty, C.parchmentText, 14, 'left', 'middle');
      ty += lineH;
    }
  }

  const btnW = bw - 48;
  const btnH = 44;
  const btnX = bx + (bw - btnW) / 2;
  const btnY = by + bh - btnH - 16;
  fillRoundRect(btnX, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('知道了', btnX + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 16, 'center', 'middle');
  modalButtons.push({ id: 'rules-close', x: btnX, y: btnY, w: btnW, h: btnH });
}

function drawLogModal() {
  drawOverlay();
  const bw = Math.min(W - 48, 340);
  const bh = Math.min(H - 80, 520);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  fillRoundRect(bx, by, bw, bh, 14, C.parchment);
  drawText('行棋记录', bx + bw / 2, by + 32, C.parchmentTitle, 20, 'center', 'middle');
  if (copyTip) {
    drawText(copyTip, bx + bw / 2, by + 50, '#c0392b', 12, 'center', 'middle');
  }

  // 日志可能很长，只显示最近若干行
  const all = (moveLog && moveLog.length) ? moveLog : ['（暂无行棋记录）'];
  let shown = all;
  if (all.length > 24) {
    shown = ['…（前面省略，可复制查看完整）'].concat(all.slice(-23));
  }

  const font = '12px sans-serif';
  const pad = 20;
  const lineH = 19;
  const maxWidth = bw - pad * 2;
  let ty = by + 58;
  const maxTY = by + bh - 84;
  ctx.font = font;
  for (const raw of shown) {
    const lines = wrapText(raw, maxWidth, font);
    for (const ln of lines) {
      if (ty > maxTY) break;
      drawText(ln, bx + pad, ty, C.parchmentText, 12, 'left', 'middle');
      ty += lineH;
    }
  }

  // 底部两个按钮
  const gap = 10;
  const btnH = 44;
  const btnW = (bw - 48 - gap) / 2;
  const btnX1 = bx + 24;
  const btnX2 = btnX1 + btnW + gap;
  const btnY = by + bh - btnH - 16;
  fillRoundRect(btnX1, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('复制日志', btnX1 + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 15, 'center', 'middle');
  fillRoundRect(btnX2, btnY, btnW, btnH, 22, '#e5d0a0');
  drawText('关闭', btnX2 + btnW / 2, btnY + btnH / 2, C.parchmentTitle, 15, 'center', 'middle');
  modalButtons.push({ id: 'copy', x: btnX1, y: btnY, w: btnW, h: btnH });
  modalButtons.push({ id: 'log-close', x: btnX2, y: btnY, w: btnW, h: btnH });
}

// ================= 触摸处理 =================

function hitTest(btn, x, y) {
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

function copyLog() {
  const text = (moveLog && moveLog.length) ? moveLog.join('\n') : '（暂无行棋记录）';
  // 先给出可见反馈（画在弹窗里），不依赖剪贴板 API 的回调
  copyTip = '已触发复制…';
  draw();

  if (typeof wx.setClipboardData !== 'function') {
    copyTip = '当前环境不支持复制';
    draw();
    return;
  }
  wx.setClipboardData({
    data: text,
    success() {
      copyTip = '已复制到剪贴板';
      draw();
      wx.showToast({ title: '已复制', icon: 'success' });
    },
    fail(err) {
      copyTip = '复制失败（请真机重试）';
      draw();
    }
  });
}

function handleTap(x, y) {
  // 主菜单：六个棋局入口
  if (showMenu) {
    for (const b of menuButtons) {
      if (hitTest(b, x, y)) {
        const g = GAMES[b.gameId - 1];
        if (b.gameId === 1) {
          startGame(); // 古典象棋（萨米板棋）
        } else if (b.gameId === 2) {
          enterWolfSheep(); // 狼羊棋（尼泊尔虎棋）
        } else {
          const ggKey = ['', '', '', 'seega', 'mutorere', 'konane', 'puluc'][b.gameId];
          enterGG(ggKey); // 施嘉/舞棋/跳棋/普鲁克
        }
        return;
      }
    }
    return; // 菜单模式下忽略其它点击
  }

  // 四款新棋页面
  if (gActive) {
    // 弹窗优先
    if (gOver) {
      for (const b of gModal) {
        if (b.id === 'gg-again' && hitTest(b, x, y)) { startGG(); return; }
      }
      return; // 必须点按钮
    }
    if (gShowRules) {
      for (const b of gModal) {
        if (b.id === 'gg-rules-close' && hitTest(b, x, y)) { gShowRules = false; draw(); return; }
      }
      gShowRules = false; // 点遮罩关闭
      draw();
      return;
    }
    if (gShowLog) {
      for (const b of gModal) {
        if (hitTest(b, x, y)) {
          if (b.id === 'gg-copy') ggCopyLog();
          else if (b.id === 'gg-log-close') gShowLog = false;
          draw();
          return;
        }
      }
      gShowLog = false; // 点遮罩关闭
      draw();
      return;
    }
    // 返回菜单
    if (x >= 0 && x <= 90 && y >= SAFE_TOP && y <= SAFE_TOP + TITLE_H) { backToMenu(); return; }
    // 底部按钮
    const gy1 = (gActive === 'puluc')
      ? (gLayout.pulucY + gLayout.homeH * 2 + puluc.CELLS * gLayout.pulucRoad + 22 + 74)
      : (gLayout.by + gLayout.size + 16);
    const gy2 = gy1 + BTN_H + BTN_GAP;
    const toggleW = Math.min(220, W - 32);
    const row3W = (W - 32 - BTN_GAP * 2) / 3;
    const tx = (W - toggleW) / 2;
    if (hitTest({ x: tx, y: gy1, w: toggleW, h: BTN_H }, x, y)) {
      gSide = (x < tx + toggleW / 2) ? 1 : 2; // 左半执黑、右半执白
      startGG();
      return;
    }
    if (hitTest({ x: 16, y: gy2, w: row3W, h: BTN_H }, x, y)) { startGG(); return; }
    if (hitTest({ x: 16 + (row3W + BTN_GAP), y: gy2, w: row3W, h: BTN_H }, x, y)) { gShowRules = true; draw(); return; }
    if (hitTest({ x: 16 + (row3W + BTN_GAP) * 2, y: gy2, w: row3W, h: BTN_H }, x, y)) { gShowLog = true; gLogTip = ''; draw(); return; }
    // 舞棋：最近点命中
    if (gActive === 'mutorere') {
      const { cx, cy, r } = gLayout;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 4;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      pts.push({ x: cx, y: cy });
      let best = -1, bestD = 1e9;
      for (let i = 0; i < 9; i++) {
        const d = (x - pts[i].x) * (x - pts[i].x) + (y - pts[i].y) * (y - pts[i].y);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0 && bestD < (r * 0.35) * (r * 0.35)) onGGTap(Math.floor(best / 3), best % 3);
      return;
    }
    // 普鲁克（竖版宽格）：掷棍按钮 / 道路格 / 自家家区
    if (gActive === 'puluc') {
      const road = gLayout.pulucRoad, cellW = gLayout.pulucW, homeH = gLayout.homeH;
      const px = gLayout.pulucX, y0 = gLayout.pulucY;
      const stickY = y0 + homeH * 2 + puluc.CELLS * road + 22;
      // 掷棍按钮
      if (gPulucPhase === 'roll' && !gThink && !gOver) {
        if (hitTest({ x: W / 2 - 55, y: stickY + 24, w: 110, h: 32 }, x, y)) {
          startStickThrow();
          return;
        }
      }
      // 道路格
      if (x >= px && x <= px + cellW && y >= y0 + homeH && y <= y0 + homeH + puluc.CELLS * road) {
        const r = Math.floor((y - (y0 + homeH)) / road);
        if (r >= 0 && r < puluc.CELLS) onGGTap(0, r);
        return;
      }
      // 自家家区 → 进场
      const myHomeY = (gSide === 1) ? y0 : y0 + homeH + puluc.CELLS * road;
      if (x >= px - 6 && x <= px + cellW + 6 && y >= myHomeY - 8 && y <= myHomeY + homeH + 8) {
        onGGTap(-1, -1);
        return;
      }
      return;
    }
    // 方格类：施嘉 5×5 / 跳棋 8×8
    const size = gLayout.size, bx = gLayout.bx, by = gLayout.by;
    const n = (gActive === 'seega') ? 5 : 8;
    const cell = size / n;
    if (x >= bx && x <= bx + size && y >= by && y <= by + size) {
      const c = Math.floor((x - bx) / cell);
      const r = Math.floor((y - by) / cell);
      if (r >= 0 && r < n && c >= 0 && c < n) onGGTap(r, c);
    }
    return;
  }

  // 狼羊棋页面
  if (wsActive) {
    // 弹窗优先
    if (wsGameOver) {
      for (const b of wsModalButtons) {
        if (b.id === 'ws-again' && hitTest(b, x, y)) { startWsGame(); return; }
      }
      return; // 必须点按钮
    }
    if (wsShowRules) {
      for (const b of wsModalButtons) {
        if (b.id === 'ws-rules-close' && hitTest(b, x, y)) { wsShowRules = false; draw(); return; }
      }
      wsShowRules = false; // 点遮罩关闭
      draw();
      return;
    }
    // 返回菜单
    if (x >= 0 && x <= 90 && y >= SAFE_TOP && y <= SAFE_TOP + TITLE_H) { backToMenu(); return; }
    // 底部按钮
    for (const b of wsButtons) {
      if (hitTest(b, x, y)) {
        if (b.id === 'ws-toggle') {
          wsSide = (x < b.x + b.w / 2) ? 1 : 2; // 左半执狼、右半执羊
          startWsGame();
        } else if (b.id === 'ws-restart') startWsGame();
        else if (b.id === 'ws-rules') { wsShowRules = true; draw(); }
        return;
      }
    }
    // 棋盘（5×5 点阵）
    const { bx, by, cell } = wsLayout;
    if (x >= bx - cell / 2 && x <= bx + cell * 4 + cell / 2 && y >= by - cell / 2 && y <= by + cell * 4 + cell / 2) {
      const c = Math.round((x - bx) / cell);
      const r = Math.round((y - by) / cell);
      if (r >= 0 && r < 5 && c >= 0 && c < 5) onWsTap(r, c);
    }
    return;
  }

  // 弹窗优先
  if (isGameOver) {
    for (const b of modalButtons) {
      if (b.id === 'again' && hitTest(b, x, y)) {
        startGame();
        return;
      }
    }
    return; // 必须点按钮
  }
  if (showRules) {
    for (const b of modalButtons) {
      if (b.id === 'rules-close' && hitTest(b, x, y)) {
        showRules = false;
        draw();
        return;
      }
    }
    showRules = false; // 点遮罩关闭
    draw();
    return;
  }
  if (showLog) {
    for (const b of modalButtons) {
      if (hitTest(b, x, y)) {
        if (b.id === 'copy') copyLog();
        else if (b.id === 'log-close') { showLog = false; }
        draw();
        return;
      }
    }
    showLog = false; // 点遮罩关闭
    draw();
    return;
  }

  // 标题栏左侧「‹ 菜单」返回主菜单
  if (x >= 0 && x <= 90 && y >= SAFE_TOP && y <= SAFE_TOP + TITLE_H) {
    backToMenu();
    return;
  }

  // 固定按钮
  for (const b of buttons) {
    if (hitTest(b, x, y)) {
      if (b.id === 'side-toggle') {
        const half = b.w / 2;
        const mode = (x < b.x + half) ? 1 : 2; // 左半执黑、右半执白
        if (mode !== gameMode) changeMode(mode);
      } else if (b.id === 'diff1') changeDifficulty(1);
      else if (b.id === 'diff2') changeDifficulty(2);
      else if (b.id === 'diff3') changeDifficulty(3);
      else if (b.id === 'restart') startGame();
      else if (b.id === 'rules') { showRules = true; draw(); }
      else if (b.id === 'log') { showLog = true; draw(); }
      return;
    }
  }

  // 棋盘
  const { boardX, boardY, boardSize, cell } = layout;
  if (x >= boardX && x <= boardX + boardSize && y >= boardY && y <= boardY + boardSize) {
    const c = Math.floor((x - boardX) / cell);
    const r = Math.floor((y - boardY) / cell);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      onCellTap(r, c);
    }
  }
}

wx.onTouchStart(function (e) {
  sound.unlock(); // 首次触摸解锁音频（iOS 等平台要求手势后才能发声）
  const t = e.touches[0];
  if (!t) return;
  let x = t.clientX;
  let y = t.clientY;
  // 兼容：个别环境返回物理像素坐标，超出逻辑尺寸时归一化
  if (x > W || y > H) {
    x = x / DPR;
    y = y / DPR;
  }
  handleTap(x, y);
});

// ---------- 启动 ----------
gameMode = 1;
ai.maxDepth = DIFF_DEPTH[difficulty]; // 应用难度设置
computeWsLayout();
buildWsButtons();
computeGgLayout();
showMenu = true;
draw();
