/* ============ 全局状态 / 存档 / 成长 ============ */
window.G = {
  t: 0, running: false, paused: false, dead: false,
  player: null, zoneId: 'town', zone: null,
  enemies: [], allies: [], projs: [], fx: [], texts: [], loots: [],
  npcs: [], props: [], points: [], aiEnts: [],
  ai: null, chatOpen: false,
  factions: [], bounties: [], mainIdx: 0,
  log: [], cam: { x: 0, y: 0 }, shake: 0, shakeT: 0,
  spawnT: 0, factionT: 0, bountyT: 0, saveT: 0, capT: 0,
  explored: {}, flags: {}, uid: 1, slot: 1,
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  keys: {}, dialogNpc: null, nearNpc: null, nearPortal: false,
  lastHitT: 0, combo: 0, comboText: '',
  statsData: { kills: 0, deaths: 0, weak: 0, execute: 0, gold: 0 },
};

window.S = (function () {
  const S = {};

  /* ---------- 卡槽 ---------- */
  S.SLOTS = 3;
  S.slot = 1;                       // 当前卡槽
  const LEGACY_KEY = 'zongheng_save_v1';

  function uid() {
    return (window.A && A.uid && A.uid()) || 'guest';
  }
  /** 每个账号、每个卡槽一份独立本地存档 */
  function keyFor(slot) {
    return 'zh_save_' + uid() + '_' + (slot || S.slot || 1);
  }
  S.keyFor = keyFor;

  S.setSlot = function (n) {
    S.slot = Math.min(S.SLOTS, Math.max(1, (n | 0) || 1));
    G.slot = S.slot;
    return S.slot;
  };

  /** 首次进入时，把老版本的单存档搬进 1 号卡槽 */
  S.migrateLegacy = function () {
    try {
      const old = localStorage.getItem(LEGACY_KEY);
      if (!old) return false;
      if (localStorage.getItem(keyFor(1))) return false;
      localStorage.setItem(keyFor(1), old);
      // 老存档不属于任何账号，搬完就删，避免串号
      localStorage.removeItem(LEGACY_KEY);
      return true;
    } catch (e) { return false; }
  };

  /* ---------- 建立新角色 ---------- */
  S.newGame = function (clsId, name, slot) {
    if (slot) S.setSlot(slot);
    const c = D.CLASSES[clsId];
    const p = {
      kind: 'player',
      name: name || '无名散人', cls: clsId, level: 1, exp: 0, expNext: U.expFor(1),
      attr: { str: 8, vit: 8, agi: 8, int: 8 }, freePts: 0, growthAcc: { str: 0, vit: 0, agi: 0, int: 0 },
      spent: { str: 0, vit: 0, agi: 0, int: 0 },
      hp: 0, mp: 0, gold: 160, rep: 0, mount: false,
      equip: { weapon: null, head: null, chest: null, hands: null, feet: null, trinket: null },
      bag: [], potions: { potion: 3, mana: 2 }, stones: 2, gems: [],
      skills: c.skills.map((id, i) => ({ id, unlocked: i === 0, mastery: 0 })),
      skillCd: {}, stance: 'attack', stanceCd: 0, atkCd: 0,
      dashCd: 0, dashT: 0, dashDir: 0, invuln: 0,
      x: 590, y: 640, vx: 0, vy: 0, facing: 0, r: 16,
      buffs: [], factionId: null, weakBuff: 0, poisonBuff: 0,
      dead: false, respawnT: 0, kills: 0, potionCd: 0,
      unlocked: { knight: true, assassin: true, archer: true, dragon: S.dragonUnlocked() },
    };
    const st = S.stats(p);
    p.hp = st.maxHp; p.mp = st.maxMp;
    G.player = p;

    // 世界初始化
    G.factions = D.FACTIONS.map(f => ({
      id: f.id, name: f.name, trait: f.trait, color: f.color, desc: f.desc,
      strength: 1000 + U.randInt(-120, 220), gold: 2000 + U.randInt(-300, 800),
      points: U.randInt(1, 3), relation: 0, joined: false,
    }));
    G.bounties = [];
    G.mainIdx = 0;
    G.log = []; G.explored = { town: true, forest: true };
    G.statsData = { kills: 0, deaths: 0, weak: 0, execute: 0, gold: 0 };
    G.flags = {};
    G.t = 0;

    // 世界先于人：1200 个「别的玩家」先上线，再把你放进去
    if (window.AI) AI.init(0, false);

    setTimeout(() => {
      for (let i = 0; i < 3; i++) W.addBounty(true);
    }, 300);
    W.loadZone('town');
    S.save();
  };

  /* ---------- 属性结算 ---------- */
  S.stats = function (p) {
    const eq = I.totals(p);
    const st = D.STANCES[p.stance] || D.STANCES.attack;
    const cls = D.CLASSES[p.cls];

    const str = p.attr.str + (eq.str || 0);
    const vit = p.attr.vit + (eq.vit || 0);
    const agi = p.attr.agi + (eq.agi || 0);
    const int = p.attr.int + (eq.int || 0);

    let atk  = 6 + str * 2.1 + p.level * 1.5 + (eq.atk || 0);
    let mAtk = 5 + int * 2.2 + p.level * 0.9 + (eq.mAtk || 0);
    let def  = 2 + vit * 1.15 + str * 0.22 + (eq.def || 0);
    let mdef = 2 + int * 1.0 + vit * 0.2 + (eq.mdef || 0);
    let maxHp = 62 + vit * 16 + p.level * 15 + (eq.hp || 0);
    let maxMp = 30 + int * 10 + p.level * 6 + (eq.mp || 0);
    let crit = 5 + agi * 0.075 + (eq.crit || 0);
    let weakDmg = 100 + (eq.weak || 0);
    let lifesteal = (eq.life || 0);
    let as = cls.atkSpeed * (1 + agi * 0.0042 + (eq.as || 0) / 100) * st.as;
    let speed = (178 + agi * 0.95) * (1 + (eq.ms || 0) / 100) * st.spd;

    let bAtk = 1, bDef = 1, bSpd = 1, bAs = 1;
    for (const b of p.buffs) {
      if (b.mods.atk) bAtk *= b.mods.atk;
      if (b.mods.def) bDef *= b.mods.def;
      if (b.mods.spd) bSpd *= b.mods.spd;
      if (b.mods.as) bAs *= b.mods.as;
    }

    atk *= st.atk * bAtk;
    mAtk *= st.atk * bAtk;
    def *= st.def * bDef;
    mdef *= st.def * bDef;
    speed *= bSpd;
    as *= bAs;
    if (p.mount) speed *= 1.12;

    return {
      str, vit, agi, int,
      atk: Math.round(atk), mAtk: Math.round(mAtk),
      def: Math.round(def), mdef: Math.round(mdef),
      maxHp: Math.round(maxHp), maxMp: Math.round(maxMp),
      crit: U.clamp(crit, 0, 65), weakDmg: Math.round(weakDmg),
      lifesteal: Math.min(30, lifesteal), atkSpeed: Math.max(0.4, as),
      speed: Math.round(speed), dodge: Math.min(28, agi * 0.32),
    };
  };

  /* ---------- 升级 ---------- */
  S.gainExp = function (n) {
    const p = G.player;
    if (!p) return;
    p.exp += Math.round(n);
    let guard = 0;
    while (p.exp >= p.expNext && p.level < 60 && guard++ < 20) {
      p.exp -= p.expNext;
      p.level++;
      const g = D.CLASSES[p.cls].growth;
      const acc = p.growthAcc;
      for (const k in g) {
        acc[k] += g[k];
        while (acc[k] >= 1) { p.attr[k]++; acc[k] -= 1; }
      }
      if (p.level % 5 === 0) p.freePts += 5;
      p.expNext = U.expFor(p.level);
      const st = S.stats(p);
      p.hp = st.maxHp; p.mp = st.maxMp;
      U.sfx('level');
      U.toast(`升 级 · Lv.${p.level}`, 'epic');
      U.log(`你升到了 ${p.level} 级。`, 'good');
      // 解锁技能
      for (const s of p.skills) {
        const def = D.SKILLS[s.id];
        if (!s.unlocked && p.level >= def.lv) {
          s.unlocked = true;
          U.toast(`解锁技能：${def.name}`, 'epic');
          U.log(`习得新战技：${def.name}。`, 'good');
        }
      }
      // 转职 / 隐藏职业线索
      if (p.level === 10 && p.cls === 'knight') U.log('骑士可在坐骑栏驯服坐骑（本版本坐骑提供额外移速）。', 'hot');
      if (p.level === 20 && !p.unlocked.dragon) S.checkDragonUnlock();
    }
    W.checkQuest();
    UI.refreshHUD(true);
  };

  S.dragonUnlocked = function () {
    try {
      if (localStorage.getItem('zh_dragon_' + uid()) === '1') return true;
      return localStorage.getItem('zh_dragon') === '1';
    } catch (e) { return false; }
  };

  S.checkDragonUnlock = function () {
    const p = G.player;
    if (p.unlocked.dragon) return;
    if (p.level >= 20 && p.rep >= 120 && G.flags.killedGolon) {
      p.unlocked.dragon = true;
      try {
        localStorage.setItem('zh_dragon_' + uid(), '1');
        localStorage.setItem('zh_dragon', '1');
      } catch (e) {}
      U.toast('隐藏职业「龙语者」已解锁：可去训练师云老处觉醒', 'epic');
      U.log('龙语在你血脉中苏醒——隐藏职业「龙语者」已解锁。', 'good');
      setTimeout(() => U.log('训练师云老那里可以完成「觉醒」。', 'hot'), 1200);
    } else {
      U.log('你感应到一丝龙语，但条件尚未满足（20 级 / 声望 120 / 击杀黑石矿主）。', 'hot');
    }
  };

  /* ---------- 分配属性点 ---------- */
  S.addStat = function (key) {
    const p = G.player;
    if (p.freePts <= 0) return;
    if (!p.spent) p.spent = { str: 0, vit: 0, agi: 0, int: 0 };
    p.freePts--; p.attr[key]++; p.spent[key]++;
    const st = S.stats(p);
    p.hp = Math.min(p.hp + 18, st.maxHp);
    UI.refreshHUD(true);
    if (UI.currentPanel === 'char') UI.open('char');
  };

  S.resetPoints = function () {
    const p = G.player;
    if (!p.spent) p.spent = { str: 0, vit: 0, agi: 0, int: 0 };
    let total = 0;
    for (const k in p.spent) {
      p.attr[k] -= p.spent[k];
      total += p.spent[k];
      p.spent[k] = 0;
    }
    p.freePts += total;
    const st = S.stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    return total;
  };

  /* ---------- 存读档 ---------- */

  // 组装存档对象（本地存档与云存档共用）
  S.serialize = function (bagLimit) {
    const p = G.player;
    if (!p) return null;
    const bag = bagLimit ? p.bag.slice(0, bagLimit) : p.bag;
    return {
      v: 1, ts: Date.now(), slot: S.slot,
      p: {
        name: p.name, cls: p.cls, level: p.level, exp: p.exp, expNext: p.expNext,
        attr: p.attr, freePts: p.freePts, growthAcc: p.growthAcc, spent: p.spent,
        hp: p.hp, mp: p.mp, gold: p.gold, rep: p.rep, mount: p.mount,
        equip: p.equip, bag: bag, potions: p.potions, stones: p.stones, gems: p.gems,
        skills: p.skills, factionId: p.factionId, unlocked: p.unlocked,
        kills: p.kills, x: p.x, y: p.y,
      },
      zoneId: G.zoneId,
      factions: G.factions.map(f => ({ id: f.id, strength: f.strength, gold: f.gold, points: f.points, relation: f.relation, joined: f.joined })),
      bounties: G.bounties,
      mainIdx: G.mainIdx,
      explored: G.explored,
      flags: G.flags,
      statsData: G.statsData,
      log: G.log.slice(0, 12),
      ai: window.AI ? AI.serialize() : null,
      t: G.t,
    };
  };

  S.save = function () {
    if (!G.player) return false;
    const K = keyFor(S.slot);
    let data = S.serialize();
    if (!data) return false;
    try {
      localStorage.setItem(K, JSON.stringify(data));
      S.quotaWarned = false;
      if (window.C && C.autoPush && !A.guest) C.autoPush(data, S.slot);
      return true;
    } catch (e) {
      // 背包上万件时可能超出 localStorage 配额：降级保存并提示
      try {
        localStorage.setItem(K, JSON.stringify(S.serialize(3000)));
        if (!S.quotaWarned) {
          S.quotaWarned = true;
          U.toast('本地存档空间不足，本次仅保存前 3000 件背包物品。建议分解或使用云存档。', 'bad');
          U.log('本地存档超限：背包过大，已截断保存。建议使用云存档。', 'hot');
        }
        if (window.C && C.autoPush && !A.guest) C.autoPush(data, S.slot);
        return true;
      } catch (e2) { /* 隐私模式或空间彻底不足，忽略 */ }
      return false;
    }
  };

  S.hasSave = function (slot) {
    try { return !!localStorage.getItem(keyFor(slot)); } catch (e) { return false; }
  };

  S.slotInfo = function (slot) {
    try {
      const d = JSON.parse(localStorage.getItem(keyFor(slot)) || 'null');
      if (!d || !d.p) return null;
      return {
        name: d.p.name, cls: d.p.cls, level: d.p.level, zone: d.zoneId,
        ts: d.ts, bag: (d.p.bag || []).length, playtime: d.t || 0,
      };
    } catch (e) { return null; }
  };

  S.clearSlot = function (slot) {
    try { localStorage.removeItem(keyFor(slot)); } catch (e) {}
  };

  // 兼容旧调用：默认当前卡槽
  S.saveInfo = slot => S.slotInfo(slot);
  S.clearSave = slot => S.clearSlot(slot);

  // 把任意存档对象应用到当前游戏（本地读档 / 云端拉取共用）
  S.applyData = function (d) {
    if (!d || !d.p) return false;
    if (d.slot) S.setSlot(d.slot);
    const p = Object.assign({
      kind: 'player', vx: 0, vy: 0, facing: 0, r: 16, buffs: [], skillCd: {}, stance: 'attack',
      stanceCd: 0, atkCd: 0, dashCd: 0, dashT: 0, dashDir: 0, invuln: 0,
      weakBuff: 0, poisonBuff: 0, dead: false, respawnT: 0, potionCd: 0,
      gems: [], stones: 0, mount: false, spent: null,
    }, d.p);
    p.kind = 'player';
    if (!Array.isArray(p.bag)) p.bag = [];
    if (!p.gems) p.gems = [];
    if (!p.spent) p.spent = { str: 0, vit: 0, agi: 0, int: 0 };
    if (!p.growthAcc) p.growthAcc = { str: 0, vit: 0, agi: 0, int: 0 };
    // 残缺存档兜底，避免老版本 / 损坏数据把整局卡死
    if (!p.attr) p.attr = { str: 8, vit: 8, agi: 8, int: 8 };
    if (!p.equip) p.equip = { weapon: null, head: null, chest: null, hands: null, feet: null, trinket: null };
    if (!p.potions) p.potions = { potion: 3, mana: 2 };
    if (!Array.isArray(p.skills) || !p.skills.length) {
      const c = D.CLASSES[p.cls] || D.CLASSES.knight;
      p.skills = c.skills.map((id, i) => ({ id, unlocked: i === 0, mastery: 0 }));
    }
    if (!p.unlocked) p.unlocked = { knight: true, assassin: true, archer: true, dragon: S.dragonUnlocked() };
    if (!D.CLASSES[p.cls]) p.cls = 'knight';
    if (typeof p.freePts !== 'number') p.freePts = 0;
    if (!p.buffs) p.buffs = [];
    G.player = p;
    G.zoneId = d.zoneId || 'town';
    G.explored = d.explored || { town: true, forest: true };
    G.flags = d.flags || {};
    G.mainIdx = d.mainIdx || 0;
    G.factions = D.FACTIONS.map(f => {
      const sd = (d.factions || []).find(x => x.id === f.id) || {};
      return {
        id: f.id, name: f.name, trait: f.trait, color: f.color, desc: f.desc,
        strength: sd.strength != null ? sd.strength : 1000,
        gold: sd.gold != null ? sd.gold : 2000,
        points: sd.points != null ? sd.points : 1,
        relation: sd.relation || 0,
        joined: !!sd.joined,
      };
    });
    G.bounties = d.bounties || [];
    G.statsData = d.statsData || { kills: 0, deaths: 0, weak: 0, execute: 0, gold: 0 };
    G.log = d.log || [];
    G.t = d.t || 0;

    // 世界状态：AI 生态 + 离线补算（上限 72 小时）
    let away = '';
    if (window.AI) {
      if (d.ai) AI.apply(d.ai);
      else AI.init(0, false);
      if (d.ts) {
        try { away = AI.offlineCatchup((Date.now() - d.ts) / 3600000) || ''; } catch (e) {}
      }
    }

    W.loadZone(G.zoneId, true);
    UI.refreshHUD(true);
    if (away) {
      G.ai.awaySummary = away;
      setTimeout(() => U.toast(away, 'good'), 900);
      setTimeout(() => U.log(away + '。', 'hot'), 1600);
    }
    return true;
  };

  /** 读取指定卡槽的本地存档 */
  S.loadSlot = function (slot) {
    if (slot) S.setSlot(slot);
    let d;
    try { d = JSON.parse(localStorage.getItem(keyFor(S.slot)) || 'null'); } catch (e) { return false; }
    return S.applyData(d);
  };

  // 兼容旧调用
  S.load = function () { return S.loadSlot(); };

  return S;
})();
