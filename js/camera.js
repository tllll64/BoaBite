// 相机取景与拍摄（BOABITE_DESIGN.md §6.1）。
// 只负责取流、拍帧和释放；页面流程由 app.js 驱动。
// 预览和成图都不做镜像——所见即所得。

const MAX_EDGE = 1280;   // 长边上限，避免大图拖慢后续抠图和存储

let stream = null;
let cameras = [];        // videoinput 设备，顺序即切换顺序
let activeId = null;     // 当前设备 deviceId
let blank = false;       // 只有一个摄像头时，翻转后的黑屏状态

export function isSupported() {
  return !!navigator.mediaDevices?.getUserMedia;
}

export function cameraCount() { return cameras.length; }
export function isBlank() { return blank; }

// deviceId 只在授权后可见，所以每次取流后都刷一遍
async function refreshCameras() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    cameras = all.filter((d) => d.kind === 'videoinput');
  } catch {
    cameras = [];
  }
  return cameras;
}

// 失败时抛错误码，由调用方决定文案，不在这里写 UI 文字。
export async function start(video, { deviceId } = {}) {
  if (!isSupported()) throw new Error('unsupported');
  stop();
  const pick = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: 'environment' } };
  stream = await navigator.mediaDevices.getUserMedia({
    video: { ...pick, width: { ideal: 1280 }, height: { ideal: 1280 } },
    audio: false,
  });
  // 以“请求的 deviceId”为准：部分浏览器上报的 deviceId 为空或与请求不一致，
  // 若据此记录会导致下次切换算错下一个设备。
  activeId = deviceId ?? stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? null;
  blank = false;
  video.srcObject = stream;
  await video.play().catch(() => {});
  await refreshCameras();
  return activeId;
}

export function stop() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function isRunning() {
  return !!stream;
}

// 切到下一个真实摄像头（前摄 / 后摄），不是镜像。
// 设备只有一个时进入黑屏，再按一次切回画面。
export async function flip(video) {
  if (blank) {
    await start(video, activeId ? { deviceId: activeId } : {});
    return { blank: false };
  }
  await refreshCameras();
  if (cameras.length < 2) {
    stop();
    video.srcObject = null;
    blank = true;
    return { blank: true };
  }
  let i = cameras.findIndex((d) => d.deviceId === activeId);
  if (i < 0) i = 0;   // 认不出当前设备时，从头推进而不是卡在原地
  const next = cameras[(i + 1) % cameras.length];
  await start(video, { deviceId: next.deviceId });
  return { blank: false };
}

// 按取景框的可视比例裁剪，保证拍到的就是蛇嘴里看到的那块
export function capture(video, canvas, aspect) {
  if (blank) throw new Error('blank');
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('not-ready');

  const target = aspect || vw / vh;
  let sw = vw;
  let sh = Math.round(vw / target);
  if (sh > vh) { sh = vh; sw = Math.round(vh * target); }
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);

  canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}

// 相册选图：同样压到长边上限，输出和 capture 一致的 dataURL
export function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('not-image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
    img.src = url;
  });
}
