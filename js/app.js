import { PROVIDERS, DEFAULT_SETTINGS, TONES, DEFAULT_PERSONA } from './config.js';
import { load, save } from './storage.js';
import { renderSnake, stopSnake, renderFoods, humpHeight } from './snake-render.js';
import { renderSwallow } from './swallow-render.js';
import * as cam from './camera.js';
import { cutout, warmUp } from './food-cutout.js';
import { analyzeFeed, buildPersona } from './ai.js';
import { chatJSON } from './llm.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 本地开发时 js/config.local.js 提供一份默认模型配置（该文件不入 git）。
// 存在就用它做初始值，用户在设置页改过之后以 localStorage 为准。
let localDefaults = {};
try {
  const m = await import('./config.local.js');
  localDefaults = m.LOCAL_SETTINGS ?? {};
} catch {
  // 没有这个文件是正常情况：交付版本就让用户自己在设置页填
}

const state = {
  settings: { ...DEFAULT_SETTINGS, ...localDefaults, ...load('settings', {}) },
  persona: { ...DEFAULT_PERSONA, ...load('persona', {}) },
  logs: load('logs', []),
  shot: null,    // 本次拍到的照片 dataURL
  cut: null,     // 抠好的食物轮廓 { image, width, height, alphaMask, coverage }
  feed: null,    // 本次投喂的两个必填字段 { name, reason }
  homeMode: 'eat',     // 首页的两个模式：eat（蛇 + 今日摘要）/ view（投喂记录）
  history: ['home'],
};

// ---------- 导航 ----------

function show(name, { push = true } = {}) {
  if (name !== 'camera') cam.stop();  // 离开即释放摄像头
  if (name !== 'home') stopSnake();   // 蛇的动画只在首页跑
  document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== name; });
  if (push && state.history.at(-1) !== name) state.history.push(name);
  if (name === 'home') state.history = ['home'];
  // 填写页自带取消/确认，不需要顶栏（参考图里也没有）
  $('.topbar').hidden = name === 'home' || name === 'camera' || name === 'feed' || name === 'analyze';
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
  const mode = e.target.closest('[data-home-mode]');
  if (mode) { setHomeMode(mode.dataset.homeMode); return; }
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
  if (e.target.closest('[data-action="back"]')) back();
});

// ---------- 首页 ----------

// 蛇腹布局的坐标系，renderFoods 按同一宽度换算到 viewBox

