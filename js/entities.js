/* ============ 实体 · 战斗 · 技能 ============ */
window.E = (function () {
  const E = {};

  /* ================= 基础工具 ================= */
  E.addText = function (x, y, text, color, size, vy) {
    G.texts.push({ x, y, text, color: color || '#fff', size: size || 15, life: 0.9, max: 0.9, vy: vy || -52, vx: U.rand(-14, 14) });
  };

  E.fx = function (type, o) {
    const f = Object.assign({ type, t: 0, life: 0.3, max: 0.3 }, o);
    G.fx.push(f);
    return f;
  };

  E.ring = function (x, y, r, color, life) {
    return E.fx('ring', { x, y, r: r || 10, color: color || '#fff', life: life || 0.4, max: life || 0.4 });
  };

  E.burst = function (x, y, color, n, spd) {
    for (let i = 0; i < (n || 8); i++) {
      const a = U.rand(0, Math.PI * 2), s = U.rand(40, spd || 200);
      E.fx('p', { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: U.rand(0.25, 0.55), max: 0.55, r: U.rand(1.5, 3.4) });
    }
  };

  E.shake = function (v, t) { G.shake = Math.max(G.shake, v); G.shakeT = Math.max(G.shakeT, t || 0.18); };

  E.resolveProps = function (ent, r) {
    for (const pr of G.props) {
      if (pr.pass) continue;
      const d = U.dist(ent.x, ent.y, pr.x, pr.y);
      const min = (r || ent.r) + pr.r;
      if (d < min && d > 0.001) {
        const a = U.ang(pr.x, pr.y, ent.x, ent.y);
        ent.x = pr.x + Math.cos(a) * min;
        ent.y = pr.y + Math.sin(a) * min;
      }
    }
    const z = G.zone;
    ent.x = U.clamp(ent.x, 40, z.w - 40);
    ent.y = U.clamp(ent.y, 40, z.h - 40);
  };

  /* ================= 玩家 ================= */
  E.updatePlayer = function (dt) {
    const p = G.player;
    if (!p || p.dead) return;
    const st = S.stats(p);

    // 冷却
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.stanceCd = Math.max(0, p.stanceCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.potionCd = Math.max(0, p.potionCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.swing = Math.max(0, (p.swing || 0) - dt);
    p.poisonBuff = Math.max(0, (p.poisonBuff || 0) - dt);
    p.slowT = Math.max(0, (p.slowT || 0) - dt);
    if (p.dot && p.dot.t > 0) {
      p.dot.t -= dt;
      p.hp -= p.dot.dmg * dt;
      if (Math.random() < 0.14) E.addText(p.x + U.rand(-10, 10), p.y - 30, '-' + Math.round(p.dot.dmg), '#8ff07a', 11);
      if (p.hp <= 0) { p.hp = 0; E.playerDie({ name: p.dot.name || '中毒' }); return; }
    }
    for (const k in p.skillCd) p.skillCd[k] = Math.max(0, p.skillCd[k] - dt);

    // 增益
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      p.buffs[i].t -= dt;
      if (p.buffs[i].t <= 0) {
        U.log(`${p.buffs[i].name} 效果结束。`);
        p.buffs.splice(i, 1);
      }
    }

    // 移动
    let dx = 0, dy = 0;
    if (G.keys['w'] || G.keys['arrowup']) dy -= 1;
    if (G.keys['s'] || G.keys['arrowdown']) dy += 1;
    if (G.keys['a'] || G.keys['arrowleft']) dx -= 1;
    if (G.keys['d'] || G.keys['arrowright']) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    if (p.dashT > 0) {
      p.dashT -= dt;
      const sp = 920;
      p.x += Math.cos(p.dashDir) * sp * dt;
      p.y += Math.sin(p.dashDir) * sp * dt;
      if (Math.random() < 0.6) E.fx('p', { x: p.x, y: p.y, vx: U.rand(-30, 30), vy: U.rand(-30, 30), color: '#9fb6d8', life: 0.25, max: 0.25, r: 2.4 });
    } else {
      let sp = st.speed;
      if (p.slowT > 0) sp *= 0.72;
      if (G.hazard && G.hazard.blizz > 0) sp *= 0.72;
      const onIce = window.W && W.onIce && W.onIce(p.x, p.y);
      if (onIce) {
        // 冰面：加速慢、刹不住
        p.svx = (p.svx || 0) + (dx * sp - (p.svx || 0)) * Math.min(1, dt * 2.6);
        p.svy = (p.svy || 0) + (dy * sp - (p.svy || 0)) * Math.min(1, dt * 2.6);
        p.x += p.svx * dt;
        p.y += p.svy * dt;
        p.vx = p.svx; p.vy = p.svy;
      } else {
        p.svx = 0; p.svy = 0;
        p.vx = dx * sp; p.vy = dy * sp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    E.resolveProps(p, p.r);

    // 朝向
    const aim = U.ang(p.x, p.y, G.mouse.wx, G.mouse.wy);
    p.facing = aim;

    // 普攻
    if (G.mouse.down && p.atkCd <= 0 && !G.paused) E.playerAttack();

    // 回复
    if (G.t - G.lastHitT > 6) {
      p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.022 * dt);
      p.mp = Math.min(st.maxMp, p.mp + st.maxMp * 0.035 * dt);
    }
    p.hp = Math.min(p.hp, st.maxHp);
    p.mp = Math.min(p.mp, st.maxMp);

    // 拾取（带磁吸）
    for (let i = G.loots.length - 1; i >= 0; i--) {
      const l = G.loots[i];
      const ld = U.dist(p.x, p.y, l.x, l.y);
      if (l.born > 0.3 && ld < 130 && ld > 30) {
        const a = U.ang(l.x, l.y, p.x, p.y);
        const sp = 240 * dt * (1 - ld / 160);
        l.x += Math.cos(a) * sp * 3;
        l.y += Math.sin(a) * sp * 3;
      }
      if (l.born > 0.35 && ld < 52) {
        E.pickLoot(l);
        G.loots.splice(i, 1);
      } else if (l.born !== undefined) l.born += dt;
    }

    if (p.hp <= 0) E.playerDie();
  };

  E.playerAttack = function () {
    const p = G.player, cls = D.CLASSES[p.cls], st = S.stats(p);
    p.atkCd = 1 / st.atkSpeed;
    p.swing = 0.16;
    p.swingDir = (p.swingDir || 1) * -1;
    const aim = p.facing;

    if (cls.melee) {
      E.meleeSwing(p, aim, cls.range, Math.PI * 0.62, 1.0);
      E.fx('slash', { x: p.x, y: p.y, a: aim, r: cls.range, arc: Math.PI * 0.62, color: cls.color, life: 0.18, max: 0.18 });
      U.sfx('hit');
    } else {
      E.shoot(p, aim, {
        speed: 700, dmgMult: 1.0, weak: true, color: '#8fffd8', r: 6, len: 22,
      });
      U.sfx('hit');
    }
    // 攻击时若有小位移反馈
  };

  E.meleeSwing = function (attacker, aim, range, arc, mult) {
    const isPlayer = attacker.kind === 'player';
    const list = isPlayer ? E.playerTargets() : [G.player].concat(G.allies);
    for (const t of list) {
      if (!t || t.dead || t.hp <= 0) continue;
      const d = U.dist(attacker.x, attacker.y, t.x, t.y);
      if (d > range + t.r) continue;
      if (Math.abs(U.angDiff(aim, U.ang(attacker.x, attacker.y, t.x, t.y))) > arc / 2) continue;
      if (isPlayer) {
        const weak = E.isWeakAim(t, aim, range, arc);
        E.hit(t, mult, { weak });
      } else {
        E.damagePlayer(attacker.atk * mult, attacker);
      }
    }
  };

  /* 玩家可攻击的目标：怪物 + 敌对 / 被挑衅的 AI 玩家 */
  E.playerTargets = function () {
    const list = G.enemies.slice();
    for (const a of (G.aiEnts || [])) {
      if (!a.dead && (a.hostile || a.provoked)) list.push(a);
    }
    return list;
  };

  /* 统一命中入口：怪物走 playerHit，AI 玩家走 playerHitAI */
  E.hit = function (t, mult, opts) {
    if (!t || t.dead) return;
    if (t.kind === 'ai') E.playerHitAI(t, mult, opts);
    else E.playerHit(t, mult, opts);
  };

  E.isWeakAim = function (t, aim, range, arc) {
    const p = G.player;
    if (p.weakBuff > 0) return true;
    const wx = t.x + (t.weak.ox || 0), wy = t.y + (t.weak.oy || 0);
    const wAng = U.ang(p.x, p.y, wx, wy);
    const wDist = U.dist(p.x, p.y, wx, wy);
    const cursorOn = U.dist(G.mouse.wx, G.mouse.wy, wx, wy) < t.r * 0.95;
    return cursorOn || (Math.abs(U.angDiff(aim, wAng)) < arc * 0.4 && wDist <= range + 16);
  };

  /* ---------- 玩家命中敌人 ---------- */
  E.playerHit = function (e, mult, opts) {
    const p = G.player, st = S.stats(p);
    opts = opts || {};
    if (e.hp <= 0 || e.dead) return;
    if (e.invuln > 0) return;

    let mode = 'normal';
    const lvDiff = e.level - p.level;
    if (opts.weak) {
      if (lvDiff >= 10) mode = 'normal';
      else if (e.rank === 'normal' && lvDiff <= 5) mode = 'execute';
      else mode = 'weak';
    }
    const crit = Math.random() * 100 < st.crit;

    if (mode === 'execute') {
      e.hp = 0;
      E.addText(e.x + U.rand(-12, 12), e.y - e.r - 12 + U.rand(-6, 6), '处决', '#ffd166', 19, -72);
      E.burst(e.x, e.y, '#ffd166', 18, 300);
      E.ring(e.x, e.y, e.r * 2.4, '#ffd166', 0.4);
      E.shake(9, 0.2);
      U.sfx('crit');
      G.statsData.execute++;
      if (p.weakBuff > 0) p.weakBuff--;
      E.killEnemy(e);
      return;
    }

    let raw = st.atk * mult;
    let dmg = raw * (1 - e.def / (e.def + 180));
    if (crit) dmg *= 1.9;
    if (mode === 'weak') {
      dmg *= 3.2 * (st.weakDmg / 100);
      e.stun = Math.max(e.stun, e.rank === 'boss' ? 0.35 : 0.95);
      G.statsData.weak++;
      if (p.weakBuff > 0) p.weakBuff--;
    }
    dmg = Math.max(1, Math.round(dmg * U.rand(0.93, 1.07)));
    if (e.shieldT > 0) dmg = Math.max(1, Math.round(dmg * 0.62));

    e.hp -= dmg;
    e.playerDmg = (e.playerDmg || 0) + dmg;   // 用于「被 AI 抢怪」判定
    e.hitFlash = 0.14;
    e.aggro = true;
    e.target = 'player';
    // 精英 / 首领有仇恨记忆：脱战后仍会追一段时间
    if (e.rank !== 'normal') e.hateT = e.rank === 'elite' ? 15 : 24;

    const col = mode === 'weak' ? '#ff9f43' : crit ? '#ffd166' : '#ffffff';
    E.addText(e.x + U.rand(-16, 16), e.y - e.r - 6 + U.rand(-8, 8), (mode === 'weak' ? '要害 ' : '') + U.fmt(dmg), col, mode === 'weak' ? 19 : 15);
    if (mode === 'weak') {
      U.sfx('weak');
      E.shake(5, 0.14);
      E.burst(e.x, e.y, '#ff9f43', 10, 220);
      E.ring(e.x, e.y, e.r * 1.6, '#ff9f43', 0.25);
    } else {
      E.burst(e.x, e.y, '#ffdfc0', 5, 140);
    }

    // 吸血
    if (st.lifesteal > 0) {
      const heal = dmg * st.lifesteal / 100;
      if (heal >= 1) {
        p.hp = Math.min(st.maxHp, p.hp + heal);
        E.addText(p.x, p.y - 26, '+' + Math.round(heal), '#5fd18d', 12);
      }
    }
    // 毒刃
    if (p.poisonBuff > 0) {
      e.poison = e.poison || { stacks: 0, t: 0 };
      e.poison.stacks = Math.min(5, e.poison.stacks + 1);
      e.poison.t = 4;
      e.poison.dmg = Math.max(2, st.atk * 0.12);
    }

    if (e.hp <= 0) E.killEnemy(e);
  };

  /* ---------- 玩家命中 AI 玩家（PVP） ---------- */
  E.playerHitAI = function (ent, mult, opts) {
    const p = G.player, st = S.stats(p);
    opts = opts || {};
    if (!ent || ent.dead) return;
    const weak = !!opts.weak;
    const crit = Math.random() * 100 < st.crit;
    let dmg = st.atk * mult * (1 - ent.def / (ent.def + 200));
    if (crit) dmg *= 1.9;
    if (weak) dmg *= 2.6;
    dmg = Math.max(1, Math.round(dmg * U.rand(0.93, 1.07)));

    ent.hp -= dmg;
    ent.hitFlash = 0.14;
    ent.provoked = true;      // 打了他，他就还手
    ent.noHit = 0;
    ent.target = 'player';
    E.addText(ent.x + U.rand(-14, 14), ent.y - 26, (weak ? '要害 ' : '') + U.fmt(dmg),
      weak ? '#ff9f43' : crit ? '#ffd166' : '#fff', weak ? 17 : 14);
    E.burst(ent.x, ent.y, '#ffb0c0', 5, 140);
    U.sfx(weak ? 'weak' : 'hit');
    if (st.lifesteal > 0) p.hp = Math.min(st.maxHp, p.hp + dmg * st.lifesteal / 100);

    if (ent.hp <= 0) {
      if (window.AI && AI.onPlayerKillAI) AI.onPlayerKillAI(ent);
      else ent.dead = true;
    }
  };

  /* ---------- AI 玩家被野怪打 ---------- */
  E.damageAI = function (ent, raw) {
    if (!ent || ent.dead) return;
    const dmg = Math.max(1, Math.round(raw * (1 - ent.def / (ent.def + 220)) * U.rand(0.92, 1.08)));
    ent.hp -= dmg;
    ent.noHit = 0;
    ent.hitFlash = 0.12;
    E.addText(ent.x + U.rand(-8, 8), ent.y - 26, '-' + U.fmt(dmg), '#ff8080', 12);
    if (ent.hp <= 0) {
      ent.dead = true;
      const a = ent.agent;
      a.deaths++;
      a.state = 'offline';
      if (window.AI) {
        AI.pushLog(`${a.name} 在${G.zone.name}被野怪打死了，尸体旁边围了三个人。`, 'ai');
        AI.remember(a, 'death', `在${G.zone.name}被野怪打死`, -0.6, 0.5);
        setTimeout(() => { if (a.state === 'offline') a.state = 'active'; }, 45000);
      }
      E.burst(ent.x, ent.y, ent.color, 14, 200);
      U.log(`${a.name} 被野怪打死了。`);
    }
  };

  /* ---------- 玩家受伤 ---------- */
  E.damagePlayer = function (raw, src) {
    const p = G.player;
    if (!p || p.dead) return;
    if (p.invuln > 0) {
      E.addText(p.x, p.y - 30, '闪避', '#8fd8ff', 13);
      return;
    }
    const st = S.stats(p);
    if (Math.random() * 100 < st.dodge) {
      E.addText(p.x, p.y - 30, '闪避', '#8fd8ff', 14);
      return;
    }
    let dmg = raw * (1 - st.def / (st.def + 200));
    dmg = Math.max(1, Math.round(dmg * U.rand(0.92, 1.08)));
    p.hp -= dmg;
    G.lastHitT = G.t;
    E.addText(p.x + U.rand(-10, 10), p.y - 24, '-' + U.fmt(dmg), '#ff8080', 16);
    E.burst(p.x, p.y, '#ff6b6b', 6, 160);
    E.shake(6, 0.16);
    U.sfx('hurt');
    if (p.hp <= 0) E.playerDie(src);
  };

  E.playerDie = function (src) {
    const p = G.player;
    if (p.dead) return;
    p.dead = true;
    G.statsData.deaths++;
    U.sfx('die');
    if (src && src.kind === 'ai' && window.AI && AI.onPlayerDeath) {
      try { AI.onPlayerDeath(src); } catch (e) {}
      p.killedBy = src.name;
    } else {
      p.killedBy = (src && src.name) ? src.name : '';
    }
    const lost = Math.round(p.gold * 0.05);
    p.gold = Math.max(0, p.gold - lost);
    U.log(`你被击败了，遗落 ${lost} 金币。三秒后在落霞城醒来。`, 'bad');
    E.showDeathScreen(lost);
  };

  E.showDeathScreen = function (lost) {
    const p = G.player;
    const by = p.killedBy ? `被「${U.esc(p.killedBy)}」击杀` : '力 竭';
    const d = document.createElement('div');
    d.className = 'death-screen';
    d.innerHTML = `<h2>${p.killedBy ? by : '力 竭'}</h2><p>${p.killedBy ? '技不如人。' : ''}遗落 ${lost} 金币 · 三秒后于落霞城重生</p>`;
    document.getElementById('app').appendChild(d);
    setTimeout(() => {
      d.remove();
      const p = G.player;
      p.dead = false;
      p.hp = S.stats(p).maxHp;
      p.mp = S.stats(p).maxMp;
      p.buffs = [];
      W.loadZone('town');
      U.toast('你在落霞城醒来', 'good');
    }, 3000);
  };

  /* ---------- 击杀 ---------- */
  E.killEnemy = function (e, byAI) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;

    // 被 AI 玩家抢掉：世界在跟你抢饭吃
    if (byAI) {
      E.burst(e.x, e.y, e.tpl.color, 12, 220);
      U.sfx('die');
      if (window.AI && AI.onKillSteal) AI.onKillSteal(byAI, e);
      return;
    }

    const p = G.player;
    p.kills++;
    G.statsData.kills++;
    U.sfx('die');
    E.burst(e.x, e.y, e.tpl.color, 16, 260);
    E.ring(e.x, e.y, e.r * 2, e.tpl.color, 0.4);

    const exp = Math.round(e.exp);
    S.gainExp(exp);
    E.addText(e.x, e.y - e.r - 16, '+' + exp + ' 经验', '#b8f0c8', 13, -70);

    if (e.rank === 'boss') {
      E.shake(16, 0.5);
      U.toast(`${e.name} 被击败！`, 'epic');
      U.log(`你击杀了 ${e.name}。`, 'good');
      if (e.tpl.id === 'boss_golon') G.flags.killedGolon = true;
      if (e.tpl.id === 'boss_lava') G.flags.killedLava = true;
    } else if (e.rank === 'elite') {
      U.log(`精英 ${e.name} 倒下了。`, 'hot');
    }
    if (e.eliteName) {
      G.flags['elite_' + e.eliteName] = (G.flags['elite_' + e.eliteName] || 0) + 1;
    }

    E.dropLoot(e);
    W.onKill(e);
  };

  /* ---------- 掉落 ---------- */
  E.dropLoot = function (e) {
    const lvDiff = Math.max(0, G.player.level - e.level);
    let coins = Math.round((6 + e.level * 4.5) * (e.rank === 'boss' ? 22 : e.rank === 'elite' ? 4 : 1) * U.rand(0.8, 1.25));
    coins = Math.round(coins * (1 - U.clamp(lvDiff * 0.03, 0, 0.6)));
    const loot = { x: e.x + U.rand(-14, 14), y: e.y + U.rand(-14, 14), gold: coins, items: [], born: 0 };
    G.loots.push(loot);

    const dropChance = e.rank === 'boss' ? 1 : e.rank === 'elite' ? 0.9 : 0.34;
    const count = e.rank === 'boss' ? 3 : e.rank === 'elite' ? 1 + (U.chance(0.4) ? 1 : 0) : (U.chance(dropChance) ? 1 : 0);
    const bonus = e.rank === 'boss' ? 5 : e.rank === 'elite' ? 1.9 : 0;
    for (let i = 0; i < count; i++) {
      const ilvl = U.clamp(e.level + U.randInt(-1, 2), 1, 40);
      const q = I.rollQuality(bonus, 0);
      const item = I.gen(ilvl, q, null, G.player.cls);
      loot.items.push(item);
    }
    if (e.rank === 'boss') {
      const gemType = U.pick(['ruby', 'jade', 'sapp', 'topaz']);
      I.addGem(gemType, e.tpl.id === 'boss_lava' ? 3 : 2);
      U.toast('获得宝石：' + D.GEMS[gemType].name, 'good');
    }
    // 冒光
    E.fx('lootGlow', { x: loot.x, y: loot.y, color: e.rank === 'boss' ? '#ffb347' : '#c9a35c', life: 0.7, max: 0.7 });
  };

  E.pickLoot = function (l) {
    const p = G.player;
    if (l.gold) {
      p.gold += l.gold;
      G.statsData.gold += l.gold;
      U.sfx('coin');
      E.addText(l.x, l.y - 10, '+' + l.gold + ' 金币', '#f0c24b', 13, -50);
    }
    for (const it of l.items) I.add(it, l.items.length === 1 && it.q < 4);
  };

  /* ================= 投射物 ================= */
  E.shoot = function (src, angle, o) {
    o = o || {};
    G.projs.push({
      x: src.x + Math.cos(angle) * 18, y: src.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * (o.speed || 640), vy: Math.sin(angle) * (o.speed || 640),
      r: o.r || 6, life: o.life || 1.4, from: src.kind === 'player' ? 'player' : src.kind === 'ally' ? 'ally' : 'enemy',
      dmgMult: o.dmgMult || 1, color: o.color || '#fff', weak: !!o.weak,
      explode: o.explode || 0, slow: o.slow || 0, burn: o.burn || 0, len: o.len || 14,
      pierce: o.pierce || 0, hitSet: [], src,
    });
  };

  E.updateProjectiles = function (dt) {
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const pr = G.projs[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (U.chance(0.5)) E.fx('p', { x: pr.x, y: pr.y, vx: 0, vy: 0, color: pr.color, life: 0.2, max: 0.2, r: 2 });

      let dead = pr.life <= 0;

      // 撞墙（树冠不挡箭，岩石挡）
      for (const p2 of G.props) {
        if (p2.pass || p2.kind === 'tree' || p2.kind === 'mushroom' || p2.kind === 'lamp') continue;
        if (U.dist(pr.x, pr.y, p2.x, p2.y) < p2.r * 0.7) { dead = true; E.burst(pr.x, pr.y, pr.color, 4, 90); }
      }

      if (!dead) {
        if (pr.from === 'player' || pr.from === 'ally') {
          for (const e of (pr.from === 'player' ? E.playerTargets() : G.enemies)) {
            if (e.dead || pr.hitSet.indexOf(e) >= 0) continue;
            const hitR = e.r + pr.r;
            const weak = pr.weak && U.dist(pr.x, pr.y, e.x + (e.weak.ox || 0), e.y + (e.weak.oy || 0)) < e.r * 0.62;
            if (U.dist(pr.x, pr.y, e.x, e.y) < hitR) {
              pr.hitSet.push(e);
              if (pr.from === 'player') E.hit(e, pr.dmgMult, { weak });
              else E.allyHit(e, pr.dmgMult);
              dead = true;
              break;
            }
          }
        } else {
          const targets = [G.player].concat(G.allies).concat(G.aiEnts || []);
          for (const t of targets) {
            if (!t || t.dead) continue;
            if (U.dist(pr.x, pr.y, t.x, t.y) < t.r + pr.r) {
              if (t.kind === 'player') E.damagePlayer(pr.src ? pr.src.atk * pr.dmgMult : 10, pr.src);
              else if (t.kind === 'ai') E.damageAI(t, pr.src ? pr.src.atk * pr.dmgMult : 10);
              else E.damageAlly(t, pr.src ? pr.src.atk * pr.dmgMult : 10);
              dead = true;
              break;
            }
          }
        }
      }

      if (dead) {
        if (pr.explode) {
          E.ring(pr.x, pr.y, pr.explode, pr.color, 0.35);
          for (const e of E.playerTargets()) {
            if (e.dead) continue;
            if (U.dist(pr.x, pr.y, e.x, e.y) < pr.explode + e.r) E.hit(e, pr.dmgMult, { weak: false });
          }
        }
        E.burst(pr.x, pr.y, pr.color, 5, 120);
        G.projs.splice(i, 1);
      }
    }
  };

  /* ================= 敌人 ================= */
  E.spawnEnemy = function (tplId, x, y, level, opts) {
    const t = D.MONSTERS[tplId];
    if (!t) return null;
    opts = opts || {};
    const lv = U.clamp(level || 1, 1, 60);
    const elite = !!opts.elite;
    const boss = !!t.boss;
    const rank = boss ? 'boss' : elite ? 'elite' : 'normal';
    const hpM = (1 + (lv - 1) * 0.34) * (elite ? 3.4 : 1);
    const atkM = (1 + (lv - 1) * 0.40) * (elite ? 1.40 : 1);
    const r = t.r * (elite ? 1.3 : 1);

    const e = {
      kind: 'enemy', tpl: t, id: 'e' + (G.uid++), name: elite ? '精英·' + t.name : t.name,
      eliteName: opts.eliteName || null,
      rank, level: lv, x, y, r,
      maxHp: Math.round(t.hp * hpM), hp: 0,
      atk: t.atk * atkM,
      def: 2 + lv * 2.4 * (elite ? 1.4 : 1) * (boss ? 1.8 : 1),
      speed: t.speed, range: t.range, rate: t.rate,
      exp: t.exp * (1 + (lv - 1) * 0.26) * (elite ? 4 : 1),
      aggro: false, aggroRange: t.aggro, state: 'idle',
      timer: U.rand(0.5, 2), windup: 0, stun: 0, slowT: 0, hitFlash: 0,
      weak: { ox: 0, oy: -r * (boss ? 0.42 : 0.55) }, weakR: r * (boss ? 0.3 : 0.34),
      homeX: x, homeY: y, wanderA: U.rand(0, 6.28), dead: false,
      attackCd: U.rand(0.3, 1.2), phase: 0, chargeT: 0, chargeDir: 0,
      poison: null, burn: null, invuln: 0, target: null,
      isBoss: boss, ranged: !!t.ranged, summonT: 6,
      beh: t.beh || {}, hateT: 0, shieldT: 0, shieldCd: U.rand(2, 5),
      healCd: U.rand(3, 6), blinkCd: U.rand(4, 7), enraged: false,
      born: 0,
    };
    e.hp = e.maxHp;
    G.enemies.push(e);
    return e;
  };

  E.nearestTarget = function (e) {
    const list = [];
    if (G.player && !G.player.dead) list.push(G.player);
    for (const a of G.allies) if (!a.dead) list.push(a);
    for (const a of (G.aiEnts || [])) if (!a.dead) list.push(a);
    let best = null, bd = 1e9;
    for (const t of list) {
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  };

  E.updateEnemies = function (dt) {
    const p = G.player;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      if (e.dead) { G.enemies.splice(i, 1); continue; }

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.hateT = Math.max(0, (e.hateT || 0) - dt);
      e.shieldT = Math.max(0, (e.shieldT || 0) - dt);
      e.healCd = Math.max(0, (e.healCd || 0) - dt);
      e.blinkCd = Math.max(0, (e.blinkCd || 0) - dt);

      // 持续伤害
      if (e.poison && e.poison.t > 0) {
        e.poison.t -= dt;
        e.hp -= e.poison.dmg * e.poison.stacks * dt;
        if (U.chance(0.12)) E.addText(e.x, e.y - e.r, Math.round(e.poison.dmg * e.poison.stacks), '#8ff07a', 11);
        if (e.hp <= 0) { E.killEnemy(e); continue; }
      }
      if (e.burn && e.burn.t > 0) {
        e.burn.t -= dt;
        e.hp -= e.burn.dmg * dt;
        if (U.chance(0.14)) E.addText(e.x, e.y - e.r, Math.round(e.burn.dmg), '#ff9f43', 11);
        if (e.hp <= 0) { E.killEnemy(e); continue; }
      }

      if (e.stun > 0) {
        if (U.chance(0.3)) E.fx('stun', { x: e.x, y: e.y - e.r - 12, life: 0.3, max: 0.3 });
        continue;
      }

      const target = E.nearestTarget(e);
      if (!target) continue;
      const d = U.dist(e.x, e.y, target.x, target.y);

      // 仇恨
      if (!e.aggro && d < e.aggroRange) { e.aggro = true; e.state = 'chase'; }
      if (e.aggro && d > e.aggroRange * 2.6 && e.hateT <= 0) { e.aggro = false; e.state = 'return'; }
      if (e.aggro && e.state === 'return' && e.hateT > 0) { e.state = 'chase'; }

      // 残血狂暴
      if (e.beh.enrage && !e.enraged && e.hp < e.maxHp * 0.4) {
        e.enraged = true; e.atk *= 1.35; e.speed *= 1.1;
        E.ring(e.x, e.y, e.r * 2, '#ff5b5b', 0.55);
        U.log(`${e.name} 进入了狂暴状态。`, 'bad');
      }
      // 护盾
      if (e.beh.shield && e.shieldCd <= 0 && e.shieldT <= 0) {
        e.shieldT = 4.5; e.shieldCd = 9;
        E.ring(e.x, e.y, e.r * 1.7, '#9fd8ff', 0.4);
      }
      // 治疗同伴
      if (e.beh.heal && e.healCd <= 0) {
        e.healCd = 7;
        let healed = 0;
        for (const o of G.enemies) {
          if (o === e || o.dead || o.hp >= o.maxHp) continue;
          if (U.dist(o.x, o.y, e.x, e.y) > 260) continue;
          const hv = Math.round(o.maxHp * 0.16);
          o.hp = Math.min(o.maxHp, o.hp + hv);
          E.addText(o.x, o.y - o.r - 4, '+' + hv, '#5fd18d', 11);
          healed++;
          if (healed >= 3) break;
        }
        if (healed) E.ring(e.x, e.y, 120, '#7fd6a8', 0.35);
      }
      // 瞬移贴脸
      if (e.beh.blink && e.blinkCd <= 0 && e.aggro && d > 180) {
        e.blinkCd = 6;
        const a = U.ang(e.x, e.y, target.x, target.y);
        E.fx('p', { x: e.x, y: e.y, vx: 0, vy: 0, color: e.tpl.color, life: 0.4, max: 0.4, r: 14 });
        e.x = target.x - Math.cos(a) * 70;
        e.y = target.y - Math.sin(a) * 70;
        E.ring(e.x, e.y, 50, e.tpl.color, 0.35);
      }

      if (e.state === 'idle') {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = U.rand(1.2, 3.2);
          e.wanderA = U.rand(0, 6.28);
        }
        const sp = e.speed * 0.28;
        e.x += Math.cos(e.wanderA) * sp * dt;
        e.y += Math.sin(e.wanderA) * sp * dt;
        E.resolveProps(e, e.r);
      } else if (e.state === 'return') {
        const a = U.ang(e.x, e.y, e.homeX, e.homeY);
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
        if (U.dist(e.x, e.y, e.homeX, e.homeY) < 20) e.state = 'idle';
        E.resolveProps(e, e.r);
      } else if (e.state === 'chase') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) E.enemyStrike(e, target);
        } else {
          const spd = e.speed * (e.slowT > 0 ? 0.55 : 1) * (e.chargeT > 0 ? 2.6 : 1);
          const a = U.ang(e.x, e.y, target.x, target.y);
          if (e.chargeT > 0) {
            e.chargeT -= dt;
            e.x += Math.cos(e.chargeDir) * spd * dt;
            e.y += Math.sin(e.chargeDir) * spd * dt;
            if (U.dist(e.x, e.y, target.x, target.y) < e.r + target.r + 12) {
              E.damagePlayer(e.atk * 1.5, e);
              e.chargeT = 0;
              e.attackCd = 1.2;
            }
          } else {
            const stop = e.ranged ? e.range * 0.8 : e.range * 0.75;
            if (d > stop) {
              // 简单绕行避免堆叠
              let mx = Math.cos(a), my = Math.sin(a);
              for (const o of G.enemies) {
                if (o === e || o.dead) continue;
                const dd = U.dist(e.x, e.y, o.x, o.y);
                if (dd < e.r + o.r + 6 && dd > 0.1) {
                  mx -= (o.x - e.x) / dd * 0.85;
                  my -= (o.y - e.y) / dd * 0.85;
                }
              }
              const ml = Math.hypot(mx, my) || 1;
              e.x += (mx / ml) * spd * dt;
              e.y += (my / ml) * spd * dt;
            } else if (e.attackCd <= 0) {
              e.windup = e.rate * 0.55;
              e.windupMax = e.windup;
              e.atkA = a;
              e.state = 'chase';
              if (e.tpl.charge && U.chance(0.4) && d > 90) {
                e.windup = 0.55; e.chargeT = 0.5; e.chargeDir = a; e.chargePending = true;
              }
            }
          }
        }
        E.resolveProps(e, e.r);
      }

      // BOSS 特殊
      if (e.isBoss) E.bossLogic(e, dt, target, d);
    }
  };

  E.enemyStrike = function (e, target) {
    e.attackCd = 1 / e.rate;
    const beh = e.beh || {};
    const d = U.dist(e.x, e.y, target.x, target.y);
    if (e.ranged) {
      const a = U.ang(e.x, e.y, target.x, target.y);
      E.shoot(e, a, { speed: 300, dmgMult: 1, color: e.tpl.color || '#ff8b3d', r: 8, len: 16 });
      U.sfx('hit');
      if (beh.splash) {
        // 抛射范围伤害：落点预警圈
        const tx = target.x, ty = target.y;
        E.fx('telegraph', { x: tx, y: ty, r: 92, life: 0.55, max: 0.55, color: '#ff9b3d' });
        setTimeout(() => {
          if (e.dead || !G.player) return;
          E.ring(tx, ty, 92, '#ff9b3d', 0.35);
          if (U.dist(tx, ty, G.player.x, G.player.y) < 100) E.damagePlayer(e.atk * 1.15, e);
        }, 520);
      }
      return;
    }
    E.fx('slash', { x: e.x, y: e.y, a: U.ang(e.x, e.y, target.x, target.y), r: e.range * 1.1, arc: beh.cleave ? 3.6 : 1.5, color: e.tpl.color, life: 0.2, max: 0.2 });
    if (e.chargePending) { e.chargePending = false; return; }

    const hitList = beh.cleave ? [G.player].concat(G.allies) : [target];
    for (const t of hitList) {
      if (!t || t.dead || t.hp <= 0) continue;
      if (beh.cleave && U.dist(e.x, e.y, t.x, t.y) > e.range * 1.25 + t.r) continue;
      const dd = U.dist(e.x, e.y, t.x, t.y);
      if (dd > e.range + t.r + 12) continue;
      if (t.kind === 'player') {
        E.damagePlayer(e.atk, e);
        if (beh.poison) {
          G.player.dot = { dmg: Math.max(1, e.atk * 0.12), t: 5, name: e.name };
        }
        if (beh.slow) {
          G.player.slowT = 3;
          E.addText(G.player.x, G.player.y - 44, '迟缓', '#9fd8ff', 12);
        }
      } else if (t.kind === 'ai') E.damageAI(t, e.atk);
      else E.damageAlly(t, e.atk);
    }
  };

  E.bossLogic = function (e, dt, target, d) {
    e.summonT -= dt;
    if ((e.beh.summon || e.isBoss) && e.summonT <= 0) {
      e.summonT = 15;
      const add = typeof e.beh.summon === 'string' ? e.beh.summon : 'mineBat';
      const n = e.beh.summon ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, 6.28);
        E.spawnEnemy(add, e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80, Math.max(1, e.level - 2), {});
      }
      E.ring(e.x, e.y, 90, e.tpl.color, 0.5);
      U.log(`${e.name} 召唤了随从。`, 'bad');
    }
    if (e.attackCd <= 0 && d < 170 && e.windup <= 0) {
      if (U.chance(0.35)) {
        // 范围践踏
        e.attackCd = 3.2;
        E.fx('telegraph', { x: e.x, y: e.y, r: 160, life: 0.6, max: 0.6, color: '#ff6b4b' });
        setTimeout(() => {
          if (e.dead) return;
          E.ring(e.x, e.y, 160, '#ff6b4b', 0.45);
          E.shake(12, 0.3);
          if (U.dist(e.x, e.y, G.player.x, G.player.y) < 170) E.damagePlayer(e.atk * 1.3, e);
        }, 560);
      }
    }
  };

  E.damageAlly = function (a, raw) {
    if (!a || a.dead) return;
    const dmg = Math.max(1, Math.round(raw * (1 - a.def / (a.def + 200))));
    a.hp -= dmg;
    E.addText(a.x, a.y - 24, '-' + dmg, '#ffb0b0', 12);
    if (a.hp <= 0) {
      a.dead = true;
      U.log(`${a.name} 倒下了。`, 'bad');
      E.burst(a.x, a.y, '#8fa6b8', 12, 200);
    }
  };

  E.allyHit = function (e, mult) {
    if (e.dead) return;
    const dmg = Math.max(1, Math.round(G.player ? S.stats(G.player).atk * 0.45 * mult * (1 - e.def / (e.def + 180)) : 10));
    e.hp -= dmg;
    e.hitFlash = 0.1;
    E.addText(e.x, e.y - e.r - 4, String(dmg), '#b8d8ff', 12);
    if (e.hp <= 0) E.killEnemy(e);
  };

  /* ================= 同伴 ================= */
  E.spawnAlly = function (name, role, lv) {
    const a = {
      kind: 'ally', id: 'a' + (G.uid++), name, role,
      level: lv || 1, x: G.player.x + U.rand(-30, 30), y: G.player.y + U.rand(-30, 30), r: 14,
      hp: 0, maxHp: 0, atk: 0, def: 0, speed: 190, range: 70, rate: 1,
      attackCd: 0, dead: false, swing: 0, target: null, color: role === 'healer' ? '#8ff0b6' : '#9fb6d8',
      followA: U.rand(0, 6.28),
    };
    a.maxHp = Math.round(90 + a.level * 46);
    a.hp = a.maxHp;
    a.atk = 6 + a.level * 5.2;
    a.def = 4 + a.level * 3.2;
    G.allies.push(a);
    return a;
  };

  E.updateAllies = function (dt) {
    for (let i = G.allies.length - 1; i >= 0; i--) {
      const a = G.allies[i];
      if (a.dead) { if (a.hp <= 0) a.hp = 0; continue; }
      a.attackCd = Math.max(0, a.attackCd - dt);
      a.swing = Math.max(0, a.swing - dt);

      // 找目标
      let tgt = null, bd = 380;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const d = U.dist(a.x, a.y, e.x, e.y);
        if (d < bd) { bd = d; tgt = e; }
      }
      const dp = U.dist(a.x, a.y, G.player.x, G.player.y);
      if (tgt) {
        if (bd > a.range * 0.8) {
          const ang = U.ang(a.x, a.y, tgt.x, tgt.y);
          a.x += Math.cos(ang) * a.speed * dt;
          a.y += Math.sin(ang) * a.speed * dt;
        } else if (a.attackCd <= 0) {
          a.attackCd = 1 / a.rate;
          a.swing = 0.16;
          E.fx('slash', { x: a.x, y: a.y, a: U.ang(a.x, a.y, tgt.x, tgt.y), r: a.range, arc: 1.4, color: a.color, life: 0.16, max: 0.16 });
          E.allyHit(tgt, 1);
        }
      } else {
        if (dp > 110) {
          const ang = U.ang(a.x, a.y, G.player.x, G.player.y);
          const sp = a.speed * (dp > 300 ? 1.35 : 1);
          a.x += Math.cos(ang) * sp * dt;
          a.y += Math.sin(ang) * sp * dt;
        }
      }
      E.resolveProps(a, a.r);
      if (a.hp <= 0) a.dead = true;
    }
  };

  /* ================= 技能 ================= */
  E.canCast = function (id) {
    const p = G.player;
    const s = p.skills.find(x => x.id === id);
    if (!s || !s.unlocked) return '未习得';
    const def = D.SKILLS[id];
    if ((p.skillCd[id] || 0) > 0) return '冷却中';
    if (p.mp < def.mp) return '魔法不足';
    return null;
  };

  E.castSkill = function (idx) {
    const p = G.player;
    if (p.dead) return;
    const s = p.skills[idx];
    if (!s) return;
    const reason = E.canCast(s.id);
    if (reason) {
      if (reason !== '冷却中') U.toast(reason, 'bad');
      return;
    }
    const def = D.SKILLS[s.id];
    p.mp -= def.mp;
    p.skillCd[s.id] = def.cd;
    U.sfx('skill');
    s.mastery = (s.mastery || 0) + 1;

    const aim = p.facing;
    const st = S.stats(p);
    const melee = D.CLASSES[p.cls].melee;

    switch (s.id) {
      case 'shieldBash': {
        const guard = p.stance === 'guard';
        const mult = guard ? 1.8 * 1.4 : 1.2;
        E.cone(p, aim, 118, Math.PI * 0.9, mult, { stun: guard ? 1.2 : 0.3 });
        E.fx('slash', { x: p.x, y: p.y, a: aim, r: 118, arc: Math.PI * 0.9, color: '#8fc4ff', life: 0.28, max: 0.28 });
        E.shake(6, 0.18);
        break;
      }
      case 'charge': {
        E.corridor(p, aim, 230, 70, 2.2, { knock: 120 });
        p.dashT = 0.24; p.dashDir = aim;
        E.fx('slash', { x: p.x, y: p.y, a: aim, r: 230, arc: 0.5, color: '#8fc4ff', life: 0.3, max: 0.3, corridor: true });
        break;
      }
      case 'warCry': {
        E.addBuff(p, { id: 'warcry', name: '战吼', dur: 8, mods: { atk: 1.25, def: 1.3 }, color: '#ffb347' });
        E.ring(p.x, p.y, 70, '#ffb347', 0.5);
        break;
      }
      case 'backstab': {
        let best = null, bd = 320;
        for (const e of G.enemies) {
          if (e.dead) continue;
          const d = U.dist(p.x, p.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) { U.toast('附近没有目标', 'bad'); p.skillCd[s.id] = 0.6; return; }
        const ang = U.ang(best.x, best.y, p.x, p.y);
        p.x = U.clamp(best.x + Math.cos(ang) * (best.r + 26), 40, G.zone.w - 40);
        p.y = U.clamp(best.y + Math.sin(ang) * (best.r + 26), 40, G.zone.h - 40);
        p.facing = U.ang(p.x, p.y, best.x, best.y);
        E.fx('p', { x: p.x, y: p.y, vx: 0, vy: 0, color: '#b06bff', life: 0.3, max: 0.3, r: 18 });
        E.playerHit(best, 3.0, { weak: true });
        E.shake(7, 0.18);
        break;
      }
      case 'shadowStep': {
        E.corridor(p, aim, 210, 56, 1.6, {});
        p.dashT = 0.2; p.dashDir = aim; p.invuln = Math.max(p.invuln, 0.24);
        E.fx('slash', { x: p.x, y: p.y, a: aim, r: 210, arc: 0.4, color: '#b06bff', life: 0.25, max: 0.25, corridor: true });
        break;
      }
      case 'poisonBlade': {
        p.poisonBuff = 8;
        E.addBuff(p, { id: 'poison', name: '毒刃', dur: 8, mods: {}, color: '#8ff07a' });
        break;
      }
      case 'frostArrow': {
        const pr = {
          x: p.x + Math.cos(aim) * 18, y: p.y + Math.sin(aim) * 18,
          vx: Math.cos(aim) * 760, vy: Math.sin(aim) * 760, r: 9, life: 1.5,
          from: 'player', dmgMult: 1.8, color: '#8fd8ff', weak: true, len: 26, hitSet: [], slow: 2.5, src: p,
        };
        G.projs.push(pr);
        break;
      }
      case 'flameArrow': {
        const pr = {
          x: p.x + Math.cos(aim) * 18, y: p.y + Math.sin(aim) * 18,
          vx: Math.cos(aim) * 680, vy: Math.sin(aim) * 680, r: 10, life: 1.5,
          from: 'player', dmgMult: 1.7, color: '#ff8b3d', weak: true, len: 30, hitSet: [], explode: 92, src: p,
        };
        G.projs.push(pr);
        break;
      }
      case 'windStep': {
        E.addBuff(p, { id: 'wind', name: '疾风步', dur: 6, mods: { spd: 1.35, as: 1.35 }, color: '#8fffd8' });
        p.weakBuff = 3;
        E.ring(p.x, p.y, 50, '#8fffd8', 0.4);
        break;
      }
      case 'dragonFang': {
        E.corridor(p, aim, 250, 74, 2.4, {});
        p.dashT = 0.22; p.dashDir = aim;
        E.fx('slash', { x: p.x, y: p.y, a: aim, r: 250, arc: 0.55, color: '#ff8b3d', life: 0.3, max: 0.3, corridor: true });
        break;
      }
      case 'dragonBreath': {
        E.cone(p, aim, 230, Math.PI * 0.62, 2.6, { burn: true, magic: true });
        E.fx('breath', { x: p.x, y: p.y, a: aim, r: 230, arc: Math.PI * 0.62, color: '#ff8b3d', life: 0.45, max: 0.45 });
        E.shake(9, 0.3);
        break;
      }
      case 'dragonArmor': {
        const bonus = 1.5 + Math.min(0.3, (s.mastery || 0) * 0.01);
        E.addBuff(p, { id: 'dragonArmor', name: '龙甲术', dur: 10, mods: { def: bonus }, color: '#ffb347' });
        E.ring(p.x, p.y, 60, '#ffb347', 0.5);
        break;
      }
    }
    UI.refreshHUD(true);
  };

  E.addBuff = function (p, b) {
    const ex = p.buffs.find(x => x.id === b.id);
    if (ex) { ex.t = b.dur; ex.dur = b.dur; }
    else p.buffs.push({ id: b.id, name: b.name, t: b.dur, dur: b.dur, mods: b.mods || {}, color: b.color || '#fff' });
  };

  /* 扇形伤害 */
  E.cone = function (p, aim, range, arc, mult, opts) {
    opts = opts || {};
    for (const e of E.playerTargets()) {
      if (e.dead) continue;
      const d = U.dist(p.x, p.y, e.x, e.y);
      if (d > range + e.r) continue;
      if (Math.abs(U.angDiff(aim, U.ang(p.x, p.y, e.x, e.y))) > arc / 2) continue;
      E.hit(e, mult, { weak: E.isWeakAim(e, aim, range, arc) });
      if (opts.stun) e.stun = Math.max(e.stun, opts.stun);
      if (opts.burn) e.burn = { t: 5, dmg: S.stats(p).atk * 0.18 };
      if (opts.knock) {
        const a = U.ang(p.x, p.y, e.x, e.y);
        e.x += Math.cos(a) * opts.knock; e.y += Math.sin(a) * opts.knock;
      }
    }
  };

  /* 走廊伤害 */
  E.corridor = function (p, aim, len, width, mult, opts) {
    opts = opts || {};
    for (const e of E.playerTargets()) {
      if (e.dead) continue;
      const relX = e.x - p.x, relY = e.y - p.y;
      const along = relX * Math.cos(aim) + relY * Math.sin(aim);
      const perp = Math.abs(-relX * Math.sin(aim) + relY * Math.cos(aim));
      if (along < -10 || along > len + e.r) continue;
      if (perp > width / 2 + e.r) continue;
      E.hit(e, mult, { weak: false });
      if (opts.knock) {
        e.x += Math.cos(aim) * opts.knock;
        e.y += Math.sin(aim) * opts.knock;
        e.stun = Math.max(e.stun, 0.3);
      }
    }
  };

  /* ================= 姿态 / 药水 ================= */
  E.cycleStance = function () {
    const p = G.player;
    if (p.stanceCd > 0) return;
    const order = ['attack', 'guard', 'skirmish'];
    const i = order.indexOf(p.stance);
    p.stance = order[(i + 1) % order.length];
    p.stanceCd = 1.2;
    U.toast(D.STANCES[p.stance].name, 'good');
    U.sfx('ui');
    UI.refreshHUD(true);
  };

  E.usePotion = function () {
    const p = G.player;
    if (p.potionCd > 0) { U.toast('药力尚未散去', 'bad'); return; }
    if (!p.potions.potion) { U.toast('没有金疮药了', 'bad'); return; }
    const st = S.stats(p);
    p.potions.potion--;
    p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.4);
    p.potionCd = 8;
    U.sfx('loot');
    E.addText(p.x, p.y - 30, '+' + Math.round(st.maxHp * 0.4), '#5fd18d', 16);
    E.ring(p.x, p.y, 46, '#5fd18d', 0.35);
    UI.refreshHUD(true);
  };

  /* ================= 更新循环辅助 ================= */
  E.updateFx = function (dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i];
      f.t += dt;
      if (f.type === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
      if (f.t >= f.max) G.fx.splice(i, 1);
    }
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.x += t.vx * dt;
      t.vy += 34 * dt;
      if (t.life <= 0) G.texts.splice(i, 1);
    }
    if (G.shakeT > 0) { G.shakeT -= dt; if (G.shakeT <= 0) G.shake = 0; }
  };

  return E;
})();
