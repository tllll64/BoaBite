// 吞食反馈页的蛇身渲染（BOABITE_DESIGN.md §6.4）。
// 造型不另画一份：直接复用首页的 bodyPath()，保证两屏是同一条蛇。
// 差别只在这里要把食物轮廓裁进隆起里，所以取静态路径（t=0），
// 让 clipPath 和可见轮廓始终是同一条线——逐帧蠕动会让裁剪跟不上。

import { bodyPath, humpHeight } from './snake-render.js';

const BASE = 178;   // 与 snake-render.js 一致
const TOP = 152;

// 食物摆放框：落在隆起内部，四周留出边距不贴到线稿上。
// 隆起大致横跨 x 90–254，峰顶在 TOP-h。
export function foodBox(h) {
  const peak = TOP - h;
  const pad = 10;
  const x = 104;
  const w = 142;
  const y = peak + pad + 6;
  return { x, y, w, h: BASE - y - pad };
}

/**
 * 渲染吞下食物后的蛇身。
 * @param {{shape:SVGPathElement, outline:SVGPathElement, foods:SVGGElement}} els
 * @param {{image:string, aspectRatio:number}|null} food 抠好的轮廓；没有则只画空腹的蛇
 * @param {number} foodCount 肚子里共有几件，决定隆起高度
 */
export function renderSwallow(els, food, foodCount = 1) {
  const h = humpHeight(foodCount);
  const d = bodyPath(h, 0);
  els.shape.setAttribute('d', d);     // clipPath 用
  els.outline.setAttribute('d', d);   // 可见线稿
  els.foods.innerHTML = '';
  if (!food?.image) return;

  const box = foodBox(h);
  const ar = food.aspectRatio || 1;
  let w = box.w;
  let hh = w / ar;
  if (hh > box.h) { hh = box.h; w = hh * ar; }
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - hh) / 2;

  const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  img.setAttribute('href', food.image);
  img.setAttribute('x', x.toFixed(1));
  img.setAttribute('y', y.toFixed(1));
  img.setAttribute('width', w.toFixed(1));
  img.setAttribute('height', hh.toFixed(1));
  img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  els.foods.appendChild(img);
}
