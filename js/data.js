/* ============ 游戏数据 ============ */
window.D = (function () {
  const D = {};

  /* ---------- 装备品质阶梯（沿用小说） ---------- */
  D.QUALITY = [
    { id: 0,  name: '粗糙品',   color: '#8d8d8d', mult: 0.62, affix: 0, sock: 0, glow: 0 },
    { id: 1,  name: '白色',     color: '#cfd6e2', mult: 1.00, affix: 0, sock: 0, glow: 0 },
    { id: 2,  name: '黑铁器',   color: '#8fa6b8', mult: 1.22, affix: 1, sock: 0, glow: 0 },
    { id: 3,  name: '青铜器',   color: '#c98b4b', mult: 1.48, affix: 1, sock: 0, glow: 0 },
    { id: 4,  name: '白银器',   color: '#dbe4f0', mult: 1.78, affix: 2, sock: 1, glow: 4 },
    { id: 5,  name: '黄金器',   color: '#f0c24b', mult: 2.14, affix: 2, sock: 1, glow: 6 },
    { id: 6,  name: '暗金器',   color: '#b06bff', mult: 2.58, affix: 3, sock: 1, glow: 8 },
    { id: 7,  name: '地器',     color: '#4fd1a5', mult: 3.10, affix: 3, sock: 2, glow: 10 },
    { id: 8,  name: '天器',     color: '#4fa8ff', mult: 3.78, affix: 4, sock: 2, glow: 12 },
    { id: 9,  name: '鬼器',     color: '#ff5d8f', mult: 4.60, affix: 4, sock: 2, glow: 14 },
    { id: 10, name: '仙器',     color: '#ffe066', mult: 5.60, affix: 5, sock: 3, glow: 16 },
    { id: 11, name: '旷世圣器', color: '#ff8b3d', mult: 6.90, affix: 5, sock: 3, glow: 20 },
    { id: 12, name: '神器',     color: '#ff3b3b', mult: 9.00, affix: 6, sock: 4, glow: 26 },
  ];

  D.SLOTS = [
    { key: 'weapon',  name: '武器', icon: '刃' },
    { key: 'head',    name: '头盔', icon: '盔' },
    { key: 'chest',   name: '胸甲', icon: '甲' },
    { key: 'hands',   name: '护手', icon: '腕' },
    { key: 'feet',    name: '战靴', icon: '靴' },
    { key: 'trinket', name: '饰品', icon: '佩' },
  ];

  D.SLOT_BASE = {
    weapon:  { atk: l => 5 + l * 3.3,                 hp: l => 0,            def: l => 0 },
    head:    { atk: l => 0,                            hp: l => 10 + l * 5,   def: l => 2 + l * 1.7 },
    chest:   { atk: l => 0,                            hp: l => 18 + l * 8,   def: l => 3 + l * 2.4 },
    hands:   { atk: l => 1 + l * 0.75,                 hp: l => 4 + l * 2,    def: l => 1.5 + l * 1.2 },
    feet:    { atk: l => 0,                            hp: l => 6 + l * 3,    def: l => 1.5 + l * 1.1 },
    trinket: { atk: l => 2 + l * 1.2,                  hp: l => 8 + l * 4,    def: l => 0 },
  };

  /* ---------- 词条池 ---------- */
  D.AFFIX = {
    atk:  { kind: 'flat', label: v => `物理攻击 +${v}`,        roll: (l, m) => Math.round((4 + l * 2.0) * m * U.rand(0.85, 1.15)) },
    def:  { kind: 'flat', label: v => `物理防御 +${v}`,        roll: (l, m) => Math.round((2 + l * 1.55) * m * U.rand(0.85, 1.15)) },
    mdef: { kind: 'flat', label: v => `魔法防御 +${v}`,        roll: (l, m) => Math.round((1.5 + l * 1.35) * m * U.rand(0.85, 1.15)) },
    hp:   { kind: 'flat', label: v => `气血上限 +${v}`,        roll: (l, m) => Math.round((14 + l * 8) * m * U.rand(0.85, 1.15)) },
    mp:   { kind: 'flat', label: v => `魔法上限 +${v}`,        roll: (l, m) => Math.round((8 + l * 4.5) * m * U.rand(0.85, 1.15)) },
    str:  { kind: 'flat', label: v => `力量 +${v}`,            roll: (l, m) => Math.max(1, Math.round((1 + l * 0.14) * m * U.rand(0.8, 1.2))) },
    vit:  { kind: 'flat', label: v => `体力 +${v}`,            roll: (l, m) => Math.max(1, Math.round((1 + l * 0.14) * m * U.rand(0.8, 1.2))) },
    agi:  { kind: 'flat', label: v => `敏捷 +${v}`,            roll: (l, m) => Math.max(1, Math.round((1 + l * 0.13) * m * U.rand(0.8, 1.2))) },
    int:  { kind: 'flat', label: v => `智力 +${v}`,            roll: (l, m) => Math.max(1, Math.round((1 + l * 0.13) * m * U.rand(0.8, 1.2))) },
    crit: { kind: 'pct',  label: v => `暴击率 +${v}%`,          roll: (l, m, q) => +(Math.min(18, U.rand(1.2, 2.8) + q * 0.35)).toFixed(1) },
    weak: { kind: 'pct',  label: v => `致命一击伤害 +${v}%`,    roll: (l, m, q) => Math.round(U.rand(5, 11) + q * 2) },
    life: { kind: 'pct',  label: v => `吸收 ${v}% 伤害为气血`,  roll: (l, m, q) => +(U.rand(3, 7) + q * 0.7).toFixed(1) },
    as:   { kind: 'pct',  label: v => `攻击速度 +${v}%`,        roll: (l, m, q) => +(U.rand(2, 5) + q * 0.5).toFixed(1) },
    ms:   { kind: 'pct',  label: v => `移动速度 +${v}%`,        roll: (l, m, q) => +(U.rand(1.5, 3.5) + q * 0.4).toFixed(1) },
  };
  D.AFFIX_KEYS = ['atk', 'def', 'mdef', 'hp', 'mp', 'str', 'vit', 'agi', 'int', 'crit', 'weak', 'life', 'as', 'ms'];

  D.PREFIX = {
    2: ['精铁', '粗铸', '猎手'],
    3: ['青铜', '烈风', '山岩'],
    4: ['白银', '霜纹', '游侠'],
    5: ['黄金', '耀日', '王庭'],
    6: ['暗金', '幽冥', '血饮'],
    7: ['地脉', '苍岩', '厚土'],
    8: ['天穹', '雷霆', '星陨'],
    9: ['鬼泣', '九幽', '修罗'],
    10: ['仙踪', '琉璃', '云梦'],
    11: ['旷世', '归墟', '太虚'],
    12: ['神铸', '开天', '鸿蒙'],
  };
  D.SUFFIX = ['之刃', '之守', '之息', '之痕', '之誓', '之怒', '之心'];

  D.BASE_NAME = {
    weapon: { knight: '长剑', assassin: '短匕', archer: '长弓', dragon: '龙牙' },
    head: ['战盔', '兜帽', '头环'],
    chest: ['胸甲', '战袍', '皮甲'],
    hands: ['护手', '腕甲', '铁腕'],
    feet: ['战靴', '轻履', '铁履'],
    trinket: ['项链', '指环', '护符'],
  };

  /* ---------- 职业 ---------- */
  D.CLASSES = {
    knight: {
      id: 'knight', name: '骑士', tag: '守御 · 重装近战', icon: '骑', color: '#6f9fe0',
      growth: { str: 2.0, vit: 2.7, agi: 1.15, int: 0.6 },
      blurb: '气血与防御最高，容错率高。10 级后驯服坐骑，兼顾快速旅行与马上战斗。',
      stars: { str: 9, vit: 12, agi: 7, int: 6 },
      melee: true, range: 82, atkSpeed: 1.0, weakBonus: 0,
      skills: ['shieldBash', 'charge', 'warCry'],
      weapon: '长剑', dmgType: 'phys',
    },
    assassin: {
      id: 'assassin', name: '刺客', tag: '爆发 · 要害猎手', icon: '刺', color: '#b06bff',
      growth: { str: 1.75, vit: 1.35, agi: 2.9, int: 0.7 },
      blurb: '移速与攻速极快，要害判定范围更大。背刺可直接制造致命窗口，脆但锋利。',
      stars: { str: 7, vit: 5, agi: 12, int: 5 },
      melee: true, range: 64, atkSpeed: 1.35, weakBonus: 0.75,
      skills: ['backstab', 'shadowStep', 'poisonBlade'],
      weapon: '短匕', dmgType: 'phys',
    },
    archer: {
      id: 'archer', name: '元素弓手', tag: '远程 · 属性克制', icon: '弓', color: '#4fd1a5',
      growth: { str: 1.3, vit: 1.55, agi: 2.6, int: 1.25 },
      blurb: '元素凝箭，无需箭矢。冰火切换打出控制与爆发，操作上限最高。',
      stars: { str: 5, vit: 6, agi: 11, int: 8 },
      melee: false, range: 520, atkSpeed: 1.15, weakBonus: 0.3,
      skills: ['frostArrow', 'flameArrow', 'windStep'],
      weapon: '长弓', dmgType: 'phys',
    },
    dragon: {
      id: 'dragon', name: '龙语者', tag: '隐藏 · 全能近战', icon: '龙', color: '#ff8b3d',
      growth: { str: 2.6, vit: 2.3, agi: 1.85, int: 1.65 },
      blurb: '同时拥有龙系战技与龙语魔法，四维成长极高。需 20 级、声望 120、击败黑石矿主方可觉醒。',
      stars: { str: 12, vit: 10, agi: 9, int: 8 },
      melee: true, range: 88, atkSpeed: 1.05, weakBonus: 0.35,
      skills: ['dragonFang', 'dragonBreath', 'dragonArmor'],
      weapon: '龙牙', dmgType: 'phys', hidden: true,
    },
  };

  /* ---------- 技能 ---------- */
  D.SKILLS = {
    shieldBash: { id: 'shieldBash', name: '盾击', icon: '盾', lv: 1,  cd: 6,  mp: 10, cls: 'knight',
      desc: '前方扇形 1.8 倍伤害并击晕 1.2 秒。坚守姿态下伤害再 +40%。' },
    charge:     { id: 'charge',     name: '冲锋', icon: '冲', lv: 5,  cd: 9,  mp: 15, cls: 'knight',
      desc: '向前突进，撞击路径上所有敌人造成 2.2 倍伤害并击退。' },
    warCry:     { id: 'warCry',     name: '战吼', icon: '吼', lv: 10, cd: 18, mp: 20, cls: 'knight',
      desc: '8 秒内攻击 +25%、物理防御 +30%。' },

    backstab:   { id: 'backstab',   name: '背刺', icon: '刺', lv: 1,  cd: 7,  mp: 12, cls: 'assassin',
      desc: '瞬移至最近敌人身后，造成 3 倍伤害且必定命中要害。' },
    shadowStep: { id: 'shadowStep', name: '影袭', icon: '影', lv: 5,  cd: 8,  mp: 14, cls: 'assassin',
      desc: '向前突进并留下残影，路径敌人受到 1.6 倍伤害。' },
    poisonBlade:{ id: 'poisonBlade',name: '毒刃', icon: '毒', lv: 10, cd: 14, mp: 16, cls: 'assassin',
      desc: '8 秒内每次命中附加中毒，每秒造成 12% 攻击力的伤害，可叠加 5 层。' },

    frostArrow: { id: 'frostArrow', name: '冰霜箭', icon: '冰', lv: 1,  cd: 5,  mp: 10, cls: 'archer',
      desc: '射出凝冰之箭，1.8 倍伤害并使目标减速 45%，持续 2.5 秒。' },
    flameArrow: { id: 'flameArrow', name: '火焰箭', icon: '焰', lv: 5,  cd: 7,  mp: 15, cls: 'archer',
      desc: '射出爆裂火箭，命中后爆炸，对范围内敌人造成 1.7 倍伤害。' },
    windStep:   { id: 'windStep',   name: '疾风步', icon: '风', lv: 10, cd: 16, mp: 18, cls: 'archer',
      desc: '6 秒内移速 +35%、攻速 +35%，接下来 3 次攻击必定命中要害。' },

    dragonFang: { id: 'dragonFang', name: '龙牙突', icon: '牙', lv: 1,  cd: 7,  mp: 14, cls: 'dragon',
      desc: '龙形突进穿透敌人，造成 2.4 倍伤害。' },
    dragonBreath:{ id: 'dragonBreath', name: '龙语·焚天', icon: '焚', lv: 5, cd: 12, mp: 26, cls: 'dragon',
      desc: '喷吐龙息，前方大范围 2.6 倍魔法伤害并点燃目标。' },
    dragonArmor:{ id: 'dragonArmor', name: '龙甲术', icon: '甲', lv: 10, cd: 22, mp: 24, cls: 'dragon',
      desc: '10 秒内防御 +60%。熟练度越高，加成越强。' },
  };

  /* ---------- 姿态 ---------- */
  D.STANCES = {
    attack: { id: 'attack', name: '进攻姿态', atk: 1.25, def: 0.80, spd: 1.00, as: 1.00, color: '#ff8b6b',
      desc: '伤害 +25%，防御 -20%' },
    guard:  { id: 'guard',  name: '坚守姿态', atk: 0.75, def: 1.65, spd: 0.86, as: 0.95, color: '#6f9fe0',
      desc: '防御 +65%，移速 -14%' },
    skirmish:{ id: 'skirmish', name: '游击姿态', atk: 0.90, def: 1.00, spd: 1.22, as: 1.12, color: '#4fd1a5',
      desc: '移速 +22%，攻速 +12%，伤害 -10%' },
  };

  /* ==========================================================
     怪物模板
     ---------------------------------
     数值口径：这里的 hp/atk 是「1 级基础值」，
     E.spawnEnemy 再按刷怪等级放大（hp ×(1+(lv-1)*0.34)，atk ×(1+(lv-1)*0.40)）。
     beh 里是怪物的行为标签，由 entities.js 解释：
       ranged 远程 / charge 冲锋 / poison 中毒 / slow 减速
       cleave 横扫 / summon 召唤 / heal 治疗 / blink 瞬移
       splash 范围弹 / enrage 残血狂暴 / shield 护盾
     ========================================================== */
  const M = (id, name, shape, color, hp, atk, o) => Object.assign({
    id, name, shape, color, hp, atk,
    r: 15, speed: 120, range: 40, rate: 1.0,
    exp: Math.round(hp * 0.24 + atk), aggro: 270,
  }, o || {});

  D.MONSTERS = {
    /* -------- 清风林地 Lv.1–12 -------- */
    wolf:       M('wolf', '荒野狼', 'beast', '#8894a6', 46, 6.5, { r: 15, speed: 134, range: 36, rate: 1.15, exp: 11, aggro: 250 }),
    bandit:     M('bandit', '流窜山贼', 'humanoid', '#b08060', 64, 8, { r: 16, speed: 108, range: 44, rate: 0.85, exp: 14, aggro: 260 }),
    boar:       M('boar', '铁鬃野猪', 'beast', '#96705a', 96, 11, { r: 19, speed: 120, range: 42, rate: 0.7, exp: 18, aggro: 240, charge: true, beh: { charge: true } }),
    wolfGrey:   M('wolfGrey', '灰背狼', 'beast', '#6f7f96', 70, 8, { r: 14, speed: 152, range: 34, rate: 1.3, exp: 15, aggro: 330, beh: { pack: true } }),
    banditBow:  M('banditBow', '山贼弓手', 'humanoid', '#a07a55', 60, 9, { r: 15, speed: 102, range: 300, rate: 0.62, exp: 16, aggro: 350, ranged: true, beh: { ranged: true } }),
    treant:     M('treant', '幼木妖', 'golem', '#4f7a58', 150, 10, { r: 22, speed: 66, range: 46, rate: 0.62, exp: 26, aggro: 220, beh: { cleave: true } }),
    wasp:       M('wasp', '毒刺蜂', 'spider', '#b0a04a', 52, 7, { r: 12, speed: 176, range: 32, rate: 1.45, exp: 13, aggro: 340, beh: { poison: true } }),

    /* -------- 浅水沼泽 Lv.12–20 -------- */
    lizard:     M('lizard', '沼泽蜥', 'lizard', '#5f8f6a', 118, 13, { r: 17, speed: 118, range: 42, rate: 1.0, exp: 24, aggro: 280 }),
    bogman:     M('bogman', '腐沼人', 'humanoid', '#6b7f5a', 156, 15, { r: 19, speed: 92, range: 46, rate: 0.75, exp: 30, aggro: 250 }),
    spider:     M('spider', '毒囊蛛', 'spider', '#7a5f9a', 98, 12, { r: 16, speed: 148, range: 40, rate: 1.1, exp: 26, aggro: 300, beh: { poison: true } }),
    croc:       M('croc', '泥沼鳄', 'lizard', '#4f7a62', 210, 17, { r: 24, speed: 104, range: 50, rate: 0.8, exp: 40, aggro: 265, charge: true, beh: { charge: true } }),
    wisp:       M('wisp', '腐沼鬼火', 'imp', '#6fd1a0', 96, 16, { r: 14, speed: 112, range: 280, rate: 0.9, exp: 30, aggro: 350, ranged: true, beh: { ranged: true, poison: true } }),
    toad:       M('toad', '毒瘴蟾', 'beast', '#6a8a4a', 180, 14, { r: 20, speed: 80, range: 44, rate: 0.7, exp: 34, aggro: 240, beh: { poison: true } }),
    bogPriest:  M('bogPriest', '沼祭司', 'humanoid', '#7a9a6a', 140, 16, { r: 17, speed: 96, range: 300, rate: 0.7, exp: 36, aggro: 330, ranged: true, beh: { ranged: true, heal: true } }),

    /* -------- 赤焰海 Lv.20–30 -------- */
    golem:      M('golem', '熔岩石魔', 'golem', '#8a5a4a', 340, 24, { r: 26, speed: 72, range: 52, rate: 0.6, exp: 62, aggro: 230, beh: { cleave: true } }),
    fireImp:    M('fireImp', '炎魔小鬼', 'imp', '#d06a3a', 182, 22, { r: 15, speed: 132, range: 330, rate: 0.75, exp: 50, aggro: 350, ranged: true, beh: { ranged: true } }),
    drake:      M('drake', '裂谷亚龙', 'lizard', '#c25a4a', 290, 30, { r: 23, speed: 124, range: 54, rate: 0.95, exp: 72, aggro: 300 }),
    salamander: M('salamander', '熔火蜥', 'lizard', '#bf6a3a', 240, 26, { r: 20, speed: 128, range: 46, rate: 1.0, exp: 58, aggro: 300, beh: { poison: true } }),
    ember:      M('ember', '炎灵', 'imp', '#ff9b3d', 170, 28, { r: 14, speed: 118, range: 340, rate: 0.85, exp: 58, aggro: 360, ranged: true, beh: { ranged: true, splash: true } }),
    hound:      M('hound', '岩浆猎犬', 'beast', '#a04a32', 260, 27, { r: 18, speed: 150, range: 40, rate: 1.1, exp: 60, aggro: 340, charge: true, beh: { charge: true } }),
    flamePriest:M('flamePriest', '炎裔祭司', 'humanoid', '#c9803a', 320, 30, { r: 20, speed: 88, range: 320, rate: 0.7, exp: 80, aggro: 330, ranged: true, beh: { ranged: true, summon: true } }),

    /* -------- 霜语冰原 Lv.30–40 -------- */
    iceWolf:    M('iceWolf', '霜牙狼', 'beast', '#9fd8ff', 380, 40, { r: 17, speed: 150, range: 38, rate: 1.15, exp: 94, aggro: 330 }),
    frostGiant: M('frostGiant', '霜巨人', 'golem', '#a8c8e0', 900, 48, { r: 30, speed: 70, range: 60, rate: 0.55, exp: 155, aggro: 260, beh: { cleave: true } }),
    iceWraith:  M('iceWraith', '冰魄', 'imp', '#bfe8ff', 420, 46, { r: 18, speed: 100, range: 300, rate: 0.85, exp: 112, aggro: 340, ranged: true, beh: { ranged: true, slow: true } }),
    yeti:       M('yeti', '雪魈', 'humanoid', '#c8d8e8', 720, 52, { r: 26, speed: 104, range: 54, rate: 0.8, exp: 132, aggro: 300, charge: true, beh: { charge: true } }),
    frostSpider:M('frostSpider', '冰晶蛛', 'spider', '#8fc8e8', 350, 38, { r: 17, speed: 140, range: 42, rate: 1.05, exp: 90, aggro: 320, beh: { poison: true, slow: true } }),
    iceDrake:   M('iceDrake', '冰翼亚龙', 'lizard', '#7fb8d8', 660, 50, { r: 24, speed: 126, range: 56, rate: 0.9, exp: 138, aggro: 310 }),
    sentinel:   M('sentinel', '霜卫', 'golem', '#b0c8d8', 820, 46, { r: 24, speed: 84, range: 50, rate: 0.7, exp: 142, aggro: 280, beh: { shield: true } }),

    /* -------- 幻灵秘境 Lv.40–50 -------- */
    phantom:    M('phantom', '幻影', 'humanoid', '#c9a3ff', 480, 56, { r: 16, speed: 160, range: 40, rate: 1.2, exp: 152, aggro: 360, beh: { blink: true } }),
    runeGuard:  M('runeGuard', '符文守卫', 'golem', '#9f8fd8', 560, 60, { r: 28, speed: 78, range: 58, rate: 0.6, exp: 212, aggro: 260, beh: { shield: true, cleave: true } }),
    soulWisp:   M('soulWisp', '幽魂', 'imp', '#a8b8ff', 460, 62, { r: 16, speed: 116, range: 320, rate: 0.85, exp: 162, aggro: 360, ranged: true, beh: { ranged: true } }),
    mirror:     M('mirror', '镜中人', 'humanoid', '#d0c0ff', 520, 58, { r: 20, speed: 124, range: 48, rate: 0.95, exp: 192, aggro: 320, beh: { blink: true } }),
    dreamEater: M('dreamEater', '食梦兽', 'beast', '#8f7fc8', 540, 56, { r: 24, speed: 118, range: 50, rate: 0.9, exp: 208, aggro: 300 }),
    sanctumPriest:M('sanctumPriest', '秘境祭司', 'humanoid', '#bfa3ff', 500, 64, { r: 18, speed: 92, range: 310, rate: 0.75, exp: 188, aggro: 340, ranged: true, beh: { ranged: true, heal: true } }),

    /* -------- 副本杂兵 -------- */
    mineGuard:  M('mineGuard', '黑石守卫', 'golem', '#5f6b7d', 260, 20, { r: 22, speed: 96, range: 50, rate: 0.8, exp: 40, aggro: 280 }),
    mineBat:    M('mineBat', '矿洞蝠', 'spider', '#6a5f7a', 88, 14, { r: 14, speed: 170, range: 38, rate: 1.3, exp: 26, aggro: 320 }),
    boneKnight: M('boneKnight', '白骨骑士', 'humanoid', '#c8c8b0', 520, 30, { r: 21, speed: 104, range: 48, rate: 0.9, exp: 76, aggro: 300, beh: { cleave: true } }),
    ghostMonk:  M('ghostMonk', '幽魂僧', 'imp', '#9fe0d0', 380, 34, { r: 17, speed: 120, range: 320, rate: 0.8, exp: 70, aggro: 340, ranged: true, beh: { ranged: true, heal: true } }),
    murloc:     M('murloc', '海族战士', 'humanoid', '#4fb0b8', 520, 72, { r: 18, speed: 124, range: 46, rate: 1.0, exp: 232, aggro: 320 }),
    deepPriest: M('deepPriest', '深海祭司', 'humanoid', '#5fc8d0', 480, 80, { r: 18, speed: 96, range: 320, rate: 0.75, exp: 246, aggro: 340, ranged: true, beh: { ranged: true, heal: true } }),
    shark:      M('shark', '深渊鲨', 'lizard', '#3f9aa8', 580, 86, { r: 26, speed: 150, range: 54, rate: 0.9, exp: 302, aggro: 340, charge: true, beh: { charge: true } }),
    moonAcolyte:M('moonAcolyte', '月神侍者', 'humanoid', '#d9d3ff', 600, 92, { r: 18, speed: 112, range: 330, rate: 0.85, exp: 322, aggro: 340, ranged: true, beh: { ranged: true, slow: true } }),
    moonBeast:  M('moonBeast', '月兽', 'beast', '#c0b8f0', 650, 96, { r: 25, speed: 126, range: 52, rate: 1.0, exp: 362, aggro: 320 }),
    avalonGuard:M('avalonGuard', '阿瓦隆守卫', 'golem', '#e8d8a8', 800, 120, { r: 30, speed: 86, range: 60, rate: 0.7, exp: 522, aggro: 300, beh: { shield: true, cleave: true } }),
    royalGuard: M('royalGuard', '王城禁卫', 'humanoid', '#d8c090', 720, 100, { r: 20, speed: 116, range: 50, rate: 0.95, exp: 402, aggro: 310 }),
    shadow:     M('shadow', '暗影刺客', 'humanoid', '#8f7fc8', 640, 110, { r: 16, speed: 170, range: 42, rate: 1.3, exp: 332, aggro: 360, beh: { blink: true } }),

    /* -------- BOSS（12 只） -------- */
    boss_swordwolf: M('boss_swordwolf', '剑狼王', 'boss', '#9fb8d8', 1200, 24, { r: 38, speed: 112, range: 70, rate: 0.85, exp: 520, aggro: 420, boss: true, beh: { charge: true, cleave: true, enrage: true } }),
    boss_golon: M('boss_golon', '黑石矿主·戈隆', 'boss', '#8d5b3d', 2600, 42, { r: 44, speed: 84, range: 78, rate: 0.75, exp: 900, aggro: 480, boss: true, beh: { summon: 'mineBat', cleave: true } }),
    boss_lava:  M('boss_lava', '裂谷之主·炎殇', 'boss', '#b23a2e', 4200, 52, { r: 48, speed: 92, range: 84, rate: 0.8, exp: 1600, aggro: 500, boss: true, beh: { summon: 'fireImp', splash: true, enrage: true } }),
    boss_bog:   M('boss_bog', '腐沼之主·泥菩萨', 'boss', '#5f8a5a', 6000, 30, { r: 42, speed: 80, range: 74, rate: 0.7, exp: 760, aggro: 440, boss: true, beh: { summon: 'toad', poison: true } }),
    boss_ghost: M('boss_ghost', '幽魂古刹·枯禅', 'boss', '#8fd8c0', 5200, 44, { r: 42, speed: 88, range: 76, rate: 0.75, exp: 1100, aggro: 460, boss: true, beh: { summon: 'ghostMonk', heal: true } }),
    boss_ash:   M('boss_ash', '灰烬之龙', 'boss', '#c26a3a', 5200, 56, { r: 46, speed: 96, range: 80, rate: 0.8, exp: 1800, aggro: 500, boss: true, beh: { splash: true, summon: 'ember', enrage: true } }),
    boss_ice:   M('boss_ice', '冰霜之翼·龙骨', 'boss', '#9fd8ff', 6800, 64, { r: 50, speed: 94, range: 86, rate: 0.78, exp: 2800, aggro: 520, boss: true, beh: { slow: true, summon: 'iceWraith', cleave: true } }),
    boss_undersea: M('boss_undersea', '海底之城·亚特兰斯', 'boss', '#4fbfd0', 7000, 78, { r: 48, speed: 92, range: 84, rate: 0.8, exp: 4000, aggro: 520, boss: true, beh: { splash: true, summon: 'murloc' } }),
    boss_illusion: M('boss_illusion', '幻灵·无相', 'boss', '#c9a3ff', 8000, 80, { r: 46, speed: 104, range: 82, rate: 0.85, exp: 4200, aggro: 520, boss: true, beh: { blink: true, summon: 'phantom' } }),
    boss_moon:  M('boss_moon', '月神殿·月读', 'boss', '#d9d3ff', 8000, 95, { r: 52, speed: 96, range: 86, rate: 0.82, exp: 5200, aggro: 540, boss: true, beh: { slow: true, heal: true, splash: true } }),
    boss_avalon: M('boss_avalon', '阿瓦隆·圣裁', 'boss', '#ffd166', 13000, 110, { r: 56, speed: 90, range: 90, rate: 0.8, exp: 7000, aggro: 560, boss: true, beh: { cleave: true, splash: true, enrage: true } }),
    boss_king:  M('boss_king', '王者之都·摄政王', 'boss', '#e0b45c', 13000, 100, { r: 50, speed: 100, range: 84, rate: 0.85, exp: 6500, aggro: 520, boss: true, beh: { summon: 'royalGuard', cleave: true } }),
  };

  /* ---------- 区域 ----------
     8 大区域（2 主城 + 6 野外）+ 6 副本，对应 PRD 3.2 / 13 章。
     landmarks 只做视觉与导航；elites 是固定刷点的有名精英；boss 为区域首领。
     hazard 交给 world.js 的区域机制解释。
     ---------------------------------------------------------- */
  D.ZONES = {
    town: {
      id: 'town', name: '落霞村', sub: '安全区 · 主城', lv: [1, 5], need: 0, w: 1180, h: 860, safe: true,
      ground: '#1c2230', ground2: '#222a3a', accent: '#c9a35c', theme: 'town',
      spawns: [],
      npcs: [
        { id: 'shop',   name: '阿福',   title: '杂货商', x: 505, y: 520, color: '#d0a95f' },
        { id: 'smith',  name: '老铁',   title: '铁匠',   x: 722, y: 484, color: '#b06b3d' },
        { id: 'trainer',name: '云老',   title: '训练师', x: 408, y: 676, color: '#6f9fe0' },
        { id: 'board',  name: '任务板', title: '悬赏',   x: 848, y: 664, color: '#c9a35c' },
        { id: 'envoy',  name: '使者·墨', title: '势力',  x: 308, y: 472, color: '#b06bff' },
      ],
      portal: { x: 980, y: 720, to: 'forest', name: '林区界门' },
      buildings: [
        { x: 430, y: 400, w: 150, h: 90, c: '#2b3346' },
        { x: 640, y: 350, w: 160, h: 100, c: '#2b3346' },
        { x: 340, y: 550, w: 140, h: 95, c: '#2b3346' },
        { x: 780, y: 520, w: 130, h: 110, c: '#2b3346' },
        { x: 250, y: 360, w: 120, h: 80, c: '#2b3346' },
      ],
      landmarks: [{ x: 590, y: 660, name: '村口传送阵', kind: 'gate' }],
    },

    forest: {
      id: 'forest', name: '清风林地', sub: 'Lv.1 - 12 · 恶狼岭与鬼王坡', lv: [1, 12], need: 0, w: 1900, h: 1400,
      ground: '#16241c', ground2: '#1c2e23', accent: '#4fd1a5', theme: 'forest',
      spawns: [{ id: 'wolf', w: 5 }, { id: 'bandit', w: 3 }, { id: 'boar', w: 2 }, { id: 'wolfGrey', w: 3 }, { id: 'wasp', w: 2 }, { id: 'banditBow', w: 2 }, { id: 'treant', w: 1 }],
      elitePool: ['独眼山贼', '林间屠夫', '铁鬃猪王', '断刃流寇'],
      elites: [
        { id: 'bandit', name: '独眼山贼', lv: 11, x: 0.72, y: 0.34 },
        { id: 'boar',   name: '铁鬃猪王', lv: 10, x: 0.34, y: 0.62 },
        { id: 'treant', name: '林间屠夫', lv: 12, x: 0.58, y: 0.78 },
      ],
      boss: { id: 'boss_swordwolf', x: 0.82, y: 0.22, name: '剑狼王巢穴', world: true },
      resources: ['林间药圃', '古树祭坛'],
      landmarks: [
        { x: 0.82, y: 0.22, name: '剑狼王巢穴', kind: 'lair' },
        { x: 0.26, y: 0.3, name: '恶狼岭', kind: 'ruin' },
        { x: 0.5, y: 0.82, name: '鬼王坡', kind: 'shrine' },
      ],
      portal: { x: 120, y: 1260, to: 'town', name: '回城界门' },
    },

    swamp: {
      id: 'swamp', name: '浅水沼泽', sub: 'Lv.12 - 20 · 腐气弥漫', lv: [12, 20], need: 12, w: 2100, h: 1600,
      ground: '#141d20', ground2: '#1b262a', accent: '#4fd1a5', theme: 'swamp',
      spawns: [{ id: 'lizard', w: 4 }, { id: 'bogman', w: 3 }, { id: 'spider', w: 3 }, { id: 'croc', w: 2 }, { id: 'toad', w: 2 }, { id: 'wisp', w: 2 }, { id: 'bogPriest', w: 1 }],
      elitePool: ['沼泽霸主', '腐毒母巢', '泥沼巨鳄'],
      elites: [
        { id: 'bogman', name: '沼泽霸主', lv: 19, x: 0.66, y: 0.36 },
        { id: 'spider', name: '腐毒母巢', lv: 20, x: 0.28, y: 0.72 },
        { id: 'croc',   name: '泥沼巨鳄', lv: 18, x: 0.74, y: 0.76 },
      ],
      boss: { id: 'boss_bog', x: 0.5, y: 0.5, name: '腐沼深潭', world: true },
      hazard: { type: 'miasma', name: '腐气', dps: 0.0055, purify: '古树祭坛' },
      resources: ['灵石矿脉', '腐沼祭坛', '毒菇林'],
      landmarks: [
        { x: 0.5, y: 0.5, name: '腐沼深潭', kind: 'lair' },
        { x: 0.2, y: 0.26, name: '枯木海岸', kind: 'shrine', purify: true },
        { x: 0.8, y: 0.2, name: '毒菇林', kind: 'ruin' },
      ],
      portal: { x: 120, y: 1440, to: 'town', name: '回城界门' },
    },

    mine: {
      id: 'mine', name: '黑石矿洞', sub: '副本 · 推荐 Lv.15 · 首个五人大本', lv: [15, 18], need: 15, w: 1500, h: 1200,
      ground: '#151a22', ground2: '#1b212c', accent: '#8fa6b8', theme: 'mine', dungeon: true,
      spawns: [{ id: 'mineBat', w: 4 }, { id: 'mineGuard', w: 5 }],
      elites: [{ id: 'mineGuard', name: '矿洞监工', lv: 18, x: 0.62, y: 0.5 }],
      boss: { id: 'boss_golon', x: 0.8, y: 0.26, name: '矿脉核心' },
      resources: ['玄铁矿脉'],
      landmarks: [{ x: 0.8, y: 0.26, name: '矿脉核心', kind: 'lair' }],
      portal: { x: 120, y: 1080, to: 'town', name: '离开矿洞' },
    },

    rift: {
      id: 'rift', name: '赤焰海', sub: 'Lv.20 - 30 · 熔岩与亚龙群', lv: [20, 30], need: 20, w: 2200, h: 1700,
      ground: '#251315', ground2: '#2e1719', accent: '#ff8b3d', theme: 'rift',
      spawns: [{ id: 'golem', w: 3 }, { id: 'fireImp', w: 3 }, { id: 'drake', w: 3 }, { id: 'salamander', w: 2 }, { id: 'hound', w: 2 }, { id: 'ember', w: 2 }, { id: 'flamePriest', w: 1 }],
      elitePool: ['熔岩守卫', '裂谷暴君', '炎裔大祭司'],
      elites: [
        { id: 'golem', name: '熔岩守卫', lv: 28, x: 0.3, y: 0.34 },
        { id: 'drake', name: '裂谷暴君', lv: 30, x: 0.72, y: 0.64 },
        { id: 'flamePriest', name: '炎裔大祭司', lv: 29, x: 0.5, y: 0.8 },
      ],
      boss: { id: 'boss_ash', x: 0.6, y: 0.3, name: '灰烬之巢', world: true },
      hazard: { type: 'lava', name: '熔岩池', dps: 0.022 },
      resources: ['熔火矿脉', '炎晶洞窟', '火岩祭坛'],
      landmarks: [
        { x: 0.6, y: 0.3, name: '灰烬之巢', kind: 'lair' },
        { x: 0.22, y: 0.7, name: '熔岩裂口', kind: 'crystal' },
        { x: 0.8, y: 0.2, name: '炎晶洞窟', kind: 'ruin' },
      ],
      portal: { x: 120, y: 1540, to: 'town', name: '回城界门' },
    },

    lavaRift: {
      id: 'lavaRift', name: '炎殇深渊', sub: '副本 · 推荐 Lv.20 · 裂谷之主的巢穴', lv: [20, 26], need: 20, w: 1600, h: 1300,
      ground: '#1c1114', ground2: '#241417', accent: '#ff3b3b', theme: 'rift', dungeon: true,
      spawns: [{ id: 'drake', w: 4 }, { id: 'fireImp', w: 3 }, { id: 'salamander', w: 3 }, { id: 'hound', w: 2 }],
      elites: [{ id: 'salamander', name: '熔心蜥王', lv: 25, x: 0.4, y: 0.66 }],
      boss: { id: 'boss_lava', x: 0.8, y: 0.26, name: '深渊祭坛' },
      resources: ['炎晶'],
      landmarks: [{ x: 0.8, y: 0.26, name: '深渊祭坛', kind: 'lair' }],
      portal: { x: 120, y: 1180, to: 'town', name: '离开深渊' },
    },

    ghost: {
      id: 'ghost', name: '幽魂古刹', sub: '副本 · 推荐 Lv.25 · 枯禅的禅房', lv: [25, 28], need: 25, w: 1700, h: 1300,
      ground: '#141a1c', ground2: '#1a2226', accent: '#7fd6c0', theme: 'ghost', dungeon: true,
      spawns: [{ id: 'boneKnight', w: 4 }, { id: 'ghostMonk', w: 4 }, { id: 'mineBat', w: 2 }],
      elites: [{ id: 'boneKnight', name: '古刹主持', lv: 28, x: 0.44, y: 0.58 }],
      boss: { id: 'boss_ghost', x: 0.8, y: 0.24, name: '枯禅禅房' },
      resources: ['骨灰'],
      landmarks: [{ x: 0.8, y: 0.24, name: '枯禅禅房', kind: 'lair' }, { x: 0.3, y: 0.4, name: '残钟', kind: 'shrine' }],
      portal: { x: 120, y: 1180, to: 'town', name: '离开古刹' },
    },

    glacier: {
      id: 'glacier', name: '霜语冰原', sub: 'Lv.30 - 40 · 暴风雪与冰面', lv: [30, 40], need: 30, w: 2300, h: 1800,
      ground: '#131b26', ground2: '#1a2533', accent: '#8fd8ff', theme: 'ice',
      spawns: [{ id: 'iceWolf', w: 4 }, { id: 'frostSpider', w: 2 }, { id: 'iceWraith', w: 2 }, { id: 'yeti', w: 2 }, { id: 'frostGiant', w: 1 }, { id: 'iceDrake', w: 2 }, { id: 'sentinel', w: 1 }],
      elitePool: ['霜巨人王', '冰魄女妖', '雪魈头领'],
      elites: [
        { id: 'frostGiant', name: '霜巨人王', lv: 40, x: 0.34, y: 0.3 },
        { id: 'iceWraith', name: '冰魄女妖', lv: 38, x: 0.68, y: 0.5 },
        { id: 'yeti', name: '雪魈头领', lv: 39, x: 0.5, y: 0.78 },
      ],
      boss: { id: 'boss_ice', x: 0.78, y: 0.24, name: '龙骨冰窟', world: true },
      hazard: { type: 'blizzard', name: '暴风雪', every: 100, dur: 20, slow: 0.72 },
      resources: ['寒铁矿脉', '霜语祭坛', '冰芯'],
      landmarks: [
        { x: 0.78, y: 0.24, name: '龙骨冰窟', kind: 'lair' },
        { x: 0.2, y: 0.62, name: '霜语祭坛', kind: 'shrine', purify: true },
        { x: 0.62, y: 0.86, name: '断冰裂隙', kind: 'crystal' },
      ],
      portal: { x: 120, y: 1640, to: 'town', name: '回城界门' },
    },

    undersea: {
      id: 'undersea', name: '海底之城·亚特兰蒂斯', sub: '主线副本 · 推荐 Lv.45', lv: [45, 48], need: 45, w: 1900, h: 1500,
      ground: '#0e1a24', ground2: '#122331', accent: '#4fd1e5', theme: 'undersea', dungeon: true,
      spawns: [{ id: 'murloc', w: 4 }, { id: 'deepPriest', w: 2 }, { id: 'shark', w: 3 }],
      elites: [{ id: 'shark', name: '深海领主', lv: 48, x: 0.5, y: 0.6 }],
      boss: { id: 'boss_undersea', x: 0.8, y: 0.24, name: '海王殿' },
      resources: ['深海珍珠'],
      landmarks: [{ x: 0.8, y: 0.24, name: '海王殿', kind: 'lair' }, { x: 0.24, y: 0.68, name: '沉船残骸', kind: 'ruin' }],
      portal: { x: 120, y: 1340, to: 'town', name: '浮上海面' },
    },

    sanctum: {
      id: 'sanctum', name: '幻灵秘境', sub: 'Lv.40 - 50 · 结界与幻灵', lv: [40, 50], need: 40, w: 2200, h: 1700,
      ground: '#191426', ground2: '#201933', accent: '#b06bff', theme: 'sanctum',
      spawns: [{ id: 'phantom', w: 4 }, { id: 'soulWisp', w: 3 }, { id: 'runeGuard', w: 2 }, { id: 'mirror', w: 2 }, { id: 'dreamEater', w: 2 }, { id: 'sanctumPriest', w: 1 }],
      elitePool: ['幻灵守卫', '镜中我', '食梦魇'],
      elites: [
        { id: 'runeGuard', name: '幻灵守卫', lv: 50, x: 0.34, y: 0.32 },
        { id: 'mirror', name: '镜中我', lv: 48, x: 0.7, y: 0.58 },
      ],
      hazard: { type: 'runes', name: '结界符文', count: 3 },
      boss: { id: 'boss_illusion', x: 0.5, y: 0.18, name: '幻灵神殿', world: true, gated: true },
      resources: ['幻灵晶', '灵脉'],
      landmarks: [
        { x: 0.5, y: 0.18, name: '幻灵神殿', kind: 'gate' },
        { x: 0.24, y: 0.72, name: '残破结界', kind: 'rune' },
        { x: 0.78, y: 0.36, name: '镜湖', kind: 'shrine' },
      ],
      portal: { x: 120, y: 1540, to: 'town', name: '回城界门' },
    },

    illusion: {
      id: 'illusion', name: '幻灵结界', sub: '机制副本 · 推荐 Lv.48', lv: [48, 50], need: 48, w: 1800, h: 1400,
      ground: '#1a1428', ground2: '#221a36', accent: '#d9a3ff', theme: 'sanctum', dungeon: true,
      spawns: [{ id: 'phantom', w: 4 }, { id: 'soulWisp', w: 3 }, { id: 'mirror', w: 3 }],
      elites: [{ id: 'mirror', name: '镜中之主', lv: 50, x: 0.42, y: 0.6 }],
      boss: { id: 'boss_illusion', x: 0.8, y: 0.24, name: '无相之厅' },
      hazard: { type: 'runes', name: '结界符文', count: 3 },
      resources: ['无相砂'],
      landmarks: [{ x: 0.8, y: 0.24, name: '无相之厅', kind: 'lair' }],
      portal: { x: 120, y: 1240, to: 'town', name: '离开结界' },
    },

    moon: {
      id: 'moon', name: '月神殿', sub: '十人团本 · 推荐 Lv.55', lv: [55, 58], need: 55, w: 2000, h: 1600,
      ground: '#141a2a', ground2: '#1a2136', accent: '#d9d3ff', theme: 'moon', dungeon: true,
      spawns: [{ id: 'moonAcolyte', w: 4 }, { id: 'moonBeast', w: 4 }, { id: 'soulWisp', w: 2 }],
      elites: [{ id: 'moonAcolyte', name: '月神大祭司', lv: 58, x: 0.44, y: 0.54 }],
      boss: { id: 'boss_moon', x: 0.8, y: 0.22, name: '月读祭坛' },
      resources: ['月华'],
      landmarks: [{ x: 0.8, y: 0.22, name: '月读祭坛', kind: 'lair' }, { x: 0.28, y: 0.7, name: '望月台', kind: 'shrine' }],
      portal: { x: 120, y: 1440, to: 'town', name: '离开月神殿' },
    },

    capital: {
      id: 'capital', name: '王者之都', sub: '安全区 · 主城 · 攻城战', lv: [50, 60], need: 45, w: 1400, h: 1000, safe: true,
      ground: '#1e1a16', ground2: '#26211a', accent: '#e0b45c', theme: 'capital',
      spawns: [],
      npcs: [
        { id: 'shop',    name: '金掌柜', title: '王都商会', x: 560, y: 560, color: '#e0b45c' },
        { id: 'smith',   name: '铸师·玄', title: '王都铁匠', x: 800, y: 500, color: '#c98b4b' },
        { id: 'trainer', name: '教习·白', title: '二转导师', x: 420, y: 700, color: '#6f9fe0' },
        { id: 'board',   name: '王榜',   title: '悬赏',   x: 900, y: 700, color: '#e0b45c' },
        { id: 'envoy',   name: '执政使', title: '攻城',   x: 300, y: 480, color: '#b06bff' },
      ],
      portal: { x: 1150, y: 800, to: 'town', name: '传送阵' },
      buildings: [
        { x: 380, y: 330, w: 190, h: 120, c: '#2f2a22' },
        { x: 640, y: 290, w: 210, h: 130, c: '#332d24' },
        { x: 300, y: 520, w: 160, h: 110, c: '#2b2620' },
        { x: 860, y: 470, w: 170, h: 130, c: '#2b2620' },
        { x: 1000, y: 640, w: 150, h: 100, c: '#2b2620' },
        { x: 200, y: 300, w: 140, h: 90, c: '#2b2620' },
      ],
      landmarks: [
        { x: 700, y: 760, name: '王都广场', kind: 'gate' },
        { x: 1150, y: 320, name: '阿瓦隆神迹', kind: 'portal' },
      ],
    },

    avalon: {
      id: 'avalon', name: '阿瓦隆神迹', sub: '终局副本 · 推荐 Lv.60', lv: [60, 60], need: 60, w: 2100, h: 1600,
      ground: '#1d1a12', ground2: '#262115', accent: '#ffd166', theme: 'avalon', dungeon: true,
      spawns: [{ id: 'avalonGuard', w: 4 }, { id: 'royalGuard', w: 3 }, { id: 'shadow', w: 3 }],
      elites: [{ id: 'avalonGuard', name: '阿瓦隆骑士长', lv: 60, x: 0.42, y: 0.5 }],
      boss: { id: 'boss_avalon', x: 0.8, y: 0.22, name: '圣裁王座' },
      resources: ['神性碎片'],
      landmarks: [{ x: 0.8, y: 0.22, name: '圣裁王座', kind: 'lair' }, { x: 0.24, y: 0.3, name: '神迹之门', kind: 'portal' }],
      portal: { x: 120, y: 1440, to: 'town', name: '离开神迹' },
    },
  };

  /* 地图面板顺序：主城 → 逐级野外 → 副本 */
  D.ZONE_ORDER = ['town', 'forest', 'swamp', 'mine', 'rift', 'lavaRift', 'ghost', 'glacier', 'sanctum', 'illusion', 'undersea', 'moon', 'capital', 'avalon'];

  /* 世界地图坐标（面板用，0–1000 × 0–520） */
  D.MAP_POS = {
    town:     { x: 74,  y: 300 },
    forest:   { x: 186, y: 248 },
    swamp:    { x: 300, y: 300 },
    mine:     { x: 286, y: 418 },
    rift:     { x: 432, y: 262 },
    lavaRift: { x: 430, y: 424 },
    ghost:    { x: 520, y: 340 },
    glacier:  { x: 612, y: 208 },
    sanctum:  { x: 684, y: 352 },
    illusion: { x: 772, y: 452 },
    undersea: { x: 800, y: 286 },
    moon:     { x: 892, y: 396 },
    capital:  { x: 884, y: 190 },
    avalon:   { x: 962, y: 292 },
  };

  /* 地图连线（世界地图面板用） */
  D.ZONE_LINK = [
    ['town', 'forest'], ['forest', 'swamp'], ['swamp', 'mine'], ['swamp', 'rift'],
    ['rift', 'lavaRift'], ['rift', 'ghost'], ['ghost', 'glacier'], ['glacier', 'sanctum'],
    ['sanctum', 'illusion'], ['sanctum', 'undersea'], ['undersea', 'moon'],
    ['moon', 'capital'], ['capital', 'avalon'],
  ];

  /* ---------- AI 势力 ---------- */
  D.FACTIONS = [
    { id: 'canqiong', name: '苍穹公会', trait: '激进扩张', color: '#6f9fe0',
      desc: '老牌霸主，信奉以战养战。成员在野外极为活跃，见到资源点必抢。' },
    { id: 'yexing',  name: '夜行商盟', trait: '投机取巧', color: '#c9a35c',
      desc: '不做亏本买卖。垄断材料市场，也乐于向散人出售消息与情报。' },
    { id: 'xueyi',   name: '血衣楼',   trait: '稳健经营', color: '#b06bff',
      desc: '杀手组织出身，行事低调而致命。与其为敌的人往往活不过三个夜晚。' },
    { id: 'longmen', name: '龙门',     trait: '稳健经营', color: '#4fd1a5',
      desc: '由散人抱团而成的新兴势力，对散人态度友善，但根基尚浅。' },
  ];

  /* ---------- 主线任务 ---------- */
  D.MAIN_QUESTS = [
    { id: 'm1', title: '初入林区', desc: '出城后先拿荒野狼练手。记住：瞄准头部，要害一击能直接处决同级小怪。',
      obj: { type: 'kill', target: 'wolf', count: 5 }, reward: { exp: 110, gold: 70, rep: 4 } },
    { id: 'm2', title: '老玩家的直觉', desc: '把等级提到 5 级。升级后每 5 级会获得自由属性点。',
      obj: { type: 'level', value: 5 }, reward: { exp: 160, gold: 120, rep: 5, item: { q: 3, slot: 'weapon' } } },
    { id: 'm3', title: '独眼山贼', desc: '林区深处有名精英山贼，悬赏已久。精英无法被要害处决，但要害会打出巨额伤害与硬直。',
      obj: { type: 'elite', name: '独眼山贼', count: 1 }, reward: { exp: 420, gold: 260, rep: 12, item: { q: 4, slot: 'chest' } } },
    { id: 'm4', title: '沼泽的邀请', desc: '浅水沼泽的腐气会持续侵蚀气血，站在净化点里能缓一口气。清掉 8 只沼泽蜥，探明道路。',
      obj: { type: 'kill', target: 'lizard', count: 8 }, reward: { exp: 700, gold: 380, rep: 14 } },
    { id: 'm5', title: '十二级', desc: '把等级推到 12 级。黑石矿洞的门槛就在眼前。',
      obj: { type: 'level', value: 12 }, reward: { exp: 900, gold: 500, rep: 15, item: { q: 5, slot: 'weapon' } } },
    { id: 'm6', title: '黑石矿主', desc: '进入黑石矿洞（地图可直达），击杀矿主戈隆。它守着通往更高处的建帮令。',
      obj: { type: 'boss', target: 'boss_golon', count: 1 }, reward: { exp: 1400, gold: 900, rep: 60, item: { q: 6, slot: 'weapon' } } },
    { id: 'm7', title: '天下之势', desc: '单打独斗走不远。选择一方势力，把好感度做到 30 以上。',
      obj: { type: 'relation', value: 30 }, reward: { exp: 1200, gold: 700, rep: 40 } },
    { id: 'm8', title: '十八级', desc: '赤焰海的亚龙已经开始成群活动，把等级提到 18。',
      obj: { type: 'level', value: 18 }, reward: { exp: 2200, gold: 1100, rep: 30 } },
    { id: 'm9', title: '裂谷试炼', desc: '斩杀 10 只裂谷亚龙，让裂谷记住你的名字。',
      obj: { type: 'kill', target: 'drake', count: 10 }, reward: { exp: 3000, gold: 1500, rep: 45, item: { q: 7, slot: 'chest' } } },
    { id: 'm10', title: '传说之路', desc: '达到 22 级，并在炎殇深渊击败裂谷之主·炎殇。深渊之后还有更冷的地方。',
      obj: { type: 'boss2', target: 'boss_lava', level: 22, count: 1 }, reward: { exp: 6000, gold: 4000, rep: 150, item: { q: 9, slot: 'weapon' } } },
    { id: 'm11', title: '霜语之门', desc: '白霜从北面压下来。达到 30 级，去霜语冰原看看——那里的冰面滑得站不住脚。',
      obj: { type: 'level', value: 30 }, reward: { exp: 12000, gold: 5000, rep: 60 } },
    { id: 'm12', title: '冰原的爪痕', desc: '霜语冰原有东西在暴风雪里猎食。清掉 12 只霜牙狼。',
      obj: { type: 'kill', target: 'iceWolf', count: 12 }, reward: { exp: 18000, gold: 7000, rep: 80, item: { q: 7, slot: 'chest' } } },
    { id: 'm13', title: '冰霜之翼', desc: '龙骨冰窟里躺着一条死过一次的龙。击败冰霜之翼·龙骨，拿走它的翼骨。',
      obj: { type: 'boss', target: 'boss_ice', count: 1 }, reward: { exp: 40000, gold: 14000, rep: 140, item: { q: 8, slot: 'weapon' } } },
    { id: 'm14', title: '灵脉深处', desc: '幻灵秘境的结界挡住了去路。达到 40 级，点亮三座符文柱，再进神殿。',
      obj: { type: 'level', value: 40 }, reward: { exp: 30000, gold: 11000, rep: 100 } },
    { id: 'm15', title: '无相之厅', desc: '幻灵结界里有一个和你一模一样的人。进本，击败幻灵·无相。',
      obj: { type: 'boss', target: 'boss_illusion', count: 1 }, reward: { exp: 70000, gold: 24000, rep: 180, item: { q: 9, slot: 'chest' } } },
    { id: 'm16', title: '海底的城', desc: '幻灵泪的线索沉在海底。达到 45 级，进亚特兰蒂斯，击败亚特兰斯。',
      obj: { type: 'boss2', target: 'boss_undersea', level: 45, count: 1 }, reward: { exp: 110000, gold: 36000, rep: 220, item: { q: 9, slot: 'weapon' } } },
    { id: 'm17', title: '月神殿祭', desc: '月神殿的祭典要开始了。达到 55 级，在月读祭坛击败月读。',
      obj: { type: 'boss2', target: 'boss_moon', level: 55, count: 1 }, reward: { exp: 200000, gold: 60000, rep: 300, item: { q: 10, slot: 'weapon' } } },
    { id: 'm18', title: '阿瓦隆神迹', desc: '王者之都的摄政王守不住神迹之门了。达到 60 级，进阿瓦隆，接受圣裁。',
      obj: { type: 'boss2', target: 'boss_avalon', level: 60, count: 1 }, reward: { exp: 400000, gold: 120000, rep: 500, item: { q: 10, slot: 'chest' } } },
  ];

  /* ---------- 悬赏模板 ---------- */
  D.BOUNTY = {
    forest: [
      { type: '清剿', text: '林区狼患', target: 'wolf', count: 6, reward: { gold: 90, exp: 70, rep: 3 } },
      { type: '清剿', text: '驱赶流寇', target: 'bandit', count: 6, reward: { gold: 110, exp: 85, rep: 4 } },
      { type: '猎杀', text: '铁鬃野猪', target: 'boar', count: 3, reward: { gold: 130, exp: 95, rep: 5 } },
      { type: '清剿', text: '灰背狼成群', target: 'wolfGrey', count: 8, reward: { gold: 150, exp: 110, rep: 5 } },
    ],
    swamp: [
      { type: '清剿', text: '沼泽蜥泛滥', target: 'lizard', count: 8, reward: { gold: 220, exp: 200, rep: 6 } },
      { type: '猎杀', text: '腐沼人巢穴', target: 'bogman', count: 6, reward: { gold: 260, exp: 240, rep: 7 } },
      { type: '清剿', text: '毒囊蛛清剿', target: 'spider', count: 8, reward: { gold: 240, exp: 220, rep: 6 } },
      { type: '猎杀', text: '泥沼巨鳄', target: 'croc', count: 3, reward: { gold: 300, exp: 280, rep: 8 } },
    ],
    rift: [
      { type: '猎杀', text: '石魔威胁', target: 'golem', count: 5, reward: { gold: 460, exp: 480, rep: 10 } },
      { type: '清剿', text: '炎魔小鬼', target: 'fireImp', count: 7, reward: { gold: 500, exp: 520, rep: 11 } },
      { type: '猎杀', text: '亚龙踪迹', target: 'drake', count: 6, reward: { gold: 560, exp: 580, rep: 12 } },
      { type: '猎杀', text: '岩浆猎犬', target: 'hound', count: 6, reward: { gold: 620, exp: 640, rep: 13 } },
    ],
    glacier: [
      { type: '猎杀', text: '霜牙狼群', target: 'iceWolf', count: 8, reward: { gold: 900, exp: 980, rep: 18 } },
      { type: '猎杀', text: '霜巨人清扫', target: 'frostGiant', count: 3, reward: { gold: 1250, exp: 1300, rep: 22 } },
      { type: '猎杀', text: '冰魄索命', target: 'iceWraith', count: 6, reward: { gold: 1100, exp: 1180, rep: 20 } },
    ],
    sanctum: [
      { type: '猎杀', text: '幻影清除', target: 'phantom', count: 8, reward: { gold: 1500, exp: 1650, rep: 26 } },
      { type: '猎杀', text: '符文守卫', target: 'runeGuard', count: 3, reward: { gold: 1900, exp: 2000, rep: 30 } },
      { type: '猎杀', text: '镜中人', target: 'mirror', count: 5, reward: { gold: 1750, exp: 1880, rep: 28 } },
    ],
  };

  /* ---------- 商品 ---------- */
  D.SHOP = [
    { id: 'potion', name: '金疮药', icon: '药', desc: '立即恢复 40% 气血。战斗中按 F 使用。', price: 35, type: 'potion' },
    { id: 'mana',   name: '凝神散', icon: '神', desc: '立即恢复 50% 魔法值。', price: 30, type: 'mana' },
    { id: 'stone',  name: '强化石', icon: '石', desc: '装备强化的必需材料，也可通过分解装备获得。', price: 80, type: 'stone' },
    { id: 'gem_ruby',  name: '烈焰宝石 Lv.1', icon: '红', desc: '镶嵌后物理攻击 +12。', price: 260, type: 'gem', gem: 'ruby', glevel: 1 },
    { id: 'gem_jade',  name: '翡翠宝石 Lv.1', icon: '绿', desc: '镶嵌后气血上限 +80。', price: 240, type: 'gem', gem: 'jade', glevel: 1 },
    { id: 'gem_sapp',  name: '冰蓝宝石 Lv.1', icon: '蓝', desc: '镶嵌后魔法防御 +10。', price: 220, type: 'gem', gem: 'sapp', glevel: 1 },
    { id: 'gem_topaz', name: '黄玉宝石 Lv.1', icon: '黄', desc: '镶嵌后暴击率 +2%。', price: 300, type: 'gem', gem: 'topaz', glevel: 1 },
  ];

  D.GEMS = {
    ruby:  { name: '烈焰宝石', color: '#ff6b5b', stat: 'atk',  per: 12,  label: v => `物理攻击 +${v}` },
    jade:  { name: '翡翠宝石', color: '#4fd1a5', stat: 'hp',   per: 80,  label: v => `气血上限 +${v}` },
    sapp:  { name: '冰蓝宝石', color: '#6fa8ff', stat: 'mdef', per: 10,  label: v => `魔法防御 +${v}` },
    topaz: { name: '黄玉宝石', color: '#f0c24b', stat: 'crit', per: 2,   label: v => `暴击率 +${v}%` },
  };

  /* ---------- 强化 ---------- */
  D.ENHANCE = {
    max: 15,
    gainPerLevel: 0.07,
    cost(lv) { return { gold: Math.round(40 * Math.pow(lv, 1.7)), stone: 1 + Math.floor(lv / 3) }; },
    rate(lv) { return Math.max(0.28, 0.95 - lv * 0.055); },
  };

  return D;
})();
