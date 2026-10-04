// BoaBite · 首页 + 投喂链路（原型版：识别/品鉴为 mock）
"use strict";

const MAX_FEED = 8; // 蛇形态上限（PRD §8.1）
const STORE_KEY = "boabite_today";

/* ================= 状态 ================= */

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  if (!s || s.date !== todayKey()) s = { date: todayKey(), count: 0, kcal: 0, logs: [] };
  if (!Array.isArray(s.logs)) s.logs = [];
  return s;
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = load();

/* ================= 视图切换 ================= */

const VIEWS = ["Home", "Camera", "Confirm", "Pledge", "EatLoad", "Result"];

function showView(name) {
  VIEWS.forEach(function (v) {
    document.getElementById("view" + v).classList.toggle("active", v === name);
  });
}

/* ================= 蛇形态（程序绘制占位，素材到位后可整体替换） ================= */

const SNAKE_PATH =
  "M160 64 C215 64 252 100 252 148 C252 200 205 236 152 236 " +
  "C101 236 64 200 64 152 C64 108 98 78 142 78 " +
  "C176 78 200 100 200 130 C200 156 180 170 156 170 " +
  "C138 170 126 158 126 142";

function renderSnake(count) {
  const w = 30 + count * 10;
  const hr = w * 0.62 + 14;
  const full = count >= MAX_FEED;

  const eyeY = 44;
  const eyeDX = Math.max(12, hr * 0.44);
  let eyes;
  if (full) {
    eyes = `
      <path d="M${160 - eyeDX - 5} ${eyeY} q5 -6 10 0" stroke="#2b2b2b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M${160 + eyeDX - 5} ${eyeY} q5 -6 10 0" stroke="#2b2b2b" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  } else if (count === 0) {
    eyes = `
      <circle cx="${160 - eyeDX}" cy="${eyeY}" r="6.5" fill="#fff"/>
      <circle cx="${160 + eyeDX}" cy="${eyeY}" r="6.5" fill="#fff"/>
      <circle cx="${160 - eyeDX + 1}" cy="${eyeY + 1.5}" r="3.4" fill="#2b2b2b"/>
      <circle cx="${160 + eyeDX + 1}" cy="${eyeY + 1.5}" r="3.4" fill="#2b2b2b"/>`;
  } else {
    eyes = `
      <circle cx="${160 - eyeDX}" cy="${eyeY}" r="6" fill="#fff"/>
      <circle cx="${160 + eyeDX}" cy="${eyeY}" r="6" fill="#fff"/>
      <circle cx="${160 - eyeDX}" cy="${eyeY}" r="3" fill="#2b2b2b"/>
      <circle cx="${160 + eyeDX}" cy="${eyeY}" r="3" fill="#2b2b2b"/>`;
  }

  const tongue = full
    ? ""
    : `<path d="M160 ${50 - hr} v-9 m0 0 l-4 -4 m4 4 l4 -4" stroke="#FF6B6B" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

  const mouth = full
    ? `<path d="M150 66 q10 8 20 0" stroke="#2b2b2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M152 64 q8 6 16 0" stroke="#2b2b2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

  document.getElementById("snakeHolder").innerHTML = `
    <svg class="snake-svg" viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="256" rx="${w * 1.15 + 30}" ry="13" fill="#5b5348" opacity="0.08"/>
      <path d="${SNAKE_PATH}" fill="none" stroke="#8FD694" stroke-width="${w}" stroke-linecap="round"/>
      <path d="${SNAKE_PATH}" fill="none" stroke="#4E9F5C" stroke-width="${w * 0.56}" stroke-linecap="butt"
            stroke-dasharray="13 26" opacity="0.32"/>
      <circle cx="160" cy="50" r="${hr}" fill="#8FD694"/>
      <circle cx="160" cy="${50 + hr * 0.62}" r="${hr * 0.8}" fill="#A9E4AD" opacity="0.55"/>
      ${eyes}
      ${mouth}
      <ellipse cx="${160 - hr * 0.72}" cy="${eyeY + 13}" rx="5.5" ry="3.6" fill="#FFB4A2" opacity="0.7"/>
      <ellipse cx="${160 + hr * 0.72}" cy="${eyeY + 13}" rx="5.5" ry="3.6" fill="#FFB4A2" opacity="0.7"/>
      ${tongue}
    </svg>`;
}

/* ================= 气泡文案池（占位版，文案池由产品提供后替换） ================= */

function timeSlot() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "noon";
  if (h >= 14 && h < 18) return "afternoon";
  if (h >= 18 && h < 23) return "evening";
  return "night";
}

const POOLS = {
  hungry: {
    morning: ["早安～我肚子空空的，今天也拜托你啦", "早上好！想吃零食的时候，先想想我哦"],
    noon: ["午饭后嘴巴闲不住？先喂我一口试试", "中午的我，胃口正好"],
    afternoon: ["下午茶时间……零食递到嘴边之前，先喂我？", "工作累了？我陪你，别拿零食解压啦"],
    evening: ["晚饭后的嘴馋最难熬，我懂的", "想开冰箱？先来摸摸我"],
    night: ["半夜的冰箱灯，就别打开啦", "夜宵的冲动，塞给我吧"]
  },
  fed: [
    "嗯～今天的我，比早上圆了一点点",
    "你忍住的那几口，都在我身上了",
    "继续哦，我还想再圆一点",
    "这一口没吃，亏的是零食，赚的是你"
  ],
  full: [
    "快……快装不下了，但也许还能再来一口",
    "我快圆成球了，你的坚持也是"
  ],
  stuffed: [
    "今天真的装不下了！明天再来喂我吧",
    "8 分饱的我，替你说一句：够了，很棒"
  ]
};

let bubbleTimer = null;

function pickBubble() {
  const c = state.count;
  let pool;
  if (c === 0) pool = POOLS.hungry[timeSlot()];
  else if (c <= 4) pool = POOLS.fed;
  else if (c < MAX_FEED) pool = POOLS.full;
  else pool = POOLS.stuffed;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showBubble(text) {
  const el = document.getElementById("bubbleText");
  el.style.opacity = "0";
  setTimeout(() => {
    el.textContent = text;
    el.style.opacity = "1";
  }, 280);
}

function rotateBubble() {
  showBubble(pickBubble());
  clearInterval(bubbleTimer);
  bubbleTimer = setInterval(rotateBubble, 8000);
}

/* ================= 数据栏 ================= */

function renderStats() {
  const panel = document.getElementById("todayPanel");
  if (state.count === 0) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const d = new Date();
  document.getElementById("datePill").textContent =
    `今日记录 · ${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  document.getElementById("feedCount").textContent = state.count;
  document.getElementById("feedKcal").textContent = state.kcal;
}

function renderFeedBtn() {
  const btn = document.getElementById("feedBtn");
  if (state.count >= MAX_FEED) {
    btn.disabled = true;
    btn.textContent = "今天吃饱啦，明天再来";
  } else {
    btn.disabled = false;
    btn.textContent = "🖐 我要投喂";
  }
}

function renderAll() {
  renderSnake(state.count);
  renderStats();
  renderFeedBtn();
}

/* ================= 相机（getUserMedia 优先，失败降级相册/系统相机） ================= */

const camVideo = document.getElementById("camVideo");
const albumInput = document.getElementById("albumInput");
const takeInput = document.getElementById("takeInput");

let stream = null;
let camLive = false;
let photoData = null;

async function startCamera() {
  stopCamera();
  camLive = false;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    camVideo.srcObject = stream;
    camLive = true;
  } catch (err) {
    console.warn("[BoaBite] getUserMedia failed:", err && err.name);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
  }
  camVideo.srcObject = null;
}

function captureFrame() {
  const v = camVideo;
  if (!v.videoWidth) return null;
  const scale = Math.min(1, 1080 / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

function pickAlbum() {
  albumInput.value = "";
  albumInput.click();
}

function readImageFile(file, cb) {
  const r = new FileReader();
  r.onload = function () { cb(r.result); };
  r.readAsDataURL(file);
}

/* ================= 识别 / 品鉴（mock，AI 链路上线阶段接入） ================= */

const MOCK_FOODS = [
  { name: "黑松露可颂", kcal: 420, size: "1 个" },
  { name: "原味薯片", kcal: 275, size: "半包" },
  { name: "奶油小蛋糕", kcal: 350, size: "1 块" },
  { name: "珍珠奶茶", kcal: 470, size: "1 杯" },
  { name: "巧克力曲奇", kcal: 220, size: "2 块" },
  { name: "炸鸡腿", kcal: 290, size: "1 只" },
  { name: "芝士小汉堡", kcal: 560, size: "1 个" },
  { name: "抹茶冰淇淋", kcal: 280, size: "1 支" }
];

const REVIEWS = [
  "咔嚓——酥皮碎了一地，这一口我替你扛了",
  "甜度像下午三点的偷闲，刚刚好",
  "外酥里软，热量很诚实，你的克制也是",
  "唔，油香在嘴里转了三圈才肯下去",
  "脆、香、还有点罪恶感，现在归我了",
  "这一口的快乐我收下了，你收下轻松"
];

let loadTimers = [];
let processing = false;

function clearLoadTimers() {
  loadTimers.forEach(clearTimeout);
  loadTimers = [];
}

/* 识别/品鉴：相机页原地呼吸（构图不变），约 3s 后进抠像确认页 */
function runMockRecognize(mode) {
  clearLoadTimers();
  lastMode = mode || "card";
  const shot = document.getElementById("camShot");
  shot.classList.toggle("card", mode === "card");
  shot.src = photoData || "";
  shot.hidden = false;
  processing = true;

  loadTimers.push(setTimeout(function () {
    processing = false;
    shot.hidden = true;
    shot.src = "";
    pendingFood = MOCK_FOODS[Math.floor(Math.random() * MOCK_FOODS.length)];
    pendingReview = REVIEWS[Math.floor(Math.random() * REVIEWS.length)];
    const layer = document.getElementById("cfPhotoLayer");
    layer.className = "cf-photo-layer " + mode; // 与相机页同构：card / full
    layer.src = photoData || "";
    showView("Confirm");
  }, 3000));
}

function cancelProcessing() {
  clearLoadTimers();
  processing = false;
  const shot = document.getElementById("camShot");
  shot.hidden = true;
  shot.src = "";
}

/* 品鉴结果数据（快门时生成，✓ 确认后呈现） */
let pendingFood = null;
let pendingReview = "";
let pendingReason = "";

/* 投食状页：蛇衔圆环与照片原位延续（mode 与确认页一致） */
let lastMode = "card";

function showPledge() {
  const layer = document.getElementById("plPhotoLayer");
  layer.className = "cf-photo-layer " + lastMode;
  layer.src = photoData || "";
  document.getElementById("plReason").value = "";
  showView("Pledge");
}

/* 品鉴加载动画（马上喂后）：食物落入蛇嘴 → 完毕后出品鉴结果 */
function runTasteLoad() {
  clearLoadTimers();
  const canvas = document.getElementById("elCanvas");
  canvas.innerHTML =
    '<img class="food" src="' + (photoData || "") + '" alt="">' +
    '<svg class="mouth" viewBox="0 0 130 60" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="65" cy="30" rx="58" ry="24" fill="#F0C878" stroke="#1f1f1f" stroke-width="3"/>' +
    '<path d="M30 22 q6 -14 14 -6 M86 16 q8 -8 14 6" stroke="#1f1f1f" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '</svg>';
  showView("EatLoad");
  loadTimers.push(setTimeout(showTasteResult, 2600));
}

/* 品鉴结果页（r2）：蛇腹鼓包 + 感言 + 消化热量 + 相当于 */
function showTasteResult() {
  const food = pendingFood || { name: "神秘食物", kcal: 200, size: "1 口" };
  document.getElementById("tkReview").textContent =
    pendingReview || "是" + food.name + "诶，这一口我替你扛了";
  document.getElementById("tkKcal").textContent = food.kcal;
  const eq = food.kcal >= 450 ? "2只" : food.kcal >= 280 ? "1只" : "半只";
  document.getElementById("tkEq").textContent = eq;
  document.getElementById("tkSticker").textContent = "🐍";

  // 蛇插画：横趴蛇 + 腹中鼓包（先显示食物，后消化）
  document.getElementById("tkSnake").innerHTML = renderFlatSnake(!!photoData);
  if (photoData) {
    setTimeout(function () {
      const belly = document.getElementById("tkBellyFood");
      if (belly) belly.style.opacity = "0";
      document.querySelector(".tk-face-happy").style.display = "";
      document.querySelector(".tk-face-stuffed").style.display = "none";
    }, 1800);
    document.querySelector(".tk-face-happy").style.display = "none";
    document.querySelector(".tk-face-stuffed").style.display = "";
  }
  showView("Result");
}

/* 横趴蛇（程序绘制原型）：头部在右，腹中鼓包，可选嵌入食物 */
function renderFlatSnake(withFood) {
  const bodyY = 150;
  const bumpH = withFood ? 86 : 64;
  const belly = withFood
    ? '<clipPath id="bellyClip"><path d="M80 190 Q196 ' + (190 - bumpH - 26) + ' 312 190 Z"/></clipPath>' +
      '<image id="tkBellyFood" class="tk-belly-food" href="' + photoData + '" x="84" y="100" width="224" height="120" preserveAspectRatio="xMidYMid slice" clip-path="url(#bellyClip)"/>'
    : '';
  return '<svg viewBox="0 0 393 200" xmlns="http://www.w3.org/2000/svg">' + belly +
    '<path d="M6 ' + bodyY + ' Q196 ' + (bodyY - bumpH) + ' 360 ' + (bodyY - 10) + '" fill="none" stroke="#F0C878" stroke-width="44" stroke-linecap="round"/>' +
    '<path d="M6 ' + bodyY + ' Q196 ' + (bodyY - bumpH) + ' 360 ' + (bodyY - 10) + '" fill="none" stroke="#1f1f1f" stroke-width="2.5" stroke-dasharray="0" opacity="0"/>' +
    '<circle cx="352" cy="' + (bodyY - 34) + '" r="24" fill="#F0C878" stroke="#1f1f1f" stroke-width="2.5"/>' +
    '<circle cx="348" cy="' + (bodyY - 40) + '" r="2.8" fill="#1f1f1f"/>' +
    '<path d="M366 ' + (bodyY - 36) + ' q10 -2 8 -10" stroke="#FF6B6B" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '</svg>';
}

/* ================= 投喂落地 ================= */

function applyFeed(food, reason) {
  state.count += 1;
  state.kcal += food.kcal;
  state.logs.push({ t: Date.now(), name: food.name, kcal: food.kcal, size: food.size, reason: reason || "" });
  save();

  const holder = document.getElementById("snakeHolder");
  holder.classList.remove("gulping");
  void holder.offsetWidth;
  holder.classList.add("gulping");

  renderAll();
  showView("Home");
  setTimeout(rotateBubble, 350);
}

/* ================= 轻提示 ================= */

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ================= 事件绑定 ================= */

document.addEventListener("click", function (e) {
  const btn = e.target.closest("#feedBtn");
  if (!btn || btn.disabled) return;
  showView("Camera");
  startCamera();
});

document.getElementById("camClose").addEventListener("click", function () {
  cancelProcessing(); // 处理中取消 → 返回首页，无记录残留
  stopCamera();
  showView("Home");
});

document.getElementById("camShutter").addEventListener("click", function () {
  if (processing) return;
  if (camLive) {
    const shot = captureFrame();
    if (shot) {
      stopCamera();
      photoData = shot;
      runMockRecognize("full"); // 照片与取景同位同尺寸
    }
  } else {
    // 无实时取景（桌面预览演示）：用演示图走完整链路
    photoData = "design/assets/cam-demo-food.png";
    runMockRecognize("card"); // 与演示背景同位同尺寸
  }
});

document.getElementById("camAlbum").addEventListener("click", function () {
  if (processing) return;
  pickAlbum();
});

albumInput.addEventListener("change", function () {
  const f = albumInput.files && albumInput.files[0];
  if (!f) return;
  readImageFile(f, function (data) {
    stopCamera();
    photoData = data;
    runMockRecognize("full");
  });
});

takeInput.addEventListener("change", function () {
  const f = takeInput.files && takeInput.files[0];
  if (!f) return;
  readImageFile(f, function (data) {
    photoData = data;
    runMockRecognize("full");
  });
});

// 抠像确认页：↺ 重拍（反悔窗口的最后一刻）/ ✓ 确认 → 品鉴结果
document.getElementById("cfRetake").addEventListener("click", function () {
  showView("Camera");
  startCamera();
});

document.getElementById("cfConfirm").addEventListener("click", function () {
  showPledge();
});

// 投食状页：反悔了（回相机）/ 马上喂（→ 品鉴加载动画 → 品鉴结果）
document.getElementById("plRegret").addEventListener("click", function () {
  showView("Camera");
  startCamera();
});

document.getElementById("plFeed").addEventListener("click", function () {
  const reason = document.getElementById("plReason").value.trim() || "买多了吃不下";
  pendingReason = reason;
  runTasteLoad();
});

// 品鉴结果页：喂完了（落地投喂回首页）/ 继续喂（回相机）
document.getElementById("tkDone").addEventListener("click", function () {
  applyFeed({
    name: pendingFood ? pendingFood.name : "神秘食物",
    kcal: pendingFood ? pendingFood.kcal : 200,
    size: pendingFood ? pendingFood.size : "1 口"
  }, pendingReason);
});

document.getElementById("tkMore").addEventListener("click", function () {
  showView("Camera");
  startCamera();
});

document.getElementById("btnShare").addEventListener("click", function () {
  toast("分享 · 第 2 期排期中");
});

/* ================= 启动 ================= */

document.getElementById("btnCalendar").addEventListener("click", function () {
  toast("投喂日记 · P1 排期中");
});

document.getElementById("btnPersona").addEventListener("click", function () {
  toast("蛇的人设 · P2 排期中");
});

renderAll();
showView("Home");
rotateBubble();
console.log("[BoaBite] ready, count =", state.count);
