/* ============ 渲染 ============ */
window.R = (function () {
  const R = {};
  let cv, ctx, dpr = 1, vw = 0, vh = 0, vwW = 0, vhW = 0;
  const ZOOM = 1.28;
  R.ZOOM = ZOOM;

  R.init = function () {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth;
    vh = window.innerHeight;
    cv.width = Math.floor(vw * dpr);
    cv.height = Math.floor(vh * dpr);
    cv.style.width = vw + 'px';
    cv.style.height = vh + 'px';
  };

  R.view = function () { return { w: vw, h: vh }; };

  /* ---------- 主绘制 ---------- */
  R.draw = function (dt) {
    if (!ctx || !G.zone) return;
    const z = G.zone, p = G.player;

    // 相机（带缩放）
    vwW = vw / ZOOM;
    vhW = vh / ZOOM;
    let tx = p ? p.x - vwW / 2 : 0;
    let ty = p ? p.y - vhW / 2 : 0;
    tx = z.w > vwW ? U.clamp(tx, 0, z.w - vwW) : (z.w - vwW) / 2;
    ty = z.h > vhW ? U.clamp(ty, 0, z.h - vhW) : (z.h - vhW) / 2;
    G.cam.x = U.lerp(G.cam.x, tx, Math.min(1, dt * 9));
    G.cam.y = U.lerp(G.cam.y, ty, Math.min(1, dt * 9));

    let sx = 0, sy = 0;
    if (G.shake > 0) {
      sx = U.rand(-G.shake, G.shake);
      sy = U.rand(-G.shake, G.shake);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, 0, 0);
    ctx.translate(-G.cam.x + sx, -G.cam.y + sy);

    drawGround(z);
    drawHazards(z);
    drawLandmarks(z);
    drawPoints();
    drawPortal();
    drawProps(z);
    drawLoot();
    drawEntities();
    drawProjectiles();
    drawFx();
    drawTexts();
    drawReticle();
    drawBossBar();

    ctx.restore();
    drawAmbient();
    drawVignette();
  };

  /* ---------- 区域氛围粒子（屏幕空间） ---------- */
  function drawAmbient() {
    const th = G.zone && G.zone.theme;
    const t = G.t;
    if (th === 'ice') {
      // 细雪
      for (let i = 0; i < 46; i++) {
        const x = (i * 173 + Math.sin(t * 0.6 + i) * 40 + t * (14 + (i % 5) * 10)) % (vw + 60) - 30;
        const y = (i * 97 + t * (26 + (i % 4) * 16)) % (vh + 60) - 30;
        ctx.fillStyle = `rgba(230,245,255,${0.18 + (i % 4) * 0.06})`;
        ctx.fillRect(x, y, 1.6, 1.6 + (i % 3));
      }
    } else if (th === 'rift') {
      // 火星
      for (let i = 0; i < 26; i++) {
        const x = (i * 211 + Math.sin(t * 0.8 + i) * 26) % vw;
        const y = vh - ((i * 149 + t * (40 + (i % 6) * 22)) % (vh + 40));
        ctx.fillStyle = `rgba(255,${140 + (i % 5) * 15},70,${0.25 + (i % 4) * 0.08})`;
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (th === 'sanctum' || th === 'moon') {
      // 灵光
      for (let i = 0; i < 22; i++) {
        const x = (i * 191 + Math.sin(t * 0.5 + i * 1.7) * 34) % vw;
        const y = (i * 263 + Math.cos(t * 0.4 + i) * 30 - t * 8) % vh;
        const yy = y < 0 ? y + vh : y;
        ctx.fillStyle = `rgba(200,170,255,${0.14 + (i % 4) * 0.05})`;
        ctx.beginPath(); ctx.arc(x, yy, 1.6 + (i % 3), 0, 6.283); ctx.fill();
      }
    } else if (th === 'undersea') {
      // 气泡
      for (let i = 0; i < 20; i++) {
        const x = (i * 233 + Math.sin(t * 1.2 + i) * 18) % vw;
        const y = vh - ((i * 137 + t * (18 + (i % 4) * 12)) % (vh + 60));
        ctx.strokeStyle = `rgba(160,235,245,${0.14 + (i % 3) * 0.05})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 2 + (i % 4), 0, 6.283); ctx.stroke();
      }
    } else if (th === 'ghost') {
      for (let i = 0; i < 14; i++) {
        const x = (i * 197 + Math.sin(t * 0.7 + i) * 40) % vw;
        const y = (i * 311 - t * 12) % vh;
        const yy = y < 0 ? y + vh : y;
        ctx.fillStyle = `rgba(130,220,190,${0.10 + (i % 3) * 0.04})`;
        ctx.beginPath(); ctx.arc(x, yy, 2 + (i % 3), 0, 6.283); ctx.fill();
      }
    } else if (th === 'capital' || th === 'avalon') {
      for (let i = 0; i < 16; i++) {
        const x = (i * 181 + Math.sin(t * 0.5 + i) * 22) % vw;
        const y = (i * 271 - t * 6) % vh;
        const yy = y < 0 ? y + vh : y;
        ctx.fillStyle = `rgba(255,215,140,${0.10 + (i % 3) * 0.04})`;
        ctx.beginPath(); ctx.arc(x, yy, 1.4, 0, 6.283); ctx.fill();
      }
    }
  }

  /* ---------- 地面 ---------- */
  function drawGround(z) {
    const grad = ctx.createLinearGradient(0, 0, 0, z.h);
    grad.addColorStop(0, z.ground);
    grad.addColorStop(1, z.ground2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, z.w, z.h);

    // 网格（只有可见区域）
    const g = 140;
    const x0 = Math.floor(G.cam.x / g) * g;
    const y0 = Math.floor(G.cam.y / g) * g;
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x < G.cam.x + vwW + g; x += g) { ctx.moveTo(x, G.cam.y - 10); ctx.lineTo(x, G.cam.y + vhW + 10); }
    for (let y = y0; y < G.cam.y + vhW + g; y += g) { ctx.moveTo(G.cam.x - 10, y); ctx.lineTo(G.cam.x + vwW + 10, y); }
    ctx.stroke();

    // 地面细节
    if (G.decor) {
      for (const d of G.decor) {
        if (d.x < G.cam.x - 40 || d.x > G.cam.x + vwW + 40) continue;
        if (d.y < G.cam.y - 40 || d.y > G.cam.y + vhW + 40) continue;
        if (z.theme === 'forest' || z.theme === 'swamp') {
          ctx.strokeStyle = 'rgba(110,170,130,0.17)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y - d.l * 0.45);
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3, d.y - d.l * 0.32);
          ctx.stroke();
        } else if (z.theme === 'rift' || z.theme === 'mine' || z.theme === 'ghost') {
          ctx.strokeStyle = z.theme === 'rift' ? 'rgba(255,110,60,0.15)'
            : z.theme === 'ghost' ? 'rgba(120,220,190,0.10)' : 'rgba(120,150,190,0.10)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(d.a) * d.l, d.y + Math.sin(d.a) * d.l * 0.6);
          ctx.stroke();
        } else if (z.theme === 'ice') {
          ctx.strokeStyle = 'rgba(180,225,255,0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(d.a) * d.l * 0.8, d.y + Math.sin(d.a) * d.l * 0.4);
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(d.a + 2.1) * d.l * 0.5, d.y + Math.sin(d.a + 2.1) * d.l * 0.3);
          ctx.stroke();
        } else if (z.theme === 'sanctum' || z.theme === 'moon') {
          ctx.fillStyle = z.theme === 'moon' ? 'rgba(210,205,255,0.09)' : 'rgba(190,150,255,0.08)';
          const bob = Math.sin(G.t * 1.4 + d.t * 9) * 5;
          ctx.beginPath(); ctx.arc(d.x, d.y + bob, Math.max(1.4, d.l * 0.12), 0, 6.283); ctx.fill();
        } else if (z.theme === 'undersea') {
          ctx.strokeStyle = 'rgba(120,220,235,0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(d.x, d.y - (G.t * 12 + d.t * 40) % 90, d.l * 0.1 + 1, 0, 6.283);
          ctx.stroke();
        } else if (z.theme === 'capital' || z.theme === 'avalon') {
          ctx.fillStyle = 'rgba(240,205,130,0.06)';
          ctx.beginPath(); ctx.arc(d.x, d.y, d.l * 0.4, 0, 6.283); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(201,163,92,0.045)';
          ctx.beginPath(); ctx.arc(d.x, d.y, d.l * 0.5, 0, 6.283); ctx.fill();
        }
      }
    }

    // 副本祭坛
    if (z.dungeon) {
      const bx = z.w - 320, by = 300;
      const rg = ctx.createRadialGradient(bx, by, 30, bx, by, 330);
      rg.addColorStop(0, U.hexA(z.accent, 0.13));
      rg.addColorStop(1, U.hexA(z.accent, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(bx, by, 330, 0, 6.283); ctx.fill();
      ctx.strokeStyle = U.hexA(z.accent, 0.3);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 250, 0, 6.283); ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * 6.283;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(a) * 258, by + Math.sin(a) * 258);
        ctx.lineTo(bx + Math.cos(a) * 272, by + Math.sin(a) * 272);
        ctx.stroke();
      }
    }

    // 光斑 / 地气
    const t = G.t;
    const GLOW = {
      rift: '255,90,50', swamp: '60,200,150', ice: '150,215,255',
      sanctum: '170,120,255', moon: '200,195,255', undersea: '80,210,230',
      capital: '240,200,120', avalon: '255,220,140', ghost: '110,210,190',
    };
    if (GLOW[z.theme]) {
      const base = GLOW[z.theme];
      for (let i = 0; i < 5; i++) {
        const gx = ((i * 397 + 120) % z.w);
        const gy = ((i * 613 + 200) % z.h);
        const pulse = 0.05 + Math.sin(t * 0.8 + i) * 0.028;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 260);
        rg.addColorStop(0, `rgba(${base},${pulse})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(gx - 260, gy - 260, 520, 520);
      }
    }

    // 边界
    ctx.strokeStyle = U.hexA(z.accent, 0.22);
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, z.w, z.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, z.w + 16, z.h + 16);

    if (z.theme === 'town' || z.theme === 'capital') drawTownBuildings(z);
  }

  function drawTownBuildings(z) {
    for (const b of (z.buildings || [])) {
      // 屋顶
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 8, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(b.x, b.y, b.w, 14);
      // 三角屋顶
      ctx.fillStyle = '#39435a';
      ctx.beginPath();
      ctx.moveTo(b.x - 14, b.y + 6);
      ctx.lineTo(b.x + b.w / 2, b.y - 38);
      ctx.lineTo(b.x + b.w + 14, b.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,163,92,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 窗光
      const glow = 0.5 + Math.sin(G.t * 1.6 + b.x) * 0.12;
      ctx.fillStyle = `rgba(240,200,110,${glow * 0.5})`;
      ctx.fillRect(b.x + 20, b.y + 32, 16, 20);
      ctx.fillRect(b.x + b.w - 36, b.y + 32, 16, 20);
    }
    // 广场
    ctx.strokeStyle = 'rgba(201,163,92,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(590, 660, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(590, 660, 160, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ---------- 区域机制：熔岩池 / 冰面 / 净化点 / 符文柱 ---------- */
  function drawHazards(z) {
    const h = G.hazard;
    if (!h) return;
    const t = G.t;

    // 冰面
    for (const i of h.ice || []) {
      if (i.x + i.r < G.cam.x || i.x - i.r > G.cam.x + vwW) continue;
      if (i.y + i.r < G.cam.y || i.y - i.r > G.cam.y + vhW) continue;
      const g = ctx.createRadialGradient(i.x, i.y, i.r * 0.1, i.x, i.y, i.r);
      g.addColorStop(0, 'rgba(200,240,255,0.09)');
      g.addColorStop(0.65, 'rgba(150,210,245,0.055)');
      g.addColorStop(1, 'rgba(140,200,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(i.x, i.y, i.r, i.r * 0.7, 0, 0, 6.283); ctx.fill();
      // 冰面边缘
      ctx.strokeStyle = 'rgba(205,238,255,0.20)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(i.x, i.y, i.r * 0.86, i.r * 0.58, 0, 0, 6.283); ctx.stroke();
      // 裂纹
      ctx.strokeStyle = 'rgba(220,245,255,0.13)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const a0 = i.x * 0.01 + k * 2.1;
        ctx.beginPath();
        ctx.moveTo(i.x + Math.cos(a0) * i.r * 0.15, i.y + Math.sin(a0) * i.r * 0.1);
        ctx.lineTo(i.x + Math.cos(a0 + 0.5) * i.r * 0.55, i.y + Math.sin(a0 + 0.5) * i.r * 0.38);
        ctx.lineTo(i.x + Math.cos(a0 + 0.2) * i.r * 0.85, i.y + Math.sin(a0 + 0.2) * i.r * 0.55);
        ctx.stroke();
      }
    }

    // 净化点
    for (const pad of h.pads || []) {
      const pulse = 0.5 + Math.sin(t * 1.6) * 0.2;
      const g = ctx.createRadialGradient(pad.x, pad.y, 10, pad.x, pad.y, pad.r);
      g.addColorStop(0, `rgba(120,230,170,${0.14 * pulse})`);
      g.addColorStop(1, 'rgba(120,230,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `rgba(140,240,190,${0.28 * pulse})`;
      ctx.setLineDash([10, 12]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r * 0.92, 0, 6.283); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 腐气：缓慢漂移的绿色雾团
    if (h.type === 'miasma') {
      for (let i = 0; i < 7; i++) {
        const bx = ((i * 421 + t * 9) % (vwW + 260)) + G.cam.x - 130;
        const by = ((i * 733 + Math.sin(t * 0.4 + i) * 60) % (vhW + 220)) + G.cam.y - 110;
        const rr = 90 + (i % 3) * 40;
        const gg = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
        gg.addColorStop(0, 'rgba(90,200,140,0.055)');
        gg.addColorStop(1, 'rgba(90,200,140,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(bx, by, rr, 0, 6.283); ctx.fill();
      }
    }

    // 熔岩池
    for (const pool of h.packs || []) {
      if (pool.x + pool.rx < G.cam.x || pool.x - pool.rx > G.cam.x + vwW) continue;
      if (pool.y + pool.ry < G.cam.y || pool.y - pool.ry > G.cam.y + vhW) continue;
      const pulse = 0.55 + Math.sin(t * 1.2 + pool.ph) * 0.2;
      // 焦黑边缘
      ctx.fillStyle = 'rgba(28,14,12,0.85)';
      ctx.beginPath(); ctx.ellipse(pool.x, pool.y, pool.rx * 1.06, pool.ry * 1.06, 0, 0, 6.283); ctx.fill();
      // 熔岩
      const g = ctx.createRadialGradient(pool.x, pool.y, 4, pool.x, pool.y, Math.max(pool.rx, pool.ry));
      g.addColorStop(0, `rgba(255,235,170,${0.85 * pulse})`);
      g.addColorStop(0.35, `rgba(255,140,50,${0.7 * pulse})`);
      g.addColorStop(0.8, `rgba(190,50,25,${0.55 * pulse})`);
      g.addColorStop(1, 'rgba(90,20,15,0.1)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(pool.x, pool.y, pool.rx, pool.ry, 0, 0, 6.283); ctx.fill();
      // 气泡
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.5 + pool.ph + k * 0.7) % 1;
        const bx = pool.x + Math.cos(pool.ph + k * 2.1) * pool.rx * 0.45;
        const by = pool.y + Math.sin(pool.ph + k * 1.7) * pool.ry * 0.45;
        ctx.fillStyle = `rgba(255,220,150,${0.5 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(bx, by, 2 + ph * 4, 0, 6.283); ctx.fill();
      }
    }

    // 符文柱
    for (const r of h.runes || []) {
      const on = r.on;
      const pulse = on ? 0.8 + Math.sin(t * 3) * 0.15 : 0.3 + Math.sin(t * 1.4) * 0.1;
      const col = on ? '201,163,255' : '120,110,160';
      const g = ctx.createRadialGradient(r.x, r.y, 6, r.x, r.y, 120);
      g.addColorStop(0, `rgba(${col},${0.28 * pulse})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(r.x, r.y, 120, 0, 6.283); ctx.fill();
      // 柱体
      ctx.fillStyle = on ? '#c9a3ff' : '#4a4660';
      ctx.fillRect(r.x - 9, r.y - 74, 18, 78);
      ctx.strokeStyle = `rgba(${col},${0.6 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - 9, r.y - 74, 18, 78);
      // 顶部符文
      ctx.save();
      ctx.translate(r.x, r.y - 84);
      ctx.rotate(t * (on ? 1.2 : 0.2));
      ctx.strokeStyle = `rgba(${col},${pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.09;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a + 2.09) * 12, Math.sin(a + 2.09) * 12);
        ctx.stroke();
      }
      ctx.restore();
      ctx.font = '10px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${col},0.85)`;
      ctx.fillText(on ? '符文柱·已点亮' : '符文柱', r.x, r.y + 22);
    }
  }

  /* ---------- 地标 ---------- */
  function drawLandmarks(z) {
    for (const l of G.landmarks || []) {
      if (l.x < G.cam.x - 160 || l.x > G.cam.x + vwW + 160) continue;
      if (l.y < G.cam.y - 160 || l.y > G.cam.y + vhW + 160) continue;
      const col = z.accent;
      if (l.kind === 'lair') {
        const pulse = 0.5 + Math.sin(G.t * 1.1 + l.x) * 0.18;
        const g = ctx.createRadialGradient(l.x, l.y, 20, l.x, l.y, 260);
        g.addColorStop(0, U.hexA(col, 0.14 * pulse));
        g.addColorStop(1, U.hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(l.x, l.y, 260, 0, 6.283); ctx.fill();
        // 骨堆 / 巢穴
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(l.x, l.y + 12, 70, 26, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = U.hexA(col, 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(l.x, l.y, 62, 0.4, 2.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(l.x, l.y, 62, 3.5, 5.9); ctx.stroke();
      } else if (l.kind === 'shrine' || l.purify) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(l.x, l.y + 10, 40, 16, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a4456';
        ctx.fillRect(l.x - 16, l.y - 46, 32, 46);
        ctx.fillStyle = U.hexA(col, 0.5);
        ctx.beginPath();
        ctx.moveTo(l.x - 24, l.y - 44);
        ctx.lineTo(l.x, l.y - 74);
        ctx.lineTo(l.x + 24, l.y - 44);
        ctx.closePath(); ctx.fill();
      } else if (l.kind === 'crystal') {
        for (let i = 0; i < 3; i++) {
          const a = -1.2 + i * 1.1;
          ctx.fillStyle = U.hexA(col, 0.28 + i * 0.08);
          ctx.beginPath();
          ctx.moveTo(l.x + Math.cos(a) * 30, l.y + 16);
          ctx.lineTo(l.x + Math.cos(a) * 30 + 10, l.y - 30 - i * 14);
          ctx.lineTo(l.x + Math.cos(a) * 30 - 10, l.y + 16);
          ctx.closePath(); ctx.fill();
        }
      } else if (l.kind === 'rune') {
        ctx.strokeStyle = U.hexA(col, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(l.x, l.y, 30, 0, 6.283); ctx.stroke();
      } else if (l.kind === 'portal') {
        const pulse = 0.6 + Math.sin(G.t * 2) * 0.2;
        const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 90);
        g.addColorStop(0, `rgba(255,220,150,${0.32 * pulse})`);
        g.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(l.x, l.y, 90, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(255,225,160,${0.6 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(l.x, l.y, 54, 0, 6.283); ctx.stroke();
      } else if (l.kind === 'ruin') {
        ctx.fillStyle = 'rgba(90,96,110,0.55)';
        for (let i = 0; i < 4; i++) {
          const bx = l.x - 54 + i * 32;
          const bh = 26 + ((i * 37) % 34);
          ctx.fillRect(bx, l.y - bh, 16, bh);
        }
        ctx.strokeStyle = U.hexA(col, 0.25);
        ctx.lineWidth = 2;
        ctx.strokeRect(l.x - 58, l.y - 8, 128, 10);
      } else {
        ctx.strokeStyle = U.hexA(col, 0.4);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(l.x, l.y, 40, 0, 6.283); ctx.stroke();
      }
      // 名字
      ctx.font = '11px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = U.hexA(col, 0.55);
      ctx.fillText(l.name, l.x, l.y + 40);
    }
  }

  /* ---------- 道具 ---------- */
  function drawProps(z) {
    for (const pr of G.props) {
      if (pr.x < G.cam.x - 80 || pr.x > G.cam.x + vwW + 80) continue;
      if (pr.y < G.cam.y - 80 || pr.y > G.cam.y + vhW + 80) continue;
      if (pr.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(pr.x + 6, pr.y + pr.r * 0.55, pr.r * 0.9, pr.r * 0.42, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(pr.x - 3, pr.y - pr.r * 0.1, 6, pr.r * 0.9);
        const g = ctx.createRadialGradient(pr.x - pr.r * 0.3, pr.y - pr.r * 0.9, 2, pr.x, pr.y - pr.r * 0.5, pr.r * 1.4);
        g.addColorStop(0, z.theme === 'forest' ? '#2f5d3f' : '#2a4a42');
        g.addColorStop(1, z.theme === 'forest' ? '#152a20' : '#12211f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y - pr.r * 0.65, pr.r, 0, 6.283);
        ctx.fill();
      } else if (pr.kind === 'rock') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(pr.x + 4, pr.y + 6, pr.r, pr.r * 0.5, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = z.theme === 'rift' ? '#3a2622' : '#2a323f';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * 6.283 + pr.seed;
          const rr = pr.r * (0.75 + (i % 2 ? 0.22 : 0));
          ctx.lineTo(pr.x + Math.cos(a) * rr, pr.y + Math.sin(a) * rr * 0.85 - 6);
        }
        ctx.closePath();
        ctx.fill();
        if (z.theme === 'rift') {
          ctx.strokeStyle = 'rgba(255,110,60,0.45)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      } else if (pr.kind === 'mushroom') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 8, pr.r * 0.8, pr.r * 0.3, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#4a3f6a';
        ctx.fillRect(pr.x - 2, pr.y - 4, 4, 12);
        ctx.fillStyle = '#7a5f9a';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y - 8, pr.r * 0.8, pr.r * 0.5, 0, Math.PI, 0);
        ctx.fill();
      } else if (pr.kind === 'crystal') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 8, pr.r * 0.8, pr.r * 0.3, 0, 0, 6.283); ctx.fill();
        const col = z.theme === 'sanctum' ? '#b06bff' : z.theme === 'ice' ? '#9fd8ff' : '#ff8b3d';
        const gg = ctx.createLinearGradient(pr.x, pr.y - pr.r * 1.6, pr.x, pr.y);
        gg.addColorStop(0, U.hexA(col, 0.25));
        gg.addColorStop(1, U.hexA(col, 0.8));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y - pr.r * 1.7);
        ctx.lineTo(pr.x + pr.r * 0.55, pr.y - pr.r * 0.3);
        ctx.lineTo(pr.x + pr.r * 0.18, pr.y);
        ctx.lineTo(pr.x - pr.r * 0.5, pr.y - pr.r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = U.hexA(col, 0.5);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (pr.kind === 'pine') {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(pr.x + 5, pr.y + pr.r * 0.5, pr.r * 0.8, pr.r * 0.3, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#2f3a44';
        ctx.fillRect(pr.x - 3, pr.y - pr.r * 0.3, 6, pr.r * 0.7);
        for (let i = 0; i < 3; i++) {
          const w = pr.r * (1 - i * 0.24);
          ctx.fillStyle = i === 2 ? '#d8ecf8' : '#2c4a52';
          ctx.beginPath();
          ctx.moveTo(pr.x - w, pr.y - pr.r * (0.2 + i * 0.52));
          ctx.lineTo(pr.x, pr.y - pr.r * (0.95 + i * 0.52));
          ctx.lineTo(pr.x + w, pr.y - pr.r * (0.2 + i * 0.52));
          ctx.closePath();
          ctx.fill();
        }
      } else if (pr.kind === 'rune') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 8, pr.r * 0.7, pr.r * 0.25, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a3352';
        ctx.fillRect(pr.x - pr.r * 0.28, pr.y - pr.r * 1.2, pr.r * 0.56, pr.r * 1.2);
        const pulse = 0.45 + Math.sin(G.t * 1.6 + pr.seed * 9) * 0.18;
        ctx.strokeStyle = `rgba(190,150,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(pr.x - pr.r * 0.28, pr.y - pr.r * 1.2, pr.r * 0.56, pr.r * 1.2);
        ctx.beginPath();
        ctx.arc(pr.x, pr.y - pr.r * 1.32, pr.r * 0.24, 0, 6.283);
        ctx.stroke();
      } else if (pr.kind === 'coral') {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 8, pr.r * 0.8, pr.r * 0.28, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#3f9aa8';
        ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
          const a = -1.9 + i * 0.55;
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y);
          ctx.quadraticCurveTo(pr.x + Math.cos(a) * pr.r * 0.8, pr.y - pr.r * 0.7,
            pr.x + Math.cos(a) * pr.r * 1.1, pr.y - pr.r * 1.5);
          ctx.stroke();
        }
      } else if (pr.kind === 'pillar') {
        const col = z.theme === 'avalon' ? '#ffd166' : '#cfc8ff';
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 10, pr.r * 0.8, pr.r * 0.3, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a4152';
        ctx.fillRect(pr.x - pr.r * 0.34, pr.y - pr.r * 2.1, pr.r * 0.68, pr.r * 2.1);
        ctx.fillStyle = '#4a5266';
        ctx.fillRect(pr.x - pr.r * 0.5, pr.y - pr.r * 2.2, pr.r * 1.0, pr.r * 0.18);
        ctx.fillRect(pr.x - pr.r * 0.5, pr.y - pr.r * 0.16, pr.r * 1.0, pr.r * 0.16);
        const pulse = 0.4 + Math.sin(G.t * 1.2 + pr.seed * 7) * 0.16;
        ctx.strokeStyle = U.hexA(col, pulse);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y - pr.r * 1.9);
        ctx.lineTo(pr.x, pr.y - pr.r * 0.4);
        ctx.stroke();
      } else if (pr.kind === 'deadTree') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(pr.x + 4, pr.y + 8, pr.r * 0.6, pr.r * 0.24, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#3a4234';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x + 2, pr.y - pr.r * 1.6);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = -2.4 + i * 0.7;
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y - pr.r * (0.7 + i * 0.22));
          ctx.lineTo(pr.x + Math.cos(a) * pr.r * 0.9, pr.y - pr.r * (1.1 + i * 0.2));
          ctx.stroke();
        }
      } else if (pr.kind === 'lamp') {
        ctx.fillStyle = '#2a3140';
        ctx.fillRect(pr.x - 2, pr.y - 38, 4, 44);
        const glow = ctx.createRadialGradient(pr.x, pr.y - 44, 2, pr.x, pr.y - 44, 70);
        glow.addColorStop(0, 'rgba(255,214,140,0.55)');
        glow.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 44, 70, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#ffe3a8';
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 44, 3.5, 0, 6.283); ctx.fill();
      }
    }
  }

  /* ---------- 资源点 ---------- */
  function drawPoints() {
    for (const pt of G.points) {
      const f = G.factions.find(x => x.id === pt.owner);
      const col = f ? f.color : '#8b95a8';
      ctx.save();
      ctx.translate(pt.x, pt.y);
      // 底圈
      ctx.strokeStyle = U.hexA(col, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.283); ctx.stroke();
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, U.hexA(col, 0.16));
      g.addColorStop(1, U.hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 60, 0, 6.283); ctx.fill();

      // 旗杆
      ctx.strokeStyle = '#5a6478';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -62); ctx.stroke();
      // 旗
      const wave = Math.sin(G.t * 2 + pt.x) * 3;
      ctx.fillStyle = U.hexA(col, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, -62);
      ctx.lineTo(26 + wave, -54);
      ctx.lineTo(0, -42);
      ctx.closePath();
      ctx.fill();

      // 名称
      ctx.font = '11px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = U.hexA(col, 0.9);
      ctx.fillText(pt.name, 0, 20);
      ctx.fillStyle = 'rgba(180,190,205,0.6)';
      ctx.font = '10px "Microsoft YaHei",sans-serif';
      ctx.fillText(f ? f.name : '无主', 0, 34);

      // 占领进度
      if (pt.cap > 0) {
        ctx.strokeStyle = '#f0d49a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pt.cap / 4));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPortal() {
    const pt = G.portal;
    if (!pt) return;
    const pulse = 0.6 + Math.sin(G.t * 2.2) * 0.18;
    const g = ctx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 62);
    g.addColorStop(0, `rgba(140,190,255,${0.4 * pulse})`);
    g.addColorStop(1, 'rgba(80,140,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 62, 0, 6.283); ctx.fill();
    ctx.strokeStyle = `rgba(150,200,255,${0.65 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 34, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 24, G.t, G.t + 4.2); ctx.stroke();
    ctx.fillStyle = 'rgba(180,210,255,0.85)';
    ctx.font = '11px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pt.name, pt.x, pt.y + 58);
  }

  /* ---------- 掉落 ---------- */
  function drawLoot() {
    for (const l of G.loots) {
      const bob = Math.sin(G.t * 3 + l.x) * 3;
      const glow = ctx.createRadialGradient(l.x, l.y - 8 + bob, 0, l.x, l.y - 8 + bob, 26);
      glow.addColorStop(0, 'rgba(240,200,110,0.45)');
      glow.addColorStop(1, 'rgba(240,200,110,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(l.x, l.y - 8 + bob, 26, 0, 6.283); ctx.fill();
      // 小袋子
      ctx.fillStyle = l.items.length ? '#c9a35c' : '#b08a4a';
      ctx.beginPath();
      ctx.ellipse(l.x, l.y - 6 + bob, 7, 9, 0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(l.x - 3, l.y - 15 + bob, 6, 3);
      if (l.gold) {
        ctx.fillStyle = '#ffe9a8';
        ctx.font = '10px "Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.gold, l.x, l.y + 16 + bob);
      }
    }
  }

  /* ---------- 实体 ---------- */
  function drawEntities() {
    const list = [];
    if (G.player) list.push(G.player);
    for (const a of G.allies) if (!a.dead) list.push(a);
    for (const e of G.enemies) if (!e.dead) list.push(e);
    for (const a of (G.aiEnts || [])) if (!a.dead) list.push(a);
    list.sort((a, b) => a.y - b.y);

    for (const ent of list) {
      if (ent.x < G.cam.x - 120 || ent.x > G.cam.x + vwW + 120) continue;
      if (ent.y < G.cam.y - 120 || ent.y > G.cam.y + vhW + 120) continue;
      if (ent.kind === 'player') drawPlayer(ent);
      else if (ent.kind === 'ally') drawAlly(ent);
      else if (ent.kind === 'ai') drawAI(ent);
      else drawEnemy(ent);
    }

    // NPC
    for (const n of G.npcs) drawNpc(n);

    drawPkHints();
  }

  /* 决斗标记 / 自由 PK 的目标提示 */
  function drawPkHints() {
    const duel = G.duel && G.duel.ent;
    if (G.pk && G.pk.mode) {
      for (const a of (G.aiEnts || [])) {
        if (a.dead || a === duel) continue;
        const d = U.dist(a.x, a.y, G.player.x, G.player.y);
        if (d > 560) continue;
        ctx.strokeStyle = 'rgba(255,90,90,.5)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(a.x, a.y - 4, a.r + 8, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (!duel || duel.dead) return;
    const bob = Math.sin(G.t * 4) * 3;
    const y = duel.y - duel.r - 34 + bob;
    // 交叉双剑
    ctx.save();
    ctx.translate(duel.x, y);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 5); ctx.lineTo(7, -5);
    ctx.moveTo(7, 5); ctx.lineTo(-7, -5);
    ctx.stroke();
    ctx.restore();
    // 标签
    ctx.font = '10px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    const txt = G.duel.phase === 'count' ? `战书 ${Math.max(1, Math.ceil(G.duel.t))}` : '决斗中';
    const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = 'rgba(60,14,14,.85)';
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(duel.x - w / 2, y - 22, w, 15, 4); ctx.fill();
    } else ctx.fillRect(duel.x - w / 2, y - 22, w, 15);
    ctx.fillStyle = '#ffb3b3';
    ctx.fillText(txt, duel.x, y - 11);
    // 脚下光环
    ctx.strokeStyle = 'rgba(255,120,90,.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(duel.x, duel.y + duel.r * 0.7, duel.r * 1.5, duel.r * 0.6, 0, 0, 6.283);
    ctx.stroke();
  }

  function shadow(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.72, r * 0.95, r * 0.4, 0, 0, 6.283);
    ctx.fill();
  }

  function drawPlayer(p) {
    const cls = D.CLASSES[p.cls];
    const st = S.stats(p);
    shadow(p.x, p.y, p.r);

    // 姿态光环
    const stanceColor = D.STANCES[p.stance].color;
    ctx.strokeStyle = U.hexA(stanceColor, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r * 0.72, p.r * 1.05, p.r * 0.44, 0, 0, 6.283);
    ctx.stroke();

    // 无敌闪烁
    if (p.invuln > 0 && Math.floor(G.t * 20) % 2 === 0) return;

    // 武器挥击
    if (p.swing > 0) {
      const prog = 1 - p.swing / 0.16;
      const a0 = p.facing - 0.85 + prog * 1.7;
      ctx.save();
      ctx.translate(p.x, p.y - 4);
      ctx.rotate(a0);
      ctx.strokeStyle = U.hexA(cls.color, 0.85);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, cls.melee ? cls.range * 0.72 : 26, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // 披风（朝向反方向）
    const back = p.facing + Math.PI;
    ctx.fillStyle = U.hexA(cls.color, 0.38);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(back - 0.6) * p.r * 0.8, p.y - 4 + Math.sin(back - 0.6) * p.r * 0.8);
    ctx.lineTo(p.x + Math.cos(back) * p.r * 1.9, p.y - 4 + Math.sin(back) * p.r * 1.9);
    ctx.lineTo(p.x + Math.cos(back + 0.6) * p.r * 0.8, p.y - 4 + Math.sin(back + 0.6) * p.r * 0.8);
    ctx.closePath();
    ctx.fill();

    // 身体
    const g = ctx.createRadialGradient(p.x - 5, p.y - 9, 2, p.x, p.y - 4, p.r * 1.5);
    g.addColorStop(0, '#e8f1ff');
    g.addColorStop(0.5, cls.color);
    g.addColorStop(1, U.hexA(cls.color, 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, p.r, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 朝向刺
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.facing) * p.r * 0.6, p.y - 4 + Math.sin(p.facing) * p.r * 0.6);
    ctx.lineTo(p.x + Math.cos(p.facing) * p.r * 1.35, p.y - 4 + Math.sin(p.facing) * p.r * 1.35);
    ctx.stroke();

    // 名字
    ctx.font = '11px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,238,250,0.8)';
    ctx.fillText(p.name, p.x, p.y - p.r - 14);

    // 增益
    let bx = p.x - 26;
    for (const b of p.buffs) {
      ctx.fillStyle = U.hexA(b.color, 0.9);
      ctx.fillRect(bx, p.y - p.r - 34, 12, 3);
      bx += 15;
    }
    // 低血警示
    if (p.hp / st.maxHp < 0.3) {
      ctx.strokeStyle = `rgba(255,80,80,${0.35 + Math.sin(G.t * 7) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, p.r + 8, 0, 6.283);
      ctx.stroke();
    }
  }

  function drawAlly(a) {
    shadow(a.x, a.y, a.r);
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y - 3, a.r * 0.9, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (a.swing > 0) {
      ctx.strokeStyle = U.hexA(a.color, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y - 3, a.range * 0.6, -0.6, 0.6);
      ctx.stroke();
    }
    // 血条
    const w = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(a.x - w / 2, a.y - a.r - 14, w, 4);
    ctx.fillStyle = '#5fd18d';
    ctx.fillRect(a.x - w / 2, a.y - a.r - 14, w * U.clamp(a.hp / a.maxHp, 0, 1), 4);
    ctx.font = '10px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200,215,235,0.85)';
    ctx.fillText(a.name, a.x, a.y - a.r - 18);
  }

  /* AI 玩家：会走、会抢怪、会主动来砍你 */
  function drawAI(a) {
    const r = a.r;
    shadow(a.x, a.y, r);

    // 敌对 / 红名光环
    if (a.hostile || a.red) {
      const pulse = 0.5 + Math.sin(G.t * 6) * 0.2;
      ctx.strokeStyle = `rgba(255,80,80,${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(a.x, a.y + r * 0.72, r * 1.25, r * 0.55, 0, 0, 6.283);
      ctx.stroke();
    }

    if (a.invuln > 0 && Math.floor(G.t * 20) % 2 === 0) return;
    if (a.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.arc(a.x, a.y - 4, r + 3, 0, 6.283);
      ctx.fill();
    }

    // 挥砍
    if (a.swing > 0) {
      const prog = 1 - a.swing / 0.18;
      ctx.save();
      ctx.translate(a.x, a.y - 4);
      ctx.rotate(a.facing - 0.8 + prog * 1.6);
      ctx.strokeStyle = U.hexA(a.hostile ? '#ff7b7b' : a.color, 0.85);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, a.arch === 'ranged' ? 22 : 30, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // 披风
    const back = a.facing + Math.PI;
    ctx.fillStyle = U.hexA(a.gcolor, 0.34);
    ctx.beginPath();
    ctx.moveTo(a.x + Math.cos(back - 0.6) * r * 0.75, a.y - 4 + Math.sin(back - 0.6) * r * 0.75);
    ctx.lineTo(a.x + Math.cos(back) * r * 1.75, a.y - 4 + Math.sin(back) * r * 1.75);
    ctx.lineTo(a.x + Math.cos(back + 0.6) * r * 0.75, a.y - 4 + Math.sin(back + 0.6) * r * 0.75);
    ctx.closePath();
    ctx.fill();

    // 身体
    const g = ctx.createRadialGradient(a.x - 4, a.y - 9, 2, a.x, a.y - 4, r * 1.45);
    g.addColorStop(0, '#f2f6ff');
    g.addColorStop(0.5, a.color);
    g.addColorStop(1, U.hexA(a.color, 0.28));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(a.x, a.y - 4, r * 0.92, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = U.hexA(a.gcolor, 0.85);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 朝向
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(a.x + Math.cos(a.facing) * r * 0.6, a.y - 4 + Math.sin(a.facing) * r * 0.6);
    ctx.lineTo(a.x + Math.cos(a.facing) * r * 1.2, a.y - 4 + Math.sin(a.facing) * r * 1.2);
    ctx.stroke();

    // 血条
    const w = 40;
    const hy = a.y - r - 22;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(a.x - w / 2, hy, w, 4);
    ctx.fillStyle = (a.hostile || a.red) ? '#ff6b6b' : '#8fd8a0';
    ctx.fillRect(a.x - w / 2, hy, w * U.clamp(a.hp / a.maxHp, 0, 1), 4);

    // 名字：公会 · 名字 Lv
    ctx.font = '11px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = (a.hostile || a.red) ? '#ff9b9b' : U.hexA(a.gcolor, 0.95);
    const tag = a.guildName ? `〈${a.guildName}〉` : '';
    ctx.fillText(`${tag}${a.name}`, a.x, hy - 5);
    ctx.font = '9px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(200,212,230,.62)';
    ctx.fillText(`Lv.${a.lv} ${a.job}`, a.x, hy + 15);

    // 气泡
    if (a.bubble) {
      const txt = a.bubble.text.length > 16 ? a.bubble.text.slice(0, 16) + '…' : a.bubble.text;
      ctx.font = '11px "Microsoft YaHei",sans-serif';
      const tw = ctx.measureText(txt).width + 14;
      const bx = a.x - tw / 2, by = a.y - r - 62;
      ctx.fillStyle = 'rgba(12,16,24,.92)';
      ctx.strokeStyle = U.hexA(a.gcolor, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw, 20, 6);
      else ctx.rect(bx, by, tw, 20);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e6edf8';
      ctx.textAlign = 'center';
      ctx.fillText(txt, a.x, by + 14);
    }
  }

  function drawEnemy(e) {
    const t = e.tpl;
    const r = e.r;
    shadow(e.x, e.y, r);

    // 精英光环
    if (e.rank === 'elite') {
      const g2 = ctx.createRadialGradient(e.x, e.y, r * 0.4, e.x, e.y, r * 2.2);
      g2.addColorStop(0, 'rgba(255,180,80,0.16)');
      g2.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 2.2, 0, 6.283); ctx.fill();
    }
    if (e.rank === 'boss') {
      const g2 = ctx.createRadialGradient(e.x, e.y, r * 0.4, e.x, e.y, r * 2.4);
      g2.addColorStop(0, 'rgba(255,80,60,0.22)');
      g2.addColorStop(1, 'rgba(255,80,60,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 2.4, 0, 6.283); ctx.fill();
    }

    const flash = e.hitFlash > 0;
    const base = flash ? '#ffffff' : t.color;

    ctx.save();
    ctx.translate(e.x, e.y);
    const wob = Math.sin(G.t * 6 + e.x) * (e.aggro ? 1.6 : 0.8);

    ctx.fillStyle = base;
    ctx.strokeStyle = 'rgba(4,6,10,0.82)';
    ctx.lineWidth = 2;

    if (t.shape === 'beast') {
      ctx.beginPath();
      ctx.ellipse(0, -4, r * 1.15, r * 0.72, 0, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.6, -r * 0.7);
      ctx.lineTo(r * 1.15, -r * 1.5);
      ctx.lineTo(r * 0.95, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.4);
      ctx.lineTo(-r * 1.6, -r * 0.1 + wob);
      ctx.lineTo(-r * 0.85, r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(10,12,18,0.9)';
      ctx.beginPath();
      ctx.arc(r * 0.72, -r * 0.68, r * 0.15, 0, 6.283);
      ctx.fill();
    } else if (t.shape === 'humanoid') {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-r * 0.62, -r * 1.0, r * 1.24, r * 1.85, 4) : ctx.rect(-r * 0.62, -r * 1.0, r * 1.24, r * 1.85);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -r * 1.35, r * 0.44, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(10,12,18,0.9)';
      ctx.fillRect(-r * 0.24, -r * 1.42, r * 0.16, r * 0.12);
      ctx.fillRect(r * 0.08, -r * 1.42, r * 0.16, r * 0.12);
      ctx.strokeStyle = 'rgba(240,240,240,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.3);
      ctx.lineTo(r * 1.3, -r * 0.9 + wob);
      ctx.stroke();
    } else if (t.shape === 'lizard') {
      ctx.beginPath();
      ctx.ellipse(0, -4, r * 1.2, r * 0.66, 0, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, -r * 0.2);
      ctx.lineTo(-r * 2.1, -r * 0.05 + wob);
      ctx.lineTo(-r * 1.0, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.75, -r * 0.55, r * 0.38, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,12,18,0.9)';
      ctx.beginPath();
      ctx.arc(r * 0.85, -r * 0.68, r * 0.11, 0, 6.283);
      ctx.fill();
    } else if (t.shape === 'spider') {
      ctx.strokeStyle = base;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.1 + wob * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.1 - wob * 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(0, -2, r * 0.62, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ff5b5b';
      ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, 2, 0, 6.283); ctx.arc(r * 0.2, -r * 0.2, 2, 0, 6.283); ctx.fill();
    } else if (t.shape === 'golem') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * 6.283 + 0.3;
        const rr = r * (i % 2 ? 1.0 : 1.2);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,60,0.5)';
      ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.22, 0, 6.283); ctx.fill();
    } else if (t.shape === 'imp') {
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.6, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.75, -r * 1.3); ctx.lineTo(-r * 0.2, -r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(r * 0.75, -r * 1.3); ctx.lineTo(r * 0.2, -r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.25, 2.4, 0, 6.283); ctx.arc(r * 0.2, -r * 0.25, 2.4, 0, 6.283); ctx.fill();
    } else if (t.shape === 'boss') {
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.283;
        const rr = r * (i % 2 ? 0.85 : 1.15);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.95);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, r * 0.1, 0, 6.283); ctx.arc(r * 0.3, -r * 0.2, r * 0.1, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,60,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0.4, 2.2); ctx.stroke();
    }
    ctx.restore();

    // 要害标记
    const wx = e.x + e.weak.ox, wy = e.y + e.weak.oy;
    const pulse = 0.55 + Math.sin(G.t * 4 + e.x) * 0.28;
    // 光晕
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, 16);
    wg.addColorStop(0, `rgba(255,70,60,${0.34 * pulse})`);
    wg.addColorStop(1, 'rgba(255,70,60,0)');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(wx, wy, 16, 0, 6.283); ctx.fill();
    // 靶心
    ctx.strokeStyle = `rgba(255,150,130,${0.5 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, wy, 9.5, 0, 6.283); ctx.stroke();
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(255,80,70,${pulse})`;
    ctx.fillRect(-3.6, -3.6, 7.2, 7.2);
    ctx.strokeStyle = `rgba(255,210,190,${pulse * 0.9})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();

    // 血条
    if (e.aggro || e.hp < e.maxHp) {
      const w = Math.max(38, r * 2.4);
      const hpy = e.y - r - (e.rank === 'boss' ? 26 : 16);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2 - 1, hpy - 1, w + 2, 6);
      const pct = U.clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = e.rank === 'boss' ? '#ff5b5b' : e.rank === 'elite' ? '#ffab4a' : '#c0392b';
      ctx.fillRect(e.x - w / 2, hpy, w * pct, 4);
      ctx.font = '10px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = e.rank === 'boss' ? '#ffb3b3' : e.rank === 'elite' ? '#ffd39b' : 'rgba(200,210,225,0.8)';
      ctx.fillText(`${e.name} Lv.${e.level}`, e.x, hpy - 4);
    }

    // 蓄力提示
    if (e.windup > 0) {
      const pr = 1 - U.clamp(e.windup / (e.windupMax || 0.5), 0, 1);
      ctx.strokeStyle = 'rgba(255,120,80,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 12, -Math.PI / 2, -Math.PI / 2 + 6.283 * pr);
      ctx.stroke();
    }
    if (e.stun > 0) {
      ctx.fillStyle = 'rgba(255,230,120,0.9)';
      ctx.font = '12px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', e.x - 8, e.y - r - 22);
      ctx.fillText('★', e.x + 8, e.y - r - 26);
    }
  }

  function drawNpc(n) {
    shadow(n.x, n.y, 15);
    const glow = ctx.createRadialGradient(n.x, n.y - 6, 0, n.x, n.y - 6, 40);
    glow.addColorStop(0, U.hexA(n.color, 0.22));
    glow.addColorStop(1, U.hexA(n.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(n.x, n.y - 6, 40, 0, 6.283); ctx.fill();

    ctx.fillStyle = n.color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(n.x - 9, n.y - 30, 18, 30, 5) : ctx.rect(n.x - 9, n.y - 30, 18, 30);
    ctx.fill();
    ctx.fillStyle = '#f0e4cc';
    ctx.beginPath(); ctx.arc(n.x, n.y - 36, 8, 0, 6.283); ctx.fill();

    ctx.font = '11px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9dcc0';
    ctx.fillText(n.name, n.x, n.y + 22);
    ctx.font = '9px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(160,170,190,0.75)';
    ctx.fillText(n.title, n.x, n.y + 34);
  }

  /* ---------- 投射物 ---------- */
  function drawProjectiles() {
    for (const pr of G.projs) {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-pr.len, 0, pr.r, 0);
      g.addColorStop(0, U.hexA(pr.color, 0));
      g.addColorStop(1, pr.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, pr.len, pr.r * 0.8, 0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pr.r * 0.5, 0, pr.r * 0.45, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- 特效 ---------- */
  function drawFx() {
    for (const f of G.fx) {
      const k = 1 - f.t / f.max;
      if (f.type === 'p') {
        ctx.globalAlpha = k;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * k, 0, 6.283);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.type === 'ring') {
        ctx.globalAlpha = k * 0.9;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1.15 - k * 0.6) + 4, 0, 6.283);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'slash') {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);
        ctx.globalAlpha = k * 0.85;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 10 * k + 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (f.corridor) {
          ctx.moveTo(0, 0);
          ctx.lineTo(f.r * (1 - k * 0.4), 0);
        } else {
          ctx.arc(0, 0, f.r * 0.85, -f.arc / 2, f.arc / 2);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if (f.type === 'breath') {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);
        ctx.globalAlpha = k * 0.75;
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, f.r);
        g.addColorStop(0, 'rgba(255,220,150,0.9)');
        g.addColorStop(0.5, 'rgba(255,130,50,0.55)');
        g.addColorStop(1, 'rgba(255,60,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, f.r, -f.arc / 2, f.arc / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if (f.type === 'telegraph') {
        ctx.globalAlpha = 0.16 + (1 - k) * 0.2;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.2 + (1 - k) * 0.8), 0, 6.283); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'stun') {
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffe066';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✶', f.x + Math.sin(f.t * 12) * 6, f.y);
        ctx.globalAlpha = 1;
      } else if (f.type === 'lootGlow') {
        ctx.globalAlpha = k * 0.8;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 70 * (1.4 - k));
        g.addColorStop(0, U.hexA(f.color, 0.7));
        g.addColorStop(1, U.hexA(f.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, 70, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------- 飘字 ---------- */
  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of G.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = `600 ${t.size}px "Microsoft YaHei",sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 准星 ---------- */
  function drawReticle() {
    const mx = G.mouse.wx, my = G.mouse.wy;
    let hover = null;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (U.dist(mx, my, e.x, e.y) < e.r + 10) { hover = e; break; }
    }
    // 目标高亮
    if (hover) {
      ctx.strokeStyle = 'rgba(255,120,90,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y - 4, hover.r + 6, 0, 6.283);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,90,0.25)';
      ctx.beginPath();
      ctx.arc(hover.x + hover.weak.ox, hover.y + hover.weak.oy, 9, 0, 6.283);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(230,240,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, 6.283);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 14, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 14, my);
    ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 14);
    ctx.stroke();
  }

  /* ---------- BOSS 血条 ---------- */
  function drawBossBar() {
    const boss = G.enemies.find(e => e.rank === 'boss' && !e.dead && e.aggro);
    if (!boss) return;
    const w = Math.min(520, vwW * 0.62);
    const x = G.cam.x + (vwW - w) / 2;
    const y = G.cam.y + 54;
    ctx.fillStyle = 'rgba(6,8,12,0.82)';
    ctx.fillRect(x - 2, y - 2, w + 4, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, 14);
    const pct = U.clamp(boss.hp / boss.maxHp, 0, 1);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, '#7a1512');
    g.addColorStop(0.6, '#d1453a');
    g.addColorStop(1, '#ff8b6b');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * pct, 14);
    ctx.strokeStyle = 'rgba(255,180,150,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 14);
    ctx.font = '600 12px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe2d6';
    ctx.fillText(`${boss.name}  Lv.${boss.level}   ${Math.ceil(boss.hp)} / ${boss.maxHp}`, G.cam.x + vwW / 2, y - 8);
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // 暴风雪：白雾 + 雪片
    if (G.hazard && G.hazard.blizz > 0) {
      ctx.fillStyle = 'rgba(200,225,245,0.16)';
      ctx.fillRect(0, 0, vw, vh);
      for (let i = 0; i < 90; i++) {
        const sx = (i * 137 + G.t * (60 + (i % 7) * 26)) % (vw + 80) - 40;
        const sy = (i * 211 + G.t * (120 + (i % 5) * 40)) % (vh + 80) - 40;
        ctx.fillStyle = `rgba(235,245,255,${0.15 + (i % 5) * 0.05})`;
        ctx.fillRect(sx, sy, 2, 4 + (i % 3));
      }
    }

    // 低血红色边缘
    const p = G.player;
    if (p && p.hp > 0) {
      const st = S.stats(p);
      const low = 1 - U.clamp(p.hp / st.maxHp / 0.35, 0, 1);
      if (low > 0) {
        const g2 = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
        g2.addColorStop(0, 'rgba(160,0,0,0)');
        g2.addColorStop(1, `rgba(150,10,10,${0.42 * low * (0.75 + Math.sin(G.t * 5) * 0.25)})`);
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    // 自由 PK：画面四边泛红，提醒你正在能杀人的状态
    if (G.pk && G.pk.mode) {
      const gp = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
      gp.addColorStop(0, 'rgba(180,20,20,0)');
      gp.addColorStop(1, `rgba(170,20,20,${0.16 + Math.sin(G.t * 2.4) * 0.04})`);
      ctx.fillStyle = gp;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  return R;
})();
