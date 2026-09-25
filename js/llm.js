// 模型调用适配层。迁移到小程序时，把 fetch 换成 wx.request 或云函数即可，接口保持不变。

export class LLMError extends Error {}

export async function chatJSON({ baseURL, model, apiKey }, messages, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new LLMError(err.name === 'AbortError' ? '模型响应超时' : '网络连接失败');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // 401 也带上服务端原文：Key 无效和 baseURL 指错同样返回 401，
    // 只说“Key 无效”会把人引向错误的方向。
    if (res.status === 401) throw new LLMError(`API Key 无效或接口地址不对${detail ? `：${detail.slice(0, 160)}` : ''}`);
    throw new LLMError(`模型服务出错（${res.status}）${detail.slice(0, 120)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return parseJSON(content);
}

// 模型偶尔会在 JSON 外包一层 ```json 或多余文字，这里取出第一个完整对象。
export function parseJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new LLMError('模型没有返回有效内容');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LLMError('模型返回的格式有误');
  }
}
