// 食物抠图（BOABITE_DESIGN.md §7.1）。
// 用完整版 u2net 做显著物体分割：食物照片里食物就是显著物体，
// 不需要识别它具体是什么。输出保留真实颜色的透明轮廓图 + 用于碰撞的 alpha mask。

const MODEL_URL = new URL('./vendor/models/u2net.onnx', import.meta.url).href;
const INPUT = 320;        // u2netp 的输入边长
const OUT_EDGE = 320;     // 轮廓图长边上限，进蛇腹只需这个量级
const MASK_EDGE = 64;     // 碰撞用 mask 的边长，存进 localStorage 的就是它

// ImageNet 均值/标准差，u2net 系列沿用这组参数
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let ortPromise = null;
let sessionPromise = null;

// onnxruntime-web 体积大，只在真正抠图时才加载
function loadOrt() {
  if (!ortPromise) {
    ortPromise = import('./vendor/ort/ort.wasm.min.mjs').then((m) => {
      const ort = m.default ?? m;
      // 单线程 + 关闭 SIMD 线程版：多线程需要 COOP/COEP 响应头，
      // 而 dev 用的 python http.server 加不了，这里直接避开。
      ort.env.wasm.numThreads = 1;
      // 必须是绝对路径：相对路径无法解析成模块说明符
      ort.env.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
      return ort;
    });
  }
  return ortPromise;
}

export function getSession() {
  if (!sessionPromise) {
    sessionPromise = loadOrt().then((ort) =>
      ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      }),
    );
  }
  return sessionPromise;
}

// 首次抠图要下模型，调用方可以先预热，避免用户等在确认页
export function warmUp() {
  return getSession().then(() => true).catch(() => false);
}

function drawToCanvas(img, w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, w, h);
  return cv;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = src;
  });
}

// NCHW float32，按 ImageNet 参数归一化
function toTensorData(canvas) {
  const { data } = canvas.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, INPUT, INPUT);
  const out = new Float32Array(3 * INPUT * INPUT);
  const plane = INPUT * INPUT;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

// u2net 输出未归一化，按 min-max 拉伸到 0..1
function normalize(arr) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
  const span = max - min || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = (arr[i] - min) / span;
  return out;
}

// 可分离盒式模糊：横竖各扫一遍，把 mask 的硬边磨成渐变。
// u2net 输出为 320×320，直接拿去做 alpha 会带阶梯感。
// 跑两遍近似高斯，代价仍是 O(n)。
function blurMask(src, n, radius, passes = 2) {
  if (radius < 1) return src;
  let cur = Float32Array.from(src);
  let tmp = new Float32Array(n * n);
  const win = radius * 2 + 1;

  for (let p = 0; p < passes; p++) {
    // 横向
    for (let y = 0; y < n; y++) {
      const row = y * n;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += cur[row + Math.min(n - 1, Math.max(0, k))];
      for (let x = 0; x < n; x++) {
        tmp[row + x] = sum / win;
        const out = row + Math.min(n - 1, Math.max(0, x - radius));
        const add = row + Math.min(n - 1, Math.max(0, x + radius + 1));
        sum += cur[add] - cur[out];
      }
    }
    // 纵向
    for (let x = 0; x < n; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(n - 1, Math.max(0, k)) * n + x];
      for (let y = 0; y < n; y++) {
        cur[y * n + x] = sum / win;
        const out = Math.min(n - 1, Math.max(0, y - radius)) * n + x;
        const add = Math.min(n - 1, Math.max(0, y + radius + 1)) * n + x;
        sum += tmp[add] - tmp[out];
      }
    }
  }
  return cur;
}

