// 模型连通性验证：直接调用 js/llm.js 和 js/ai.js 的真实代码路径，不另写一份实现。
// 用法：
//   BIOBITE_API_KEY=sk-xxx node scripts/check-ai.mjs
//   BIOBITE_API_KEY=sk-xxx BIOBITE_PROVIDER=qwen BIOBITE_MODEL=qwen-plus node scripts/check-ai.mjs
// Key 只从环境变量读，不写进文件、不进 git。

import { PROVIDERS, DEFAULT_SETTINGS } from '../js/config.js';
import { chatJSON, LLMError } from '../js/llm.js';
import { buildMemory, respondToImpulse, suggestRules, estimateFood } from '../js/ai.js';

const apiKey = process.env.BIOBITE_API_KEY?.trim();
if (!apiKey) {
  console.error('缺少 BIOBITE_API_KEY。用法：BIOBITE_API_KEY=sk-xxx node scripts/check-ai.mjs');
  process.exit(2);
}

const providerKey = process.env.BIOBITE_PROVIDER || DEFAULT_SETTINGS.provider;
const preset = PROVIDERS[providerKey];
if (!preset) {
  console.error(`未知的 provider「${providerKey}」。可选：${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(2);
}

const settings = {
  baseURL: process.env.BIOBITE_BASE_URL || preset.baseURL,
  model: process.env.BIOBITE_MODEL || preset.model,
  apiKey,
};

if (!settings.baseURL || !settings.model) {
  console.error(`provider「${providerKey}」缺少 baseURL 或 model，请用 BIOBITE_BASE_URL / BIOBITE_MODEL 补上`);
  process.exit(2);
}

const mask = (k) => (k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '…');
console.log(`服务：${preset.name}（${providerKey}）`);
console.log(`地址：${settings.baseURL}`);
console.log(`模型：${settings.model}`);
console.log(`Key ：${mask(apiKey)}`);
console.log('');

let pass = 0;
let fail = 0;

async function step(name, fn, check) {
  const t0 = Date.now();
  process.stdout.write(`▶ ${name} … `);
  try {
    const out = await fn();
    const ms = Date.now() - t0;
    const problem = check?.(out);
    if (problem) {
      fail += 1;
      console.log(`字段有问题（${ms}ms）\n   ${problem}`);
    } else {
      pass += 1;
      console.log(`通过（${ms}ms）`);
    }
    console.log(`   ${JSON.stringify(out)}\n`);
  } catch (err) {
    fail += 1;
    const ms = Date.now() - t0;
    const kind = err instanceof LLMError ? 'LLMError' : err.constructor.name;
    console.log(`失败（${ms}ms）\n   ${kind}: ${err.message}\n`);
  }
}

// 1. 最小连通性：等价于设置页的「测试连接」
await step(
  '连通性（chatJSON）',
  () => chatJSON(settings, [{ role: 'user', content: '只输出 JSON：{"ok":true}' }], { timeoutMs: 20000 }),
  (d) => (d?.ok === true ? null : '期望 { ok: true }'),
);

// 2. 食物估算：投喂链路真正要用的那一个（两个必填字段）
await step(
  'estimateFood（食物名称 + 原因）',
  () => estimateFood(settings, { food: '一块黑森林蛋糕', reason: '同事过生日剩下的，不吃好像浪费' }),
  (d) => {
    const bad = [];
    if (!d.food) bad.push('food 为空');
    if (d.calories !== null && typeof d.calories !== 'number') bad.push('calories 既不是数字也不是 null');
    if (d.duration !== null && typeof d.duration !== 'number') bad.push('duration 既不是数字也不是 null');
    if (!['高', '中', '低'].includes(d.confidence)) bad.push(`confidence = ${d.confidence}`);
    // normalize 会把缺失字段兜成 null，所以这里额外提醒一次真实模型是否给了数值
    if (d.calories === null) bad.push('calories 为 null——模型没给数值，首页热量会是 0');
    if (d.duration === null) bad.push('duration 为 null——模型没给数值，首页耗时会是 0');
    return bad.length ? bad.join('；') : null;
  },
);

// 3. 冲动回应：带长期记忆的那条链路，顺便验证 buildMemory 拼进 prompt 后模型还能守格式
const memory = buildMemory(
  { goal: '年底之前穿上那条收腰的裙子', rules: ['如果晚上 9 点后想吃东西，就先刷牙'] },
  [{ ts: Date.now() - 3600e3, scene: '同事递来的小零食', text: '就吃一口', ai: { excuse_type: '就一口' }, outcome: 'skipped' }],
);
await step(
  'respondToImpulse（含长期记忆）',
  () => respondToImpulse(settings, { scene: '同事递来的小零食', text: '同事给了块蛋糕，就吃一口应该没事吧', memory }),
  (d) => {
    const bad = [];
    if (!['生理', '情绪', '环境'].includes(d.trigger)) bad.push(`trigger = ${d.trigger}`);
    if (d.alternatives.length !== 3) bad.push(`alternatives 有 ${d.alternatives.length} 条，prompt 要求恰好 3 条`);
    if (!d.mirror || !d.reason || !d.if_eaten) bad.push('mirror / reason / if_eaten 有空值（已被 normalize 兜底，说明模型漏字段）');
    return bad.length ? bad.join('；') : null;
  },
);

// 4. 规则生成
await step(
  'suggestRules（硬边界）',
  () => suggestRules(settings, { goal: '年底之前穿上那条收腰的裙子', context: '加班到很晚、同事分零食' }),
  (d) => (d.length === 3 ? null : `返回 ${d.length} 条，prompt 要求 3 条`),
);

console.log(`—— 通过 ${pass} / 失败 ${fail} ——`);
process.exit(fail ? 1 : 0);
