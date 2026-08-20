// 普鲁克（Puluc 玛雅折返戏）：纯数据规则（对齐骑砍二酒馆版本）
// 规则（游戏内弹窗）：
//  掷骰：4 根双色棍，红面数=点数；0 红（全白）=5。
//  移动：棋子向对手大本营方向前进，到达最后一格后折返向自己本垒返回。
//  俘虏：落点有对方棋子时，对方整个堆叠被俘、叠在我方棋子下面，现在属于我方；
//        俘虏后本回合结束，堆叠必须掉头往回走（不能再前进）。
//  返回本垒（胜利）：堆叠准确落在自己本垒时，己方棋子回到 home 可重新使用，
//        堆叠里的对方俘虏棋子被淘汰出局；对方无可用棋子即获胜。
//  补充：同色棋子不能叠同一格；棋子只能前进，到敌方终点才折返；
//        俘虏堆叠返回途中可能被对手反俘虏夺回。
// 状态：cells[i] = null 或 { side(控制者), dir(堆叠方向), captives:[side...](下方俘虏，从早到晚) }
//       home = {1,2} 可重新使用数；eliminated = {1,2} 被淘汰数

const CELLS = 11; // 道路格数（对齐骑砍二：中间 11 格）
const PIECE = { Black: 1, White: 2 };
const TOTAL = 6; // 双方各 6 枚棋子

function createState() {
  return {
    cells: Array(CELLS).fill(null),
    home: { 1: TOTAL, 2: TOTAL },
    eliminated: { 1: 0, 2: 0 }
  };
}

// 掷骰：4 根双色棍红面数 n(0-4)，0 红 = 5 点
function roll() {
  let n = 0;
  for (let i = 0; i < 4; i++) if (Math.random() < 0.5) n++;
  return n === 0 ? 5 : n;
}

function homeEndOf(side) { return side === PIECE.Black ? 0 : CELLS - 1; }
function farEndOf(side) { return side === PIECE.Black ? CELLS - 1 : 0; }

// 某方可用棋子数 = home 可重新使用 + 场上己方控制的堆叠
function usableCount(state, side) {
  let n = state.home[side];
  for (let i = 0; i < CELLS; i++) {
    if (state.cells[i] && state.cells[i].side === side) n++;
  }
  return n;
}

// 从 pos 沿 dir 走 n 步（到敌方终点折返反射），返回落点与是否回到主本垒
// 回家规则（飞行棋式）：本垒格是道路上的格子；返回方向「越过」本垒格时——
//   · 剩余步数正好用完 → 回到主本垒结算；
//   · 步数多了 → 被顶回：从家往回弹剩余步数，停在弹回处，方向恢复朝家。
function landing(pos, dir, n, side) {
  const homeEnd = homeEndOf(side);
  const farEnd = farEndOf(side);
  let p = pos, d = dir;
  for (let i = 0; i < n; i++) {
    p += d;
    if (p === farEnd) {
      d = -d; // 到敌方终点折返（剩余步数继续走）
    } else if ((side === PIECE.Black && d === -1 && p < homeEnd) || (side === PIECE.White && d === 1 && p > homeEnd)) {
      // 越过己方本垒格（到家边缘），此时 p = 家外位置
      const remaining = n - (i + 1);
      if (remaining === 0) {
        return { p, dir: d, homeReturn: true }; // 正好到家 → 结算
      }
      // 步数多了 → 被顶回：从家往回弹 remaining 步（方向临时反向），弹完恢复朝家
      d = -d;
      for (let j = 0; j < remaining; j++) {
        p += d;
        if (p === farEnd) d = -d;
      }
      return { p, dir: -d, homeReturn: false };
    }
  }
  return { p, dir: d, homeReturn: false };
}

// 从家出发进场：掷出 n 点走满 n 格（从棋盘外"家"起算，第 1 步进本垒格，遇远端折返）
function enterLanding(side, n) {
  const homeEnd = homeEndOf(side);
  const farEnd = farEndOf(side);
  const dir = (side === PIECE.Black) ? 1 : -1;
  let p = homeEnd - dir; // 家在棋盘外一格
  let d = dir;
  for (let i = 0; i < n; i++) {
    p += d;
    if (p === farEnd) d = -d;
  }
  return { p, dir: d };
}

