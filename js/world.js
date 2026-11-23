/* ============ 世界：区域 / 刷怪 / 势力 / 任务 ============ */
window.W = (function () {
  const W = {};

  /* 各区域进入门槛（没写 need 时用 lv[0]） */
  const NEED = { town: 0, forest: 1, swamp: 12, mine: 15, rift: 20, lavaRift: 20, ghost: 25, glacier: 30, sanctum: 40, illusion: 48, undersea: 45, moon: 55, capital: 45, avalon: 60 };

  /* ---------- 确定性随机 ---------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 读图 ---------- */
  W.loadZone = function (id, silent) {
    const z = D.ZONES[id];
    if (!z) return;
    G.zoneId = id;
    G.zone = z;
    G.explored[id] = true;
    G.enemies = []; G.projs = []; G.loots = []; G.fx = []; G.texts = [];
    G.points = [];
    G.props = [];
    G.spawnT = 0;
    G.capT = 0;
    G.capture = null;
    G.bossCd = {};
    G.runes = [];
    G.hazard = null;
    // 换图即中断决斗，PK 模式在安全区自动熄灭
    if (G.duel && window.AI && AI.endDuel) { try { AI.endDuel('abort'); } catch (e) {} }
    if (z.safe && G.pk) G.pk.mode = false;

    buildProps(z);
    buildDecor(z);
    G.npcs = (z.npcs || []).map(n => Object.assign({}, n));
    G.portal = z.portal ? Object.assign({}, z.portal) : null;
    G.landmarks = (z.landmarks || []).map(l => ({
      name: l.name, kind: l.kind, purify: !!l.purify,
      x: l.x <= 1 ? l.x * z.w : l.x,
      y: l.y <= 1 ? l.y * z.h : l.y,
    }));
    G.hazard = buildHazard(z);

    // 资源点
    if (z.resources && z.resources.length) {
      for (let i = 0; i < z.resources.length; i++) {
        const rnd = mulberry32(hashStr(z.id) + i * 77);
        const owner = U.pick(G.factions);
        G.points.push({
          id: 'pt' + i,
          name: z.resources[i],
          x: 300 + rnd() * (z.w - 600),
          y: 300 + rnd() * (z.h - 600),
          owner: owner.id,
          cap: 0,
        });
      }
    }

    // 玩家落点
    const p = G.player;
    if (p) {
      if (z.safe) { p.x = z.w * 0.5; p.y = z.h * 0.78; }
      else { p.x = 190; p.y = z.h - 190; }
      p.vx = 0; p.vy = 0; p.svx = 0; p.svy = 0;
      p.dead = p.dead || false;
    }

    // 初始刷怪
    if (z.dungeon) {
      for (let i = 0; i < 6; i++) spawnOne(z, true);
    } else if (!z.safe) {
      for (let i = 0; i < 8; i++) spawnOne(z, true);
    }

    // 首领：副本进场必刷；野外首领按约定点位刷，且带复活计时
    if (z.boss && !z.boss.gated && (z.dungeon || !G.bossDown[z.boss.id])) {
      spawnBoss(z);
    }

    // 固定刷点的有名精英（不随区域等级随机）
    (z.elites || []).forEach(el => {
      if (G.flags['elite_' + el.name] && z.dungeon) return;
      const x = (el.x <= 1 ? el.x * z.w : el.x);
      const y = (el.y <= 1 ? el.y * z.h : el.y);
      const e = E.spawnEnemy(el.id, x, y, el.lv || z.lv[1], { elite: true, eliteName: el.name });
      if (e) { e.name = el.name; e.homeX = x; e.homeY = y; e.hateT = 0; e.fixed = true; }
    });

    // 主线指定精英（保留旧逻辑）
    const q = D.MAIN_QUESTS[G.mainIdx];
    if (q && q.obj.type === 'elite' && !G.flags['elite_' + q.obj.name] && z.elites) {
      const spot = z.elites.find(x => x.name === q.obj.name);
      if (spot) {
        const x = (spot.x <= 1 ? spot.x * z.w : spot.x);
        const y = (spot.y <= 1 ? spot.y * z.h : spot.y);
        const e = E.spawnEnemy(spot.id, x, y, spot.lv, { elite: true, eliteName: q.obj.name });
        if (e) { e.name = q.obj.name; e.homeX = x; e.homeY = y; }
      }
    }

    // 该区域在线的 AI 玩家进场（他们各自有目的地）
    if (window.AI && AI.onZoneEnter) AI.onZoneEnter(id);

    if (!silent) {
      UI.refreshHUD(true);
      UI.updateQuestHud();
      U.log(`进入 ${z.name}。`, z.safe ? '' : 'hot');
      if (z.hazard) U.log(hazardTip(z.hazard), 'hot');
      // 第一次离开安全区时，把 PK 的入口教给玩家
      if (!z.safe && !G.flags.pkHint) {
        G.flags.pkHint = 1;
        setTimeout(() => {
          U.toast('这里能动手了：<b>右键点 AI 玩家</b>可下战书决斗，按 <b>X</b> 开自由 PK', 'hot');
        }, 1400);
      }
    }
    S.save();
  };

  function hazardTip(h) {
    if (h.type === 'miasma') return '腐气正在侵蚀气血——站到净化点（祭坛）附近可以缓一缓。';
    if (h.type === 'lava') return '赤焰海的地面裂开了，踩进熔岩池会被烧穿。';
    if (h.type === 'blizzard') return '冰原随时会起暴风雪，风雪里视野和移速都会被压住。';
    if (h.type === 'runes') return '三座符文柱锁住了神殿，靠近并按 E 逐一点亮。';
    return '';
  }

  function spawnBoss(z) {
    const b = z.boss;
    if (!b) return;
    const x = b.x <= 1 ? b.x * z.w : b.x;
    const y = b.y <= 1 ? b.y * z.h : b.y;
    const e = E.spawnEnemy(b.id, x, y, z.dungeon ? z.lv[1] : (z.lv[1] || z.lv[0]), {});
    if (e) {
      e.homeX = x; e.homeY = y; e.bossIntro = true;
      if (!z.dungeon) { e.worldBoss = true; e.zoneBoss = true; }
    }
  }

  /* ---------- 区域机制 ---------- */
  function buildHazard(z) {
    const h = z.hazard ? Object.assign({}, z.hazard) : null;
    if (!h) return null;
    const rnd = mulberry32(hashStr(z.id) + 401);
    h.acc = 0; h.tick = 0; h.on = false; h.blizz = 0; h.next = 45;
    h.packs = []; h.ice = []; h.runes = []; h.pads = [];
    if (h.type === 'lava') {
      for (let i = 0; i < 8; i++) {
        let px = 260 + rnd() * (z.w - 520), py = 260 + rnd() * (z.h - 520);
        // 不要把熔岩池刷在入口传送门脚下
        let guard = 0;
        while (Math.hypot(px - 190, py - (z.h - 190)) < 380 && guard++ < 12) {
          px = 260 + rnd() * (z.w - 520);
          py = 260 + rnd() * (z.h - 520);
        }
        h.packs.push({ x: px, y: py, rx: 70 + rnd() * 100, ry: 44 + rnd() * 66, ph: rnd() * 6.28 });
      }
    }
    if (h.type === 'blizzard' || z.theme === 'ice') {
      for (let i = 0; i < 7; i++) {
        h.ice.push({ x: 220 + rnd() * (z.w - 440), y: 220 + rnd() * (z.h - 440), r: 120 + rnd() * 150 });
      }
    }
    if (h.type === 'miasma') {
      (z.landmarks || []).forEach(l => {
        if (l.purify) h.pads.push({ x: l.x <= 1 ? l.x * z.w : l.x, y: l.y <= 1 ? l.y * z.h : l.y, r: 210 });
      });
    }
    if (h.type === 'runes') {
      const n = h.count || 3;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / n;
        h.runes.push({ x: z.w / 2 + Math.cos(a) * Math.min(z.w, z.h) * 0.3, y: z.h / 2 + Math.sin(a) * Math.min(z.w, z.h) * 0.26, on: false, t: 0, i });
      }
    }
    return h;
  }

  W.onIce = function (x, y) {
    const h = G.hazard;
    if (!h || !h.ice) return false;
    for (const i of h.ice) if (U.dist(x, y, i.x, i.y) < i.r) return true;
    return false;
  };

  W.inPurify = function (x, y) {
    const h = G.hazard;
    if (!h || !h.pads) return false;
    for (const p of h.pads) if (U.dist(x, y, p.x, p.y) < p.r) return true;
    return false;
  };

  function hazHit(frac, color, name) {
    const p = G.player;
    const st = S.stats(p);
    const dmg = Math.max(1, Math.round(st.maxHp * frac));
    p.hp -= dmg;
    G.lastHitT = G.t;
    E.addText(p.x + U.rand(-10, 10), p.y - 42, '-' + dmg, color, 13);
    if (p.hp <= 0) { p.hp = 0; E.playerDie({ name }); }
  }

  W.zoneTick = function (dt) {
    const z = G.zone, h = G.hazard, p = G.player;
    if (!z || !h || !p || p.dead) return;
    G.zoneT = (G.zoneT || 0) + dt;
    h.tick += dt;

    // 暴风雪
    if (h.type === 'blizzard') {
      if (h.blizz > 0) {
        h.blizz -= dt;
        if (h.blizz <= 0) { U.log('风雪渐停，视野恢复了。', 'good'); h.next = h.every || 100; }
      } else {
        h.next -= dt;
        if (h.next <= 0) {
          h.blizz = h.dur || 20;
          U.log('暴风雪压下来了——视野变白，脚步变沉。', 'bad');
          U.toast('暴风雪：移速 -28%，视野受限', 'bad');
        }
      }
    }

    // 腐气 / 熔岩：每秒一跳
    h.acc += dt;
    if (h.acc < 1) return;
    h.acc = 0;

    if (h.type === 'miasma') {
      if (W.inPurify(p.x, p.y)) {
        if (h.tick > 6) { h.tick = 0; }
      } else {
        hazHit(h.dps || 0.0055, '#8ff07a', '腐气');
        if (U.chance(0.25)) E.fx('p', { x: p.x + U.rand(-16, 16), y: p.y + U.rand(-10, 10), vx: 0, vy: -18, color: '#7fd68a', life: 0.6, max: 0.6, r: 3 });
        if (!h.warned) { h.warned = true; U.toast('你吸入了腐气——快去净化点，或者离开沼泽', 'bad'); }
      }
    }
    if (h.type === 'lava') {
      for (const pool of h.packs) {
        const dd = Math.hypot((p.x - pool.x) / pool.rx, (p.y - pool.y) / pool.ry);
        if (dd < 1) {
          hazHit(h.dps || 0.022, '#ff8b3d', '熔岩池');
          E.fx('p', { x: p.x, y: p.y, vx: U.rand(-40, 40), vy: -60, color: '#ff8b3d', life: 0.5, max: 0.5, r: 3 });
          break;
        }
      }
    }
    if (h.type === 'runes' && h.runes.every(r => r.on) && !h.buff) {
      h.buff = true;
      U.toast('结界已开——神殿深处传来回响', 'epic');
      U.log('三座符文柱同时亮起，幻灵神殿的门开了。', 'hot');
      if (z.boss && G.zoneId === z.id) spawnBoss(z);
    }
  };

  /* 符文柱交互 */
  W.runeNear = function () {
    const p = G.player, h = G.hazard;
    if (!p || !h || !h.runes) return null;
    for (const r of h.runes) if (U.dist(p.x, p.y, r.x, r.y) < 90) return r;
    return null;
  };

  W.lightRune = function (r) {
    if (!r || r.on) return;
    r.on = true; r.t = G.t;
    E.ring(r.x, r.y, 80, '#c9a3ff', 0.6);
    const n = G.hazard.runes.filter(x => x.on).length;
    U.toast(`符文柱点亮 ${n}/${G.hazard.runes.length}`, 'good');
    U.log(`符文柱亮起（${n}/${G.hazard.runes.length}）。`, 'good');
    U.sfx('level');
  };

  function buildProps(z) {
    const rnd = mulberry32(hashStr(z.id) + 13);
    const count = z.safe ? 6 : 38;
    for (let i = 0; i < count; i++) {
      const x = 80 + rnd() * (z.w - 160);
      const y = 80 + rnd() * (z.h - 160);
      if (Math.hypot(x - 190, y - (z.h - 190)) < 150) continue;
      let r = 16 + rnd() * 14;
      let kind = 'tree';
      const th = z.theme;
      if (th === 'swamp') { r = 12 + rnd() * 16; kind = rnd() > 0.5 ? 'tree' : 'mushroom'; }
      if (th === 'rift') { r = 18 + rnd() * 20; kind = rnd() > 0.75 ? 'crystal' : 'rock'; }
      if (th === 'mine' || th === 'ghost') { r = 20 + rnd() * 18; kind = th === 'ghost' && rnd() > 0.6 ? 'deadTree' : 'rock'; }
      if (th === 'town' || th === 'capital') { r = 14 + rnd() * 8; kind = 'lamp'; }
      if (th === 'ice') { r = 16 + rnd() * 18; kind = rnd() > 0.45 ? 'pine' : 'crystal'; }
      if (th === 'sanctum') { r = 14 + rnd() * 16; kind = rnd() > 0.5 ? 'rune' : 'crystal'; }
      if (th === 'undersea') { r = 14 + rnd() * 18; kind = rnd() > 0.5 ? 'coral' : 'rock'; }
      if (th === 'moon' || th === 'avalon') { r = 16 + rnd() * 14; kind = rnd() > 0.4 ? 'pillar' : 'lamp'; }
      G.props.push({ x, y, r, kind, seed: rnd() });
    }
  }

  function buildDecor(z) {
    G.decor = [];
    const rnd = mulberry32(hashStr(z.id) + 99);
    const n = z.safe ? 14 : 70;
    for (let i = 0; i < n; i++) {
      G.decor.push({
        x: rnd() * z.w,
        y: rnd() * z.h,
        a: rnd() * 6.283,
        l: 10 + rnd() * 26,
        t: rnd(),
      });
    }
  }

  function spawnOne(z, initial) {
    if (!z.spawns || !z.spawns.length) return;
    const p = G.player;
    const pick = U.weighted(z.spawns);
    const cap = z.dungeon ? 10 : 16;
    if (G.enemies.length >= cap) return;

    let x, y, tries = 0;
    do {
      x = 120 + Math.random() * (z.w - 240);
      y = 120 + Math.random() * (z.h - 240);
      tries++;
    } while (p && Math.hypot(x - p.x, y - p.y) < (initial ? 380 : 540) && tries < 25);
    if (tries >= 25) return;

    // 等级锚定：低等级玩家不会在区域入口撞上区域上限的怪
    let lo = z.lv[0], hi = z.lv[1];
    if (p && !z.dungeon) {
      lo = Math.max(lo, p.level - 3);
      hi = Math.min(hi, p.level + 4);
      if (hi < lo) hi = lo;
    }
    const lv = U.randInt(lo, hi);
    const elite = !z.dungeon && Math.random() < 0.06;
    const opts = { elite };
    if (elite) {
      const pool = z.elitePool || ['头目'];
      opts.eliteName = '精英·' + tplName(pick.id) + '·' + U.pick(pool);
    }
    const e = E.spawnEnemy(pick.id, x, y, lv, opts);
    if (e) { e.homeX = x; e.homeY = y; }
  }

  function tplName(id) { return (D.MONSTERS[id] || {}).name || '怪物'; }

  W.spawnTick = function (dt) {
    const z = G.zone;
    if (!z || z.safe) return;

    // 野外首领复活
    if (z.boss && !z.dungeon) {
      G.bossCd = G.bossCd || {};
      const key = z.boss.id;
      if (G.bossDown[key]) {
        G.bossCd[key] = (G.bossCd[key] == null ? 180 : G.bossCd[key]) - dt;
        if (G.bossCd[key] <= 0) {
          G.bossDown[key] = false;
          delete G.bossCd[key];
          spawnBoss(z);
          U.log(`${z.name}：${D.MONSTERS[key].name} 重新出现了。`, 'hot');
        }
        return;
      }
    }

    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    G.spawnT = z.dungeon ? 6 : 2.4;

    // 主线通缉精英
    const q = D.MAIN_QUESTS[G.mainIdx];
    if (q && q.obj.type === 'elite' && !G.flags['elite_' + q.obj.name] &&
        !G.enemies.some(e => e.eliteName === q.obj.name) && Math.random() < 0.5) {
      const spot = (z.elites || []).find(x => x.name === q.obj.name);
      if (spot) {
        const p = G.player;
        const a = U.rand(0, 6.283);
        const dd = U.rand(320, 520);
        const x = U.clamp(p.x + Math.cos(a) * dd, 100, z.w - 100);
        const y = U.clamp(p.y + Math.sin(a) * dd, 100, z.h - 100);
        const el = E.spawnEnemy(spot.id, x, y, spot.lv, { elite: true, eliteName: q.obj.name });
        if (el) {
          el.name = q.obj.name;
          U.log(`通缉目标「${q.obj.name}」出现在附近。`, 'hot');
        }
        return;
      }
    }

    if (G.enemies.length >= (z.dungeon ? 10 : 16)) return;
    spawnOne(z, false);
  };

  /* ================= 悬赏（活的任务板） ================= */
  W.addBounty = function (silent) {
    if (G.bounties.length >= 4) return;
    const p = G.player;
    let zoneIds = ['forest'];
    if (p.level >= 8) zoneIds.push('swamp');
    if (p.level >= 16) zoneIds.push('rift');
    if (p.level >= 26) zoneIds.push('glacier');
    if (p.level >= 36) zoneIds.push('sanctum');
    const zid = U.pick(zoneIds);
    let tpl = U.pick(D.BOUNTY[zid]);
    let tries = 0;
    while (G.bounties.some(b => b.text === tpl.text) && tries++ < 8) tpl = U.pick(D.BOUNTY[zid]);
    const b = {
      id: 'b' + (G.uid++),
      ...tpl,
      zone: zid,
      prog: 0,
      ttl: 200 + Math.random() * 120,
      max: 0,
    };
    b.max = b.ttl;
    G.bounties.push(b);
    if (!silent) U.log(`任务板刷新：${b.text}（${D.ZONES[zid].name}）`, 'hot');
    if (UI.currentPanel === 'quests') UI.open('quests');
  };

  W.bountyTick = function (dt) {
    let changed = false;
    for (let i = G.bounties.length - 1; i >= 0; i--) {
      const b = G.bounties[i];
      b.ttl -= dt;
      if (b.ttl <= 0) {
        G.bounties.splice(i, 1);
        U.log(`悬赏「${b.text}」已过期。`);
        changed = true;
      }
    }
    G.bountyT -= dt;
    if (G.bountyT <= 0) {
      G.bountyT = 45;
      if (G.bounties.length < 3) W.addBounty(true);
      // AI 玩家接走悬赏（有名字的人，而不是抽象势力）
      if (G.bounties.length > 0 && Math.random() < 0.55) {
        if (window.AI && AI.st && AI.st()) {
          const pool = AI.st().agents.filter(a => a.state !== 'offline');
          if (pool.length) {
            AI.claimBounty(U.pick(pool));
            changed = true;
          }
        } else {
          const idx = Math.floor(Math.random() * G.bounties.length);
          const b = G.bounties[idx];
          const f = U.pick(G.factions);
          G.bounties.splice(idx, 1);
          U.log(`${f.name} 接走了悬赏「${b.text}」。`, 'hot');
          changed = true;
        }
      }
    }
    if (changed && UI.currentPanel === 'quests') UI.open('quests');
  };

  W.checkBountyKill = function (e) {
    for (const b of G.bounties.slice()) {
      if (b.zone !== G.zoneId || b.target !== e.tpl.id) continue;
      b.prog++;
      if (b.prog >= b.count) {
        const i = G.bounties.indexOf(b);
        if (i >= 0) G.bounties.splice(i, 1);
        G.player.gold += b.reward.gold;
        G.player.rep += b.reward.rep;
        S.gainExp(b.reward.exp);
        U.sfx('level');
        U.toast(`悬赏完成：${b.text}（+${b.reward.gold} 金币）`, 'good');
        U.log(`你完成了悬赏「${b.text}」。`, 'good');
      }
    }
  };

  /* ================= 势力模拟 ================= */
  W.factionTick = function (dt) {
    G.factionT -= dt;
    if (G.factionT > 0) return;
    G.factionT = 14 + Math.random() * 8;

    const fs = G.factions;
    if (!fs.length) return;

    // 实力成长 / 消耗
    for (const f of fs) {
      f.strength += Math.round(6 + f.points * 5 + U.rand(-6, 14));
      f.gold += Math.round(U.rand(30, 140) + f.points * 30);
    }

    // 势力互斗
    if (Math.random() < 0.72) {
      const a = U.pick(fs);
      let b = U.pick(fs);
      let guard = 0;
      while (b === a && guard++ < 5) b = U.pick(fs);
      if (b !== a) {
        const pa = a.strength * (a.trait === '激进扩张' ? 1.18 : 1) * U.rand(0.75, 1.3);
        const pb = b.strength * (b.trait === '激进扩张' ? 1.18 : 1) * U.rand(0.75, 1.3);
        const winner = pa > pb ? a : b;
        const loser = pa > pb ? b : a;
        const pointGain = Math.random() < 0.6 && loser.points > 0;
        if (pointGain) {
          loser.points--;
          winner.points++;
          const zid = U.pick(['swamp', 'rift', 'forest', 'glacier', 'sanctum']);
          const zres = (D.ZONES[zid].resources || ['资源点']);
          const ptName = U.pick(zres);
          U.log(`${winner.name} 攻占了 ${D.ZONES[zid].name} 的${ptName}。`, 'hot');
        } else {
          U.log(`${winner.name} 在野战中击退了 ${loser.name}。`);
        }
        winner.strength += 30;
        loser.strength = Math.max(320, loser.strength - 40);
        // 与玩家关系牵连
        if (G.player.factionId === winner.id) winner.relation = Math.min(100, winner.relation + 1);
        if (G.player.factionId === loser.id) loser.relation = Math.max(-100, loser.relation - 1);
      }
    }

    // 稀有事件
    if (Math.random() < 0.16) {
      const f = U.pick(fs);
      const events = [
        `${f.name} 在拍卖行扫走了一批强化石。`,
        `${f.name} 正在招募散人，据说报酬不低。`,
        `${f.name} 的商队在幽暗沼泽遇袭。`,
        `${f.name} 洗劫了一处上古遗迹，实力大增。`,
      ];
      U.log(U.pick(events));
      f.strength += 20;
    }

    if (UI.currentPanel === 'faction') UI.open('faction');
  };

  /* ================= 资源点占领 ================= */
  W.updateCapture = function (dt) {
    const p = G.player;
    if (!p) return;
    const near = W.pointNear();
    if (!near) { if (G.capture) { G.capture = null; UI.hidePrompt(); } return; }

    if (G.capture && G.capture.id === near.id) {
      if (U.dist(p.x, p.y, near.x, near.y) > 110) { G.capture = null; return; }
      near.cap += dt;
      G.capT = near.cap;
      if (Math.random() < 0.3) E.ring(near.x, near.y, 40, '#c9a35c', 0.3);
      if (near.cap >= 4) {
        const owner = G.factions.find(f => f.id === near.owner);
        near.owner = p.factionId || 'none';
        near.cap = 0;
        G.capture = null;
        const gold = 120 + p.level * 22;
        p.gold += gold;
        p.rep += 6;
        S.gainExp(80 + p.level * 18);
        U.toast(`占领 ${near.name}：+${gold} 金币，声望 +6`, 'good');
        U.log(`你夺取了 ${near.name}${owner ? '，' + owner.name + ' 的旗子被拔下' : ''}。`, 'hot');
        if (owner) owner.relation = Math.max(-100, owner.relation - 6);
        const it = I.gen(p.level, I.rollQuality(1.2, 2), null, p.cls);
        I.add(it, false);
        // 该点会招来反击（用本区域的怪，而不是固定的山贼）
        const z = G.zone;
        const tpl = (z && z.spawns && z.spawns.length) ? U.weighted(z.spawns).id : 'bandit';
        for (let i = 0; i < 3; i++) {
          const a = U.rand(0, 6.28);
          E.spawnEnemy(tpl, near.x + Math.cos(a) * 90, near.y + Math.sin(a) * 90, Math.max(1, p.level), {});
        }
      }
    }
  };

  W.pointNear = function () {
    const p = G.player;
    if (!p) return null;
    for (const pt of G.points) {
      if (U.dist(p.x, p.y, pt.x, pt.y) < 80) return pt;
    }
    return null;
  };

  /* ================= 交互 ================= */
  W.interact = function () {
    if (G.paused || !G.running) return;
    const p = G.player;
    if (!p || p.dead) return;

    // NPC
    for (const n of G.npcs) {
      if (U.dist(p.x, p.y, n.x, n.y) < 70) {
        U.sfx('ui');
        if (n.id === 'shop') UI.open('shop');
        else if (n.id === 'smith') UI.open('smith');
        else if (n.id === 'trainer') UI.open('trainer');
        else if (n.id === 'board') UI.open('quests');
        else if (n.id === 'envoy') UI.open('faction');
        return;
      }
    }
    // 传送门
    if (G.portal && U.dist(p.x, p.y, G.portal.x, G.portal.y) < 80) {
      U.sfx('ui');
      UI.open('map');
      return;
    }
    // 符文柱
    const rn = W.runeNear();
    if (rn) {
      if (rn.on) { U.toast('这座符文柱已经亮了', ''); return; }
      W.lightRune(rn);
      return;
    }
    // 资源点
    const pt = W.pointNear();
    if (pt) {
      if (G.capture && G.capture.id === pt.id) return;
      G.capture = { id: pt.id, t: 0 };
      U.toast(`正在占领 ${pt.name}，请勿离开`, 'good');
      return;
    }
  };

  W.updateNear = function () {
    const p = G.player;
    if (!p) return;
    let near = null;
    for (const n of G.npcs) {
      if (U.dist(p.x, p.y, n.x, n.y) < 70) { near = { type: 'npc', obj: n }; break; }
    }
    if (!near && G.portal && U.dist(p.x, p.y, G.portal.x, G.portal.y) < 80) near = { type: 'portal', obj: G.portal };
    const rn = W.runeNear();
    if (!near && rn) near = { type: 'rune', obj: rn };
    const pt = W.pointNear();
    if (!near && pt) near = { type: 'point', obj: pt };
    G.near = near;

    const el = document.getElementById('prompt');
    if (!el) return;
    if (near && !G.paused) {
      el.classList.remove('hidden');
      if (near.type === 'npc') el.innerHTML = `<kbd>E</kbd> 与 ${near.obj.name}（${near.obj.title}）交谈`;
      else if (near.type === 'portal') el.innerHTML = `<kbd>E</kbd> 使用 ${near.obj.name}`;
      else if (near.type === 'rune') el.innerHTML = near.obj.on ? '符文柱已点亮' : `<kbd>E</kbd> 点亮符文柱`;
      else if (near.type === 'point') {
        el.innerHTML = G.capture && G.capture.id === pt.id
          ? `占领中 ${Math.round(pt.cap / 4 * 100)}%`
          : `<kbd>E</kbd> 占领 ${pt.name}（归属：${(G.factions.find(f => f.id === pt.owner) || {}).name || '无主'}）`;
      }
    } else {
      el.classList.add('hidden');
    }
  };

  W.hidePrompt = function () {
    const el = document.getElementById('prompt');
    if (el) el.classList.add('hidden');
  };

  /* ================= 任务 ================= */
  W.mainQuest = function () { return D.MAIN_QUESTS[G.mainIdx] || null; };

  W.objText = function (q) {
    if (!q) return '';
    const o = q.obj;
    const p = G.player;
    if (o.type === 'kill') {
      const cur = Math.min(o.count, G.flags['k_' + o.target] || 0);
      return `击杀 ${D.MONSTERS[o.target].name} ${cur}/${o.count}`;
    }
    if (o.type === 'level') return `达到 ${o.value} 级（当前 ${p.level}）`;
    if (o.type === 'elite') {
      const cur = Math.min(o.count || 1, G.flags['elite_' + o.name] || 0);
      return `击败精英「${o.name}」 ${cur}/${o.count || 1}`;
    }
    if (o.type === 'boss') return `击败 ${D.MONSTERS[o.target].name}${G.flags['boss_' + o.target] ? '（已完成）' : ''}`;
    if (o.type === 'boss2') return `达到 ${o.level} 级并击败 ${D.MONSTERS[o.target].name}`;
    if (o.type === 'relation') {
      const best = Math.max.apply(null, G.factions.map(f => f.relation));
      return `与任一势力好感达到 ${o.value}（当前最高 ${Math.max(0, Math.round(best))}）`;
    }
    return '';
  };

  W.questDone = function (q) {
    const o = q.obj, p = G.player;
    if (o.type === 'kill') return (G.flags['k_' + o.target] || 0) >= o.count;
    if (o.type === 'level') return p.level >= o.value;
    if (o.type === 'elite') return (G.flags['elite_' + o.name] || 0) >= (o.count || 1);
    if (o.type === 'boss' || o.type === 'boss2') return !!G.flags['boss_' + o.target] && (o.level ? p.level >= o.level : true);
    if (o.type === 'relation') return G.factions.some(f => f.relation >= o.value);
    return false;
  };

  W.grantQuest = function (q) {
    const p = G.player, r = q.reward;
    if (r.gold) p.gold += r.gold;
    if (r.rep) p.rep += r.rep;
    if (r.exp) S.gainExp(r.exp);
    if (r.item) {
      const it = I.gen(Math.max(1, p.level), r.item.q, r.item.slot, p.cls);
      I.add(it, true);
      U.toast(`主线奖励：<span style="color:${D.QUALITY[it.q].color}">${it.name}</span>`, 'epic');
    }
    U.toast(`主线完成：${q.title}`, 'epic');
    U.log(`主线「${q.title}」已完成。`, 'good');
    U.sfx('level');
  };

  W.checkQuest = function () {
    if (W._checking) return;
    W._checking = true;
    let guard = 0;
    while (guard++ < 12) {
      const q = W.mainQuest();
      if (!q) break;
      if (!W.questDone(q)) break;
      G.mainIdx++;
      W.grantQuest(q);
    }
    W._checking = false;
    if (G.mainIdx >= D.MAIN_QUESTS.length && !G.flags.mainAllDone) {
      G.flags.mainAllDone = 1;
      U.log('主线已全部完成。你已站到这个世界的顶端。', 'hot');
    }
    UI.updateQuestHud();
    S.save();
  };

  W.onKill = function (e) {
    const id = e.tpl.id;
    G.flags['k_' + id] = (G.flags['k_' + id] || 0) + 1;
    if (e.rank === 'boss') {
      G.flags['boss_' + id] = 1;
      if (e.zoneBoss) { G.bossDown[id] = true; G.bossCd = G.bossCd || {}; G.bossCd[id] = 180; }
    }
    if (e.eliteName) G.flags['elite_' + e.eliteName] = (G.flags['elite_' + e.eliteName] || 0) + 1;
    if (window.AI && AI.onPlayerKill) AI.onPlayerKill(e);
    W.checkBountyKill(e);
    W.checkQuest();
    UI.updateQuestHud();
  };

  /* ================= 势力加入 ================= */
  W.joinFaction = function (id) {
    const f = G.factions.find(x => x.id === id);
    if (!f) return;
    const p = G.player;
    if (p.factionId) { U.toast('你已经加入了一个势力', 'bad'); return; }
    if (f.relation < 10) { U.toast('好感度不足 10，先去刷点声望', 'bad'); return; }
    f.joined = true;
    p.factionId = id;
    f.relation = Math.min(100, f.relation + 15);
    for (const o of G.factions) if (o.id !== id) o.relation = Math.max(-100, o.relation - 4);
    p.gold += 200 + p.level * 30;
    p.rep += 10;
    U.toast(`你加入了 ${f.name}`, 'epic');
    U.log(`你成为 ${f.name} 的一员，获得入会俸禄。`, 'good');
    W.checkQuest();
    if (UI.currentPanel) UI.open(UI.currentPanel);
    UI.refreshHUD(true);
  };

  W.giftFaction = function (id) {
    const f = G.factions.find(x => x.id === id);
    const p = G.player;
    if (!f) return;
    if (p.gold < 300) { U.toast('金币不足（需 300 金）', 'bad'); return; }
    if (f.relation >= 100) { U.toast('好感已满', 'bad'); return; }
    p.gold -= 300;
    f.relation = Math.min(100, f.relation + 6);
    U.sfx('coin');
    U.toast(`向 ${f.name} 示好，好感 +6`, 'good');
    W.checkQuest();
    if (UI.currentPanel) UI.open(UI.currentPanel);
    UI.refreshHUD(true);
  };

  W.leaveFaction = function () {
    const p = G.player;
    if (!p.factionId) return;
    const f = G.factions.find(x => x.id === p.factionId);
    if (f) { f.joined = false; f.relation = Math.max(-100, f.relation - 20); }
    p.factionId = null;
    U.toast('你退出了势力', 'bad');
    if (UI.currentPanel) UI.open(UI.currentPanel);
  };

  /* ================= 传送 ================= */
  W.travel = function (id) {
    const z = D.ZONES[id];
    if (!z) return;
    const need = W.needLevel(id);
    if (G.player.level < need) { U.toast(`等级不足，需要 Lv.${need}`, 'bad'); return; }
    UI.close();
    G.paused = false;
    const fade = document.createElement('div');
    fade.style.cssText = 'position:absolute;inset:0;background:#000;z-index:65;opacity:0;transition:opacity .22s;';
    document.getElementById('app').appendChild(fade);
    requestAnimationFrame(() => fade.style.opacity = '1');
    setTimeout(() => {
      W.loadZone(id);
      fade.style.opacity = '0';
      setTimeout(() => fade.remove(), 260);
    }, 240);
  };

  W.needLevel = function (id) {
    const z = D.ZONES[id];
    if (!z) return 0;
    return z.need != null ? z.need : (NEED[id] != null ? NEED[id] : z.lv[0]);
  };

  /* ================= 同伴招募 ================= */
  W.COMPANIONS = [
    { id: 'mobai', name: '墨白', role: '剑士', cost: 500, rep: 0, desc: '沉默寡言的老兵，擅长正面顶住压力。' },
    { id: 'qinghe', name: '青禾', role: '游侠', cost: 900, rep: 20, desc: '出身药庐，会用毒也会包扎伤口。' },
  ];

  W.recruit = function (cid) {
    const c = W.COMPANIONS.find(x => x.id === cid);
    if (!c) return;
    const p = G.player;
    if (G.flags['ally_' + cid]) { U.toast('该同伴已在队伍中', 'bad'); return; }
    if (p.gold < c.cost) { U.toast('金币不足', 'bad'); return; }
    if (p.rep < c.rep) { U.toast('声望不足', 'bad'); return; }
    p.gold -= c.cost;
    G.flags['ally_' + cid] = 1;
    const a = E.spawnAlly(c.name, c.role === '游侠' ? 'healer' : 'fighter', Math.max(1, p.level - 1));
    U.toast(`${c.name} 加入了队伍`, 'epic');
    U.log(`${c.name} 加入了你的队伍。`, 'good');
    if (UI.currentPanel) UI.open(UI.currentPanel);
  };

  return W;
})();
