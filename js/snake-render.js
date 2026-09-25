// 蛇身轮廓渲染（BOABITE_DESIGN.md §7.2）。
// 造型依据《小王子》原画：一条平躺的蛇，左侧鼓起被吞下的象，
// 向右收成细长的尾，末端是一个小圆头和一个点眼——全部是同一条连续轮廓。

const BASE = 98;   // 蛇腹底线，始终贴平
const TOP = 88;    // 细身部分的上缘，厚度 10——再细就不像身体了
const MAX_FOODS = 6;

// 隆起高度只由食物数量决定，0 件时完全没有包，蛇接近一条线（§5.2 空状态）
export function humpHeight(foodCount) {
  const n = Math.min(Math.max(foodCount, 0), MAX_FOODS);
  return n === 0 ? 0 : 14 + n * 11;
}

// 纯函数：给定隆起高度算出完整轮廓。方便单测，也方便以后接食物布局。
export function bodyPath(h) {
  const peak = TOP - h;
  const r = (k) => (TOP - h * k).toFixed(2);
  return [
    `M8 ${TOP}`,
    `L42 ${TOP}`,
    // 左肩抬起
    `C52 ${TOP} 56 ${r(0.42)} 66 ${r(0.72)}`,
    `C78 ${r(1.0)} 92 ${peak.toFixed(2)} 112 ${peak.toFixed(2)}`,
    // 顶部一处浅浅的塌陷，象背和象臀之间
    `C132 ${peak.toFixed(2)} 140 ${r(0.93)} 152 ${r(0.88)}`,
    `C163 ${r(0.84)} 168 ${r(0.8)} 178 ${r(0.72)}`,
    // 右肩落回细身
    `C190 ${r(0.5)} 200 ${r(0.16)} 216 ${TOP}`,
    `L268 ${TOP}`,
    // 小圆头：颈部微收后鼓成钝圆，比尾明显粗一圈
    `C276 ${TOP} 280 ${TOP - 0.8} 286 ${TOP - 2.6}`,
    `C294 ${TOP - 5} 305 ${TOP - 4.4} 311 ${TOP - 1.4}`,
    `C316 ${TOP + 1.2} 316.5 ${BASE - 2.4} 312 ${BASE - 0.6}`,
    `C306 ${BASE + 1.4} 296 ${BASE + 1} 288 ${BASE}`,
    // 底线一路平回左端
    `L30 ${BASE}`,
    `C16 ${BASE} 8 ${BASE - 0.6} 8 ${TOP}`,
    'Z',
  ].join(' ');
}

export function renderSnake(pathEl, foodCount) {
  pathEl.setAttribute('d', bodyPath(humpHeight(foodCount)));
}
