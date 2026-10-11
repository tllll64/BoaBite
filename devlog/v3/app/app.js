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

/* ================= 蛇形态（V3 设计稿为静态扁平插画，渲染由 HTML 素材完成） ================= */

function renderSnake() {
  // 设计稿蛇为静态素材（#snakeHolder 内的 .hs-* 已按坐标排布），无需程序绘制。
  // 保留此函数仅作为状态变化钩子：投喂后触发吞咽动画。
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

/* ================= 数据栏（V3 设计稿首页无数据栏，仅保留状态逻辑） ================= */

function renderStats() {
  // V3 设计稿首页不再展示「今日记录 / 投喂次数 / kcal」数据栏，状态仍保留供气泡与记录使用。
}

function renderFeedBtn() {
  const btn = document.getElementById("feedBtn");
  const label = btn.querySelector("span");
  if (state.count >= MAX_FEED) {
    btn.disabled = true;
    if (label) label.textContent = "今天吃饱啦，明天再来";
  } else {
    btn.disabled = false;
    if (label) label.textContent = "我要投喂";
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
let cameraRequest = 0;

camVideo.addEventListener("playing", function () {
  const activeStream = stream;
  function showCameraOverlay() {
    if (!activeStream || stream !== activeStream || camVideo.readyState < 2) return;
    camLive = true;
    document.getElementById("viewCamera").classList.add("camera-ready");
  }
  if (camVideo.requestVideoFrameCallback) {
    camVideo.requestVideoFrameCallback(showCameraOverlay);
  } else {
    showCameraOverlay();
  }
});

async function startCamera() {
  cancelProcessing();
  stopCamera();
  camLive = false;
  const request = cameraRequest;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  try {
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    if (request !== cameraRequest) {
      nextStream.getTracks().forEach(function (track) { track.stop(); });
      return;
    }
    stream = nextStream;
    camVideo.srcObject = stream;
  } catch (err) {
    console.warn("[BoaBite] getUserMedia failed:", err && err.name);
  }
}

function stopCamera() {
  cameraRequest += 1;
  document.getElementById("viewCamera").classList.remove("camera-ready");
  camLive = false;
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

let analysisRequest = 0;
let developmentAnimations = [];

async function revealPaperSubject(src, request) {
  const camera = document.getElementById("viewCamera");
  const subject = document.getElementById("analysisSubject");
  subject.src = src;
  await subject.decode();
  if (!processing || request !== analysisRequest) return;
  camera.classList.add("developing");
  const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1700;
  const options = { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" };
  const centers = ["15% 24%", "86% 66%", "28% 91%"];
  developmentAnimations = Array.from(camera.querySelectorAll(".analysis-paper img"), (paper, i) =>
    paper.animate([
      { clipPath: `circle(0% at ${centers[i]})` },
      { clipPath: `circle(145% at ${centers[i]})` }
    ], options)
  );
  developmentAnimations.push(
    camera.querySelector(".analysis-yellow").animate([{ opacity: 0 }, { opacity: 1 }], options),
    subject.animate([{ opacity: 0 }, { opacity: 1 }], options)
  );
  // 先叠加气泡和面板，底层纸张与蛇头继续显影。
  loadTimers.push(setTimeout(() => {
    if (!processing || request !== analysisRequest) return;
    document.getElementById("viewConfirm").classList.add("revealing", "active");
  }, duration ? 400 : 0));
  await Promise.allSettled(developmentAnimations.map(animation => animation.finished));
}

function clearDevelopment() {
  const confirm = document.getElementById("viewConfirm");
  if (confirm.classList.contains("revealing")) {
    confirm.classList.remove("revealing", "active");
  }
  developmentAnimations.forEach(animation => animation.cancel());
  developmentAnimations = [];
  document.getElementById("viewCamera").classList.remove("developing");
  document.getElementById("analysisSubject").removeAttribute("src");
}


async function recognizeSubject(image, signal) {
  const base = location.port === "8787" ? "" : "http://127.0.0.1:8787";
  const response = await fetch(base + "/api/ai/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
    signal
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "识别失败");
  if (data.mock) throw new Error("识别服务当前为演示模式");
  const name = typeof data.food === "string" ? data.food.trim() : "";
  if (!name || name === "没认出来") throw new Error("未识别出名称");
  return name;
}

let recognitionController = null;


async function cropMouthSubject(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const viewport = document.getElementById("viewCamera").getBoundingClientRect();
  const mouth = document.querySelector(".cam-overlay img").getBoundingClientRect();
  // 对应 object-fit: cover 的取景坐标，只分析蛇嘴内的区域。
  const scale = Math.max(viewport.width / img.width, viewport.height / img.height);
  const offsetX = (img.width * scale - viewport.width) / 2;
  const offsetY = (img.height * scale - viewport.height) / 2;
  const x = Math.max(0, (mouth.left - viewport.left + mouth.width * .06 + offsetX) / scale);
  const y = Math.max(0, (mouth.top - viewport.top + mouth.height * .18 + offsetY) / scale);
  const w = Math.min(img.width - x, mouth.width * .88 / scale);
  const h = Math.min(img.height - y, mouth.height * .78 / scale);
  if (w <= 0 || h <= 0) throw new Error("invalid-crop");
  const cv = document.createElement("canvas");
  const resize = Math.min(1, 1024 / Math.max(w, h));
  cv.width = Math.max(1, Math.round(w * resize));
  cv.height = Math.max(1, Math.round(h * resize));
  cv.getContext("2d").drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", .92);
}

/* 定格 → 主体分割与名称识别 → 纸张显影 → 图片确认。 */
async function runMockRecognize(mode) {
  clearLoadTimers();
  clearDevelopment();
  if (recognitionController) recognitionController.abort();
  recognitionController = new AbortController();
  const signal = recognitionController.signal;
  const request = ++analysisRequest;
  lastMode = "cutout";
  processing = true;
  const camera = document.getElementById("viewCamera");
  const shot = document.getElementById("camShot");
  camera.classList.add("analyzing");
  shot.classList.remove("card");
  shot.onload = null;
  shot.src = photoData;
  shot.hidden = false;
  try {
    await shot.decode();
    if (request !== analysisRequest) return;
    camera.classList.add("captured");
    stopCamera();
    const cropped = await cropMouthSubject(photoData);
    const { cutout } = await import("./food-cutout.js?v=2");
    const [result, identified] = await Promise.all([
      cutout(cropped),
      recognizeSubject(cropped, signal).then(
        name => ({ name }),
        error => ({ error })
      )
    ]);
    if (request !== analysisRequest) return;
    if (result.coverage < .02) throw new Error("no-subject");
    photoData = result.image;
    const layer = document.getElementById("cfPhotoLayer");
    layer.className = "cf-photo-layer cutout";
    layer.src = photoData;
    await layer.decode();
    if (request !== analysisRequest) return;
    const sample = MOCK_FOODS[Math.floor(Math.random() * MOCK_FOODS.length)];
    pendingFood = { ...sample, name: identified.name || "未识别出名称" };
    document.getElementById("cfFoodName").value = identified.name || "";
    if (identified.error) toast("名称识别暂不可用，请检查 AI Lab 后端连接");
    pendingReview = REVIEWS[Math.floor(Math.random() * REVIEWS.length)];
    await revealPaperSubject(photoData, request);
    if (request !== analysisRequest) return;
    processing = false;
    document.getElementById("viewConfirm").classList.remove("revealing");
    showView("Confirm");
    // 让视图淡入完成后再清理底层，避免露出旧照片。
    loadTimers.push(setTimeout(function () {
      camera.classList.remove("analyzing");
      clearDevelopment();
    }, 300));
  } catch (err) {
    if (request !== analysisRequest) return;
    cancelProcessing();
    toast("这次没分离出主体，请重新拍摄");
    startCamera();
  }
}

function cancelProcessing() {
  clearDevelopment();
  if (recognitionController) recognitionController.abort();
  recognitionController = null;
  analysisRequest += 1;
  document.getElementById("viewCamera").classList.remove("analyzing");
  clearLoadTimers();
  processing = false;
  const shot = document.getElementById("camShot");
  shot.onload = null;
  shot.hidden = true;
  shot.src = "";
  document.getElementById("viewCamera").classList.remove("captured");
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
let tasteController = null;
async function runTasteLoad() {
  clearLoadTimers();
  if (tasteController) tasteController.abort();
  const controller = new AbortController();
  tasteController = controller;
  const text = document.querySelector(".el-text");
  text.textContent = "把它吞进肚子里...";
  showView("EatLoad");
  loadTimers.push(setTimeout(() => { text.textContent = "吃完吧唧嘴..."; }, 3000));
  loadTimers.push(setTimeout(() => { text.textContent = "想想怎么评价..."; }, 6000));
  try {
    const base = location.port === "8787" ? "" : "http://127.0.0.1:8787";
    const response = await fetch(base + "/api/ai/taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: photoData, food: pendingFood.name, trigger: pendingReason }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok || data.error || data.mock) throw new Error(data.error || "品鉴服务暂不可用");
    if (tasteController !== controller) return;
    pendingReview = data.note;
    if (Number.isFinite(data.calories)) pendingFood.kcal = data.calories;
    pendingFood.animalEmoji = data.animalEmoji;
    pendingFood.animalCount = data.animalCount;
    clearLoadTimers();
    tasteController = null;
    showTasteResult();
  } catch (error) {
    if (tasteController !== controller || controller.signal.aborted) return;
    clearLoadTimers();
    tasteController = null;
    showView("Pledge");
    toast(error instanceof TypeError ? "无法连接本地 AI 后端，请确认服务已启动" : "品鉴失败：" + error.message);
  }
}

document.getElementById("elBack").addEventListener("click", () => {
  if (tasteController) tasteController.abort();
  tasteController = null;
  clearLoadTimers();
  showView("Pledge");
});

/* 品鉴结果页（r2）：蛇腹鼓包 + 感言 + 消化热量 + 相当于 */
function showTasteResult() {
  const food = pendingFood || { name: "神秘食物", kcal: 200, size: "1 口" };
  document.getElementById("tkReview").textContent =
    pendingReview || "是" + food.name + "诶，这一口我替你扛了";
  document.getElementById("tkKcal").textContent = food.kcal;
  document.getElementById("tkAnimalEmoji").textContent = food.animalEmoji || "";
  document.getElementById("tkEq").textContent = Number.isFinite(food.animalCount) ? food.animalCount + "只" : "—";
  showView("Result");
}

document.getElementById("resultBack").addEventListener("click", () => showView("Home"));

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
      photoData = shot;
      runMockRecognize("full"); // 照片与取景同位同尺寸
    }
  } else {
    // 没有实时画面时使用系统拍摄，不能把演示拼接图当作照片。
    takeInput.value = "";
    takeInput.click();
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
  const input = document.getElementById("cfFoodName");
  const name = input.value.trim();
  if (!name) {
    toast("请填写物体名称");
    input.focus();
    return;
  }
  pendingFood.name = name;
  input.blur();
  showPledge();
});

document.getElementById("cfFoodName").addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    event.currentTarget.blur();
  }
});

// 投食状页：反悔了（回首页）/ 马上喂（→ 品鉴加载动画 → 品鉴结果）
document.getElementById("plRegret").addEventListener("click", function () {
  cancelProcessing();
  stopCamera();
  showView("Home");
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
// 首屏气泡按设计稿文案，之后进入轮换
showBubble("太饿了，你不吃的可以给我喂点");
setTimeout(rotateBubble, 8000);
console.log("[BoaBite] ready, count =", state.count);
