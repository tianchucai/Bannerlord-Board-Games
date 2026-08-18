// 帝国板棋（Tablut）微信小游戏
// 棋规与 AI 复用 utils/game.js 与 utils/ai.js，界面用 Canvas 渲染

const game = require('./utils/game');
const ai = require('./utils/ai');

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
  board = game.createEmptyBoard();
  game.setupFormation(board);
  currentTurn = PieceType.Attacker;
  selected = null;
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
      showGameOver('平局（步数上限）');
    } else {
      switchTurn();
    }
    draw();
  });
}

function showGameOver(msg) {
  isGameOver = true;
  winnerText = msg;
  selected = null;
  isThinking = false;
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

function draw() {
  // 背景（木纹）
  drawWoodBackground();

  // 标题
  drawText('帝国板棋', W / 2, SAFE_TOP + TITLE_H / 2, C.text, 22, 'center', 'middle');

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
startGame();
