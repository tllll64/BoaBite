// 蛇身轮廓渲染（BOABITE_DESIGN.md §7.2）。
// 造型依据《小王子》原画：一条平躺的蛇，中段鼓起被吞下的象，
// 左侧收成细身，右端是一个向右探出的钝楔形头和一个点眼——全部是同一条连续轮廓。
//
// 坐标系：viewBox 0 0 320 190，与 index.html 的 .snake-body 一致。

const BASE = 178;        // 蛇腹底线，始终贴平
const TOP = 152;         // 细身部分的上缘，厚度 26
const HUMP_REST = 66;    // 空腹时的隆起高度——蛇本来就有肚子，不是一条线
const HUMP_PER_FOOD = 8; // 每投喂一件再鼓高一点
const MAX_FOODS = 6;

// 隆起高度：0 件时是 HUMP_REST（已经有肚子），随投喂数量继续鼓起（§5.2）
export function humpHeight(foodCount) {
  const n = Math.min(Math.max(foodCount, 0), MAX_FOODS);
  return HUMP_REST + n * HUMP_PER_FOOD;
}

// 纯函数：给定隆起高度算出完整轮廓。方便单测，也方便以后接食物布局。
const NECK = 254;         // 颈部枢轴 x：头部绕这里做刚体旋转
const TAIL_END = 70;      // 细身与隆起的交界

// 全身共用同一个相位场，只让幅度和运动形式随区域变——
// 这样波才会从尾一路传到头，读作蠕动；各区独立取相位就会散成三处各自抖。
const OMEGA = 1.7;        // 角频率
const K = 0.026;          // 波数，决定波长
const AMP_HUMP = 2.4;     // 隆起段上缘最大位移
const AMP_TAIL = 0.9;     // 细身段幅度，受 26 的厚度限制不能大
const TAIL_SWAY = 1.3;    // 尾尖整段上下摆
const HEAD_ROT = 1.6;     // 头部点头角度（度）
const DRIFT = 2.6;        // 隆起峰位左右漂移
const DRIFT_OMEGA = 0.43;

const phase = (t, x) => Math.sin(t * OMEGA - x * K);

// 隆起段权重：顶部最大，向两端衰减到 0
function humpWeight(x) {
  if (x < TAIL_END || x > NECK + 8) return 0;
  return Math.sin(((x - TAIL_END) / (NECK + 8 - TAIL_END)) * Math.PI) ** 1.4;
}

// 细身段权重：从尾尖到交界逐渐增强，尾尖本身摆幅最大
function tailWeight(x) {
  if (x > TAIL_END) return 0;
  return Math.max(0, 1 - Math.abs(x - 40) / 46);
}

// 头部刚体旋转：绕颈部转，避免让 26 单位厚的楔形产生形变（会像果冻）
export function headAngle(t) {
  return HEAD_ROT * phase(t, NECK);
}

function rotate(x, y, deg) {
  const a = (deg * Math.PI) / 180;
  const dx = x - NECK;
  const dy = y - TOP;
  return [
    NECK + dx * Math.cos(a) - dy * Math.sin(a),
    TOP + dx * Math.sin(a) + dy * Math.cos(a),
  ];
}

