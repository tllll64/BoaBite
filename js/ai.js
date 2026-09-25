import { chatJSON } from './llm.js';
import { IMPULSE_PERSONA, IMPULSE_OUTPUT_FORMAT, RULES_PROMPT, FOOD_RECOGNITION_PROMPT, FOOD_ESTIMATE_OUTPUT_FORMAT } from './prompts.js';

const OUTCOME_LABEL = { skipped: '没吃', alternative: '换了方式', ate: '吃了' };

// 长期记忆：用户的目标、承诺和最近的记录，每次调用都带给模型。
export function buildMemory(profile, logs) {
  const lines = [];
  if (profile.goal) lines.push(`用户的目标：${profile.goal}`);
  if (profile.rules?.length) {
    lines.push('用户给自己定的硬边界规则：');
    profile.rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  const recent = logs.slice(0, 5);
  if (recent.length) {
    lines.push('最近几次想多吃的记录（新的在前）：');
    recent.forEach((l) => {
      const when = new Date(l.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      lines.push(`- ${when}，${l.scene || '其他场景'}，"${l.text}"，借口：${l.ai?.excuse_type || '未知'}，结果：${OUTCOME_LABEL[l.outcome] || '未决定'}`);
    });
  }
  return lines.length ? lines.join('\n') : '用户还没有设定目标和规则。';
}

export async function respondToImpulse(settings, { scene, text, memory }) {
  const now = new Date().toLocaleString('zh-CN', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const messages = [
    { role: 'system', content: `${IMPULSE_PERSONA}\n\n【用户的长期记忆】\n${memory}\n\n${IMPULSE_OUTPUT_FORMAT}` },
    { role: 'user', content: `现在是${now}。场景：${scene || '未选择'}。我此刻的想法：${text}` },
  ];
  const data = settings.apiKey ? await chatJSON(settings, messages) : await mockImpulse({ scene, text });
  return normalizeImpulse(data);
}

export async function suggestRules(settings, { goal, context }) {
  const messages = [
    { role: 'system', content: RULES_PROMPT },
    { role: 'user', content: `我的目标：${goal || '想减肥'}。我最容易多吃的情况：${context || '正餐之外嘴馋'}` },
  ];
  const data = settings.apiKey ? await chatJSON(settings, messages) : await mockRules();
  const rules = Array.isArray(data.rules) ? data.rules.filter((r) => typeof r === 'string' && r.trim()) : [];
  if (!rules.length) throw new Error('没有生成规则，请重试');
  return rules.slice(0, 3);
}

// 食物识别与热量估算
export async function estimateFood(settings, { food, reason }) {
  const messages = [
    { role: 'system', content: `${FOOD_RECOGNITION_PROMPT}\n\n${FOOD_ESTIMATE_OUTPUT_FORMAT}` },
    { role: 'user', content: `我想吃的东西：${food || '零食'}。原因：${reason || '想吃'}` },
  ];
  const data = settings.apiKey ? await chatJSON(settings, messages) : await mockFoodEstimate(food);
  return normalizeFoodEstimate(data);
}

// 规范化食物估算数据
function normalizeFoodEstimate(d) {
  const str = (v, fb) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const num = (v, fb) => (typeof v === 'number' ? v : fb);
  return {
    food: str(d.food, '零食'),
    calories: num(d.calories, null),
    duration: num(d.duration, null),
    confidence: ['高', '中', '低'].includes(d.confidence) ? d.confidence : '中',
  };
}

// 模型输出不完整时补齐字段，保证界面总能渲染。
function normalizeImpulse(d) {
  const str = (v, fb) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const alts = Array.isArray(d.alternatives) ? d.alternatives : [];
  return {
    food: str(d.food, '零食'),
    trigger: ['生理', '情绪', '环境'].includes(d.trigger) ? d.trigger : '环境',
    excuse_type: str(d.excuse_type, '就一口'),
    mirror: str(d.mirror, '你在给这一口找一个理由。'),
    reason: str(d.reason, '你想要的，比这一口更重要。'),
    alternatives: alts
      .map((a) => ({ title: str(a?.title, ''), detail: str(a?.detail, '') }))
      .filter((a) => a.title)
      .slice(0, 3),
    if_eaten: str(d.if_eaten, '吃了也没关系，下一口回到正轨就好。'),
  };
}

// ---------- 演示模式：没有配置 API Key 时使用 ----------

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockImpulse({ scene, text }) {
  await wait(900);
  const eager = /一口|一块|一点/.test(text);
  return {
    food: /蛋糕/.test(text) ? '蛋糕' : /薯片/.test(text) ? '薯片' : '零食',
    trigger: /累|烦|难过|压力|辛苦/.test(text) ? '情绪' : scene?.includes('半夜') ? '生理' : '环境',
    excuse_type: eager ? '就一口' : /辛苦|累/.test(text) ? '犒劳自己' : /免费|浪费/.test(text) ? '怕浪费' : '不好拒绝',
    mirror: eager ? '"就一口"，上次也是这么开始的。' : '你在给这一口找一个理由。',
    reason: '你说过想在年底穿上那条裙子。这一口给不了你想要的，那条裙子可以。',
    alternatives: [
      { title: '先喝一杯温水', detail: '喝完等 10 分钟，再决定要不要吃' },
      { title: '只吃一半', detail: '掰一半给别人，剩下的慢慢吃' },
      { title: '先收起来', detail: '放进抽屉，下午真饿了再拿出来' },
    ],
    if_eaten: '吃了就好好享受它。这一口不会毁掉今天，下一顿照常就好。',
  };
}

async function mockRules() {
  await wait(700);
  return {
    rules: [
      '如果晚上 9 点后想吃东西，就先刷牙',
      '如果同事递来零食，就说"谢谢，我刚吃过"',
      '如果逛超市想买零食，就先放回货架走一圈',
    ],
  };
}

// Mock 食物估算
async function mockFoodEstimate(food) {
  await wait(600);
  const foodMap = {
    蛋糕: { calories: 280, duration: 45 },
    薯片: { calories: 320, duration: 60 },
    冰淇淋: { calories: 250, duration: 50 },
    巧克力: { calories: 180, duration: 40 },
    饼干: { calories: 200, duration: 35 },
    坚果: { calories: 300, duration: 75 },
  };
  const match = Object.keys(foodMap).find((k) => food?.includes(k));
  const est = match ? foodMap[match] : { calories: 200, duration: 45 };
  return {
    food: match || food || '零食',
    calories: est.calories,
    duration: est.duration,
    confidence: match ? '高' : '中',
  };
}
