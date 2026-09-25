// 保存一个版本的 HTML 快照和手机尺寸截图。
// 用法：先 npm run dev 启动本地服务，再 npm run capture -- v0.1
import { chromium } from 'playwright-core';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version) {
  console.error('请提供版本号，例如：npm run capture -- v0.1');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'devlog', version);
const BASE = process.env.BASE_URL || 'http://localhost:8000';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 1. HTML 快照
await mkdir(join(out, 'app'), { recursive: true });
for (const p of ['index.html', 'css', 'js']) {
  await cp(join(root, p), join(out, 'app', p), { recursive: true });
}

// 2. 截图：演示模式下走一遍核心流程
await mkdir(join(out, 'screens'), { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();

const shot = async (name) => {
  await page.waitForTimeout(400); // 等进场动画结束
  await page.screenshot({ path: join(out, 'screens', `${name}.png`) });
  console.log('✓', name);
};
const tap = (text) => page.locator('button:visible', { hasText: text }).first().click();

await shot('01-home-empty');

await tap('设定我的硬边界');
await page.fill('#goal', '年底之前穿上那条收腰的裙子');
await page.fill('#context', '加班到很晚、同事分零食');
await tap('AI 帮我变成具体规则');
await page.locator('.rule-item').first().waitFor();
await shot('02-setup');
await tap('保存我的承诺');

await page.waitForSelector('#toast', { state: 'hidden' });
await shot('03-home');

await tap('我想吃点什么');
await tap('同事递来的小零食');
await page.fill('#impulse-text', '同事给了块蛋糕，就吃一口应该没事吧');
await shot('04-impulse');

await tap('说给 BioBite 听');
await shot('05-thinking');
await page.locator('.mirror').waitFor();
await page.locator('.alt').nth(1).click();
await shot('06-response');

await tap('还是吃了');
await shot('07-done-ate');

await browser.close();
console.log(`已保存到 devlog/${version}/`);
