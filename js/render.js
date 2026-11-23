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
    drawVignette();
  };

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
        } else if (z.theme === 'rift' || z.theme === 'mine') {
          ctx.strokeStyle = z.theme === 'rift' ? 'rgba(255,110,60,0.15)' : 'rgba(120,150,190,0.10)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(d.a) * d.l, d.y + Math.sin(d.a) * d.l * 0.6);
          ctx.stroke();
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
    if (z.theme === 'rift' || z.theme === 'swamp') {
      for (let i = 0; i < 5; i++) {
        const gx = ((i * 397 + 120) % z.w);
        const gy = ((i * 613 + 200) % z.h);
        const pulse = 0.06 + Math.sin(t * 0.8 + i) * 0.03;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 240);
        rg.addColorStop(0, z.theme === 'rift' ? `rgba(255,90,50,${pulse})` : `rgba(60,200,150,${pulse})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(gx - 240, gy - 240, 480, 480);
      }
    }

    // 边界
    ctx.strokeStyle = U.hexA(z.accent, 0.22);
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, z.w, z.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, z.w + 16, z.h + 16);

    if (z.theme === 'town') drawTownBuildings(z);
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
    list.sort((a, b) => a.y - b.y);

    for (const ent of list) {
      if (ent.x < G.cam.x - 120 || ent.x > G.cam.x + vwW + 120) continue;
      if (ent.y < G.cam.y - 120 || ent.y > G.cam.y + vhW + 120) continue;
      if (ent.kind === 'player') drawPlayer(ent);
      else if (ent.kind === 'ally') drawAlly(ent);
      else drawEnemy(ent);
    }

    // NPC
    for (const n of G.npcs) drawNpc(n);
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
  }

  return R;
})();
