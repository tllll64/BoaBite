import { PROVIDERS, DEFAULT_SETTINGS, SCENES } from './config.js';
import { load, save } from './storage.js';
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

function renderHome() {
  $('#demo-badge').hidden = !!state.settings.apiKey;
  const { goal, rules } = state.profile;
  $('#promise').innerHTML = goal || rules.length
    ? `<div class="promise-label">我的承诺</div>
       <div class="promise-goal">${esc(goal || '还没写目标')}</div>
       <ul class="promise-rules">${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
       <button class="link-btn" data-go="setup" style="margin-top:10px">修改</button>`
    : `<div class="promise-empty">
         <p>先写下你为什么想变瘦。想多吃的时候，BioBite 会用你自己的话提醒你。</p>
         <button class="link-btn" data-go="setup">设定我的硬边界 →</button>
       </div>`;

  const weekAgo = Date.now() - 7 * 864e5;
  const week = state.logs.filter((l) => l.ts > weekAgo);
  const count = (o) => week.filter((l) => l.outcome === o).length;
  $('#stats').innerHTML = ['skipped', 'alternative', 'ate']
    .map((o) => `<div class="stat"><div class="stat-num">${count(o)}</div><div class="stat-label">本周${OUTCOME[o].label}</div></div>`)
    .join('');

  $('#log-list').innerHTML = state.logs.length
    ? state.logs.slice(0, 10).map((l) => {
        const o = OUTCOME[l.outcome];
        const when = new Date(l.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `<li class="log-item">
          <div class="log-main">
            <div class="log-text">${esc(l.text)}</div>
            <div class="log-meta">${when} · 借口：${esc(l.ai?.excuse_type || '—')}</div>
          </div>
          ${o ? `<span class="pill ${o.cls}">${o.label}</span>` : ''}
        </li>`;
      }).join('')
    : '<li class="empty">还没有记录。下次想多吃一口时，先来这里。</li>';
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