// 纯函数：给定隆起高度和时刻算出完整轮廓。
export function bodyPath(h, t = 0) {
  const peak = TOP - h;
  const drift = DRIFT * Math.sin(t * DRIFT_OMEGA);
  const ang = headAngle(t);

  // 上缘位移：隆起段和细身段用同一相位、不同幅度
  const w = (x) =>
    AMP_HUMP * humpWeight(x) * phase(t, x) +
    (AMP_TAIL + TAIL_SWAY) * tailWeight(x) * phase(t, x);

  const r = (k, x) => (TOP - h * k + (x === undefined ? 0 : w(x))).toFixed(2);
  const f = (v, x) => (v + (x === undefined ? 0 : w(x))).toFixed(2);
  // 头部各点先旋转再输出
  const hp = (x, y) => rotate(x, y, ang).map((v) => v.toFixed(2)).join(' ');

  return [
    `M8 ${f(TOP, 8)}`,
    // 细身上缘，带一点手绘起伏，不是一条直线
    `C9 ${f(TOP - 3.4, 9)} 24 ${f(TOP - 4.6, 24)} 44 ${f(TOP - 4, 44)}`,
    `C62 ${f(TOP - 3.5, 62)} 78 ${f(TOP - 5, 78)} 90 ${f(TOP - 6.5, 90)}`,
    // 左肩抬起：起手缓、中段陡
    `C106 ${r(0.2, 106)} 118 ${r(0.58, 118)} ${f(138 + drift)} ${r(0.93, 138)}`,
    `C${f(146 + drift)} ${f(peak, 146)} ${f(156 + drift)} ${f(peak - 1.6, 156)} ${f(168 + drift)} ${f(peak - 1, 168)}`,
    // 顶部一处浅浅的塌陷，象背和象臀之间
    `C${f(182 + drift)} ${r(0.985, 182)} ${f(196 + drift)} ${r(0.95, 196)} ${f(208 + drift)} ${r(0.965, 208)}`,
    `C216 ${r(0.975, 216)} 221 ${r(0.925, 221)} 227 ${r(0.82, 227)}`,
    // 右肩陡降，收进颈部
    `C236 ${r(0.58, 236)} 245 ${r(0.28, 245)} 254 ${r(0.09, 254)}`,
    `C${hp(258, TOP - 1)} ${hp(260, TOP - 7)} ${hp(266, TOP - 7.4)}`,
    // 头：向右下探出的钝楔，末端收圆
    `C${hp(282, TOP - 6)} ${hp(300, TOP + 2)} ${hp(309, TOP + 11)}`,
    `C${hp(314, TOP + 16)} ${hp(313, BASE - 2.4)} ${hp(304, BASE - 0.6)}`,
    // 底线一路平回左端：底线始终贴平（§5.2）
    `L26 ${BASE}`,
    `C12 ${BASE} 8 ${BASE - 2} 8 ${f(TOP, 8)}`,
    'Z',
  ].join(' ');
}

// ---- 食物轮廓 ----
// 蛇腹的可用区域：底线以上、隆起以内，左右留出细身段
const BELLY_LEFT = 84;
const BELLY_RIGHT = 250;
const FLOOR_PAD = 3;      // 食物与底线的间隙
const CEIL_PAD = 4;       // 食物与上缘的间隙
// 相邻食物允许重叠：肚子里的东西本来就是挤在一起的，
// 严格分槽会让件数一多就把每件压成贴片。
const SLOT_OVERLAP = 0.42;

// 上缘的三次贝塞尔分段，与 bodyPath 用同一组控制点，但取 t=0 的静止形状——
// 布局必须基于静止轮廓，否则食物会跟着蠕动一起抖。
function upperSegments(h) {
  const peak = TOP - h;
  const r = (k) => TOP - h * k;
  return [
    [8, TOP, 9, TOP - 3.4, 24, TOP - 4.6, 44, TOP - 4],
    [44, TOP - 4, 62, TOP - 3.5, 78, TOP - 5, 90, TOP - 6.5],
    [90, TOP - 6.5, 106, r(0.2), 118, r(0.58), 138, r(0.93)],
    [138, r(0.93), 146, peak, 156, peak - 1.6, 168, peak - 1],
    [168, peak - 1, 182, r(0.985), 196, r(0.95), 208, r(0.965)],
    [208, r(0.965), 216, r(0.975), 221, r(0.925), 227, r(0.82)],
    [227, r(0.82), 236, r(0.58), 245, r(0.28), 254, r(0.09)],
  ];
}

const cubic = (a, b, c, d, u) => {
  const m = 1 - u;
  return m * m * m * a + 3 * m * m * u * b + 3 * m * u * u * c + u * u * u * d;
};

// 上缘在任意 x 处的 y。解析求值，不问 DOM——
// 轮廓每帧在变，命中测试拿到的可能是上一帧甚至空路径。
export function ceilingAt(x, h) {
  const segs = upperSegments(h);
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segs) {
    const lo = Math.min(x0, x3);
    const hi = Math.max(x0, x3);
    if (x < lo || x > hi) continue;
    // x(u) 在每段内单调，二分足够
    let a = 0;
    let b = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (a + b) / 2;
      if (cubic(x0, x1, x2, x3, mid) < x) a = mid; else b = mid;
    }
    return cubic(y0, y1, y2, y3, (a + b) / 2);
  }
  return TOP;
}

// 一段区间内最低的上缘（y 最大者），决定这段能放多高的东西
function ceilingIn(xa, xb, h) {
  let worst = -Infinity;
  const step = Math.max(1, (xb - xa) / 8);
  for (let x = xa; x <= xb; x += step) worst = Math.max(worst, ceilingAt(x, h));
  return Math.max(worst, ceilingAt(xb, h));
}

