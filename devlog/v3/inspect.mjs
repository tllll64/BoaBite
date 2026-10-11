// BoaBite V3 · 巡检：加载页面、抓错误、走投喂链路、输出布局数据与截图
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'app');
const out = join(dirname(fileURLToPath(import.meta.url)), 'screens-inspect');
const BASE = process.env.BASE_URL || 'http://localhost:8003';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);

const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(out, `${name}.png`) });
};

// 输出每个活动视图的关键布局数据（矩形、文本、可见性）
const layout = () => page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vis: getComputedStyle(el).visibility, dis: getComputedStyle(el).display };
  };
  const active = document.querySelector('.view.active');
  return {
    active: active ? active.id : null,
    phone: r(document.querySelector('.phone')),
    snake: r(document.querySelector('#snakeHolder')),
    feedBtn: r(document.querySelector('#feedBtn')),
    bubble: r(document.querySelector('#bubbleText')),
    today: r(document.querySelector('#todayPanel')),
    shareBtn: r(document.querySelector('#btnShare')),
    camOverlay: r(document.querySelector('.cam-overlay')),
    camBar: r(document.querySelector('.cam-bar')),
    cfRing: r(document.querySelector('.cf-ring')),
    cfBottom: r(document.querySelector('.cf-bottom')),
    tkSnake: r(document.querySelector('#tkSnake')),
    tkCard: r(document.querySelector('.tk-card')),
    tkFace: r(document.querySelector('#tkFace')),
    elBox: r(document.querySelector('.el-box')),
    rsBody: r(document.querySelector('.rs-body')),
    prdPanel: r(document.querySelector('#prdPanel')),
  };
});

const report = (label, data) => {
  console.log('\n===== ' + label + ' =====');
  console.log(JSON.stringify(data, null, 1));
};

// 1. 首页空态
await shot('01-home-empty');
report('01-home-empty', await layout());
console.log('bubble text =', await page.evaluate(() => document.getElementById('bubbleText').textContent));

// 2. 进相机（无摄像头 → 演示模式）
await page.locator('#feedBtn').click();
await page.waitForTimeout(500);
await shot('02-camera');
report('02-camera', await layout());

// 3. 快门 → 识别呼吸 → 抠像确认
await page.locator('#camShutter').click();
await page.waitForTimeout(1200);
await shot('03-recognizing');
await page.waitForTimeout(2600);
await shot('04-confirm');
report('04-confirm', await layout());

// 4. 投食状
await page.locator('#cfConfirm').click();
await page.waitForTimeout(400);
await shot('05-pledge');
report('05-pledge', await layout());

// 5. 马上喂 → 品鉴加载 → 品鉴结果
await page.locator('#plFeed').click();
await page.waitForTimeout(600);
await shot('06-eatload');
await page.waitForTimeout(2600);
await shot('07-result');
report('07-result', await layout());

// 6. 喂完了回首页（有记录态）
await page.locator('#tkDone').click();
await page.waitForTimeout(500);
await shot('08-home-fed');
report('08-home-fed', await layout());
console.log('state =', await page.evaluate(() => localStorage.getItem('boabite_today')));

console.log('\n===== ERRORS =====');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
console.log('\nscreenshots -> ' + out);
