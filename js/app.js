import { PROVIDERS, DEFAULT_SETTINGS, SCENES } from './config.js';
import { load, save } from './storage.js';
import { renderSnake } from './snake-render.js';
import { buildMemory, respondToImpulse, suggestRules } from './ai.js';
import { chatJSON } from './llm.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  settings: { ...DEFAULT_SETTINGS, ...load('settings', {}) },
  profile: load('profile', { goal: '', context: '', rules: [] }),
  logs: load('logs', []),
  draftRules: [],
  scene: null,
  current: null, // 本次冲动：{ scene, text, ai }
  chosenAlt: null,
  history: ['home'],
};

// ---------- 导航 ----------

function show(name, { push = true } = {}) {
  document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== name; });
  if (push && state.history.at(-1) !== name) state.history.push(name);
  if (name === 'home') state.history = ['home'];
  $('.topbar').hidden = name === 'home';
  $('[data-action="back"]').hidden = name === 'home';
  RENDER[name]?.();
  window.scrollTo(0, 0);
}

function back() {
  state.history.pop();
  show(state.history.at(-1) || 'home', { push: false });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
  if (e.target.closest('[data-action="back"]')) back();
});

// ---------- 首页 ----------

const OUTCOME = {
  skipped: { label: '没吃', cls: 'pill-skipped' },
  alternative: { label: '换了方式', cls: 'pill-alternative' },
  ate: { label: '吃了', cls: 'pill-ate' },
};