const pad = (value) => String(value).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// duration 单位是分钟，不足一小时时带上“分”，避免 0:45 被读成 45 秒
function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} 分`;
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

// 「吃」/「看」是首页的两个模式，不是两个屏幕：切换只替换上半部分的内容，
// 底部导航和页面本身都留在原地（不跳转、不进历史栈）
function setHomeMode(mode) {
  state.homeMode = mode === 'view' ? 'view' : 'eat';
  const view = state.homeMode === 'view';
  // 「看」模式下隐藏蛇、今日摘要、副标题和右上角两个工具
  $('.snake-scene').hidden = view;
  $('.home-metrics').hidden = view;
  $('.home-tools').hidden = view;
  $('#home-records').hidden = !view;
  document.querySelectorAll('[data-home-mode]').forEach((el) => {
    const on = el.dataset.homeMode === state.homeMode;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  if (view) renderRecords();
}

// 投喂记录：新的在上，按天分组
function renderRecords() {
  const el = $('#home-records');
  if (!state.logs.length) {
    el.innerHTML = '<p class="records-empty">还没有投喂过。拍下一样想吃的东西，交给蛇。</p>';
    return;
  }
  const groups = new Map();
  for (const log of state.logs) {
    const key = dayKey(new Date(log.ts));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  }
  const todayKey = dayKey(new Date());
  el.innerHTML = [...groups].map(([key, logs]) => {
    const [, m, d] = key.split('-');
    return `
      <div class="records-day">
        <p class="records-date">${key === todayKey ? '今天' : `${m}/${d}`}</p>
        <ul class="records-list">
          ${logs.map((log) => `
            <li class="record-item">
              ${log.cutout?.image || log.photo
                ? `<img class="record-shot" src="${log.cutout?.image || log.photo}" alt="" />`
                : '<span class="record-shot is-empty" aria-hidden="true"></span>'}
              <div class="record-text">
                <p class="record-name">${esc(log.name || log.ai?.food || '一样想吃的东西')}</p>
                <p class="record-reason">${esc(log.reason || log.text || '')}</p>
              </div>
              ${log.ai?.calories != null ? `<span class="record-kcal">${log.ai.calories} kcal</span>` : ''}
            </li>`).join('')}
        </ul>
      </div>`;
  }).join('');
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
  // 「我想吃点东西」是空腹态的召唤语，肚子里有东西了就隐去。
  // SVG 的 <text> 不认 HTML 的 hidden 属性，用 class 控制。
  $('.snake-words').classList.toggle('is-gone', todayLogs.length > 0);
  renderSnake($('#snake-belly'), todayLogs.length);

  // 把今天带抠图的记录排进蛇腹（§7.1）。尺寸由蛇腹实际可用高度决定，
  // 所以不再需要外部布局：renderFoods 自己按静止轮廓算。
  const foods = todayLogs.filter((l) => l.cutout?.image);
  renderFoods($('#snake-foods'), foods, humpHeight(todayLogs.length));
  setHomeMode(state.homeMode);
}

// ---------- 相机 ----------

// 取景框的宽高比，拍摄时按它裁剪，保证所见即所得
function mouthAspect() {
  const r = $('.cam-mouth').getBoundingClientRect();
  return r.height ? r.width / r.height : 1;
}

function camMode(mode) {
  const shot = mode === 'shot';
  $('#cam-bar').hidden = shot;
  $('#cam-confirm').hidden = !shot;
  $('#cam-shot').hidden = !shot;
  $('#cam-video').hidden = shot;
  $('#cam-hint').textContent = shot ? '这一口，确定交给蛇吗' : '把想吃的东西放进蛇嘴里';
}

// 无相机权限或不支持时退回相册，流程不中断（§6.3 不责备用户）
function camFallback(msg) {
  cam.stop();
  $('#cam-video').hidden = true;
  $('#cam-fallback').hidden = false;
  $('#cam-fallback').textContent = msg;
  $('#cam-shutter').disabled = true;
  $('#cam-flip').hidden = true;
}

async function renderCamera() {
  state.shot = null;
  camMode('live');
  $('#cam-fallback').hidden = true;
  $('#cam-shutter').disabled = false;
  $('#cam-flip').hidden = false;
  $('.cam-mouth').classList.remove('is-blank', 'is-cut');
  $('#cam-cut-note').hidden = true;
  state.cut = null;
  warmUp();   // 提前下模型，避免用户等在确认页

  if (!cam.isSupported()) {
    camFallback('这台设备打不开相机，可以从相册选一张。');
    return;
  }
  try {
    await cam.start($('#cam-video'));
  } catch (err) {
    camFallback(err.name === 'NotAllowedError'
      ? '还没有相机权限。可以在浏览器里允许，或从相册选一张。'
      : '相机打不开，可以从相册选一张。');
  }
}

function showShot(dataUrl) {
  state.shot = dataUrl;
  state.cut = null;
  state.feed = null;   // 新照片是新的一次投喂，旧草稿作废
  $('#cam-shot').src = dataUrl;
  camMode('shot');
  cam.stop();
  runCutout(dataUrl);
}

// 抠图在确认页后台进行：成功就把轮廓换上去，失败保留原图，流程不中断
async function runCutout(dataUrl) {
  const note = $('#cam-cut-note');
  const mouth = $('.cam-mouth');
  note.hidden = false;
  note.textContent = '正在描出食物的轮廓…';
  try {
    const res = await cutout(dataUrl);
    // 这张图和当前确认的不是同一张（用户已重拍），丢弃结果
    if (state.shot !== dataUrl) return;
    // 覆盖率过低说明没找到主体，保留原图更诚实
    if (res.coverage < 0.02) {
      note.textContent = '没能分辨出食物，先用原图';
      return;
    }
    state.cut = res;
    $('#cam-shot').src = res.image;
    mouth.classList.add('is-cut');
    note.textContent = '已描出轮廓';
  } catch {
    if (state.shot !== dataUrl) return;
    note.textContent = '这次没描出轮廓，先用原图';
  }
}

$('#cam-shutter').addEventListener('click', () => {
  try {
    showShot(cam.capture($('#cam-video'), $('#cam-canvas'), mouthAspect()));
  } catch {
    toast('还没拍到画面，再试一次');
  }
});

$('#cam-flip').addEventListener('click', async () => {
  try {
    const { blank } = await cam.flip($('#cam-video'));
    // 设备只有一个摄像头时（多数电脑），翻转后是黑屏，再按一次回到画面
    $('.cam-mouth').classList.toggle('is-blank', blank);
    $('#cam-shutter').disabled = blank;
    $('#cam-hint').textContent = blank ? '另一侧没有摄像头' : '把想吃的东西放进蛇嘴里';
  } catch {
    toast('切换失败，再试一次');
  }
});

$('#cam-album').addEventListener('click', () => $('#cam-file').click());

$('#cam-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    showShot(await cam.readFile(file));
  } catch {
    toast('这张图读不出来，换一张试试');
  }
});

$('#cam-retake').addEventListener('click', () => { renderCamera(); });

$('#cam-use').addEventListener('click', () => {
  if (!state.shot) return;
  show('feed');
});

// ---------- 填写页：两个必填字段（§6.2） ----------

function renderFeed() {
  // 有轮廓就用轮廓，没抠出来就用原图——两者都没有说明流程被跳过了
  $('#feed-shot').src = state.cut?.image || state.shot || '';
  // 从分析页「返回修改」回来时保留已填内容，不清空
  $('#feed-name').value = state.feed?.name || '';
  $('#feed-reason').value = state.feed?.reason || '';
  syncFeed();
}

// 两项都填了才能确认
function syncFeed() {
  const name = $('#feed-name').value.trim();
  const reason = $('#feed-reason').value.trim();
  $('#feed-confirm').disabled = !name || !reason;
  return { name, reason };
}

$('#feed-name').addEventListener('input', syncFeed);
$('#feed-reason').addEventListener('input', syncFeed);

// 回车推进：第一个字段跳到第二个，第二个直接确认
$('#feed-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#feed-reason').focus(); }
});
$('#feed-reason').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('#feed-confirm').disabled) { e.preventDefault(); $('#feed-confirm').click(); }
});

// 取消：放弃这次投喂，回首页。照片和轮廓一并丢掉，不留半条记录
$('#feed-cancel').addEventListener('click', () => {
  state.shot = null;
  state.cut = null;
  state.feed = null;
  show('home');
});

$('#feed-confirm').addEventListener('click', () => {
  const { name, reason } = syncFeed();
  if (!name || !reason) return;
  state.feed = { name, reason };
  show('analyze');
});

// ---------- AI 分析 + 吞食（§6.3 / §6.4） ----------

const screenEl = (name) => document.querySelector(`[data-screen="${name}"]`);

const swallowEls = () => ({
  shape: $('#belly-shape'),
  outline: $('#belly-outline'),
  foods: $('#belly-foods'),
});

function fmtClock(minutes) {
  if (minutes == null) return '—';
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

function renderAnalyze() {
  // 蛇身先按这次食物的面积鼓起来，分析中就已经是吞下的姿态
  renderSwallow(swallowEls(), state.cut ? {
    image: state.cut.image,
    aspectRatio: state.cut.width / state.cut.height,
  } : null, 1);
  runAnalyze();
}

async function runAnalyze() {
  const scr = screenEl('analyze');
  scr.classList.add('is-thinking');
  $('#swallow-duration').textContent = '—';
  $('#swallow-calories').textContent = '—';
  $('#swallow-note').textContent = '我正在把它咽下去…';
  $('#swallow-note').classList.add('is-dim');
  $('#swallow-actions').innerHTML = '';
  try {
    const res = await analyzeFeed(state.settings, { ...state.feed, persona: state.persona });
    scr.classList.remove('is-thinking');
    swallow(res);            // 成功才落记录，蛇的状态也只在这里改变（§6.3）
    renderSwallowDone(res);
  } catch (err) {
    scr.classList.remove('is-thinking');
    renderSwallowFail(err.message);
  }
}

// 写入投喂记录。热量和耗时存进 ai 里，首页的两个数字读的就是这里
function swallow(res) {
  state.logs.unshift({
    id: Date.now().toString(36),
    ts: Date.now(),
    name: state.feed.name,
    reason: state.feed.reason,
    photo: state.shot,
    cutout: state.cut ? { image: state.cut.image, width: state.cut.width, height: state.cut.height, alphaMask: state.cut.alphaMask, coverage: state.cut.coverage } : null,
    ai: res,
    outcome: 'fed',
  });
  save('logs', state.logs);
}

function renderSwallowDone(res) {
  $('#swallow-duration').textContent = fmtClock(res.duration);
  $('#swallow-calories').textContent = res.calories == null ? '—' : `${res.calories}Kcal`;
  $('#swallow-note').textContent = res.snake_note;
  $('#swallow-note').classList.remove('is-dim');
  $('#swallow-actions').innerHTML = `
    <button class="round-close" id="swallow-close" aria-label="完成，回到首页">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>
    </button>`;
  $('#swallow-close').onclick = () => {
    state.feed = null; state.shot = null; state.cut = null;
    show('home');
  };
}

function renderSwallowFail(msg) {
  $('#swallow-note').textContent = `这一口我还没咽下去。${msg}`;
  $('#swallow-note').classList.add('is-dim');
  const needsKey = !state.settings.apiKey || !state.settings.baseURL || !state.settings.model;
  $('#swallow-actions').innerHTML = `
    <button class="sketch-btn" id="swallow-back">返回修改</button>
    <button class="sketch-btn is-primary" id="swallow-retry">${needsKey ? '去设置模型' : '再试一次'}</button>`;
  $('#swallow-retry').onclick = () => (needsKey ? show('settings') : runAnalyze());
  $('#swallow-back').onclick = () => show('feed');
}

// ---------- 结果 ----------

// ---------- 蛇设定：人设会进 prompt ----------

function renderSetup() {
  const p = state.persona;
  $('#snake-name').value = p.name || '';
  $('#snake-extra').value = p.extra || '';
  $('#extra-count').textContent = (p.extra || '').length;
  $('#tone-grid').innerHTML = TONES.map((t) => `
    <button class="tone-chip" role="radio" data-tone="${t.id}"
            aria-checked="${t.id === p.tone}">${t.label}</button>`).join('');
  $('#persona-preview').textContent = '按这套设定，它会换一种说法';
}

$('#tone-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-tone]');
  if (!chip) return;
  state.persona.tone = chip.dataset.tone;
  document.querySelectorAll('#tone-grid .tone-chip').forEach((c) => {
    c.setAttribute('aria-checked', String(c === chip));
  });
});

$('#snake-name').addEventListener('input', (e) => { state.persona.name = e.target.value; });
$('#snake-extra').addEventListener('input', (e) => {
  state.persona.extra = e.target.value;
  $('#extra-count').textContent = e.target.value.length;
});

// 用一份固定的假食物试一句，让用户听到语气差别再决定要不要存
$('#persona-try').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = '它正在想…';
  try {
    const res = await analyzeFeed(state.settings, {
      name: '一块蛋糕',
      reason: '同事过生日剩下的',
      persona: state.persona,
    });
    $('#persona-preview').textContent = res.snake_note;
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '听它说一句';
  }
});

$('#setup-save').addEventListener('click', () => {
  save('persona', state.persona);
  toast('记住了');
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
  toast(state.settings.apiKey ? '已保存' : '已保存，但还缺 API Key，AI 无法回应');
  back();
});

// ---------- 启动 ----------

const RENDER = {
  home: renderHome,
  camera: renderCamera,
  feed: renderFeed,
  analyze: renderAnalyze,
  setup: renderSetup,
  settings: renderSettings,
};

show('home');

// 页面切到后台时停掉蛇的动画，回来再恢复
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSnake();
  else if (!$('[data-screen="home"]').hidden) renderHome();
});
