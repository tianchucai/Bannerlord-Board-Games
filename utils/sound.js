// 合成音效（WebAudio，无需音频资源文件）
// 木质感方案：敲击 = 白噪声经带通滤波的瞬态（木面"嗒"）+ 低频正弦共振（木质腔体）
// 依赖 wx.createWebAudioContext（基础库 2.19.0+，本工程 3.8.8 可用）
// 所有播放函数在音频不可用时静默失败，不影响游戏

let ctx = null;
let unlocked = false;
let noiseBuf = null; // 缓存的噪声 buffer（可被多个音源共享）

function ensureCtx() {
  if (ctx) return ctx;
  if (typeof wx === 'undefined' || typeof wx.createWebAudioContext !== 'function') return null;
  try {
    ctx = wx.createWebAudioContext();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

// 在用户首次触摸时调用：iOS 等平台要求手势后才能发声
function unlock() {
  const ac = ensureCtx();
  if (!ac || unlocked) return;
  unlocked = true;
  if (typeof ac.resume === 'function') {
    try { ac.resume(); } catch (e) {}
  }
  // 播放一个采样静音缓冲，激活音频管线
  try {
    const buf = ac.createBuffer(1, 1, ac.sampleRate || 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
  } catch (e) {}
}

// 生成/缓存 1.5 秒白噪声
function getNoise(ac) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor((ac.sampleRate || 22050) * 1.5);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate || 22050);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// 木面敲击瞬态：噪声 → 带通滤波 → 极快起音 + 指数衰减
function knock(ac, t0, vol, freq, dur, q) {
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q || 0.9;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

// 木质腔体共振：低频正弦，频率微降模拟木板振动
function body(ac, t0, freq, vol, dur) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// 落子：单次木面敲击 + 木质共振（更闷：低频带通、衰减稍长）
function playMove() {
  const ac = ensureCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime;
    knock(ac, t0, 0.34, 1600, 0.13, 0.7);
    body(ac, t0, 160, 0.24, 0.13);
  } catch (e) {}
}

// 吃子：单响高频短敲击（更脆，无双响）
function playCapture() {
  const ac = ensureCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime;
    knock(ac, t0, 0.32, 3400, 0.05, 1.5);
    body(ac, t0, 170, 0.18, 0.07);
  } catch (e) {}
}

// 胜利：木琴式上行三连音（每个音 = 敲击瞬态 + 基频共振）
function playWin() {
  const ac = ensureCtx();
  if (!ac) return;
  try {
    const notes = [523, 659, 784];
    notes.forEach((f, i) => {
      const t0 = ac.currentTime + i * 0.13;
      knock(ac, t0, 0.16, 3000, 0.05, 1.2);
      body(ac, t0, f, 0.22, 0.20);
    });
  } catch (e) {}
}

module.exports = { unlock, playMove, playCapture, playWin };