// 双线性采样，把 320×320 的 mask 放回目标尺寸
function sampleMask(mask, mw, x, y) {
  const fx = Math.min(mw - 1, Math.max(0, x));
  const fy = Math.min(mw - 1, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(mw - 1, x0 + 1);
  const y1 = Math.min(mw - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;
  const a = mask[y0 * mw + x0];
  const b = mask[y0 * mw + x1];
  const c = mask[y1 * mw + x0];
  const d = mask[y1 * mw + x1];
  return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
}

/**
 * 抠出食物轮廓。
 * @param {string} dataUrl 相机或相册得到的 JPEG dataURL
 * @returns {Promise<{image:string,width:number,height:number,aspectRatio:number,alphaMask:{w:number,h:number,bits:string},coverage:number}>}
 *   image 是 PNG dataURL（带透明通道），alphaMask 是降采样后的二值遮罩，供 food-layout.js 做碰撞判断。
 */
export async function cutout(dataUrl, { threshold = 0.5, feather = true, smooth = 2, softness = 0.34 } = {}) {
  const img = await loadImage(dataUrl);
  const session = await getSession();

  const small = drawToCanvas(img, INPUT, INPUT);
  const ort = await loadOrt();
  const tensor = new ort.Tensor('float32', toTensorData(small), [1, 3, INPUT, INPUT]);
  const feeds = { [session.inputNames[0]]: tensor };
  const result = await session.run(feeds);
  const raw = result[session.outputNames[0]].data;
  const rawMask = normalize(raw.length === INPUT * INPUT ? raw : raw.subarray(0, INPUT * INPUT));
  // 用于绘制的 mask 先磨平边缘；碰撞遮罩沿用未模糊的版本，避免轮廓被涨大
  const mask = feather ? blurMask(rawMask, INPUT, smooth) : rawMask;

  // 输出图按长边压到 OUT_EDGE，控制 localStorage 占用
  const scale = Math.min(1, OUT_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const cv = drawToCanvas(img, w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, w, h);

  let covered = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = sampleMask(mask, INPUT, (x / w) * INPUT, (y / h) * INPUT);
      // feather 时保留边缘过渡，否则硬切——硬切边缘会有锯齿
      const a = feather
        ? Math.max(0, Math.min(1, (v - threshold) / softness + 0.5))
        : (v >= threshold ? 1 : 0);
      px.data[(y * w + x) * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) covered++;
    }
  }
  ctx.putImageData(px, 0, 0);

  // 裁掉透明边距：整幅图里食物常只占一两成，不裁的话放进蛇腹会被
  // preserveAspectRatio 缩成一小块，看着像没吃进东西。顺带省存储。
  const box = alphaBounds(px, w, h);
  const tw = box.x2 - box.x1 + 1;
  const th = box.y2 - box.y1 + 1;
  const trimmed = document.createElement('canvas');
  trimmed.width = tw;
  trimmed.height = th;
  trimmed.getContext('2d').drawImage(cv, box.x1, box.y1, tw, th, 0, 0, tw, th);

  return {
    image: trimmed.toDataURL('image/png'),
    width: tw,
    height: th,
    aspectRatio: tw / th,
    alphaMask: buildMask(rawMask, threshold, { box, w, h }),
    coverage: covered / (w * h),   // 占比过低说明没抠到东西，调用方可据此回退
  };
}

// 扫出 alpha 的外接框
function alphaBounds(px, w, h) {
  let x1 = w, y1 = h, x2 = 0, y2 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px.data[(y * w + x) * 4 + 3] > 12) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  // 全透明时退回整幅，避免出现零尺寸画布
  if (x2 < x1 || y2 < y1) return { x1: 0, y1: 0, x2: w - 1, y2: h - 1 };
  return { x1, y1, x2, y2 };
}

// 碰撞用遮罩：降到 MASK_EDGE 见方的 1-bit 位图，base64 存储。
// 存完整 alpha 通道会让每条记录多出几百 KB，localStorage 撑不住。
function buildMask(mask, threshold, crop) {
  const n = MASK_EDGE;
  const bytes = new Uint8Array(Math.ceil((n * n) / 8));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // 遮罩要覆盖与图片相同的裁剪区域，否则碰撞判断和实际画面错位
      const u = crop ? (crop.box.x1 + (x / n) * (crop.box.x2 - crop.box.x1 + 1)) / crop.w : x / n;
      const vv = crop ? (crop.box.y1 + (y / n) * (crop.box.y2 - crop.box.y1 + 1)) / crop.h : y / n;
      const v = sampleMask(mask, INPUT, u * INPUT, vv * INPUT);
      if (v >= threshold) {
        const i = y * n + x;
        bytes[i >> 3] |= 128 >> (i & 7);
      }
    }
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { w: n, h: n, bits: btoa(bin) };
}

// 读回位图，food-layout.js 用它做像素级碰撞
export function readMask({ w, h, bits }) {
  const bin = atob(bits);
  const get = (x, y) => {
    const i = y * w + x;
    return (bin.charCodeAt(i >> 3) & (128 >> (i & 7))) !== 0;
  };
  return { w, h, get };
}
