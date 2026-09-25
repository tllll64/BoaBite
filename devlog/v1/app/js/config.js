// 模型服务预设：均为 OpenAI 兼容接口，且允许浏览器直接跨域调用。
export const PROVIDERS = {
  deepseek: { name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  doubao: { name: '豆包（火山方舟）', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  glm: { name: '智谱 GLM', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  custom: { name: '自定义', baseURL: '', model: '' },
};

export const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  baseURL: PROVIDERS.deepseek.baseURL,
  model: PROVIDERS.deepseek.model,
  apiKey: '',
};

// 用户在正餐之外最常遇到的六个场景（来自 PRD 第 3 节）。
export const SCENES = [
  { id: 'colleague', label: '同事递来的小零食' },
  { id: 'share', label: '一下子来一大块想分给别人' },
  { id: 'market', label: '逛超市想加购零食' },
  { id: 'midnight', label: '半夜嘴馋开冰箱' },
  { id: 'supper', label: '被朋友拉去吃夜宵' },
  { id: 'free', label: '看到免费的食物' },
];
