/* ============ AI 玩家生态：需求 → 决策 → 行为 → 记忆 → 关系 ============ */
/* L1 世界层（确定性模拟）与 L2 代理层都在这里，不依赖渲染层，可脱离画面跑测试。 */
window.AI = (function () {
  const AI = {};
  const NEEDS = ['exp', 'gold', 'gear', 'fame', 'social', 'revenge', 'status', 'novelty'];
  const CAP = 11;                 // 与主线章节上限对齐
  const TOTAL_POP = 1200;         // 名义全服人数（120 个持久 Agent + 1080 影子玩家）

  /* ================= 基础 ================= */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const chance = p => rnd() < p;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const zoneName = id => (window.D && D.ZONES[id] ? D.ZONES[id].name : id);

  function st() { return G.ai; }

  /* 等级 → 该去哪个区域练级 */
  function zoneForLevel(lv) {
    if (lv < 13) return 'forest';
    if (lv < 20) return 'swamp';
    if (lv < 30) return 'rift';
    if (lv < 40) return 'glacier';
    if (lv < 50) return chance(0.65) ? 'sanctum' : 'glacier';
    if (lv < 55) return chance(0.6) ? 'sanctum' : 'capital';
    return chance(0.5) ? 'capital' : 'sanctum';
  }

  /* 真实时钟 → 在线比例（19–24 点峰值 380，凌晨 3 点谷底 40） */
  const HOUR_CURVE = [0.12, 0.09, 0.06, 0.034, 0.034, 0.04, 0.06, 0.10, 0.14, 0.17,
    0.20, 0.21, 0.22, 0.21, 0.20, 0.20, 0.22, 0.24, 0.27, 0.30, 0.317, 0.317, 0.30, 0.22];
  AI.onlineTotal = function () {
    const h = new Date().getHours();
    const base = HOUR_CURVE[h] || 0.2;
    // 加一点缓慢起伏，避免整点跳变
    const wobble = 1 + 0.06 * Math.sin((G.t || 0) / 240);
    return Math.max(28, Math.round(TOTAL_POP * base * wobble));
  };

  /* ================= 构建 ================= */
  AI.build = function (seed) {
    rnd = mulberry32(seed >>> 0);
    const agents = [];

    // 1) 手写人格卡
    for (const p of AID.PERSONAS) {
      const g = AID.guild(p.guild);
      agents.push({
        id: 'ai_' + agents.length,
        name: p.name, job: p.job, arch: p.arch, guild: g.id,
        pers: Object.assign({}, p.personality),
        skill: p.skill, cp: p.catchphrase, quirk: p.quirk, goal: p.goal,
        lv: 0, exp: 0, gold: 0, gear: 0,
        needs: {}, att: 0, trust: 0, debt: 0,
        mem: [], state: 'offline', zone: 'town',
        doing: { type: 'idle' }, claim: null,
        red: 0, kills: 0, deaths: 0,
        lastSay: -999, sayT: 0, hostT: 0, decT: 0,
        lastDecision: null, note: '',
      });
    }

    // 2) 背景玩家（同一 seed 永远生成同一批人）
    const used = new Set(agents.map(a => a.name));
    for (let guard = 0; agents.length < 120 && guard < 4000; guard++) {
      let nm = pick(AID.NAME_A) + pick(AID.NAME_B) + (chance(0.4) ? pick(AID.NAME_C) : '');
      nm += pick(AID.TITLE);
      if (used.has(nm)) continue;                 // 名字必须唯一：这是个有 1200 人的服务器
      used.add(nm);
      const jobPool = [['剑士', 'melee'], ['刺客', 'burst'], ['弓箭手', 'ranged'], ['法师', 'ranged'],
      ['骑士', 'tank'], ['狂战士', 'melee'], ['牧师', 'ranged'], ['召唤师', 'ranged']];
      const job = pick(jobPool);
      const g = chance(0.25) ? AID.guild('sanren') : pick(AID.GUILDS.slice(0, 10));
      agents.push({
        id: 'ai_' + agents.length,
        name: nm, job: job[0], arch: job[1], guild: g.id,
        pers: {
          amb: +rnd().toFixed(2), agg: +rnd().toFixed(2), soc: +rnd().toFixed(2),
          pat: +rnd().toFixed(2), hon: +rnd().toFixed(2), risk: +rnd().toFixed(2),
        },
        skill: 1 + Math.floor(rnd() * 8),
        cp: pick(['嗯', '来了', '稳', '走', '别慌', '？', '在', '哦']),
        quirk: '', goal: pick(['冲上天榜', '凑齐一套', '攒钱买坐骑', '把仇人打退服']),
        lv: 0, exp: 0, gold: 0, gear: 0,
        needs: {}, att: 0, trust: 0, debt: 0,
        mem: [], state: 'offline', zone: 'town',
        doing: { type: 'idle' }, claim: null,
        red: 0, kills: 0, deaths: 0,
        lastSay: -999, sayT: 0, hostT: 0, decT: 0,
        lastDecision: null, note: '',
      });
    }

    // 3) 初始等级：核心角色领先，背景玩家按幂分布散开
    agents.forEach((a, i) => {
      const named = i < AID.PERSONAS.length;
      a.lv = named ? clamp(14 + Math.round(rnd() * 9) + (a.skill >= 8 ? 6 : 0), 8, 34)
        : clamp(1 + Math.floor(Math.pow(rnd(), 1.7) * 32), 1, 34);
      a.exp = Math.floor(rnd() * U.expFor(a.lv));
      a.gold = Math.round((30 + a.lv * a.lv * 3) * (0.5 + rnd()));
      a.gear = Math.round(a.lv * 38 + rnd() * a.lv * 20);
      for (const n of NEEDS) a.needs[n] = Math.round(rnd() * 60 + 15);
      a.needs.exp = clamp(a.needs.exp + 20, 0, 100);
      a.zone = zoneForLevel(a.lv);
    });
    return agents;
  };

  /* ================= 初始化 / 存读档 ================= */
  AI.init = function (seed, keepOld) {
    const s = seed || ((Date.now() & 0x7fffffff) >>> 0);
    G.aiEnts = [];
    G.ai = {
      seed: s, t: 0, acc: 0, growAcc: 0, rankAcc: 0, dirAcc: 0, rumorAcc: 0, hookAcc: 0,
      agents: AI.build(s),
      chat: [], worldlog: [], rumors: [], market: {},
      tension: 20, pkRecent: 0, chatCd: 0, regionCd: 20, privCd: 40,
      // 进服序号：世界早就满员，你是较晚的那一批（永远不超过总人口）
      hooksFired: {}, entryNo: TOTAL_POP - 260 + Math.floor(rnd() * 260),
      deathBy: {}, awaySummary: '', rankCache: null, lastRumorT: -999,
      sayCount: 0, stat: { chats: 0, steals: 0, pks: 0, deaths: 0, levels: 0 },
      _dirty: true,
    };
    if (!keepOld) {
      AI.pushLog(`第 ${G.ai.entryNo} 位玩家进入灵恸——世界频道安静了半秒，然后继续吵。`, 'system');
      // 开场就把频道铺满：一个没人的世界最先露馅
      const seedNames = ['凌雪', '紫韵儿', '江湖百晓生', '冰茶', '铁马冰河', '笑三少'];
      const seedIntents = ['gossip', 'trade', 'brag', 'recruit', 'complain', 'gossip'];
      seedNames.forEach((n, i) => {
        const a = G.ai.agents.find(x => x.name === n);
        if (a) { G.ai.chatCd = 0; AI.say('world', a, seedIntents[i], { zone: 'forest' }, true); }
      });
    }
    // 初始在线状态
    AI.refreshStates();
    // 这个世界在你进来之前就已经有关于你的传闻
    if (!keepOld) {
      G.ai.agents.forEach((a, i) => {
        if (i % 9 !== 0) return;
        a.att = Math.round(rnd() * 64 - 24);
        if (a.att === 0) return;
        AI.remember(a, 'rumor',
          a.att > 0 ? '听说过你在林区打得挺准' : '听说过你在林区抢别人的怪',
          a.att > 0 ? 0.3 : -0.4, 0.4);
      });
      ['夏天', '冰茶'].forEach(n => {
        const a = G.ai.agents.find(x => x.name === n);
        if (a) { a.att = 38; AI.remember(a, 'rumor', '在城里见过你一面，觉得你人不坏', 0.4, 0.5); }
      });
      const zy = G.ai.agents.find(x => x.name === '紫韵儿');
      if (zy) { zy.att = 32; AI.remember(zy, 'rumor', '卖过你一条消息', 0.3, 0.4); }
      const la = G.ai.agents.find(x => x.name === '林傲');
      if (la) { la.att = -25; AI.remember(la, 'rumor', '听说你抢过他一只首领', -0.5, 0.5); }
    }
    // 先让每个人手上都有一件事在做，面板打开时不会全是 idle
    G.ai.agents.forEach(a => {
      if (a.state !== 'offline') a.doing = { type: AI.decide(a), since: 0 };
    });
    return G.ai;
  };

  AI.apply = function (d) {
    if (!d || !d.agents) return false;
    AI.init(d.seed || 12345, true);
    const s = G.ai;
    s.t = d.t || 0;
    s.entryNo = Math.min(TOTAL_POP, d.entryNo || s.entryNo);
    s.tension = d.tension != null ? d.tension : 20;
    s.rumors = d.rumors || [];
    s.chat = d.chat || [];
    s.worldlog = d.worldlog || [];
    s.hooksFired = d.hooks || {};
    s.deathBy = d.deathBy || {};
    d.agents.forEach((row, i) => {
      const a = s.agents[i];
      if (!a || !row) return;
      a.lv = row.lv || a.lv;
      a.exp = row.exp || 0;
      a.gold = row.gold != null ? row.gold : a.gold;
      a.gear = row.gear || a.gear;
      a.att = row.att || 0;
      a.trust = row.tr || 0;
      a.red = row.red || 0;
      a.kills = row.kills || 0;
      a.deaths = row.deaths || 0;
      a.zone = row.z || a.zone;
      a.state = row.s || 'offline';
      if (row.m && row.m.length) a.mem = row.m;
      if (row.dn) a.doing = { type: row.dn };
    });
    AI.refreshStates();
    return true;
  };

  AI.serialize = function () {
    const s = G.ai;
    if (!s) return null;
    return {
      seed: s.seed, t: Math.round(s.t), entryNo: s.entryNo, tension: Math.round(s.tension),
      hooks: s.hooksFired, deathBy: s.deathBy,
      rumors: s.rumors.slice(0, 4), chat: s.chat.slice(0, 40), worldlog: s.worldlog.slice(0, 60),
      agents: s.agents.map(a => ({
        lv: a.lv, exp: Math.round(a.exp), gold: Math.round(a.gold), gear: Math.round(a.gear),
        att: Math.round(a.att), tr: Math.round(a.trust), red: a.red,
        kills: a.kills, deaths: a.deaths, z: a.zone, s: a.state,
        dn: a.doing ? a.doing.type : 'idle',
        m: a.mem.slice(0, 5),
      })),
    };
  };

  /* ================= 在线状态 / LOD ================= */
  AI.refreshStates = function () {
    const s = st();
    if (!s) return;
    const h = new Date().getHours();
    const base = HOUR_CURVE[h] || 0.2;
    s.agents.forEach((a, i) => {
      // 核心角色几乎常驻（他们"在玩这个游戏"），背景玩家按曲线和档期
      const core = i < AID.PERSONAS.length;
      const onP = core ? 0.62 + base * 0.9 : base * 2.4;
      const key = (i * 7919 + (new Date().getDate())) % 1000 / 1000;
      const online = key < clamp(onP, 0.05, 0.96);
      if (!online) { a.state = 'offline'; return; }
      const r = (i * 31 + Math.floor((G.t || 0) / 300)) % 100;
      a.state = r < 12 ? 'idle' : r < 20 ? 'busy' : 'active';
      if (core && a.lv >= 20 && r > 90) a.state = 'dc';
    });
  };

  AI.onlineCount = function () {
    const s = st();
    if (!s) return 0;
    return s.agents.filter(a => a.state !== 'offline').length;
  };
  AI.populationView = function () {
    const now = G.t || 0;
    if (AI._popCache && now - AI._popCache.t < 1.5) return AI._popCache.v;
    // 对外展示的是「服务器规模」（按真实时钟曲线），不是本地模拟的 Agent 数
    const v = { online: AI.onlineTotal(), total: TOTAL_POP, local: AI.onlineCount() };
    AI._popCache = { t: now, v };
    return v;
  };

  /* ================= 需求 / 决策 ================= */
  function needW(a, n) {
    const p = a.pers;
    switch (n) {
      case 'exp': return 1.0 - p.amb * 0.25 + p.pat * 0.2;
      case 'gold': return 0.7 + p.amb * 0.3;
      case 'gear': return 0.5 + p.risk * 0.7;
      case 'fame': return 0.3 + p.amb * 0.8;
      case 'social': return 0.25 + p.soc * 1.3;
      case 'revenge': return p.agg * 1.6;
      case 'status': return 0.2 + p.amb * 1.4;
      case 'novelty': return 0.2 + p.risk * 0.7;
      default: return 0.5;
    }
  }

  const ACTIONS = {
    leveling: { needs: { exp: 1.0, gear: 0.35, fame: 0.15 } },
    bounty:   { needs: { gold: 0.85, fame: 0.7, exp: 0.3 } },
    boss:     { needs: { gear: 1.0, status: 0.6, fame: 0.5 } },
    trade:    { needs: { gold: 1.0, status: 0.2 } },
    social:   { needs: { social: 1.0, novelty: 0.3 } },
    chat:     { needs: { social: 0.6, status: 0.5, fame: 0.4 } },
    afk:      { needs: { novelty: 0.7, social: 0.2 } },
    pk:       { needs: { revenge: 1.2, status: 0.35 } },
    quest:    { needs: { exp: 0.6, gold: 0.55, fame: 0.5 } },
  };

  function costOf(a, act) {
    switch (act) {
      case 'boss': return 18 + a.lv * 0.8;
      case 'pk': return 26;
      case 'trade': return 6;
      case 'bounty': return 8;
      case 'quest': return 5;
      case 'afk': return -4;
      default: return 0;
    }
  }
  function opportunity(a, act) {
    const s = st();
    let b = 0;
    if (act === 'bounty' && G.bounties && G.bounties.length) b += 14;
    if (act === 'boss' && s && s.tension > 55) b += 10;
    if (act === 'pk' && s && s.pkRecent > 2) b += 8;
    if (act === 'social' && G.player && a.att > 40) b += 6;
    if (act === 'afk' && a.state === 'idle') b += 26;
    return b;
  }
  function gate(a, act) {
    const p = G.player;
    if (act === 'pk') {
      if (!p || p.level < 15) return false;       // 不欺负新手
      if (a.att > -60) return false;
      if (a.hostT > 0) return false;
      if (a.pers.agg < 0.45) return false;
      return true;
    }
    if (act === 'boss') return a.lv >= 12;
    if (act === 'trade') return a.gold > 120;
    if (act === 'bounty') return !!(G.bounties && G.bounties.length);
    if (act === 'afk') return a.state === 'idle';
    return true;
  }

  /** 效用 = Σ 需求×权重 - 成本 - 重复惩罚 + 机会 + 噪声 */
  AI.decide = function (a) {
    const last = a.doing ? a.doing.type : 'idle';
    let best = 'leveling', bestU = -1e9, detail = [];
    for (const act in ACTIONS) {
      if (!gate(a, act)) continue;
      let u = 0;
      for (const n in ACTIONS[act].needs) {
        u += (a.needs[n] / 100) * ACTIONS[act].needs[n] * needW(a, n) * 10;
      }
      u -= costOf(a, act);
      if (act === last) u -= 9;                    // 行为惯性
      const rep = a._rec || [];
      if (rep[rep.length - 1] === act) u -= 5;
      u += opportunity(a, act);
      u += (rnd() - 0.5) * 3.2;                    // σ 噪声：制造犹豫
      detail.push([act, +u.toFixed(1)]);
      if (u > bestU) { bestU = u; best = act; }
    }
    detail.sort((x, y) => y[1] - x[1]);
    a._rec = (a._rec || []).concat(best).slice(-3);
    a.lastDecision = { act: best, u: +bestU.toFixed(1), top: detail.slice(0, 4) };
    return best;
  };

  /* ================= 行为执行 ================= */
  function doAction(a) {
    const act = AI.decide(a);
    a.doing = { type: act, since: Math.round(st().t) };
    const p = G.player;

    switch (act) {
      case 'leveling':
        a.zone = zoneForLevel(a.lv);
        a.needs.exp = Math.max(0, a.needs.exp - 14);
        a.needs.gear = Math.max(0, a.needs.gear - 6);
        break;
      case 'quest':
        a.zone = zoneForLevel(a.lv);
        a.needs.exp = Math.max(0, a.needs.exp - 8);
        a.needs.gold = Math.max(0, a.needs.gold - 10);
        break;
      case 'bounty': {
        AI.claimBounty(a);
        break;
      }
      case 'boss':
        a.zone = zoneForLevel(a.lv);
        a.needs.gear = Math.max(0, a.needs.gear - 22);
        a.needs.status = Math.max(0, a.needs.status - 12);
        if (chance(0.5)) {
          AI.pushLog(`${a.name} 在${zoneName(a.zone)}开了一只首领，附近的人正在往那边赶。`, 'boss');
          if (chance(0.5)) AI.say('region', a, 'warn', { zone: a.zone });
        }
        break;
      case 'trade':
        a.gold += Math.round(a.gold * 0.02 + 12);
        a.needs.gold = Math.max(0, a.needs.gold - 20);
        a.zone = chance(0.7) ? 'town' : a.zone;
        if (chance(0.3)) AI.say('world', a, 'trade');
        break;
      case 'social':
        a.zone = chance(0.5) ? 'town' : a.zone;
        a.needs.social = Math.max(0, a.needs.social - 26);
        if (p && a.att > 35 && chance(0.35)) AI.privateTo(a, 'invite');
        break;
      case 'chat':
        a.needs.social = Math.max(0, a.needs.social - 12);
        a.needs.status = Math.max(0, a.needs.status - 8);
        AI.say(chance(0.7) ? 'world' : 'region', a, pick(['gossip', 'brag', 'complain', 'trade']));
        break;
      case 'afk':
        a.zone = 'town';
        a.needs.novelty = Math.max(0, a.needs.novelty - 18);
        break;
      case 'pk': {
        a.needs.revenge = Math.max(0, a.needs.revenge - 30);
        a.zone = G.zoneId === 'town' ? zoneForLevel(a.lv) : G.zoneId;
        AI.pushLog(`${a.name} 放话要在${zoneName(a.zone)}堵人。`, 'pvp');
        if (p && a.att < -60) AI.privateTo(a, 'taunt');
        break;
      }
    }
    return act;
  }

  /* AI 抢悬赏：这是「世界在跟我抢饭吃」的关键体验 */
  AI.claimBounty = function (a) {
    const s = st();
    if (!G.bounties || !G.bounties.length) return;
    const idx = Math.floor(rnd() * G.bounties.length);
    const b = G.bounties[idx];
    const playerInvolved = (b.prog || 0) > 0;
    G.bounties.splice(idx, 1);
    s.stat.steals++;
    if (playerInvolved) {
      a.att = clamp(a.att - 6, -100, 100);
      AI.remember(a, 'steal', `在${zoneName(b.zone)}抢了你的悬赏「${b.text}」`, -0.5, 0.6);
      AI.pushLog(`悬赏「${b.text}」被 ${a.name} 抢先交了，你这趟白跑。`, 'pvp');
      U.toast(`<b>${a.name}</b> 抢走了你正在做的悬赏`, 'bad');
    } else {
      AI.pushLog(`${a.name} 接走了悬赏「${b.text}」。`, 'ai');
    }
    a.needs.gold = Math.max(0, a.needs.gold - 18);
    a.gold += 40 + Math.floor(rnd() * 60);
    if (window.UI && UI.currentPanel === 'quests') UI.open('quests');
    if (window.W && G.bounties.length < 3) setTimeout(() => W.addBounty(true), 1200);
  };

  /* ================= 主 tick ================= */
  AI.tick = function (dt) {
    const s = st();
    if (!s || !G.player) return;
    s.t += dt;

    s.acc += dt;
    if (s.acc >= 1) {
      s.acc = 0;
      s.chatCd -= 1; s.regionCd -= 1; s.privCd -= 1;
      s.pkRecent = Math.max(0, s.pkRecent - 0.02);
      // 决策分帧：每秒推进一批 agent
      const batch = 10;
      for (let i = 0; i < batch; i++) {
        const a = s.agents[(s._rr = ((s._rr || 0) + 1)) % s.agents.length];
        if (a.state === 'offline' || a.state === 'busy') continue;
        doAction(a);
      }
      AI.maybeTalk();
      AI.runHooks();
    }

    s.growAcc += dt;
    if (s.growAcc >= 2) { const d = s.growAcc; s.growAcc = 0; AI.grow(d); }

    s.rankAcc += dt;
    if (s.rankAcc >= 25) { s.rankAcc = 0; s.rankCache = null; AI.checkPlayerRank(); }

    s.dirAcc += dt;
    if (s.dirAcc >= 40) { s.dirAcc = 0; AI.director(); }

    s.rumorAcc += dt;
    if (s.rumorAcc >= 150) { s.rumorAcc = 0; AI.makeRumor(); }

    AI.updateEnts(dt);
  };

  /* 成长：等级、金币、装备评分 */
  AI.grow = function (dt) {
    const s = st();
    const active = true;
    for (const a of s.agents) {
      if (a.state === 'offline') continue;
      a.hostT = Math.max(0, a.hostT - dt);
      const busy = a.doing && (a.doing.type === 'leveling' || a.doing.type === 'quest' || a.doing.type === 'boss');
      const need = U.expFor(clamp(a.lv, 1, 40));
      const rate = (0.55 + a.skill * 0.05) * (busy ? 1.55 : 0.5) * (a.state === 'idle' ? 0.3 : 1);
      a.exp += (need / 1600) * rate * dt;
      let guard = 0;
      while (a.lv < 40 && a.exp >= U.expFor(a.lv) && guard++ < 3) {
        a.exp -= U.expFor(a.lv);
        a.lv++;
        s.stat.levels++;
        if (a.lv % 10 === 0 && a.lv >= 20) {
          AI.pushLog(`${a.name} 升到了 ${a.lv} 级。`, 'ai');
        }
      }
      // 经济：只从产出表里拿，不凭空造钱
      if (busy) a.gold += (0.6 + a.lv * 0.05) * dt;
      a.gold *= 0.9992;                                     // 修理 / 药水 / 税
      a.gear = Math.round(a.gear * (1 + 0.0009 * dt) + (busy ? 0.9 * dt : 0));

      // 需求自然增长
      a.needs.exp = Math.min(100, a.needs.exp + 0.34 * dt);
      a.needs.gold = Math.min(100, a.needs.gold + 0.26 * dt);
      a.needs.gear = Math.min(100, a.needs.gear + 0.22 * dt);
      a.needs.fame = Math.min(100, a.needs.fame + 0.16 * dt);
      a.needs.social = Math.min(100, a.needs.social + 0.3 * dt);
      a.needs.status = Math.min(100, a.needs.status + 0.18 * dt);
      a.needs.novelty = Math.min(100, a.needs.novelty + 0.28 * dt);
      a.needs.revenge = Math.max(0, a.needs.revenge - 0.1 * dt);
      a.att = clamp(a.att + (a.att > 0 ? -0.004 : 0.004) * dt, -100, 100); // 态度缓慢回归中立
    }
    if (active && chance(0.02)) AI.refreshStates();
  };

  /* ================= 台词 ================= */
  function fill(tpl, a, ctx) {
    ctx = ctx || {};
    const zone = ctx.zone || a.zone;
    const g = AID.guild(a.guild);
    return tpl
      .replace(/\{zone\}/g, zoneName(zone))
      .replace(/\{mob\}/g, D.MONSTERS[ctx.mob] ? D.MONSTERS[ctx.mob].name : pick(['荒野狼', '腐沼人', '裂谷亚龙', '熔岩石魔']))
      .replace(/\{guild\}/g, g.name)
      .replace(/\{mat\}/g, pick(AID.MATS))
      .replace(/\{q\}/g, pick(AID.QUAL))
      .replace(/\{p\}/g, (G.player && G.player.name) || '你');
  }

  /* 说话风格后处理：短句、口癖、偶尔带个符号 */
  function stylize(text, a) {
    let t = text;
    const r = (a.id.charCodeAt(3) * 37 + Math.floor(st().t)) % 100;
    if (r < 18) t = a.cp + '，' + t;
    else if (r < 30) t = t + '　' + a.cp;
    if (r > 88) t = t.replace(/[。！]$/, '') + '…';
    if (r > 94) t = t + '？';
    if (a.pers.soc > 0.8 && r > 70) t = t + ' ' + pick(['哈', '233', '笑死', '真的']);
    return t;
  }

  AI.say = function (channel, a, intent, ctx, force) {
    const s = st();
    if (!s) return null;
    // 频率预算：世界频道全局 1 条 / 6 秒（force 用于剧情钩子）
    if (channel === 'world' && s.chatCd > 0 && !force) return null;
    if (a) {
      if (s.t - a.lastSay < 45 && !force) return null;
      a.lastSay = s.t;
    }
    const pool = AID.LINES[intent] || AID.LINES.gossip;
    let text = fill(pick(pool), a || { id: 'ai_0', cp: '', zone: 'town', pers: { soc: 0.5 } }, ctx);
    if (a) text = stylize(text, a);
    const g = a ? AID.guild(a.guild) : null;
    const msg = {
      ch: channel, text,
      name: a ? a.name : '世界', guild: g ? g.name : '',
      color: g ? g.color : '#9aa4b6', t: Math.round(s.t),
    };
    s.chat.unshift(msg);
    if (s.chat.length > 120) s.chat.pop();
    s.stat.chats++;
    if (channel === 'world') s.chatCd = 6 + rnd() * 6;
    if (window.UI && UI.chatPush) UI.chatPush(msg);
    return msg;
  };

  AI.privateTo = function (a, intent, ctx, force) {
    const s = st();
    if (!s || (s.privCd > 0 && !force)) return null;
    s.privCd = 55 + rnd() * 60;                       // 每小时被动私聊 ≤ 4 条
    const pool = AID.PRIVATE[intent] || AID.PRIVATE.invite;
    const text = fill(pick(pool), a, ctx);
    const msg = { ch: 'private', text, name: a.name, guild: AID.guild(a.guild).name, color: '#ff9fc0', t: Math.round(s.t) };
    s.chat.unshift(msg);
    if (s.chat.length > 120) s.chat.pop();
    if (window.UI && UI.chatPush) UI.chatPush(msg);
    U.toast(`<b style="color:${AID.guild(a.guild).color}">${a.name}</b> 私聊你：${U.esc(text)}`, 'epic');
    return msg;
  };

  AI.maybeTalk = function () {
    const s = st();
    const p = G.player;
    if (!p) return;
    // 区域频道：当前场景有 AI 在线才有人说话
    const local = (G.aiEnts || []).filter(e => !e.dead);
    if (s.regionCd <= 0 && local.length && chance(0.5)) {
      s.regionCd = 14 + rnd() * 14;
      const a = pick(local).agent;
      AI.say('region', a, pick(['warn', 'trade', 'complain', 'gossip']), { zone: G.zoneId });
    }
    // 主动私聊：态度高的人来搭话 / 仇人来挑衅
    if (s.privCd <= 0) {
      const cand = s.agents.filter(x => x.state === 'active' && Math.abs(x.att) > 35);
      if (cand.length && chance(0.3)) {
        const a = pick(cand);
        AI.privateTo(a, a.att > 0 ? pick(['invite', 'gift', 'ask']) : 'taunt');
      }
    }
  };

  /* ================= 记忆 / 关系 ================= */
  AI.remember = function (a, type, note, valence, salience) {
    if (!a) return;
    a.mem.unshift({ t: Math.round(st() ? st().t : G.t), type, note, val: +valence.toFixed(2), sal: salience || 0.5 });
    if (a.mem.length > 8) a.mem.pop();
  };

  AI.rel = function (a) { return { attitude: Math.round(a.att), trust: Math.round(a.trust), debt: Math.round(a.debt) }; };

  AI.adjust = function (a, delta, type, note, zone) {
    if (!a) return;
    a.att = clamp(a.att + delta, -100, 100);
    if (delta <= -20) { a.needs.revenge = Math.min(100, a.needs.revenge + Math.abs(delta) * 0.8); a.hostT = 0; }
    if (note) AI.remember(a, type || 'event', note, delta > 0 ? 0.6 : -0.8, Math.abs(delta) >= 20 ? 1 : 0.6);
  };

  AI.hostileNow = function (a) {
    const p = G.player;
    if (!p || p.level < 15) return false;      // Lv15 以下不进 PK 池
    if (a.hostT > 0) return false;
    if (a.att > -60) return false;
    if (a.pers.agg < 0.4) return false;
    return true;
  };

  /* ================= 世界日志 / 传闻 ================= */
  AI.pushLog = function (text, kind) {
    const s = st();
    if (!s) return;
    s.worldlog.unshift({ text, kind: kind || 'ai', t: Math.round(s.t) });
    if (s.worldlog.length > 200) s.worldlog.pop();
  };

  AI.makeRumor = function () {
    const s = st();
    if (!s) return;
    const top = s.agents.slice().sort((a, b) => b.lv - a.lv);
    const who = pick(top.slice(0, 12));
    const who2 = pick(top.slice(10, 30));
    const g1 = AID.guild(pick(AID.GUILDS.slice(0, 10)).id);
    let g2 = AID.guild(pick(AID.GUILDS.slice(0, 10)).id);
    if (g2.id === g1.id) g2 = AID.GUILDS[1];
    const tpl = pick(AID.RUMOR);
    const text = tpl
      .replace(/\{g1\}/g, g1.name).replace(/\{g2\}/g, g2.name)
      .replace(/\{guild\}/g, g1.name)
      .replace(/\{zone\}/g, zoneName(pick(['forest', 'swamp', 'rift', 'glacier', 'sanctum'])))
      .replace(/\{who2\}/g, who2.name).replace(/\{who\}/g, who.name)
      .replace(/\{mob\}/g, pick(['剑狼王', '裂谷之主', '黑石矿主', '幽魂古刹主']))
      .replace(/\{q\}/g, pick(AID.QUAL))
      .replace(/\{item\}/g, pick(['霜噬', '烬灭', '孤鸣', '长夜', '断岳']))
      .replace(/\{gold\}/g, (1 + Math.floor(rnd() * 9)) + '.' + Math.floor(rnd() * 9) + '万')
      .replace(/\{n\}/g, String(2 + Math.floor(rnd() * 20)));
    s.rumors.unshift({ no: (s.rumors[0] ? s.rumors[0].no + 1 : 1), lines: [text], t: Math.round(s.t) });
    if (s.rumors.length > 4) s.rumors.pop();
    AI.pushLog(`【江湖传闻·第 ${s.rumors[0].no} 期】发布了。`, 'system');
  };

  /* ================= 戏剧导演 ================= */
  AI.director = function () {
    const s = st();
    const p = G.player;
    if (!s || !p) return;

    // 张力：实力不均 + PK 频次 + 抢单压力 + 仇怨 + 服务器成熟度
    const powers = AID.GUILDS.slice(0, 10).map(g => g.power || 60);
    const sum = powers.reduce((x, y) => x + y, 0);
    powers.sort((a, b) => a - b);
    let gini = 0;
    powers.forEach((v, i) => { gini += (2 * (i + 1) - powers.length - 1) * v; });
    gini = Math.abs(gini / (powers.length * sum));
    const grudge = s.agents.filter(a => a.att < -40).length / s.agents.length;
    const pkP = Math.min(1, s.pkRecent / 5);
    const stealP = Math.min(1, s.stat.steals / 20);
    const topLv = s.agents.reduce((m, a) => Math.max(m, a.lv), 1);
    const spread = Math.min(1, Math.max(0, (topLv - 18) / 18));
    s.tension = Math.round(clamp(
      0.28 * gini * 100 + 0.24 * pkP * 100 + 0.18 * stealP * 100 +
      0.20 * grudge * 100 + 0.10 * spread * 100, 5, 100));

    const t = s.tension;
    if (t > 62 && s.t - (s._dirCdA || 0) > 180) {
      s._dirCdA = s.t;
      const g1 = pick(AID.GUILDS.slice(0, 10)), g2 = AID.GUILDS[1];
      AI.pushLog(`【宣战】${g1.name} 向 ${g2.name} 的驻地提交了掠夺令，12 小时后开战。`, 'guild');
      AI.say('world', null, 'gossip');
      U.log(`天下大乱：${g1.name} 宣战 ${g2.name}。`, 'hot');
    } else if (t > 36 && t <= 62 && s.t - (s._dirCdB || 0) > 70) {
      s._dirCdB = s.t;
      const a = pick(s.agents);
      AI.pushLog(`${a.name} 在${zoneName(a.zone)}抢了一只首领，顺便杀了两个围观的。`, 'boss');
      s.pkRecent += 1;
    } else if (t < 36 && s.t - (s._dirCdC || 0) > 90) {
      s._dirCdC = s.t;
      AI.pushLog(`城里来了个卖便宜药的商人，说是清仓。`, 'econ');
      if (chance(0.5)) AI.say('world', null, 'trade');
    }
  };

  /* ================= 排行榜 ================= */
  AI.leaderboard = function (n) {
    const s = st();
    if (!s) return [];
    if (s.rankCache) return s.rankCache.slice(0, n || 20);
    const p = G.player;
    const rows = s.agents
      .filter(a => a.state !== 'offline' || a.lv >= 25)
      .slice()
      .sort((a, b) => (b.lv - a.lv) || (b.exp - a.exp))
      .slice(0, 26)
      .map(a => ({
        id: a.id, name: a.name, lv: a.lv, job: a.job, guild: AID.guild(a.guild).name,
        gcolor: AID.guild(a.guild).color, isPlayer: false, state: a.state,
      }));
    if (p) {
      rows.push({ id: 'player', name: p.name, lv: p.level, job: D.CLASSES[p.cls].name, guild: (G.factions.find(f => f.id === p.factionId) || {}).name || '散人', gcolor: '#f0d49a', isPlayer: true, state: 'active' });
    }
    rows.sort((a, b) => b.lv - a.lv || (b.isPlayer ? -1 : 1));
    // 影子玩家填充到前 30，制造「人很多」的体感
    const shadowN = 6;
    for (let i = 0; i < shadowN; i++) {
      const lv = 26 + ((i * 7919 + s.seed) % 7);
      rows.push({ id: 'sh' + i, name: pick(AID.NAME_A) + pick(AID.NAME_B), lv, job: pick(['剑士', '法师', '刺客', '骑士']), guild: pick(AID.GUILDS.slice(0, 8)).name, gcolor: '#6b7688', isPlayer: false, state: 'offline' });
    }
    rows.sort((a, b) => b.lv - a.lv || (b.isPlayer ? -1 : 1));
    const ranked = rows.map((r, i) => Object.assign(r, { rank: i + 1 }));
    s.rankCache = ranked;
    return ranked.slice(0, n || 20);
  };

  AI.playerRank = function () {
    const list = AI.leaderboard(40);
    const me = list.find(r => r.isPlayer);
    return me ? me.rank : 99;
  };

  AI.checkPlayerRank = function () {
    const s = st();
    const p = G.player;
    if (!s || !p) return;
    const r = AI.playerRank();
    if (r <= 10 && !s.hooksFired.top10) {
      s.hooksFired.top10 = 1;
      AI.pushLog(`【天榜】${p.name} 冲进天榜前十（第 ${r} 位），全服公告。`, 'system');
      AI.say('world', null, 'gossip');
      U.toast('你冲进了天榜前十——全服都看到你的名字了', 'epic');
    }
  };

  /* ================= 首次进入钩子（4.2 脚本） ================= */
  const HOOKS = [
    { t: 25, fn: () => { AI.byName('紫韵儿', a => AI.say('world', a, 'warn', { zone: 'forest' }, true)); } },
    { t: 70, fn: () => { AI.byName('夏天', a => AI.privateTo(a, 'invite', { zone: 'forest' }, true)); AI.pushLog('夏天 邀请你组队。', 'ai'); } },
    { t: 150, fn: () => { const a = AI.byName('笑三少'); if (a) { AI.pushLog(`${a.name} 在你眼皮底下交了一单悬赏。`, 'pvp'); AI.claimBounty(a); } } },
    { t: 240, fn: () => { const a = AI.byName('林傲'); if (a) { AI.adjust(a, -65, 'pk', '在恶狼岭抢了你的首领'); a.hostT = 0; AI.privateTo(a, 'taunt', {}, true); AI.pushLog('林傲 抢了你的首领，还在世界频道挑衅。', 'pvp'); } } },
    { t: 360, fn: () => { const a = AI.byName('冰茶'); if (a) { AI.say('world', a, 'recruit', {}, true); AI.privateTo(a, 'invite', {}, true); AI.pushLog('冰茶 邀请你加入雪月。', 'guild'); } } },
    { t: 480, fn: () => { AI.pushLog('天榜更新：这一小时有 7 个人的名次变了。', 'system'); AI.say('world', null, 'brag', {}, true); } },
  ];

  AI.byName = function (name, fn) {
    const a = st().agents.find(x => x.name === name);
    if (a && fn) fn(a);
    return a;
  };

  AI.runHooks = function () {
    const s = st();
    if (!s) return;
    if (G.flags.hookOff) return;
    for (let i = 0; i < HOOKS.length; i++) {
      const h = HOOKS[i];
      if (s.hooksFired['h' + i]) continue;
      if (s.t >= h.t) {
        s.hooksFired['h' + i] = 1;
        try { h.fn(); } catch (e) { /* 单条钩子失败不影响世界 */ }
      }
    }
  };

  /* ================= 玩家事件 ================= */
  AI.onPlayerKill = function (e) {
    const s = st();
    if (!s) return;
    // 附近的 AI 会注意到你抢了他们的怪 / 杀得快
    for (const ent of (G.aiEnts || [])) {
      if (ent.dead) continue;
      if (U.dist(ent.x, ent.y, e.x, e.y) < 420 && chance(0.06)) {
        AI.adjust(ent.agent, -2, 'witness', `在${zoneName(G.zoneId)}看着你抢怪`, 0);
      }
    }
  };

  AI.onKillSteal = function (ent, e) {
    const s = st();
    if (!s || !ent) return;
    const a = ent.agent;
    s.stat.steals++;
    const gold = Math.round((6 + e.level * 4) * 0.7);
    a.gold += gold;
    a.exp += e.exp * 0.6;
    a.kills++;
    const wasMine = (e.playerDmg || 0) > 0;
    ent.bubble = { text: wasMine ? pick(['抢到了', '谢了', '这只归我']) : pick(['爆了', '又一刀', '舒服']), t: 2.6 };
    if (wasMine) {
      U.log(`<b>${a.name}</b> 抢走了你打到一半的 ${e.name}。`, 'bad');
      AI.pushLog(`${a.name} 在${zoneName(G.zoneId)}抢了 ${G.player.name} 的怪。`, 'pvp');
      AI.adjust(a, -3, 'steal', `在${zoneName(G.zoneId)}抢了你的怪`, 0);
    } else if (chance(0.3)) {
      U.log(`<b>${a.name}</b> 在你旁边清了一只 ${e.name}。`);
    }
  };

  AI.onPlayerKillAI = function (ent) {
    const s = st();
    if (!s) return;
    const a = ent.agent;
    const p = G.player;
    a.deaths++;
    s.stat.deaths++;
    AI.adjust(a, -70, 'killed', `在${zoneName(G.zoneId)}被你杀了`, 0);
    a.needs.revenge = Math.min(100, a.needs.revenge + 55);
    a.hostT = 0;
    s.stat.pks++;
    // 恶名：主动杀白名
    G.flags.evil = (G.flags.evil || 0) + 100;
    s.pkRecent += 1.5;
    if (G.flags.evil >= 300 && !s.hooksFired.redname) {
      s.hooksFired.redname = 1;
      AI.pushLog(`${p.name} 恶名值突破 300，名字变红了。`, 'pvp');
      U.toast('你现在是红名：死亡会爆装备，AI 也会主动来杀你', 'bad');
    }
    // 战利品
    const gold = Math.round(a.gold * 0.12 + 10);
    p.gold += gold;
    p.rep = Math.max(0, p.rep - 3);
    U.toast(`击杀 ${a.name}：+${gold} 金币，恶名 +100`, 'bad');
    AI.pushLog(`${p.name} 在${zoneName(G.zoneId)}击杀了 ${a.name}（${a.job} Lv.${a.lv}）。`, 'pvp');
    if (chance(0.55)) {
      const it = I.gen(clamp(a.lv, 1, 40), I.rollQuality(1.2, 1), null, p.cls);
      I.add(it, true);
    }
    // 他的会记仇
    const gA = AID.guild(a.guild);
    if (gA.id !== 'sanren') {
      const f = G.factions.find(x => x.name === gA.name);
      if (f) f.relation = clamp(f.relation - 8, -100, 100);
    }
    ent.dead = true;
    const i = G.aiEnts.indexOf(ent);
    if (i >= 0) G.aiEnts.splice(i, 1);
    E.burst(ent.x, ent.y, ent.color, 18, 240);
    U.sfx('die');
    a.state = 'offline';
    // 30 秒后在别处复活继续练级
    setTimeout(() => { if (a.state === 'offline') { a.state = 'active'; a.zone = zoneForLevel(a.lv); a.hpTip = 1; } }, 30000);
  };

  AI.onPlayerDeath = function (src) {
    const s = st();
    if (!s) return;
    if (!src || src.kind !== 'ai') return;
    const a = src.agent;
    a.kills++;
    s.stat.pks++;
    s.deathBy[a.id] = (s.deathBy[a.id] || 0) + 1;
    s.pkRecent += 1;
    AI.adjust(a, -6, 'pvp', `在${zoneName(G.zoneId)}杀了你`, 0);
    AI.pushLog(`${a.name} 在${zoneName(G.zoneId)}把 ${G.player.name} 放倒了。`, 'pvp');
    if (s.deathBy[a.id] === 3) {
      // 反挫败熔断：连续 3 次被同一人杀 → 他去别处 30 分钟，并给你线索
      a.hostT = 1800;
      a.zone = pick(['forest', 'swamp', 'rift', 'glacier', 'sanctum']);
      U.toast(`有人告诉你：${a.name} 去 ${zoneName(a.zone)} 了`, 'good');
      AI.pushLog(`${a.name} 好像暂时离开这片区域了。`, 'system');
      s.deathBy[a.id] = 0;
    }
  };

  AI.onPlayerGift = function (a, gold) {
    if (!a) return false;
    const p = G.player;
    if (p.gold < gold) { U.toast('金币不足', 'bad'); return false; }
    p.gold -= gold;
    AI.adjust(a, 8, 'gift', '你送了他一笔钱', 0);
    a.trust = clamp(a.trust + 6, 0, 100);
    U.sfx('coin');
    U.toast(`${a.name} 收了你的礼，态度 +8`, 'good');
    if (chance(0.4)) AI.privateTo(a, 'thanks');
    return true;
  };

  AI.onPlayerMessage = function (text) {
    const s = st();
    const p = G.player;
    if (!s || !p) return;
    s.chat.unshift({ ch: 'world', text, name: p.name, guild: (G.factions.find(f => f.id === p.factionId) || {}).name || '散人', color: '#f0d49a', t: Math.round(s.t), mine: true });
    if (s.chat.length > 120) s.chat.pop();
    // AI 反应：挑一个态度最高的人回你
    const cand = s.agents.filter(a => a.state !== 'offline' && a.att > 0).sort((x, y) => y.att - x.att);
    if (!cand.length) return;
    const a = cand[0];
    let intent = 'greet';
    if (/组|队|一起|带/.test(text)) intent = 'invite';
    else if (/收|卖|价|多少|买/.test(text)) intent = 'trade';
    else if (/杀|打|等着|敢/.test(text)) intent = 'taunt';
    setTimeout(() => {
      if (!G.running) return;
      const pool = intent === 'taunt' ? AID.PRIVATE.taunt : (AID.LINES[intent] || AID.LINES.greet);
      const msg = { ch: 'world', text: stylize(fill(pick(pool), a, {}), a), name: a.name, guild: AID.guild(a.guild).name, color: AID.guild(a.guild).color, t: Math.round(st().t), reply: true };
      st().chat.unshift(msg);
      if (window.UI && UI.chatPush) UI.chatPush(msg);
    }, 900 + Math.random() * 1600);
  };

  /* ================= 场景内可见 AI ================= */
  AI.onZoneEnter = function (zoneId) {
    const s = st();
    G.aiEnts = [];
    if (!s) return;
    const z = D.ZONES[zoneId];
    if (!z) return;
    const p = G.player;
    const max = z.safe ? 6 : 5;

    // 优先让本区域练级的 AI 出现，其次让仇人出现（Lv15 以上）
    const cands = s.agents.filter(a => a.state === 'active' || a.state === 'idle' || a.state === 'busy');
    const here = cands.filter(a => a.zone === zoneId);
    const hostiles = (p && p.level >= 15 && !z.safe) ? s.agents.filter(a => AI.hostileNow(a)) : [];
    const chosen = [];
    for (const a of hostiles) {
      if (chosen.length >= 2) break;
      if (chance(0.55)) chosen.push(a);
    }
    for (const a of here) {
      if (chosen.length >= max) break;
      if (chosen.indexOf(a) < 0) chosen.push(a);
    }
    // 主城保底人气：任何时候城里至少 4 个人在动
    if (z.safe) {
      const extra = s.agents.filter(a => chosen.indexOf(a) < 0 && a.state !== 'offline');
      while (chosen.length < Math.min(5, max + 1) && extra.length) {
        chosen.push(extra.splice(Math.floor(rnd() * extra.length), 1)[0]);
      }
    }

    chosen.forEach(a => {
      const ang = rnd() * 6.283;
      const dd = 160 + rnd() * 380;
      const x = clamp((p ? p.x : z.w / 2) + Math.cos(ang) * dd, 80, z.w - 80);
      const y = clamp((p ? p.y : z.h / 2) + Math.sin(ang) * dd, 80, z.h - 80);
      G.aiEnts.push(AI.makeEnt(a, x, y));
    });
    // 让他们就位到自己所属区域
    chosen.forEach(a => { a.zone = zoneId; });
  };

  AI.makeEnt = function (a, x, y) {
    const arch = AID.ARCH[a.arch] || AID.ARCH.melee;
    const g = AID.guild(a.guild);
    const lv = clamp(a.lv, 1, 40);
    const maxHp = Math.round((90 + lv * 46) * arch.hp);
    return {
      kind: 'ai', agent: a, name: a.name, job: a.job, guildName: g.id === 'sanren' ? '' : g.name,
      color: arch.color, gcolor: g.color, arch: a.arch, lv,
      x, y, r: 15, facing: rnd() * 6.283,
      hp: maxHp, maxHp, atk: 8 + lv * 3.2 * arch.atk,
      def: 4 + lv * 3.4, range: arch.range, atkSpeed: arch.atkSpeed,
      cd: rnd(), swing: 0, hitFlash: 0, noHit: 9, dead: false,
      hostile: false, provoked: false, bubble: null,
      weak: { ox: 0, oy: -9 }, weakR: 5,
      wanderA: rnd() * 6.283, wanderT: 0, target: null, stealT: 0,
      red: a.red > 0,
    };
  };

  AI.updateEnts = function (dt) {
    const p = G.player;
    if (!p || !G.aiEnts) return;
    for (let i = G.aiEnts.length - 1; i >= 0; i--) {
      const ent = G.aiEnts[i];
      if (ent.dead) { G.aiEnts.splice(i, 1); continue; }
      const a = ent.agent;
      ent.cd = Math.max(0, ent.cd - dt);
      ent.swing = Math.max(0, ent.swing - dt);
      ent.hitFlash = Math.max(0, ent.hitFlash - dt);
      ent.wanderT -= dt;
      if (ent.bubble) { ent.bubble.t -= dt; if (ent.bubble.t <= 0) ent.bubble = null; }
      ent.hostile = !(G.zone && G.zone.safe) && !!(ent.provoked || AI.hostileNow(a));
      ent.red = (G.flags.evil || 0) >= 300 && ent.hostile;

      ent.noHit += dt;
      if (ent.noHit > 6) ent.hp = Math.min(ent.maxHp, ent.hp + ent.maxHp * 0.04 * dt);

      // 1) 敌对：追玩家
      if (ent.hostile && !p.dead) {
        const d = U.dist(ent.x, ent.y, p.x, p.y);
        ent.facing = U.ang(ent.x, ent.y, p.x, p.y);
        if (d > ent.range) {
          const sp = 132 + ent.lv * 1.2;
          ent.x += Math.cos(ent.facing) * sp * dt;
          ent.y += Math.sin(ent.facing) * sp * dt;
          if (ent.arch === 'ranged') E.shoot(ent, ent.facing, { speed: 520, dmgMult: 1, color: ent.color, r: 5, len: 16 });
        } else if (ent.cd <= 0) {
          ent.cd = 1 / ent.atkSpeed;
          ent.swing = 0.18;
          if (ent.arch === 'ranged') {
            E.shoot(ent, ent.facing, { speed: 560, dmgMult: 1.25, color: ent.color, r: 6, len: 18 });
          } else {
            E.fx('slash', { x: ent.x, y: ent.y, a: ent.facing, r: 60, arc: 1.2, color: ent.color, life: 0.18, max: 0.18 });
            E.damagePlayer(ent.atk * 1.1, ent);
          }
        }
        if (d > 900) { ent.provoked = false; }
        E.resolveProps(ent, ent.r);
        continue;
      }

      // 2) 打怪：抢怪 / 抢首领
      let tgt = null, bd = 640;
      for (const e of G.enemies) {
        if (e.dead) continue;
        // 不打比自己高太多的
        if (e.level > ent.lv + 8) continue;
        const d = U.dist(ent.x, ent.y, e.x, e.y);
        if (d < bd) { bd = d; tgt = e; }
      }
      if (tgt) {
        ent.facing = U.ang(ent.x, ent.y, tgt.x, tgt.y);
        if (bd > ent.range + tgt.r) {
          const sp = 128 + ent.lv * 1.4;
          ent.x += Math.cos(ent.facing) * sp * dt;
          ent.y += Math.sin(ent.facing) * sp * dt;
        } else if (ent.cd <= 0) {
          ent.cd = 1.15 / ent.atkSpeed;
          ent.swing = 0.18;
          AI.aiHitMob(ent, tgt);
        }
      } else {
        // 3) 闲逛
        if (ent.wanderT <= 0) { ent.wanderT = 1.6 + rnd() * 2.6; ent.wanderA = rnd() * 6.283; }
        const sp = (ent.agent.state === 'idle' ? 40 : 84);
        ent.x += Math.cos(ent.wanderA) * sp * dt;
        ent.y += Math.sin(ent.wanderA) * sp * dt;
        ent.facing = ent.wanderA;
      }
      E.resolveProps(ent, ent.r);
    }

    // 偶尔让在场的 AI 冒一句气泡
    if (G.aiEnts.length && chance(0.006)) {
      const ent = pick(G.aiEnts);
      const a = ent.agent;
      const pool = ent.hostile ? AID.PRIVATE.taunt : AID.LINES[ent.target === 'idle' ? 'greet' : 'brag'];
      ent.bubble = { text: fill(pick(pool), a, { zone: G.zoneId }), t: 3.4 };
    }
  };

  AI.aiHitMob = function (ent, e) {
    const weak = ent.agent.skill >= 7 && chance(0.22);
    let dmg = ent.atk * (weak ? 2.2 : 1) * (1 - e.def / (e.def + 180)) * (0.94 + rnd() * 0.12);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hitFlash = 0.12;
    E.addText(e.x + (rnd() - 0.5) * 14, e.y - e.r - 4, U.fmt(dmg), weak ? '#ffb0ff' : '#cfe0ff', weak ? 15 : 12);
    if (weak) E.ring(e.x, e.y, e.r * 1.3, ent.color, 0.2);
    if (e.hp <= 0) E.killEnemy(e, ent);
  };

  /* ================= 离线补算 ================= */
  AI.offlineCatchup = function (hours) {
    const s = st();
    if (!s || !hours || hours < 0.15) return '';
    const h = Math.min(72, hours);
    const steps = clamp(Math.round(h * 6), 1, 72);
    let before = AI.playerRank();
    let lvGain = 0, events = 0;

    for (let k = 0; k < steps; k++) {
      for (const a of s.agents) {
        if (chance(0.35)) continue;                     // 不是每个人都 24 小时在线
        const need = U.expFor(clamp(a.lv, 1, 40));
        const gain = (need / 1600) * (0.55 + a.skill * 0.05) * 1.2 * 600;
        a.exp += gain;
        let guard = 0;
        while (a.lv < 40 && a.exp >= U.expFor(a.lv) && guard++ < 2) {
          a.exp -= U.expFor(a.lv); a.lv++; lvGain++;
        }
        a.gold += (0.6 + a.lv * 0.05) * 600 * 0.7;
        a.gear = Math.round(a.gear * 1.004);
        if (chance(0.02)) events++;
      }
      if (chance(0.6)) s.pkRecent += 0.4;
    }
    AI.refreshStates();
    s.rankCache = null;
    const after = AI.playerRank();
    const diff = after - before;
    let txt = `你离开了 ${h < 1 ? Math.round(h * 60) + ' 分钟' : h.toFixed(1) + ' 小时'}：世界里多了 ${events} 件被人记住的事`;
    if (diff > 0) txt += `，有 ${diff} 个人超过了你（你现在天榜第 ${after}）`;
    else if (diff < 0) txt += `，你反而挤掉了 ${-diff} 个人（现在第 ${after}）`;
    else txt += `，你的名次没变（第 ${after}）`;
    s.awaySummary = txt;
    AI.pushLog(txt + '。', 'system');
    if (lvGain > 0) AI.pushLog(`离线期间全服共有 ${lvGain} 次升级记录。`, 'ai');
    if (chance(0.8)) AI.makeRumor();
    return txt;
  };

  /* ================= 给 UI 的查询 ================= */
  AI.st = st;
  AI.find = function (name) { return st() ? st().agents.find(a => a.name === name) : null; };
  AI.top = function (n) {
    if (!st()) return [];
    return st().agents.slice().sort((a, b) => b.lv - a.lv).slice(0, n || 8);
  };
  AI.friends = function () {
    if (!st()) return [];
    return st().agents.filter(a => a.att > 30).sort((x, y) => y.att - x.att).slice(0, 12);
  };
  AI.enemies = function () {
    if (!st()) return [];
    return st().agents.filter(a => a.att < -20).sort((x, y) => x.att - y.att).slice(0, 12);
  };
  AI.zoneName = zoneName;

  return AI;
})();
