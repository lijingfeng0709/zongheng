/* ============ 通用工具 ============ */
window.U = (function () {
  const U = {};

  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.chance = p => Math.random() < p;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
  U.ang = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  U.angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  U.fmt = n => {
    n = Math.round(n);
    if (n >= 100000) return (n / 10000).toFixed(1) + '万';
    return String(n);
  };
  U.expFor = lv => Math.floor(58 * Math.pow(lv, 1.58) + 24 * lv);
  U.shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  U.weighted = list => {
    let total = 0;
    for (const it of list) total += it.w || 1;
    let r = Math.random() * total;
    for (const it of list) { r -= (it.w || 1); if (r <= 0) return it; }
    return list[list.length - 1];
  };
  U.$ = s => document.querySelector(s);
  U.$$ = s => Array.from(document.querySelectorAll(s));
  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.timeStr = s => {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  };
  U.now = () => performance.now();

  /* ---------- 提示 ---------- */
  U.toast = function (msg, type) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast' + (type ? ' ' + type : '');
    d.innerHTML = msg;
    box.appendChild(d);
    setTimeout(() => {
      d.style.transition = 'opacity .35s, transform .35s';
      d.style.opacity = '0';
      d.style.transform = 'translateY(-6px)';
      setTimeout(() => d.remove(), 380);
    }, 2000);
    while (box.children.length > 5) box.removeChild(box.firstChild);
  };

  /* ---------- 世界日志 ---------- */
  U.log = function (text, type) {
    if (!window.G) return;
    G.log.unshift({ text, type: type || '', t: G.t });
    if (G.log.length > 40) G.log.pop();
    const box = document.getElementById('logHud');
    if (box) {
      const d = document.createElement('div');
      if (type) d.className = type;
      d.textContent = text;
      box.appendChild(d);
      while (box.children.length > 6) box.removeChild(box.firstChild);
      setTimeout(() => {
        if (!d.parentNode) return;
        d.style.transition = 'opacity .6s';
        d.style.opacity = '0';
        setTimeout(() => d.remove(), 650);
      }, 9000);
    }
  };

  /* ---------- 音效（WebAudio 合成，无资源依赖） ---------- */
  let actx = null;
  U.audioOn = true;
  U.sfx = function (kind) {
    if (!U.audioOn) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.connect(g); g.connect(actx.destination);
      const cfg = {
        hit:    { f: 320, f2: 150, type: 'square',   d: 0.07, v: 0.035 },
        weak:   { f: 760, f2: 240, type: 'sawtooth', d: 0.13, v: 0.05 },
        crit:   { f: 980, f2: 380, type: 'square',   d: 0.16, v: 0.05 },
        hurt:   { f: 180, f2: 80,  type: 'sawtooth', d: 0.13, v: 0.05 },
        skill:  { f: 520, f2: 900, type: 'sine',     d: 0.2,  v: 0.04 },
        loot:   { f: 620, f2: 980, type: 'sine',     d: 0.1,  v: 0.03 },
        level:  { f: 440, f2: 1180,type: 'sine',     d: 0.4,  v: 0.06 },
        die:    { f: 220, f2: 60,  type: 'triangle', d: 0.35, v: 0.05 },
        coin:   { f: 880, f2: 1320,type: 'sine',     d: 0.08, v: 0.025 },
        ui:     { f: 400, f2: 400, type: 'sine',     d: 0.03, v: 0.015 },
      }[kind];
      if (!cfg) return;
      o.type = cfg.type;
      o.frequency.setValueAtTime(cfg.f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.f2), t + cfg.d);
      g.gain.setValueAtTime(cfg.v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.d);
      o.start(t); o.stop(t + cfg.d + 0.02);
    } catch (e) { /* 忽略音频错误 */ }
  };

  U.hexA = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  return U;
})();
