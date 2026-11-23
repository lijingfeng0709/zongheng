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

  /* ---------- 怪物模板 ---------- */
  D.MONSTERS = {
    wolf:      { id: 'wolf',      name: '荒野狼',   shape: 'beast',    color: '#8894a6', r: 15, speed: 134, hp: 46,  atk: 6.5, range: 36, rate: 1.15, exp: 11, aggro: 250 },
    bandit:    { id: 'bandit',    name: '流窜山贼', shape: 'humanoid', color: '#b08060', r: 16, speed: 108, hp: 64,  atk: 8,   range: 44, rate: 0.85, exp: 14, aggro: 260 },
    boar:      { id: 'boar',      name: '铁鬃野猪', shape: 'beast',    color: '#96705a', r: 19, speed: 120, hp: 96,  atk: 11,  range: 42, rate: 0.7,  exp: 18, aggro: 240, charge: true },
    lizard:    { id: 'lizard',    name: '沼泽蜥',   shape: 'lizard',   color: '#5f8f6a', r: 17, speed: 118, hp: 118, atk: 13,  range: 42, rate: 1.0,  exp: 24, aggro: 280 },
    bogman:    { id: 'bogman',    name: '腐沼人',   shape: 'humanoid', color: '#6b7f5a', r: 19, speed: 92,  hp: 156, atk: 15,  range: 46, rate: 0.75, exp: 30, aggro: 250 },
    spider:    { id: 'spider',    name: '毒囊蛛',   shape: 'spider',   color: '#7a5f9a', r: 16, speed: 148, hp: 98,  atk: 12,  range: 40, rate: 1.1,  exp: 26, aggro: 300, poison: true },
    golem:     { id: 'golem',     name: '熔岩石魔', shape: 'golem',    color: '#8a5a4a', r: 26, speed: 72,  hp: 340, atk: 24,  range: 52, rate: 0.6,  exp: 62, aggro: 230 },
    fireImp:   { id: 'fireImp',   name: '炎魔小鬼', shape: 'imp',      color: '#d06a3a', r: 15, speed: 132, hp: 182, atk: 22,  range: 330, rate: 0.75, exp: 50, aggro: 350, ranged: true },
    drake:     { id: 'drake',     name: '裂谷亚龙', shape: 'lizard',   color: '#c25a4a', r: 23, speed: 124, hp: 290, atk: 30,  range: 54, rate: 0.95, exp: 72, aggro: 300 },
    mineGuard: { id: 'mineGuard', name: '黑石守卫', shape: 'golem',    color: '#5f6b7d', r: 22, speed: 96,  hp: 260, atk: 20,  range: 50, rate: 0.8,  exp: 40, aggro: 280 },
    mineBat:   { id: 'mineBat',   name: '矿洞蝠',   shape: 'spider',   color: '#6a5f7a', r: 14, speed: 170, hp: 88,  atk: 14,  range: 38, rate: 1.3,  exp: 26, aggro: 320 },
    boss_golon:{ id: 'boss_golon',name: '黑石矿主·戈隆', shape: 'boss', color: '#8d5b3d', r: 44, speed: 84, hp: 2600, atk: 42, range: 78, rate: 0.75, exp: 900, aggro: 480, boss: true },
    boss_lava: { id: 'boss_lava', name: '裂谷之主·炎殇', shape: 'boss', color: '#b23a2e', r: 48, speed: 92, hp: 4200, atk: 52, range: 84, rate: 0.8, exp: 1600, aggro: 500, boss: true },
  };

  /* ---------- 区域 ---------- */
  D.ZONES = {
    town: {
      id: 'town', name: '落霞城', sub: '安全区 · 主城', lv: [1, 99], w: 1180, h: 860, safe: true,
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
    },
    forest: {
      id: 'forest', name: '新手林区', sub: 'Lv.1 - 5 · 散人起步', lv: [1, 5], w: 1800, h: 1300,
      ground: '#16241c', ground2: '#1c2e23', accent: '#4fd1a5', theme: 'forest',
      spawns: [{ id: 'wolf', w: 6 }, { id: 'bandit', w: 4 }, { id: 'boar', w: 2 }],
      eliteNames: ['独眼山贼', '林间屠夫'],
      portal: { x: 120, y: 1160, to: 'town', name: '回城界门' },
    },
    swamp: {
      id: 'swamp', name: '幽暗沼泽', sub: 'Lv.6 - 12 · 腐气弥漫', lv: [6, 12], w: 2000, h: 1500,
      ground: '#141d20', ground2: '#1b262a', accent: '#4fd1a5', theme: 'swamp',
      spawns: [{ id: 'lizard', w: 5 }, { id: 'bogman', w: 4 }, { id: 'spider', w: 4 }],
      eliteNames: ['沼泽霸主', '腐毒母巢'],
      portal: { x: 120, y: 1340, to: 'town', name: '回城界门' },
    },
    rift: {
      id: 'rift', name: '熔岩裂谷', sub: 'Lv.13 - 20 · 高温禁地', lv: [13, 20], w: 2000, h: 1500,
      ground: '#20161a', ground2: '#2a1a1c', accent: '#ff8b3d', theme: 'rift',
      spawns: [{ id: 'golem', w: 4 }, { id: 'fireImp', w: 4 }, { id: 'drake', w: 4 }],
      eliteNames: ['熔岩守卫', '裂谷暴君'],
      portal: { x: 120, y: 1340, to: 'town', name: '回城界门' },
    },
    mine: {
      id: 'mine', name: '黑石矿洞', sub: '副本 · 推荐 Lv.10+', lv: [10, 14], w: 1500, h: 1200,
      ground: '#151a22', ground2: '#1b212c', accent: '#8fa6b8', theme: 'mine', dungeon: true,
      spawns: [{ id: 'mineBat', w: 4 }, { id: 'mineGuard', w: 5 }],
      boss: 'boss_golon',
      portal: { x: 120, y: 1080, to: 'town', name: '离开矿洞' },
    },
    lavaRift: {
      id: 'lavaRift', name: '炎殇深渊', sub: '终局副本 · 推荐 Lv.20+', lv: [20, 26], w: 1600, h: 1300,
      ground: '#1c1114', ground2: '#241417', accent: '#ff3b3b', theme: 'rift', dungeon: true,
      spawns: [{ id: 'drake', w: 5 }, { id: 'fireImp', w: 5 }],
      boss: 'boss_lava',
      portal: { x: 120, y: 1180, to: 'town', name: '离开深渊' },
    },
  };
  D.ZONE_ORDER = ['town', 'forest', 'swamp', 'rift', 'mine', 'lavaRift'];

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
    { id: 'm4', title: '沼泽的邀请', desc: '幽暗沼泽的腐气会侵蚀气血。清掉 8 只沼泽蜥，探明道路。',
      obj: { type: 'kill', target: 'lizard', count: 8 }, reward: { exp: 700, gold: 380, rep: 14 } },
    { id: 'm5', title: '十二级', desc: '把等级推到 12 级。黑石矿洞的门槛就在眼前。',
      obj: { type: 'level', value: 12 }, reward: { exp: 900, gold: 500, rep: 15, item: { q: 5, slot: 'weapon' } } },
    { id: 'm6', title: '黑石矿主', desc: '进入黑石矿洞，击杀矿主戈隆。它守着通往更高处的建帮令。',
      obj: { type: 'boss', target: 'boss_golon', count: 1 }, reward: { exp: 1400, gold: 900, rep: 60, item: { q: 6, slot: 'weapon' } } },
    { id: 'm7', title: '天下之势', desc: '单打独斗走不远。选择一方势力，把好感度做到 30 以上。',
      obj: { type: 'relation', value: 30 }, reward: { exp: 1200, gold: 700, rep: 40 } },
    { id: 'm8', title: '十八级', desc: '熔岩裂谷的亚龙已经开始成群活动，把等级提到 18。',
      obj: { type: 'level', value: 18 }, reward: { exp: 2200, gold: 1100, rep: 30 } },
    { id: 'm9', title: '裂谷试炼', desc: '斩杀 10 只裂谷亚龙，让裂谷记住你的名字。',
      obj: { type: 'kill', target: 'drake', count: 10 }, reward: { exp: 3000, gold: 1500, rep: 45, item: { q: 7, slot: 'chest' } } },
    { id: 'm10', title: '传说之路', desc: '达到 22 级，并击败裂谷之主·炎殇。这是单机版目前的终点，也是新周目的起点。',
      obj: { type: 'boss2', target: 'boss_lava', level: 22, count: 1 }, reward: { exp: 6000, gold: 4000, rep: 150, item: { q: 9, slot: 'weapon' } } },
  ];

  /* ---------- 悬赏模板 ---------- */
  D.BOUNTY = {
    forest: [
      { type: '清剿', text: '林区狼患', target: 'wolf', count: 6, reward: { gold: 90, exp: 70, rep: 3 } },
      { type: '清剿', text: '驱赶流寇', target: 'bandit', count: 6, reward: { gold: 110, exp: 85, rep: 4 } },
      { type: '猎杀', text: '铁鬃野猪', target: 'boar', count: 3, reward: { gold: 130, exp: 95, rep: 5 } },
    ],
    swamp: [
      { type: '清剿', text: '沼泽蜥泛滥', target: 'lizard', count: 8, reward: { gold: 220, exp: 200, rep: 6 } },
      { type: '猎杀', text: '腐沼人巢穴', target: 'bogman', count: 6, reward: { gold: 260, exp: 240, rep: 7 } },
      { type: '清剿', text: '毒囊蛛清剿', target: 'spider', count: 8, reward: { gold: 240, exp: 220, rep: 6 } },
    ],
    rift: [
      { type: '猎杀', text: '石魔威胁', target: 'golem', count: 5, reward: { gold: 460, exp: 480, rep: 10 } },
      { type: '清剿', text: '炎魔小鬼', target: 'fireImp', count: 7, reward: { gold: 500, exp: 520, rep: 11 } },
      { type: '猎杀', text: '亚龙踪迹', target: 'drake', count: 6, reward: { gold: 560, exp: 580, rep: 12 } },
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
