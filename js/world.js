/* ============ 世界：区域 / 刷怪 / 势力 / 任务 ============ */
window.W = (function () {
  const W = {};

  const NEED = { town: 0, forest: 1, swamp: 5, rift: 12, mine: 9, lavaRift: 18 };

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

    buildProps(z);
    buildDecor(z);
    G.npcs = (z.npcs || []).map(n => Object.assign({}, n));
    G.portal = z.portal ? Object.assign({}, z.portal) : null;

    // 资源点
    if (z.theme === 'swamp' || z.theme === 'rift' || z.theme === 'forest') {
      const n = z.theme === 'forest' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const rnd = mulberry32(hashStr(z.id) + i * 77);
        const owner = U.pick(G.factions);
        G.points.push({
          id: 'pt' + i,
          name: z.theme === 'forest' ? ['林间药圃', '古树祭坛'][i % 2]
            : z.theme === 'swamp' ? ['灵石矿脉', '腐沼祭坛', '毒菇林'][i % 3]
            : ['熔火矿脉', '炎晶洞窟', '火岩祭坛'][i % 3],
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
      if (id === 'town') { p.x = 590; p.y = 660; }
      else { p.x = 190; p.y = z.h - 190; }
      p.vx = 0; p.vy = 0;
      p.dead = p.dead || false;
    }

    // 初始刷怪
    if (z.dungeon) {
      for (let i = 0; i < 6; i++) spawnOne(z, true);
      if (z.boss) {
        const b = E.spawnEnemy(z.boss, z.w - 320, 300, z.lv[0] + 2, {});
        if (b) { b.homeX = z.w - 320; b.homeY = 300; b.bossIntro = true; }
      }
    } else {
      for (let i = 0; i < (z.safe ? 0 : 8); i++) spawnOne(z, true);
    }

    // 主线指定精英
    const q = D.MAIN_QUESTS[G.mainIdx];
    if (q && q.obj.type === 'elite' && !G.flags['elite_' + q.obj.name] && (z.id === 'forest' || z.id === 'swamp' || z.id === 'rift')) {
      const etpl = z.id === 'forest' ? 'bandit' : z.id === 'swamp' ? 'bogman' : 'drake';
      const el = E.spawnEnemy(etpl, z.w * 0.72, z.h * 0.42, U.clamp(z.lv[1], 1, 40), { elite: true, eliteName: q.obj.name });
      if (el) el.name = q.obj.name;
    }

    // 该区域在线的 AI 玩家进场（他们各自有目的地）
    if (window.AI && AI.onZoneEnter) AI.onZoneEnter(id);

    if (!silent) {
      UI.refreshHUD(true);
      UI.updateQuestHud();
      U.log(`进入 ${z.name}。`, z.safe ? '' : 'hot');
    }
    S.save();
  };

  function buildProps(z) {
    const rnd = mulberry32(hashStr(z.id) + 13);
    const count = z.safe ? 6 : 34;
    for (let i = 0; i < count; i++) {
      const x = 80 + rnd() * (z.w - 160);
      const y = 80 + rnd() * (z.h - 160);
      // 避免挡在出生点
      if (Math.hypot(x - 190, y - (z.h - 190)) < 150) continue;
      let r = 16 + rnd() * 14;
      let kind = 'tree';
      if (z.theme === 'swamp') { r = 12 + rnd() * 16; kind = rnd() > 0.5 ? 'tree' : 'mushroom'; }
      if (z.theme === 'rift') { r = 18 + rnd() * 20; kind = 'rock'; }
      if (z.theme === 'mine') { r = 20 + rnd() * 18; kind = 'rock'; }
      if (z.theme === 'town') { r = 14 + rnd() * 8; kind = 'lamp'; }
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
    const cap = z.dungeon ? 9 : 14;
    if (G.enemies.length >= cap) return;

    let x, y, tries = 0;
    do {
      x = 120 + Math.random() * (z.w - 240);
      y = 120 + Math.random() * (z.h - 240);
      tries++;
    } while (p && Math.hypot(x - p.x, y - p.y) < (initial ? 380 : 540) && tries < 25);
    if (tries >= 25) return;

    const lv = U.randInt(z.lv[0], z.lv[1]);
    const elite = !z.dungeon && Math.random() < 0.07;
    const opts = { elite };
    if (elite && z.eliteNames && Math.random() < 0.6) {
      // 普通精英，不给特殊名（特殊名留给主线）
    }
    const e = E.spawnEnemy(pick.id, x, y, lv, opts);
    if (e) { e.homeX = x; e.homeY = y; }
  }

  W.spawnTick = function (dt) {
    const z = G.zone;
    if (!z || z.safe) return;
    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    G.spawnT = z.dungeon ? 6 : 2.4;

    // 主线通缉精英
    const q = D.MAIN_QUESTS[G.mainIdx];
    if (q && q.obj.type === 'elite' && !G.flags['elite_' + q.obj.name] &&
        (z.id === 'forest' || z.id === 'swamp' || z.id === 'rift') &&
        !G.enemies.some(e => e.eliteName === q.obj.name) && Math.random() < 0.6) {
      const p = G.player;
      const etpl = z.id === 'forest' ? 'bandit' : z.id === 'swamp' ? 'bogman' : 'drake';
      const a = U.rand(0, 6.283);
      const dd = U.rand(320, 520);
      const x = U.clamp(p.x + Math.cos(a) * dd, 100, z.w - 100);
      const y = U.clamp(p.y + Math.sin(a) * dd, 100, z.h - 100);
      const el = E.spawnEnemy(etpl, x, y, U.clamp(z.lv[1], 1, 40), { elite: true, eliteName: q.obj.name });
      if (el) {
        el.name = q.obj.name;
        U.log(`通缉目标「${q.obj.name}」出现在附近。`, 'hot');
      }
      return;
    }

    if (G.enemies.length >= (z.dungeon ? 9 : 14)) return;
    spawnOne(z, false);
  };

  /* ================= 悬赏（活的任务板） ================= */
  W.addBounty = function (silent) {
    if (G.bounties.length >= 4) return;
    const p = G.player;
    let zoneIds = ['forest'];
    if (p.level >= 5) zoneIds.push('swamp');
    if (p.level >= 12) zoneIds.push('rift');
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
          const zid = U.pick(['swamp', 'rift', 'forest']);
          const ptName = U.pick(['灵石矿脉', '古树祭坛', '熔火矿脉', '林间药圃']);
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
        // 该点会招来反击
        for (let i = 0; i < 3; i++) {
          const a = U.rand(0, 6.28);
          E.spawnEnemy('bandit', near.x + Math.cos(a) * 90, near.y + Math.sin(a) * 90, p.level, {});
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
    const pt = W.pointNear();
    if (!near && pt) near = { type: 'point', obj: pt };
    G.near = near;

    const el = document.getElementById('prompt');
    if (!el) return;
    if (near && !G.paused) {
      el.classList.remove('hidden');
      if (near.type === 'npc') el.innerHTML = `<kbd>E</kbd> 与 ${near.obj.name}（${near.obj.title}）交谈`;
      else if (near.type === 'portal') el.innerHTML = `<kbd>E</kbd> 使用 ${near.obj.name}`;
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
    if (e.rank === 'boss') G.flags['boss_' + id] = 1;
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
    const need = NEED[id] || 0;
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

  W.needLevel = function (id) { return NEED[id] || 0; };

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
