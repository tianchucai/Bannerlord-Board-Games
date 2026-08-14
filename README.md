# Tablut 塔布卢棋（微信小程序版）

北欧棋盘游戏 Tablut 的微信小程序实现，纯原生小程序（WXML/WXSS/JS），无任何游戏引擎依赖。

## 目录结构

```
.
├── miniprogram/              # 微信小程序源码（主项目）
│   ├── app.js / app.json / app.wxss
│   ├── sitemap.json
│   ├── pages/index/          # 游戏页面
│   │   ├── index.wxml        #   棋盘渲染
│   │   ├── index.wxss        #   样式（纯 CSS 棋子）
│   │   └── index.js          #   页面交互逻辑
│   └── utils/
│       ├── game.js           #   规则：阵型 / 走法 / 吃子 / 胜负（纯数据）
│       └── ai.js             #   Minimax + Alpha-Beta 剪枝（纯数据）
├── project.config.json       # 微信开发者工具项目配置
└── project.private.config.json  # 开发者工具本地私有配置（已 gitignore）
```

## 运行方式

1. 打开**微信开发者工具**。
2. 导入项目，选择本项目根目录（会自动读取 `project.config.json`，`miniprogramRoot` 已指向 `miniprogram/`）。
3. 编译运行。默认玩家执黑（先手），可在页面下方切换阵营。

## 规则简介

- 9×9 棋盘，中心为王座。白方 8 枚防御子 + 国王，黑方 16 枚进攻子。
- 所有棋子走直线（车），不可跳过其他棋子。
- **吃子**：一枚棋子移动到某位置后，若与其相邻的敌方棋子被另一侧（友军或空王座）夹住，则该敌方棋子被吃掉。
- **白方胜利**：国王走到棋盘边缘。
- **黑方胜利**：国王被吃掉。

## 逻辑测试

规则和 AI 均为纯数据模块，可直接用 Node 冒烟测试：

```bash
node -e "
const g = require('./miniprogram/utils/game');
const ai = require('./miniprogram/utils/ai');
let b = g.createEmptyBoard();
g.setupFormation(b);
console.log(ai.getBestMove(b, g.PieceType.Attacker));
"
```
