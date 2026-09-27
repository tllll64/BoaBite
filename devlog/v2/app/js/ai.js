import { chatJSON, LLMError } from './llm.js';
import { FEED_ANALYSIS_PROMPT, FEED_ANALYSIS_OUTPUT_FORMAT } from './prompts.js';
import { TONES } from './config.js';

// 所有回应都必须由模型生成，没有演示模式兜底。
// 缺少任一项配置就直接报错，而不是返回假数据让人以为链路通了。
function requireKey({ apiKey, baseURL, model }) {
  if (!apiKey || !baseURL || !model) {
    throw new LLMError('还没配置模型服务，去设置里填好接口地址、模型名称和 API Key');
  }
}

// 把蛇设定页填的人设拼成 prompt 片段。
// 空着的字段不出现在 prompt 里，避免给模型塞"未设置"这类噪音。
export function buildPersona(persona = {}) {
  const lines = [];
  if (persona.name?.trim()) lines.push(`你的名字是「${persona.name.trim()}」。用户这样叫你，你可以自称这个名字。`);
  const tone = TONES.find((t) => t.id === persona.tone) ?? TONES[0];
  lines.push(`语气：${tone.instruction}`);
  if (persona.extra?.trim()) lines.push(`用户额外给你的设定：${persona.extra.trim()}`);
  return lines.join('\n');
}

// 投喂分析：蛇吃掉这份食物，并以蛇的视角回应（§6.3）
// name 是「这是什么」，reason 是「为什么忍住不吃」
export async function analyzeFeed(settings, { name, reason, persona }) {
  const messages = [
    { role: 'system', content: `${FEED_ANALYSIS_PROMPT}\n\n【蛇的人设】\n${buildPersona(persona)}\n\n${FEED_ANALYSIS_OUTPUT_FORMAT}` },
    { role: 'user', content: `我把这个交给你：${name}。我忍住没吃，因为${reason}` },
  ];
  requireKey(settings);
  const data = await chatJSON(settings, messages, { timeoutMs: 60000 });
  return normalizeFeed(data, name);
}

function normalizeFeed(d, fallbackName) {
  const str = (v, fb) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    food: str(d.food, fallbackName || '零食'),
    calories: num(d.calories),
    duration: num(d.duration),
    confidence: ['高', '中', '低'].includes(d.confidence) ? d.confidence : '中',
    snake_note: str(d.snake_note, '谢谢你的投喂。这份我吃下去了，你把它交给我，这就够了。'),
    animal: str(d.animal, ''),
  };
}
