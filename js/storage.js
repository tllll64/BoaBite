// 存储适配层。迁移到小程序时，只需把这里换成 wx.getStorageSync / wx.setStorageSync。
const PREFIX = 'boabite:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 隐私模式或存储已满时静默失败，页面仍可使用。
  }
}
