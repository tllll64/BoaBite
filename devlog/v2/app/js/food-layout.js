// 食物在蛇腹中的布局（BOABITE_DESIGN.md §7.1）。
// 全部是纯函数：同样的输入必定得到同样的输出，方便单测，
// 也保证刷新页面后不会重排（布局结果由调用方保存）。

import { readMask } from './food-cutout.js';

// 用日期和记录 id 生成固定种子，避免每次渲染都随机（§7.1）
export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFrom(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// 把 alphaMask 采样成 grid×grid 的占用格，用于快速碰撞
function occupancy(item, grid) {
  const m = readMask(item.alphaMask);
  const cells = new Uint8Array(grid * grid);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const mx = Math.min(m.w - 1, Math.floor((x / grid) * m.w));
      const my = Math.min(m.h - 1, Math.floor((y / grid) * m.h));
      if (m.get(mx, my)) cells[y * grid + x] = 1;
    }
  }
  return cells;
}

// 两个已放置对象是否重叠：先比外接矩形，再比 alpha 占用格。
// 只比矩形会让不规则食物之间出现大片视觉空隙（§7.1）。
function overlaps(a, b, grid, gap) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  if (a.x - gap > bx2 || b.x - gap > ax2 || a.y - gap > by2 || b.y - gap > ay2) return false;

  // 在重叠矩形区域内逐格比对
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(ax2, bx2);
  const y2 = Math.min(ay2, by2);
  const step = Math.max(1, Math.floor(Math.min(x2 - x1, y2 - y1) / grid));
  for (let y = y1; y < y2; y += step) {
    for (let x = x1; x < x2; x += step) {
      const au = a.cells[
        Math.min(grid - 1, Math.floor(((y - a.y) / a.h) * grid)) * grid +
        Math.min(grid - 1, Math.floor(((x - a.x) / a.w) * grid))
      ];
      if (!au) continue;
      const bu = b.cells[
        Math.min(grid - 1, Math.floor(((y - b.y) / b.h) * grid)) * grid +
        Math.min(grid - 1, Math.floor(((x - b.x) / b.w) * grid))
      ];
      if (bu) return true;
    }
  }
  return false;
}

/**
 * 计算食物在蛇腹里的位置。
 * 蛇的大小由食物的有效视觉面积决定，而不是投喂次数（§7.1）。
 *
 * @param {Array} foods 每项需含 id、width、height、alphaMask
 * @param {{width:number,maxHeight:number,padding:number,minHeight?:number,grid?:number,gap?:number}} opts
 * @returns {{height:number, scale:number, items:Array<{id,x,y,w,h,scale,rotation}>}}
 */
export function layoutFoods(foods, opts) {
  const {
    width,
    maxHeight,
    padding = 12,
    minHeight = 40,
    grid = 16,
    gap = 4,
  } = opts;

  if (!foods.length) return { height: minHeight, scale: 1, items: [] };

  const inner = width - padding * 2;
  const prepared = foods.map((f) => ({ ...f, cells: occupancy(f, grid) }));

  // 物体基准尺寸只由容器宽度决定，不跟蛇腹高度联动——
  // 否则抬高蛇腹会把食物一起放大，永远腾不出空间。
  // 基准尺寸：食物要撑起蛇腹，而不是当贴片。1.35 是放大系数，
  // 除以 1.6 让单件就能占到容器大半宽。
  const unit = Math.min(inner / 1.6, 150) * 1.35;

  // 蛇的大小由食物的有效视觉面积决定（§7.1）：
  // 先按总可见面积估一个高度，再从这里开始尝试。
  const area = prepared.reduce((sum, f) => {
    const cover = f.cells.reduce((n, c) => n + c, 0) / f.cells.length;
    return sum + unit * unit * (f.aspectRatio > 1 ? 1 : 1 / (f.aspectRatio || 1)) * cover;
  }, 0);
  const guess = Math.round(Math.sqrt(area / Math.max(1, inner)) * 2.2 + unit * 0.7);
  const startH = Math.max(minHeight, Math.min(maxHeight, guess));

  // 先在原始比例下从估算高度一路抬到上限（§7.1 第 1 步）
  for (let height = startH; height <= maxHeight; height += 10) {
    const placed = tryPlace(prepared, { inner, height, padding, scale: 1, grid, gap, unit });
    if (placed) return { height, scale: 1, items: placed };
  }
  // 抬到上限仍放不下，才整体缩小；此时高度保持在上限，不再回落（§7.1 第 2 步）
  for (let scale = 0.94; scale >= 0.3; scale -= 0.06) {
    const placed = tryPlace(prepared, { inner, height: maxHeight, padding, scale, grid, gap, unit });
    if (placed) return { height: maxHeight, scale: +scale.toFixed(2), items: placed };
  }

  // 极端情况下不放弃渲染，用最小比例硬排
  const fallback = tryPlace(prepared, { inner, height: maxHeight, padding, scale: 0.3, grid, gap, unit, force: true });
  return { height: maxHeight, scale: 0.3, items: fallback || [] };
}

function tryPlace(foods, { inner, height, padding, scale, grid, gap, unit, force = false }) {
  const out = [];
  // 大的先放，小的更容易塞进缝隙
  const order = [...foods].sort((a, b) => b.width * b.height - a.width * a.height);

  for (const f of order) {
    const w = Math.max(8, Math.round(unit * scale * Math.min(1.4, f.aspectRatio || 1)));
    const h = Math.max(8, Math.round((w / (f.aspectRatio || 1))));
    if (h > height - gap * 2 && !force) return null;

    const rng = rngFrom(seedFrom(String(f.id)));
    let done = false;
    // 候选位置由种子生成，所以同一条记录每次算出的位置相同
    for (let attempt = 0; attempt < 48 && !done; attempt++) {
      const x = padding + Math.round(rng() * Math.max(0, inner - w));
      const y = Math.round(rng() * Math.max(0, height - h));
      const cand = { id: f.id, x, y, w, h, cells: f.cells };
      if (out.every((p) => !overlaps(cand, p, grid, gap))) {
        out.push({
          ...cand,
          scale: +(w / (f.width || w)).toFixed(3),
          rotation: Math.round((rng() * 10 - 5) * 10) / 10,
        });
        done = true;
      }
    }
    if (!done) {
      if (!force) return null;
      out.push({ id: f.id, x: padding, y: 0, w, h, cells: f.cells, scale: 1, rotation: 0 });
    }
  }

  // 去掉内部字段，只留布局结果
  return out.map(({ cells, ...rest }) => rest);
}