const pad = (value) => String(value).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// duration 单位是分钟，不足一小时时带上“分”，避免 0:45 被读成 45 秒
function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} 分`;
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

function renderHome() {
  const now = new Date();
  const todayKey = dayKey(now);
  const todayLogs = state.logs.filter((log) => dayKey(new Date(log.ts)) === todayKey);
  const calories = todayLogs.reduce((sum, log) => sum + (Number(log.ai?.calories) || 0), 0);
  const duration = todayLogs.reduce((sum, log) => sum + (Number(log.ai?.duration) || 0), 0);
  $('#home-date').textContent = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  $('#home-calories').textContent = `${calories} kcal`;
  $('#home-duration').textContent = fmtDuration(duration);
  $('#home-caption').textContent = todayLogs.length ? `今天已经把 ${todayLogs.length} 件想吃的交给我了` : '';
  renderSnake($('#snake-belly'), todayLogs.length);
}

// ---------- 冲动输入 ----------

function renderImpulse() {
  state.scene = null;
  $('#impulse-text').value = '';
  $('#impulse-count').textContent = '0';
  $('#impulse-submit').disabled = true;
  $('#scene-chips').innerHTML = SCENES
    .map((s) => `<button class="chip" role="radio" aria-checked="false" data-scene="${s.label}">${s.label}</button>`)
    .join('');
}

$('#scene-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-scene]');
  if (!chip) return;
  const on = chip.getAttribute('aria-checked') !== 'true';
  document.querySelectorAll('#scene-chips .chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
  chip.setAttribute('aria-checked', String(on));
  state.scene = on ? chip.dataset.scene : null;
});

$('#impulse-text').addEventListener('input', (e) => {
  const len = e.target.value.trim().length;
  $('#impulse-count').textContent = e.target.value.length;
  $('#impulse-submit').disabled = len === 0;
});

$('#impulse-submit').addEventListener('click', () => {
  state.current = { scene: state.scene, text: $('#impulse-text').value.trim(), ai: null };
  show('response');
  askAI();
});

// ---------- AI 回应 ----------

async function askAI({ demo = false } = {}) {
  state.chosenAlt = null;
  renderThinking();
  const settings = demo ? { ...state.settings, apiKey: '' } : state.settings;
  try {
    state.current.ai = await respondToImpulse(settings, {
      scene: state.current.scene,
      text: state.current.text,
      memory: buildMemory(state.profile, state.logs),
    });
    renderResponse();
  } catch (err) {
    renderError(err.message);
  }
}

function renderThinking() {
  $('#response-body').innerHTML = `
    <div class="thinking" aria-live="polite">
      <div class="thinking-text">正在听懂你的借口…</div>
      <div class="skeleton" style="width:60%"></div>
      <div class="skeleton" style="width:90%"></div>
      <div class="skeleton" style="width:75%"></div>
    </div>`;
}

function renderError(msg) {
  $('#response-body').innerHTML = `
    <div class="error-card" role="alert">
      <p><b>BioBite 暂时没有回应</b></p>
      <p>${esc(msg)}</p>
      <button class="primary-btn" id="retry">再试一次</button>
      <button class="text-btn" id="use-demo">先用演示回应继续</button>
    </div>`;
  $('#retry').onclick = () => askAI();
  $('#use-demo').onclick = () => askAI({ demo: true });
}

function renderResponse() {
  const ai = state.current.ai;
  $('#response-body').innerHTML = `
    <div class="tags">
      <span class="tag">想吃<b>${esc(ai.food)}</b></span>
      <span class="tag">诱因<b>${esc(ai.trigger)}</b></span>
      <span class="tag">借口<b>${esc(ai.excuse_type)}</b></span>
    </div>
    <p class="mirror">${esc(ai.mirror)}</p>
    <p class="reason">${esc(ai.reason)}</p>
    <h2 class="section-title">试试第三种选择</h2>
    <div class="alts" role="radiogroup">
      ${ai.alternatives.map((a, i) => `
        <button class="alt" role="radio" aria-checked="false" data-alt="${i}">
          <div class="alt-title">${esc(a.title)}</div>
          <div class="alt-detail">${esc(a.detail)}</div>
        </button>`).join('')}
    </div>
    <div class="actions">
      <button class="primary-btn" id="do-alt" disabled>就这么做</button>
      <button class="ghost-btn" id="do-skip">这次不吃了</button>
      <button class="text-btn" id="do-eat">还是吃了</button>
    </div>`;

  $('#response-body .alts').onclick = (e) => {
    const btn = e.target.closest('[data-alt]');
    if (!btn) return;
    document.querySelectorAll('.alt').forEach((b) => b.setAttribute('aria-checked', 'false'));
    btn.setAttribute('aria-checked', 'true');
    state.chosenAlt = ai.alternatives[+btn.dataset.alt];
    $('#do-alt').disabled = false;
  };
  $('#do-alt').onclick = () => finish('alternative');
  $('#do-skip').onclick = () => finish('skipped');
  $('#do-eat').onclick = () => finish('ate');
}

function finish(outcome) {
  const entry = {
    id: Date.now().toString(36),
    ts: Date.now(),
    ...state.current,
    outcome,
    alt: outcome === 'alternative' ? state.chosenAlt : null,
  };
  state.logs.unshift(entry);
  save('logs', state.logs);
  state.history = ['home'];
  show('done');
}

// ---------- 结果 ----------

function renderDone() {
  const last = state.logs[0];
  if (!last) return;
  const check = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const heart = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const copy = {
    skipped: { mark: check, title: '这一次，你没有被借口说服。', text: `"${last.ai.excuse_type}"已经记下来了。下次它再出现，你会更早认出它。` },
    alternative: { mark: check, title: `好的，去${last.alt?.title || '试试看'}吧。`, text: last.alt?.detail || '' },
    ate: { mark: heart, warm: true, title: '吃了也没关系。', text: last.ai.if_eaten },
  }[last.outcome];
  $('#done-body').innerHTML = `
    <div class="done-mark ${copy.warm ? 'warm' : ''}">${copy.mark}</div>
    <p class="done-title">${esc(copy.title)}</p>
    <p class="done-text">${esc(copy.text)}</p>`;
}

// ---------- 硬边界规则 ----------

function renderSetup() {
  $('#goal').value = state.profile.goal;
  $('#context').value = state.profile.context || '';
  state.draftRules = [...state.profile.rules];
  renderRules();
}

function renderRules() {
  $('#rule-list').innerHTML = state.draftRules.length
    ? state.draftRules.map((r, i) => `<li class="rule-item"><span>${esc(r)}</span><button class="rule-del" data-del="${i}" aria-label="删除">×</button></li>`).join('')
    : '<li class="empty">还没有规则，可以让 AI 帮你写几条。</li>';
}

$('#rule-list').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (!del) return;
  state.draftRules.splice(+del.dataset.del, 1);
  renderRules();
});

$('#rule-add').addEventListener('click', () => {
  const v = $('#rule-input').value.trim();
  if (!v) return;
  state.draftRules.push(v);
  $('#rule-input').value = '';
  renderRules();
});

$('#rules-ai').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'AI 正在想…';
  try {
    const rules = await suggestRules(state.settings, { goal: $('#goal').value.trim(), context: $('#context').value.trim() });
    state.draftRules = [...state.draftRules, ...rules.filter((r) => !state.draftRules.includes(r))];
    renderRules();
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI 帮我变成具体规则';
  }
});

$('#setup-save').addEventListener('click', () => {
  state.profile = { goal: $('#goal').value.trim(), context: $('#context').value.trim(), rules: state.draftRules };
  save('profile', state.profile);
  toast('已保存，BioBite 会记住它');
  show('home');
});

// ---------- 设置 ----------

function renderSettings() {
  const s = state.settings;
  $('#provider').innerHTML = Object.entries(PROVIDERS)
    .map(([k, p]) => `<option value="${k}" ${k === s.provider ? 'selected' : ''}>${p.name}</option>`)
    .join('');
  $('#base-url').value = s.baseURL;
  $('#model').value = s.model;
  $('#api-key').value = s.apiKey;
  $('#settings-status').textContent = '';
}

$('#provider').addEventListener('change', (e) => {
  const p = PROVIDERS[e.target.value];
  $('#base-url').value = p.baseURL;
  $('#model').value = p.model;
});

function readSettingsForm() {
  return {
    provider: $('#provider').value,
    baseURL: $('#base-url').value.trim(),
    model: $('#model').value.trim(),
    apiKey: $('#api-key').value.trim(),
  };
}

$('#settings-test').addEventListener('click', async () => {
  const s = readSettingsForm();
  const status = $('#settings-status');
  if (!s.apiKey || !s.baseURL || !s.model) { status.textContent = '请先填写接口地址、模型名称和 API Key'; return; }
  status.textContent = '连接中…';
  try {
    await chatJSON(s, [{ role: 'user', content: '只输出 JSON：{"ok":true}' }], { timeoutMs: 15000 });
    status.textContent = '连接成功';
  } catch (err) {
    status.textContent = `连接失败：${err.message}`;
  }
});

$('#settings-save').addEventListener('click', () => {
  state.settings = readSettingsForm();
  save('settings', state.settings);
  toast(state.settings.apiKey ? '已保存' : '已保存，当前为演示模式');
  back();
});

// ---------- 启动 ----------

const RENDER = {
  home: renderHome,
  impulse: renderImpulse,
  done: renderDone,
  setup: renderSetup,
  settings: renderSettings,
};

show('home');
