// 模型服务预设：均为 OpenAI 兼容接口，且允许浏览器直接跨域调用。
export const PROVIDERS = {
  deepseek: { name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  doubao: { name: '豆包（火山方舟）', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  glm: { name: '智谱 GLM', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  packy: { name: 'PackyAPI（中转）', baseURL: 'https://www.packyapi.ai/v1', model: 'deepseek-v4-flash' },
  custom: { name: '自定义', baseURL: '', model: '' },
};

export const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  baseURL: PROVIDERS.deepseek.baseURL,
  model: PROVIDERS.deepseek.model,
  apiKey: '',
};

// ---------- 蛇的人设 ----------
// 语气是人设里最能改变输出的一项，所以做成预设 + 一句写给模型的指令。
// instruction 会原样进 prompt，改这里就能改蛇的说话方式。
export const TONES = [
  { id: 'honest', label: '憨厚', instruction: '语气平静、有点憨、像刚吃饱的动物。话不多，不抢戏。' },
  { id: 'sharp',  label: '毒舌', instruction: '语气促狭、爱挑刺，会拿这份食物开个小玩笑，但不刻薄、不羞辱人。' },
  { id: 'gentle', label: '温柔', instruction: '语气柔和体贴，像在替人分担，会轻轻肯定对方的克制。' },
  { id: 'old',    label: '老成', instruction: '语气像活了很久的老蛇，见多识广，说话慢、带一点见惯不惊的疲惫。' },
  { id: 'greedy', label: '贪吃', instruction: '语气热切、嘴馋，明显很享受这一口，会主动讨下一次投喂。' },
];

export const DEFAULT_PERSONA = {
  name: '',
  tone: 'honest',
  extra: '',
};