// 可用区间：只取隆起的宽阔平台，不含两端细身的斜坡。
// 剖面在 x=136..224 有个平台（可用高度 85+），而 x=84 处只有 31——
// 把斜坡算进槽位会让 ceilingIn 取到最低点，食物被压成贴片。
function bellySpan(h) {
  const peakY = ceilingAt(170, h);
  const maxAvail = BASE - FLOOR_PAD - peakY;
  const enough = (x) => (BASE - FLOOR_PAD - ceilingAt(x, h)) >= maxAvail * 0.62;
  let left = 170;
  let right = 170;
  while (left > BELLY_LEFT && enough(left - 2)) left -= 2;
  while (right < BELLY_RIGHT && enough(right + 2)) right += 2;
  return [left, right];
}

/**
 * 把食物画进蛇腹。尺寸由该处蛇腹的实际可用高度决定，
 * 所以食物总是尽量撑满肚子，而不是按固定基准缩成贴片。
 */
export function renderFoods(groupEl, foods, humpH) {
  if (!groupEl) return;
  if (!foods.length) { groupEl.innerHTML = ''; return; }

  const h = humpH ?? current;
  const [spanL, spanR] = bellySpan(h);
  const span = spanR - spanL;
  const n = foods.length;
  const slotW = span / n;

  groupEl.innerHTML = foods.map((f, i) => {
    const cut = f.cutout;
    const aspect = (cut.width / cut.height) || 1;
    const xa = spanL + i * slotW;
    const xb = xa + slotW;

    // 这一段可用的垂直空间
    const avail = BASE - FLOOR_PAD - ceilingIn(xa, xb, h) - CEIL_PAD;
    if (avail <= 6) return '';

    // 先按可用高度撑满，再受槽宽约束——槽宽放宽到允许重叠，
    // 否则件数一多，宽高比会把高度一起拽下来。
    let ih = avail;
    let iw = ih * aspect;
    const maxW = slotW * (1 + SLOT_OVERLAP);
    if (iw > maxW) { iw = maxW; ih = iw / aspect; }
    // 仍要确保不超出这一段的可用高度
    if (ih > avail) { ih = avail; iw = ih * aspect; }

    const x = xa + (slotW - iw) / 2;
    const y = BASE - FLOOR_PAD - ih;
    const cx = (x + iw / 2).toFixed(1);
    const cy = (y + ih / 2).toFixed(1);
    // 轻微倾斜，由 id 决定所以刷新后不变（§7.1 固定种子）
    const rot = ((f.id.charCodeAt(f.id.length - 1) % 7) - 3) * 0.9;
    return `<image href="${cut.image}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" preserveAspectRatio="xMidYMid meet" transform="rotate(${rot.toFixed(1)} ${cx} ${cy})" />`;
  }).join('');
}

// 眼睛的静止位置，随头部一起旋转
const EYE = [296, 167];
export function eyePos(t) {
  return rotate(EYE[0], EYE[1], headAngle(t));
}

// ---- 动画循环 ----
// 每帧重算 d：CSS transition 在逐帧改 d 时会被反复重启、糊成一团，
// 所以长大的过渡也在这里缓动，让路径只有一个权威来源。
const FPS = 30;
let raf = null;
let target = HUMP_REST;   // 目标隆起高度
let current = HUMP_REST;  // 当前值，朝 target 缓动
let el = null;
let last = 0;
let t0 = 0;

const reduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (now - last < 1000 / FPS) return;
  last = now;
  current += (target - current) * 0.08;          // 指数缓动，约 0.8s 到位
  const t = (now - t0) / 1000;
  el.setAttribute('d', bodyPath(current, t));
  syncEye(t);
}

// 眼睛是独立的 <circle>，头转了就得跟着走，否则会掉在轮廓外
let eyeEl = null;
function syncEye(t) {
  if (!eyeEl) eyeEl = document.querySelector('.snake-eye');
  if (!eyeEl) return;
  const [x, y] = eyePos(t);
  eyeEl.setAttribute('cx', x.toFixed(2));
  eyeEl.setAttribute('cy', y.toFixed(2));
}

export function renderSnake(pathEl, foodCount) {
  el = pathEl;
  target = humpHeight(foodCount);

  // 尊重 prefers-reduced-motion：静态渲染，不起循环（§8）
  if (reduced()) {
    stopSnake();
    current = target;
    el.setAttribute('d', bodyPath(current, 0));
    syncEye(0);
    return;
  }
  if (raf === null) {
    t0 = performance.now();
    last = 0;
    raf = requestAnimationFrame(frame);
  }
}

// 离开首页或页面隐藏时停掉，避免常驻 rAF 持续耗电
export function stopSnake() {
  if (raf !== null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}
