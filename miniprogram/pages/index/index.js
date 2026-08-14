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

Page({
  data: {
    cells: [],           // 81 个格子，每个 { r, c, piece }
    selected: null,      // 当前选中的棋子 { r, c }
    isGameOver: false,
    winnerText: '',
    gameMode: 1,         // 1: 玩家执黑(先手), 2: 玩家执白(后手)
    isThinking: false,
    currentTurnLabel: '黑方走棋'
  },

  boardState: [],        // 逻辑棋盘（PieceType 二维数组）
  currentTurn: PieceType.Attacker,
  selectedPos: null,

  onLoad() {
    this.startGame();
  },

  startGame() {
    this.boardState = game.createEmptyBoard();
    game.setupFormation(this.boardState);
    this.currentTurn = PieceType.Attacker;
    this.selectedPos = null;

    this.setData({
      isGameOver: false,
      winnerText: '',
      isThinking: false,
      selected: null,
      currentTurnLabel: '黑方走棋'
    });

    this.refreshBoard();
    this.checkAiTurn();
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
    this.boardState[toR][toC] = type;
    this.boardState[fromR][fromC] = PieceType.None;
    this.selectedPos = null;

    // 吃子
    const captured = game.checkCaptures(this.boardState, toR, toC);

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
  },

  onRestartTap() {
    this.startGame();
  },

  // 切换阵营：1=玩家执黑(先手)，2=玩家执白(后手)
  onChangeMode(e) {
    const mode = Number(e.currentTarget.dataset.mode);
    this.setData({ gameMode: mode });
    this.startGame();
  }
});
