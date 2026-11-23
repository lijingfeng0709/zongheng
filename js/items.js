/* ============ 装备 / 物品 ============ */
window.I = (function () {
  const I = {};
  const BAG_SLOTS_PER_PAGE = 100;
  const BAG_PAGES = 100;
  const BAG_MAX = BAG_SLOTS_PER_PAGE * BAG_PAGES;

  /* ---------- 生成 ---------- */
  I.gen = function (ilvl, qid, slotKey, cls) {
    const q = D.QUALITY[U.clamp(qid, 0, 12)];
    const slot = slotKey || U.pick(D.SLOTS).key;
    const base = {};
    const b = D.SLOT_BASE[slot];
    if (b.atk) { const v = Math.round(b.atk(ilvl) * q.mult * U.rand(0.92, 1.08)); if (v > 0) base.atk = v; }
    if (b.def) { const v = Math.round(b.def(ilvl) * q.mult * U.rand(0.92, 1.08)); if (v > 0) base.def = v; }
    if (b.hp)  { const v = Math.round(b.hp(ilvl) * q.mult * U.rand(0.92, 1.08)); if (v > 0) base.hp = v; }
    if (slot === 'trinket' || slot === 'head') base.mdef = Math.round((1 + ilvl * 0.9) * q.mult * U.rand(0.9, 1.1));

    const affixes = [];
    const pool = U.shuffle(D.AFFIX_KEYS.slice());
    for (let i = 0; i < q.affix && i < pool.length; i++) {
      const k = pool[i];
      const v = D.AFFIX[k].roll(ilvl, q.mult, q.id);
      if (v > 0) affixes.push({ k, v });
    }

    const pref = D.PREFIX[q.id] ? U.pick(D.PREFIX[q.id]) : '';
    const baseName = slot === 'weapon'
      ? (D.BASE_NAME.weapon[cls || 'knight'] || '长剑')
      : U.pick(D.BASE_NAME[slot]);
    let name = (pref ? pref + '·' : '') + baseName;
    if (q.id >= 5 && U.chance(0.55)) name += U.pick(D.SUFFIX);

    const item = {
      uid: G.uid++,
      slot, q: q.id, ilvl, name,
      base, affixes,
      enh: 0,
      sockets: new Array(q.sock).fill(null),
      req: ilvl,
      price: Math.round((12 + ilvl * 7) * (1 + q.mult * 0.55)),
    };
    return item;
  };

  I.rollQuality = function (bonus, minQ) {
    const W = [16, 34, 23, 12, 7, 3.6, 1.8, 0.9, 0.4, 0.18, 0.07, 0.025, 0.008];
    const arr = []; let total = 0;
    for (let i = minQ || 0; i < 13; i++) {
      const w = W[i] * Math.pow(1 + (bonus || 0), i * 0.55);
      arr.push(w); total += w;
    }
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= arr[i];
      if (r <= 0) return i + (minQ || 0);
    }
    return minQ || 0;
  };

  /* ---------- 属性合计 ---------- */
  I.totals = function (p) {
    const t = { atk: 0, def: 0, mdef: 0, hp: 0, mp: 0, str: 0, vit: 0, agi: 0, int: 0, crit: 0, weak: 0, life: 0, as: 0, ms: 0 };
    if (!p || !p.equip) return t;
    for (const k in p.equip) {
      const it = p.equip[k];
      if (!it) continue;
      const em = 1 + it.enh * D.ENHANCE.gainPerLevel;
      for (const s in it.base) t[s] += Math.round(it.base[s] * em);
      for (const a of it.affixes) t[a.k] += a.v;
      for (const g of (it.sockets || [])) {
        if (!g) continue;
        const gd = D.GEMS[g.gem];
        if (gd) t[gd.stat] += gd.per * g.lv;
      }
    }
    return t;
  };

  /* ---------- 评分（用于快速对比） ---------- */
  I.score = function (item, cls) {
    if (!item) return 0;
    const em = 1 + item.enh * D.ENHANCE.gainPerLevel;
    let s = 0;
    s += (item.base.atk || 0) * em * 1.0;
    s += (item.base.def || 0) * em * 0.9;
    s += (item.base.mdef || 0) * em * 0.5;
    s += (item.base.hp || 0) * em * 0.14;
    for (const a of item.affixes) {
      if (a.k === 'atk') s += a.v * 1.0;
      else if (a.k === 'def') s += a.v * 0.9;
      else if (a.k === 'mdef') s += a.v * 0.5;
      else if (a.k === 'hp') s += a.v * 0.14;
      else if (a.k === 'mp') s += a.v * 0.06;
      else if (a.k === 'str') s += a.v * 2.1;
      else if (a.k === 'vit') s += a.v * 2.4;
      else if (a.k === 'agi') s += a.v * 1.9;
      else if (a.k === 'int') s += a.v * 1.4;
      else if (a.k === 'crit') s += a.v * 3.2;
      else if (a.k === 'weak') s += a.v * 1.4;
      else if (a.k === 'life') s += a.v * 2.2;
      else if (a.k === 'as') s += a.v * 2.4;
      else if (a.k === 'ms') s += a.v * 1.6;
    }
    return Math.round(s);
  };

  /* ---------- 对比（用真实派生值） ---------- */
  I.compare = function (item, p) {
    if (!item || !p) return null;
    const cur = p.equip[item.slot];
    const fake = Object.assign({}, p, { equip: Object.assign({}, p.equip) });
    fake.equip[item.slot] = item;
    const a = S.stats(p), b = S.stats(fake);
    const rows = [
      ['攻击', a.atk, b.atk],
      ['防御', a.def, b.def],
      ['气血', a.maxHp, b.maxHp],
      ['暴击', a.crit, b.crit, 1, '%'],
      ['致命伤害', a.weakDmg, b.weakDmg, 1, '%'],
      ['攻速', a.atkSpeed, b.atkSpeed, 2, ''],
    ];
    return rows.map(r => ({ label: r[0], from: r[1], to: r[2], dec: r[3] || 0, unit: r[4] || '' }))
      .filter(r => Math.abs(r.to - r.from) > 0.0001);
  };

  I.cmpShort = function (item, p) {
    const rows = I.compare(item, p);
    if (!rows) return '';
    return rows.slice(0, 3).map(r => {
      const d = r.to - r.from;
      const cls = d > 0 ? 'pos' : 'neg';
      return `<span class="${cls}">${r.label} ${d > 0 ? '+' : ''}${d.toFixed(r.dec)}</span>`;
    }).join('  ');
  };

  /* ---------- 升降判定：1 优于身上，-1 劣于，0 持平或未知 ---------- */
  I.verdict = function (item, p) {
    if (!item || !p) return 0;
    const cur = p.equip ? p.equip[item.slot] : null;
    if (!cur) return 1;
    const a = I.score(item);
    const b = I.score(cur);
    const d = a - b;
    const eps = Math.max(1, b * 0.006);
    if (d > eps) return 1;
    if (d < -eps) return -1;
    return 0;
  };

  I.verdictText = function (item, p) {
    const v = I.verdict(item, p);
    if (v > 0) return { t: '▲ 优于当前装备', c: '#5fd18d', v };
    if (v < 0) return { t: '▼ 劣于当前装备', c: '#ff6b6b', v };
    return { t: '≈ 与当前装备相当', c: '#7b8699', v };
  };

  /* ---------- 背包分页 ---------- */
  I.slotsPerPage = BAG_SLOTS_PER_PAGE;
  I.pages = BAG_PAGES;
  I.pageOf = idx => Math.floor(idx / BAG_SLOTS_PER_PAGE) + 1;
  I.lastPage = function (p) {
    return U.clamp(Math.floor((p.bag.length - 1) / BAG_SLOTS_PER_PAGE) + 1, 1, BAG_PAGES);
  };
  I.countOnPage = function (p, page) {
    const s = (page - 1) * BAG_SLOTS_PER_PAGE;
    return p.bag.slice(s, s + BAG_SLOTS_PER_PAGE).filter(Boolean).length;
  };

  /* ---------- 文本 ---------- */
  I.affixText = a => (D.AFFIX[a.k] ? D.AFFIX[a.k].label(a.v) : '');
  I.enhName = it => it.enh > 0 ? `+${it.enh} ` : '';
  I.fullName = it => I.enhName(it) + it.name;
  I.qColor = it => D.QUALITY[it.q].color;

  /* ---------- 提示框 HTML ---------- */
  I.tipHTML = function (item, p, opts) {
    if (!item) return '';
    const q = D.QUALITY[item.q];
    const cur = p && p.equip ? p.equip[item.slot] : null;
    let h = `<div class="tn" style="color:${q.color}">${I.enhName(item)}${U.esc(item.name)}</div>`;
    h += `<div class="tq">${q.name} · ${D.SLOTS.find(s => s.key === item.slot).name} · 需求 Lv.${item.req}</div>`;

    const em = 1 + item.enh * D.ENHANCE.gainPerLevel;
    for (const k in item.base) {
      const label = { atk: '物理攻击', def: '物理防御', mdef: '魔法防御', hp: '气血上限', mp: '魔法上限' }[k] || k;
      const v = Math.round(item.base[k] * em);
      h += `<div class="tl"><span>${label}</span><b>+${v}${item.enh ? ` <span style="color:#8dffb5;font-size:10px">(${Math.round(item.base[k])}→)</span>` : ''}</b></div>`;
    }
    for (const a of item.affixes) h += `<div class="aff">· ${I.affixText(a)}</div>`;

    if (item.sockets && item.sockets.length) {
      const gems = item.sockets.map(g => g ? `<span style="color:${D.GEMS[g.gem].color}">${D.GEMS[g.gem].name} Lv.${g.lv}</span>` : '<span style="color:#4b5464">空槽</span>');
      h += `<div style="margin-top:4px;font-size:10.5px;color:#7b8699">凹槽：${gems.join(' / ')}</div>`;
    }

    if (opts && opts.showCmp && p) {
      if (cur) {
        const rows = I.compare(item, p);
        if (rows && rows.length) {
          h += `<div class="cmp">`;
          for (const r of rows) {
            const d = r.to - r.from;
            const cls = d > 0 ? 'pos' : 'neg';
            const arrow = d > 0 ? '▲' : '▼';
            h += `<div class="tl ${cls}"><span>${r.label}</span><b class="${cls}">${arrow} ${d > 0 ? '+' : ''}${d.toFixed(r.dec)}${r.unit}</b></div>`;
          }
          h += `</div>`;
        } else {
          h += `<div class="cmp" style="color:#7b8699">与当前装备相当</div>`;
        }
      } else {
        h += `<div class="cmp" style="color:#5fd18d">该部位当前为空，可直接装备</div>`;
      }
      if (p.level < item.req) h += `<div class="cmp" style="color:#ff6b6b">等级不足，无法装备</div>`;
    }

    if (opts && opts.hint) h += `<div class="desc" style="color:#c9a35c">${opts.hint}</div>`;
    h += `<div class="desc">${opts && opts.footer ? opts.footer : '点击装备 / 右键出售'}</div>`;
    return h;
  };

  /* ---------- 背包操作 ---------- */
  I.add = function (item, silent) {
    const p = G.player;
    if (!p) return false;
    if (p.bag.length >= BAG_MAX) {
      p.gold += item.price;
      U.toast(`背包已满，${item.name} 自动折算为 ${item.price} 金币`, 'bad');
      return false;
    }
    p.bag.push(item);
    const cmp = I.cmpShort(item, p);
    const q = D.QUALITY[item.q];
    if (!silent) {
      if (item.q >= 5) {
        U.toast(`获得 <span style="color:${q.color}">${item.name}</span>${cmp ? `<br><span style="font-size:11px">${cmp}</span>` : ''}`, 'epic');
        U.log(`拾取：${item.name}（${q.name}）`, 'hot');
      } else if (item.q >= 4) {
        U.toast(`获得 <span style="color:${q.color}">${item.name}</span>`, 'good');
      }
    }
    U.sfx('loot');
    if (UI.currentPanel === 'bag') {
      UI.bagPage = I.pageOf(p.bag.length - 1);
      UI.selBag = item.uid;
      UI.open('bag');
    }
    return true;
  };

  I.equip = function (item) {
    const p = G.player;
    if (p.level < item.req) { U.toast('等级不足，无法装备', 'bad'); return false; }
    const idx = p.bag.indexOf(item);
    if (idx >= 0) p.bag.splice(idx, 1);
    const old = p.equip[item.slot];
    if (old) p.bag.push(old);
    p.equip[item.slot] = item;
    const st = S.stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    U.sfx('ui');
    UI.refreshHUD(true);
    if (UI.currentPanel) UI.open(UI.currentPanel);
    return true;
  };

  I.unequip = function (slot) {
    const p = G.player;
    const it = p.equip[slot];
    if (!it) return;
    if (p.bag.length >= BAG_MAX) { U.toast('背包已满', 'bad'); return; }
    p.bag.push(it);
    p.equip[slot] = null;
    const st = S.stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    UI.refreshHUD(true);
    if (UI.currentPanel) UI.open(UI.currentPanel);
  };

  I.sell = function (item) {
    const p = G.player;
    const idx = p.bag.indexOf(item);
    if (idx < 0) return;
    p.bag.splice(idx, 1);
    const price = Math.round(item.price * (1 + item.enh * 0.3));
    p.gold += price;
    U.sfx('coin');
    U.toast(`出售 +${price} 金币`, 'good');
    if (UI.currentPanel) UI.open(UI.currentPanel);
  };

  I.decompose = function (item) {
    const p = G.player;
    const idx = p.bag.indexOf(item);
    if (idx < 0) return;
    if (item.q < 2) { U.toast('粗糙品与白装没有分解价值', 'bad'); return; }
    p.bag.splice(idx, 1);
    const stones = 1 + Math.floor(item.q / 2) + (item.enh > 3 ? 1 : 0);
    p.stones += stones;
    U.sfx('ui');
    U.toast(`分解获得 强化石 ×${stones}`, 'good');
    if (UI.currentPanel) UI.open(UI.currentPanel);
  };

  /* ---------- 强化 ---------- */
  I.enhance = function (item) {
    const p = G.player;
    if (item.enh >= D.ENHANCE.max) { U.toast('已达强化上限', 'bad'); return; }
    const lv = item.enh + 1;
    const cost = D.ENHANCE.cost(lv);
    if (p.gold < cost.gold) { U.toast('金币不足', 'bad'); return; }
    if (p.stones < cost.stone) { U.toast('强化石不足（可分解装备获得）', 'bad'); return; }
    p.gold -= cost.gold; p.stones -= cost.stone;
    const rate = D.ENHANCE.rate(lv);
    if (Math.random() < rate) {
      item.enh = lv;
      U.sfx('level');
      U.toast(`强化成功！${item.name} +${lv}`, item.enh >= 10 ? 'epic' : 'good');
      U.log(`${item.name} 强化至 +${lv}。`, 'good');
    } else {
      U.sfx('hurt');
      U.toast('强化失败，材料已消耗', 'bad');
    }
    const st = S.stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    if (UI.currentPanel) UI.open(UI.currentPanel);
    UI.refreshHUD(true);
  };

  /* ---------- 镶嵌 ---------- */
  I.gemList = function () {
    const p = G.player;
    if (!p.gems) p.gems = [];
    return p.gems;
  };

  I.socketGem = function (item, gemIndex) {
    const p = G.player;
    const gems = I.gemList();
    const g = gems[gemIndex];
    if (!g) return;
    const free = (item.sockets || []).indexOf(null);
    if (free < 0) { U.toast('没有空余凹槽', 'bad'); return; }
    item.sockets[free] = g;
    gems.splice(gemIndex, 1);
    const gd = D.GEMS[g.gem];
    U.toast(`镶嵌成功：${gd.name} Lv.${g.lv}`, 'good');
    U.sfx('loot');
    const st = S.stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    if (UI.currentPanel) UI.open(UI.currentPanel);
    UI.refreshHUD(true);
  };

  I.addGem = function (gem, lv) {
    const p = G.player;
    if (!p.gems) p.gems = [];
    p.gems.push({ gem, lv: lv || 1 });
  };

  I.BAG_MAX = BAG_MAX;
  I.BAG_PAGES = BAG_PAGES;
  I.BAG_SLOTS_PER_PAGE = BAG_SLOTS_PER_PAGE;
  return I;
})();