// 合法移动：进场（走满点数，落点同色不可）或 移动己方控制的堆叠（落点同色不可）
function moves(state, side, n) {
  const list = [];
  if (state.home[side] > 0) {
    const land = enterLanding(side, n);
    const target = state.cells[land.p];
    if (!target || target.side !== side) list.push({ kind: 'enter' });
  }
  for (let pos = 0; pos < CELLS; pos++) {
    const cell = state.cells[pos];
    if (!cell || cell.side !== side) continue;
    const land = landing(pos, cell.dir, n, side);
    if (land.homeReturn) { list.push({ kind: 'move', pos, n }); continue; }
    const target = state.cells[land.p];
    if (target && target.side === side) continue; // 同色不能叠
    list.push({ kind: 'move', pos, n });
  }
  return list;
}

// 应用移动，返回 { state, captured, ok }；非法返回 null
function applyMove(state, move, side, n) {
  // 深拷贝格子对象：applyMove 必须为纯函数——AI 评估会反复调用它且传入活状态，
  // 浅拷贝会让 cell.dir/captives 的修改（俘虏翻转、并入俘虏）原地污染输入状态，
  // 导致棋盘凭空多俘虏、AI 走子应用失败卡死。
  const st = {
    cells: state.cells.map(c => (c ? { ...c, captives: c.captives.slice() } : null)),
    home: { ...state.home },
    eliminated: { ...state.eliminated }
  };
  if (move.kind === 'enter') {
    // 从家出发，掷出 n 点走满 n 格；落点有对方堆叠则俘虏并强制返回
    const land = enterLanding(side, n);
    const target = st.cells[land.p];
    if (target && target.side === side) return null; // 同色不能叠
    st.home[side]--;
    let captured = 0;
    let dir = land.dir;
    let captives = [];
    if (target) {
      captives = [target.side].concat(target.captives);
      captured = 1 + target.captives.length;
      dir = -dir; // 俘虏后强制掉头往回走
    }
    st.cells[land.p] = { side, dir, captives };
    return { state: st, captured, ok: true };
  }
  const cell = st.cells[move.pos];
  if (!cell || cell.side !== side) return null;
  const land = landing(move.pos, cell.dir, n, side);
  if (land.homeReturn) {
    // 堆叠准确落在本垒：己方棋子回 home 可重新使用，俘虏敌子淘汰出局
    st.home[side] += 1;
    for (const s of cell.captives) st.eliminated[s]++;
    st.cells[move.pos] = null;
    return { state: st, captured: 0, ok: true };
  }
  const target = st.cells[land.p];
  st.cells[move.pos] = null;
  if (target) {
    if (target.side === side) return null; // 同色不能叠
    // 俘虏整个对方堆叠：对方控制者+其俘虏全部叠到我方棋子下面，所有权归我
    cell.captives = cell.captives.concat(target.side, target.captives);
    cell.dir = -cell.dir; // 俘虏后强制掉头往回走（本回合移动结束）
    st.cells[land.p] = cell;
    return { state: st, captured: 1 + target.captives.length, ok: true };
  }
  cell.dir = land.dir;
  st.cells[land.p] = cell;
  return { state: st, captured: 0, ok: true };
}

// 胜负：某方无可用棋子（home 与场上控制堆叠均为 0）→ 对方胜
function checkWin(state) {
  if (usableCount(state, PIECE.Black) === 0) return PIECE.White;
  if (usableCount(state, PIECE.White) === 0) return PIECE.Black;
  return null;
}

function hasAnyMove(state, side, n) {
  return moves(state, side, n).length > 0;
}

module.exports = {
  CELLS, PIECE, TOTAL, createState, roll, moves, applyMove,
  checkWin, hasAnyMove, usableCount, landing, enterLanding
};
