// 普鲁克（Puluc 玛雅折返戏）：纯数据规则 + 贪心 AI
// 规则：一条 5 格的道路（格 0-4），双方各 5 枚棋子从两端出发；
//       掷 4 根两面木棍（标记面数 0-4）决定步数；
//       移动一枚棋子：从己方"家"进场(占格0)，或已在路的棋子沿路前进；
//       到达格 4 后折返往回走，回到格 0 即离场(完成)；
//       落点格若含对方棋子，对方该格最上面一枚被捕获送回其"家"；
//       先让全部 5 枚棋子离场的一方获胜。
// 状态：cells[i] = 该格棋子栈（元素 { side, dir }，dir: 1=前进 -1=返回）；
//       home = {1,2} 等待进场数；done = {1,2} 已离场数

const CELLS = 5;
const PIECE = { Black: 1, White: 2 };
const TOTAL = 5;

function createState() {
  return {
    cells: Array.from({ length: CELLS }, () => []),
    home: { 1: TOTAL, 2: TOTAL },
    done: { 1: 0, 2: 0 }
  };
}

// 掷骰：4 根两面棍 → 标记面数 0-4（均匀）
function roll() {
  let n = 0;
  for (let i = 0; i < 4; i++) if (Math.random() < 0.5) n++;
  return n;
}

// 某方所有合法移动（掷出 n 步后）：进场 或 移动棋盘上最上面的己方棋子
function moves(state, side, n) {
  const list = [];
  if (state.home[side] > 0) list.push({ kind: 'enter' });
  for (let pos = 0; pos < CELLS; pos++) {
    const stack = state.cells[pos];
    if (stack.length === 0) continue;
    if (stack[stack.length - 1].side !== side) continue; // 只动己方压顶子
    list.push({ kind: 'move', pos, n });
  }
  return list;
}

// 走子，返回 { state, captured }
function applyMove(state, move, side, n) {
  const st = {
    cells: state.cells.map(stack => stack.slice()),
    home: { ...state.home },
    done: { ...state.done }
  };
  let captured = 0;
  if (move.kind === 'enter') {
    st.home[side]--;
    st.cells[0].push({ side, dir: 1 });
  } else {
    const stack = st.cells[move.pos];
    const piece = stack.pop();
    let p = move.pos, dir = piece.dir;
    let done = false;
    for (let i = 0; i < n; i++) {
      p += dir;
      if (p === CELLS - 1 && dir === 1) { dir = -1; }      // 到达远端格 4 掉头
      else if (p <= 0 && dir === -1) { done = true; break; } // 返回途中到格 0 离场
    }
    if (done) {
      st.done[side]++;
    } else {
      piece.dir = dir;
      st.cells[p].push(piece);
      // 捕获：落点格有对方棋子 → 最上面一枚送回其 home
      for (let i = st.cells[p].length - 1; i >= 0; i--) {
        if (st.cells[p][i].side !== side) {
          const oppPiece = st.cells[p].splice(i, 1)[0];
          st.home[oppPiece.side]++;
          captured++;
          break;
        }
      }
    }
  }
  return { state: st, captured };
}

function checkWin(state) {
  if (state.done[PIECE.Black] >= TOTAL) return PIECE.Black;
  if (state.done[PIECE.White] >= TOTAL) return PIECE.White;
  return null;
}

function hasAnyMove(state, side, n) {
  return moves(state, side, n).length > 0;
}

// AI：掷出 n 步后，优先捕获对方子、其次推进最接近离场的子、再其次进场
function aiMove(state, side, n) {
  const list = moves(state, side, n);
  if (list.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const m of list) {
    const { state: st, captured } = applyMove(state, m, side, n);
    let score = captured * 100;
    score += st.done[side] * 10;
    score -= st.home[side] * 2;
    for (let pos = 0; pos < CELLS; pos++) {
      for (const pc of st.cells[pos]) {
        if (pc.side !== side) continue;
        const dist = (pc.dir === 1) ? (CELLS - 1 - pos) : pos;
        score += (CELLS - dist) * 0.5; // 越接近折返/离场越好
      }
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

module.exports = {
  CELLS, PIECE, TOTAL, createState, roll, moves, applyMove,
  checkWin, hasAnyMove, aiMove
};
