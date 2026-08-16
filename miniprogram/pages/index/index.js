const game = require('../../utils/game');
const ai = require('../../utils/ai');

const PieceType = game.PieceType;
const SIZE = game.SIZE;

// 棋子类型 -> 渲染样式
const PIECE_INFO = {
  0: { cls: '' },                                  // 空
  1: { cls: 'piece-attacker' },                    // 黑
  2: { cls: 'piece-defender' },                    // 白
  3: { cls: 'piece-king' }                         // 国王
};

// 棋子类型 -> 中文名（用于日志）
function pieceName(t) {
  if (t === PieceType.Attacker) return '黑';
  if (t === PieceType.Defender) return '白';
  if (t === PieceType.King) return '王';
  return '空';
}

// 走子方名称
function sideName(t) {
  return t === PieceType.Attacker ? '黑' : '白';
}

function pos(r, c) {
  return '(' + r + ',' + c + ')';
}

const LOG_KEY = 'tablut_last_log';

Page({
  data: {
    cells: [],           // 81 个格子，每个 { r, c, piece }
    selected: null,      // 当前选中的棋子 { r, c }
    isGameOver: false,
    winnerText: '',
    gameMode: 1,         // 1: 玩家执黑(先手), 2: 玩家执白(后手)
    isThinking: false,
    currentTurnLabel: '黑方走棋',
    showRules: false,
    showLog: false,
    logText: '',
    rules: [
      '黑方 16 枚进攻子，白方 8 枚防御子加 1 枚国王。',
      '所有棋子沿直线移动，不可跳过其它棋子。',
      '只有国王能停在中央王座，士兵只能路过；国王一旦离开王座，就不能再回来。',
      '吃子：移动后，把敌方棋子夹在己方棋子与另一侧（己方棋子或空王座）之间，即可吃掉。',
      '所有棋子（包括国王）都按夹击方式吃子。',
      '白方胜利：国王抵达棋盘边缘。',
      '黑方胜利：国王被夹击吃掉。'
    ]
  },

  boardState: [],        // 逻辑棋盘（PieceType 二维数组）
  currentTurn: PieceType.Attacker,
  selectedPos: null,
  moveLog: [],           // 最近一局的行棋记录（字符串数组）
  moveCount: 0,          // 当前对局已走步数

  onLoad() {
    this.startGame();
  },

  startGame() {
    this.boardState = game.createEmptyBoard();
    game.setupFormation(this.boardState);
    this.currentTurn = PieceType.Attacker;
    this.selectedPos = null;
    this.moveLog = [];
    this.moveCount = 0;
    this.logLine('===== 新对局开始（' + (this.data.gameMode === 1 ? '玩家执黑' : '玩家执白') + '）=====');

    this.setData({
      isGameOver: false,
      winnerText: '',
      isThinking: false,
      selected: null,
      currentTurnLabel: '黑方走棋',
      showLog: false
    });

    this.refreshBoard();
    this.checkAiTurn();
  },

  // 追加一条日志并持久化
  logLine(text) {
    this.moveLog.push(text);
    this.setData({ logText: this.moveLog.join('\n') });
    try {
      wx.setStorageSync(LOG_KEY, this.moveLog.join('\n'));
    } catch (e) {}
  },

  // 把逻辑棋盘同步到渲染数据
  refreshBoard() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const type = this.boardState[r][c];
        cells.push({
          r,
          c,
          piece: type,
          cls: PIECE_INFO[type].cls,
          selected: !!(this.selectedPos && this.selectedPos.r === r && this.selectedPos.c === c),
          isThrone: game.isThrone(r, c),
          isStronghold: game.isStronghold(r, c)
        });
      }
    }
    this.setData({ cells });
  },

  onCellTap(e) {
    if (this.data.isGameOver || this.data.isThinking) return;

    const r = e.currentTarget.dataset.r;
    const c = e.currentTarget.dataset.c;

    // 阻止玩家操作 AI 的棋子
    if (this.data.gameMode === 1 && this.currentTurn === PieceType.Defender) return;
    if (this.data.gameMode === 2 && this.currentTurn === PieceType.Attacker) return;

    const clickedType = this.boardState[r][c];
    const isSameSide = game.checkSide(clickedType, this.currentTurn);

    if (!this.selectedPos) {
      if (clickedType !== PieceType.None && isSameSide) {
        this.selectPiece(r, c);
      }
      return;
    }

    // 点击已选中的棋子 -> 取消选择
    if (r === this.selectedPos.r && c === this.selectedPos.c) {
      this.deselectPiece();
      return;
    }

    // 换选己方另一枚棋子
    if (clickedType !== PieceType.None && isSameSide) {
      this.deselectPiece();
      this.selectPiece(r, c);
      return;
    }

    // 移动
    if (clickedType === PieceType.None) {
      if (game.isValidMove(this.boardState, this.selectedPos.r, this.selectedPos.c, r, c)) {
        this.movePiece(this.selectedPos.r, this.selectedPos.c, r, c);
      }
    }
  },

  selectPiece(r, c) {
    this.selectedPos = { r, c };
    this.refreshBoard();
  },

  deselectPiece() {
    this.selectedPos = null;
    this.refreshBoard();
  },

  movePiece(fromR, fromC, toR, toC) {
    const type = this.boardState[fromR][fromC];
    const mover = pieceName(type);
    this.boardState[toR][toC] = type;
    this.boardState[fromR][fromC] = PieceType.None;
    this.selectedPos = null;

    // 吃子
    const captured = game.checkCaptures(this.boardState, toR, toC);

    // 记录走子日志
    this.moveCount += 1;
    let line = this.moveCount + '. ' + sideName(type) + '[' + mover + '] ' +
      pos(fromR, fromC) + ' → ' + pos(toR, toC);
    if (captured.length > 0) {
      line += '　吃：' + captured.map(p => pieceName(p.type) + pos(p.r, p.c)).join('、');
    }
    this.logLine(line);

    // 胜负判定
    if (game.isKingCaptured(captured)) {
      this.showGameOver('黑方胜利！');
    } else if (game.checkWinCondition(this.boardState, toR, toC) === 'white') {
      this.showGameOver('白方胜利！');
    } else {
      this.switchTurn();
    }

    this.refreshBoard();
  },

  switchTurn() {
    this.currentTurn = (this.currentTurn === PieceType.Attacker)
      ? PieceType.Defender
      : PieceType.Attacker;
    this.setData({
      currentTurnLabel: this.currentTurn === PieceType.Attacker ? '黑方走棋' : '白方走棋'
    });
    this.checkAiTurn();
  },

  checkAiTurn() {
    let isAiTurn = false;
    if (this.data.gameMode === 1 && this.currentTurn === PieceType.Defender) isAiTurn = true;
    if (this.data.gameMode === 2 && this.currentTurn === PieceType.Attacker) isAiTurn = true;

    if (isAiTurn && !this.data.isGameOver) {
      this.setData({ isThinking: true });
      const delay = 300;
      setTimeout(() => this.executeAiMove(), delay);
    }
  },

  executeAiMove() {
    const bestMove = ai.getBestMove(this.boardState, this.currentTurn);
    if (bestMove) {
      this.movePiece(bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
    } else {
      // AI 无路可走
      this.showGameOver(this.currentTurn === PieceType.Attacker ? '白方胜利！' : '黑方胜利！');
    }
    this.setData({ isThinking: false });
  },

  showGameOver(msg) {
    this.setData({
      isGameOver: true,
      winnerText: msg,
      selected: null,
      currentTurnLabel: '对局结束'
    });
    this.logLine('===== 对局结束：' + msg + ' =====');
  },

  onRestartTap() {
    this.startGame();
  },

  onShowRules() {
    this.setData({ showRules: true });
  },

  onHideRules() {
    this.setData({ showRules: false });
  },

  onShowLog() {
    this.setData({ showLog: true });
  },

  onHideLog() {
    this.setData({ showLog: false });
  },

  onCopyLog() {
    const text = this.data.logText || '（暂无行棋记录）';
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  onNoop() {},

  // 切换阵营：1=玩家执黑(先手)，2=玩家执白(后手)
  onChangeMode(e) {
    const mode = Number(e.currentTarget.dataset.mode);
    this.setData({ gameMode: mode });
    this.startGame();
  }
});
