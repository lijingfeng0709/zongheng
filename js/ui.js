/* ============ UI ============ */
window.UI = (function () {
  const UI = { currentPanel: null, selBag: null, smithSel: null, smithTab: 'enh', shopTab: 'buy',
    bagPage: 1, bagFilter: false, _lastBag: null, _lastBagT: 0,
    cloudMsg: '', cloudRemote: null, cloudFetching: false, slotRemote: null };

  const $ = id => document.getElementById(id);

  /* ================= HUD ================= */
  UI.refreshHUD = function (force) {
    const p = G.player;
    if (!p) return;
    const st = S.stats(p);
    const hp = U.clamp(p.hp / st.maxHp, 0, 1);
    const mp = U.clamp(p.mp / st.maxMp, 0, 1);
    const ex = U.clamp(p.exp / p.expNext, 0, 1);

    $('barHp').style.width = (hp * 100) + '%';
    $('barMp').style.width = (mp * 100) + '%';
    $('barExp').style.width = (ex * 100) + '%';
    $('txtHp').textContent = `${Math.ceil(p.hp)} / ${st.maxHp}`;
    $('txtMp').textContent = `${Math.ceil(p.mp)} / ${st.maxMp}`;
    $('txtExp').textContent = `EXP ${Math.floor(p.exp)} / ${p.expNext}`;
    $('hudName').textContent = p.name;
    $('hudLv').textContent = 'Lv.' + p.level;
    $('hudGold').textContent = U.fmt(p.gold);
    $('hudRep').textContent = U.fmt(p.rep);
    $('hudZone').textContent = G.zone ? G.zone.name : '';
    $('hudAvatar').textContent = D.CLASSES[p.cls].icon;
    $('hudAvatar').style.background = `radial-gradient(circle at 35% 30%, #fff, ${D.CLASSES[p.cls].color} 60%, #1a2230)`;

    const stEl = $('stanceHud');
    const sd = D.STANCES[p.stance];
    stEl.querySelector('.st-name').textContent = sd.name;
    stEl.querySelector('.st-name').style.color = sd.color;

    UI.updateSkillbar();

    const f = G.factions.find(x => x.id === p.factionId);
    const q = W.mainQuest();
    const qh = $('questHud');
    if (q) {
      qh.innerHTML = `<div class="qh-t">主线 · ${G.mainIdx + 1}/${D.MAIN_QUESTS.length}</div>
        <div class="qh-n">${q.title}</div>
        <div class="qh-o">${W.objText(q)}</div>`;
    } else {
      qh.innerHTML = `<div class="qh-t">主线</div><div class="qh-n">全部完成</div>
        <div class="qh-o">${f ? '势力：' + f.name : '散人'}</div>`;
    }
  };

  UI.buildSkillbar = function () {
    const p = G.player;
    if (!p) return;
    const bar = $('skillbar');
    let h = '';
    p.skills.forEach((s, i) => {
      const def = D.SKILLS[s.id];
      h += `<div class="skill ${s.unlocked ? '' : 'locked'}" data-skill="${i}" title="${def.name}">
        <span class="key">${i + 1}</span><span class="ic">${def.icon}</span>
        <span class="nm">${def.name}</span>
        <div class="cdmask" style="display:none"></div>
      </div>`;
    });
    h += `<div class="skill" id="potionSlot">
      <span class="key">R</span><span class="ic">药</span>
      <span class="nm" id="potionCount">金疮药 ×${p.potions.potion}</span>
      <div class="cdmask" id="potionCd" style="display:none"></div>
    </div>`;
    bar.innerHTML = h;
    bar.querySelectorAll('[data-skill]').forEach(el => {
      el.addEventListener('mousedown', ev => {
        ev.stopPropagation();
        const i = +el.dataset.skill;
        if (G.running && !G.paused) E.castSkill(i);
      });
    });
    const ps = $('potionSlot');
    if (ps) ps.addEventListener('mousedown', ev => { ev.stopPropagation(); if (G.running && !G.paused) E.usePotion(); });
  };

  UI.updateSkillbar = function () {
    const p = G.player;
    if (!p) return;
    const bar = $('skillbar');
    if (!bar) return;
    bar.querySelectorAll('[data-skill]').forEach(el => {
      const i = +el.dataset.skill;
      const s = p.skills[i];
      if (!s) return;
      const cd = p.skillCd[s.id] || 0;
      const mask = el.querySelector('.cdmask');
      if (mask) {
        if (cd > 0) { mask.style.display = 'flex'; mask.textContent = cd > 1 ? Math.ceil(cd) : cd.toFixed(1); }
        else mask.style.display = 'none';
      }
      el.classList.toggle('locked', !s.unlocked);
    });
    const pc = $('potionCount');
    if (pc) pc.textContent = `金疮药 ×${p.potions.potion}`;
    const pcd = $('potionCd');
    if (pcd) {
      if (p.potionCd > 0) { pcd.style.display = 'flex'; pcd.textContent = Math.ceil(p.potionCd); }
      else pcd.style.display = 'none';
    }
  };

  UI.updateQuestHud = function () { UI.refreshHUD(); };

  /* ================= 提示框 ================= */
  let tipEl = null;
  function ensureTip() { if (!tipEl) tipEl = $('tip'); return tipEl; }

  function showTip(html, ev) {
    const t = ensureTip();
    if (!t || !html) return;
    t.innerHTML = html;
    t.classList.remove('hidden');
    moveTip(ev);
  }
  function moveTip(ev) {
    const t = ensureTip();
    if (!t || t.classList.contains('hidden')) return;
    const pad = 16;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { const t = ensureTip(); if (t) t.classList.add('hidden'); }
  UI.hideTip = hideTip;

  function bindTip(el, htmlFn) {
    el.addEventListener('mouseenter', ev => showTip(htmlFn(), ev));
    el.addEventListener('mousemove', moveTip);
    el.addEventListener('mouseleave', hideTip);
  }

  /* ================= 打开 / 关闭 ================= */
  UI.open = function (name) {
    if (!G.player) return;
    UI.currentPanel = name;
    G.paused = true;
    G.mouse.down = false;
    const wrap = $('panelWrap');
    const panel = $('panel');
    wrap.classList.remove('hidden');
    const fn = {
      char: panelChar, bag: panelBag, skills: panelSkills, quests: panelQuests,
      faction: panelFaction, map: panelMap, shop: panelShop, smith: panelSmith, trainer: panelTrainer,
      help: panelHelp, cloud: panelCloud,
    }[name];
    if (!fn) { UI.close(); return; }
    panel.className = 'panel' + (name === 'bag' || name === 'cloud' ? ' wide' : '');
    panel.innerHTML = fn();
    bindPanel(name);
    UI.refreshHUD();
  };

  UI.close = function () {
    UI.currentPanel = null;
    G.paused = false;
    G.mouse.down = false;
    $('panelWrap').classList.add('hidden');
    hideTip();
  };

  UI.toggle = function (name) {
    if (UI.currentPanel === name) UI.close();
    else UI.open(name);
  };

  UI.hidePrompt = W.hidePrompt;

  /* ================= 通用 ================= */
  function head(title, sub) {
    return `<div class="p-head"><h2>${title}</h2><span class="p-sub">${sub || ''}</span>
      <div class="p-close" data-close>×</div></div>`;
  }

  function bar(pct, color, h) {
    return `<div style="height:${h || 6}px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden">
      <div style="height:100%;width:${U.clamp(pct, 0, 1) * 100}%;background:${color};border-radius:3px"></div></div>`;
  }

  // 背包可能上万件，列表类面板只展示最有价值的一部分
  function bagTop(p, limit) {
    return p.bag.slice().sort((a, b) => (b.q - a.q) || (b.ilvl - a.ilvl)).slice(0, limit);
  }
  function moreNote(total, shown) {
    return total > shown
      ? `<div style="font-size:10.5px;color:#5d6878;margin-top:8px;line-height:1.7">仅显示价值最高的 ${shown} 件（背包共 ${total} 件）。完整列表请在背包中按页查看。</div>`
      : '';
  }

  function itemIcon(it) {
    const s = D.SLOTS.find(x => x.key === it.slot);
    return s ? s.icon : '?';
  }

  /* ================= 角色面板 ================= */
  function panelChar() {
    const p = G.player, st = S.stats(p);
    const cls = D.CLASSES[p.cls];

    let eqHTML = '';
    for (const s of D.SLOTS) {
      const it = p.equip[s.key];
      const col = it ? D.QUALITY[it.q].color : '';
      eqHTML += `<div class="eq-slot ${it ? '' : 'eq-empty'}" data-slot="${s.key}">
        <div class="eq-ico" style="${it ? `border-color:${U.hexA(col, 0.5)};color:${col};box-shadow:0 0 14px ${U.hexA(col, 0.15)}` : ''}">
          ${it ? itemIcon(it) : s.icon}
        </div>
        <div class="eq-info">
          <div class="n" style="${it ? `color:${col}` : ''}">${it ? I.fullName(it) : s.name}</div>
          <div class="t">${it ? `${D.QUALITY[it.q].name} · iLv.${it.ilvl}` : '未装备'}</div>
        </div>
      </div>`;
    }

    const stRows = [
      ['物理攻击', st.atk], ['魔法攻击', st.mAtk], ['物理防御', st.def], ['魔法防御', st.mdef],
      ['气血上限', st.maxHp], ['魔法上限', st.maxMp], ['暴击率', st.crit.toFixed(1) + '%'],
      ['致命一击伤害', st.weakDmg + '%'], ['攻击速度', st.atkSpeed.toFixed(2) + '/秒'],
      ['移动速度', st.speed], ['吸血', st.lifesteal.toFixed(1) + '%'], ['闪避', st.dodge.toFixed(1) + '%'],
    ].map(r => `<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');

    const attrRows = [['力量', 'str'], ['体力', 'vit'], ['敏捷', 'agi'], ['智力', 'int']]
      .map(([n, k]) => `<div class="attr-row"><span class="an">${n}</span>
        <span class="av">${p.attr[k]}</span>
        ${p.freePts > 0 ? `<div class="plus" data-attr="${k}">+</div>` : '<div class="plus" style="opacity:.2;cursor:default">+</div>'}
      </div>`).join('');

    return head('角 色', `${cls.name} · ${cls.tag} · 卡槽${['一', '二', '三'][S.slot - 1]}`) + `<div class="p-body">
      <div class="p-cols">
        <div>
          <div class="stat-block">
            <h3>装 备</h3>
            <div class="eq-grid">${eqHTML}</div>
          </div>
          <div class="stat-block">
            <h3>四 维 <span style="color:#c9a35c;float:right;font-size:11px">自由点 ${p.freePts}</span></h3>
            ${attrRows}
            <div style="font-size:10.5px;color:#69748a;margin-top:8px;line-height:1.7">
              力量→物攻；体力→气血/物防；敏捷→命中/闪避/攻速/移速；智力→魔攻/魔法/魔防。
            </div>
          </div>
          <div class="stat-block">
            <h3>状 态</h3>
            <div class="stat-row"><span>当前姿态</span><b style="color:${D.STANCES[p.stance].color}">${D.STANCES[p.stance].name}</b></div>
            <div class="stat-row"><span>姿态效果</span><b style="font-size:11px;font-weight:400">${D.STANCES[p.stance].desc}</b></div>
            ${p.buffs.length ? p.buffs.map(b => `<div class="stat-row"><span style="color:${b.color}">${b.name}</span><b>${b.t.toFixed(1)}s</b></div>`).join('') : '<div class="stat-row"><span>增益</span><b style="font-weight:400;color:#5d6878">无</b></div>'}
          </div>
        </div>
        <div>
          <div class="stat-block">
            <h3>面 板</h3>
            ${stRows}
          </div>
          <div class="stat-block">
            <h3>账 号</h3>
            <div class="stat-row"><span>姓名</span><b>${U.esc(A.nickname())}</b></div>
            <div class="stat-row"><span>账号</span><b>${U.esc(A.account() || '离线')}</b></div>
            <div class="stat-row"><span>卡槽</span><b>卡槽${['一', '二', '三'][S.slot - 1]}</b></div>
          </div>
          <div class="stat-block">
            <h3>战 绩</h3>
            <div class="stat-row"><span>击杀</span><b>${G.statsData.kills}</b></div>
            <div class="stat-row"><span>要害命中</span><b>${G.statsData.weak}</b></div>
            <div class="stat-row"><span>致命处决</span><b style="color:#ffd166">${G.statsData.execute}</b></div>
            <div class="stat-row"><span>死亡</span><b>${G.statsData.deaths}</b></div>
            <div class="stat-row"><span>累计金币</span><b style="color:#f0c24b">${G.statsData.gold}</b></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 背包 ================= */
  function panelBag() {
    const p = G.player;
    const SPP = I.BAG_SLOTS_PER_PAGE, PAGES = I.BAG_PAGES;
    if (!UI.bagPage) UI.bagPage = 1;
    UI.bagPage = U.clamp(UI.bagPage, 1, PAGES);
    const page = UI.bagPage;
    const base = (page - 1) * SPP;

    if (p.bag.length && !p.bag.find(x => x.uid === UI.selBag)) UI.selBag = null;

    // ---- 已装备栏（对比基准） ----
    const eqStrip = D.SLOTS.map(s => {
      const it = p.equip[s.key];
      const col = it ? D.QUALITY[it.q].color : '#4d5769';
      return `<div class="eq-mini ${it ? '' : 'empty'}" data-eqmini="${s.key}"
          title="${it ? `${I.fullName(it)} · ${D.QUALITY[it.q].name}` : s.name + '（未装备）'}"
          style="${it ? `border-color:${U.hexA(col, 0.45)}` : ''}">
        <div class="em-ico" style="color:${col}">${it ? itemIcon(it) : s.icon}</div>
        <div class="em-txt">
          <div class="em-n" style="${it ? `color:${col}` : ''}">${it ? I.fullName(it) : s.name}</div>
          <div class="em-q">${it ? `${D.QUALITY[it.q].name} · iLv.${it.ilvl}` : '空'}</div>
        </div>
      </div>`;
    }).join('');

    // ---- 100 格 ----
    let cells = '';
    let upCount = 0;
    for (let i = 0; i < SPP; i++) {
      const idx = base + i;
      const it = p.bag[idx];
      if (it) {
        const col = D.QUALITY[it.q].color;
        const v = I.verdict(it, p);
        if (v > 0) upCount++;
        const dim = UI.bagFilter && v <= 0 ? ' dim' : '';
        const isSel = it.uid === UI.selBag ? ' sel' : '';
        const vt = v > 0
          ? `<span class="vd up" title="优于当前装备">▲</span>`
          : v < 0
            ? `<span class="vd down" title="劣于当前装备">▼</span>`
            : `<span class="vd even" title="与当前装备相当">≈</span>`;
        cells += `<div class="bag-cell pcell${dim}${isSel}" data-bag="${it.uid}"
            style="border-color:${U.hexA(col, 0.55)};box-shadow:inset 0 0 18px ${U.hexA(col, 0.11)};color:${col}">
          ${itemIcon(it)}
          <span class="q" style="background:${col}"></span>
          ${vt}
          ${it.enh ? `<span class="enh">+${it.enh}</span>` : ''}
          <span class="sn">${idx + 1}</span>
        </div>`;
      } else {
        cells += `<div class="bag-cell pcell empty" title="第 ${idx + 1} 格">
          <span class="sn">${idx + 1}</span></div>`;
      }
    }

    // ---- 详情 ----
    const sel = p.bag.find(x => x.uid === UI.selBag);
    let detail = `<div class="bag-tip-empty">
      <div class="bte-i">◈</div>
      <div>点击左侧物品查看详情</div>
      <div class="bte-s">绿色 ▲ 表示该装备强于身上同部位装备，红色 ▼ 表示不如</div>
    </div>`;
    if (sel) {
      const rows = I.compare(sel, p) || [];
      const vd = I.verdictText(sel, p);
      const cur = p.equip[sel.slot];
      detail = `<div class="bag-detail">
        <div class="bd-verdict" style="color:${vd.c};border-color:${U.hexA(vd.c, 0.35)};background:${U.hexA(vd.c, 0.08)}">${vd.t}</div>
        <div class="bd-name" style="color:${D.QUALITY[sel.q].color}">${I.fullName(sel)}</div>
        <div class="bd-sub">${D.QUALITY[sel.q].name} · ${D.SLOTS.find(s => s.key === sel.slot).name} · 需求 Lv.${sel.req} · 第 ${I.pageOf(p.bag.indexOf(sel))} 页</div>
        <div class="bd-cur">当前装备：${cur ? `<span style="color:${D.QUALITY[cur.q].color}">${I.fullName(cur)}</span>` : '<span style="color:#5fd18d">空</span>'}</div>
        <div class="bd-block">
          ${Object.keys(sel.base).map(k => `<div class="stat-row"><span>${({ atk: '物理攻击', def: '物理防御', mdef: '魔法防御', hp: '气血上限', mp: '魔法上限' })[k]}</span><b>+${Math.round(sel.base[k] * (1 + sel.enh * D.ENHANCE.gainPerLevel))}</b></div>`).join('')}
          ${sel.affixes.map(a => `<div class="bd-aff">· ${I.affixText(a)}</div>`).join('')}
          ${sel.sockets && sel.sockets.length ? `<div class="bd-sock">凹槽：${sel.sockets.map(g => g ? `<span style="color:${D.GEMS[g.gem].color}">${D.GEMS[g.gem].name} Lv.${g.lv}</span>` : '空').join(' / ')}</div>` : ''}
        </div>
        ${rows.length ? `<div class="bd-block bd-cmp">
          ${rows.map(r => { const d = r.to - r.from; return `<div class="stat-row"><span>${r.label}</span><b style="color:${d > 0 ? '#5fd18d' : '#ff6b6b'}">${d > 0 ? '▲ +' : '▼ '}${d.toFixed(r.dec)}${r.unit}</b></div>`; }).join('')}
        </div>` : `<div class="bd-block" style="color:#7b8699;font-size:11px">装备后属性没有变化</div>`}
        <div class="bd-btns">
          <button class="btn sm" data-act="equip" ${p.level < sel.req ? 'disabled' : ''}>装备</button>
          <button class="btn sm ghost" data-act="sell">出售 ${Math.round(sel.price * (1 + sel.enh * 0.3))} 金</button>
          <button class="btn sm ghost" data-act="decomp">分解</button>
        </div>
      </div>`;
    }

    const pageHasItem = I.countOnPage(p, page);
    const lastItemPage = I.lastPage(p);

    return `<div class="p-head"><h2>背 包</h2>
        <span class="p-sub">${p.bag.length} / ${I.BAG_MAX} 件 · 第 ${page} / ${PAGES} 页 · 本页 ${pageHasItem} 件${upCount ? ` · <span style="color:#5fd18d">${upCount} 件可提升</span>` : ''}</span>
        <div class="p-close" data-close>×</div></div>
      <div class="p-body bag-body">
        <div class="bag-head">
          <span class="bag-tools">
            <button class="btn sm ${UI.bagFilter ? '' : 'ghost'}" data-onlyup style="padding:2px 9px;font-size:10px">
              ${UI.bagFilter ? '已只看提升' : '只看提升'}
            </button>
            <button class="btn sm ghost" data-clean style="padding:2px 9px;font-size:10px">分解劣质装备</button>
            <button class="btn sm ghost" data-jumpup style="padding:2px 9px;font-size:10px">跳到有提升页</button>
          </span>
          <span class="bag-gold">◈ ${p.gold} 金币　强化石 ×${p.stones}　宝石 ×${(p.gems || []).length}</span>
        </div>

        <div class="eq-strip">${eqStrip}</div>

        <div class="bag-main">
          <div class="bag-left">
            <div class="bag-grid page">${cells}</div>
            <div class="pager">
              <button class="pg-btn" data-page="first" ${page === 1 ? 'disabled' : ''}>«</button>
              <button class="pg-btn" data-page="prev" ${page === 1 ? 'disabled' : ''}>‹ 上一页</button>
              <span class="pg-mid">
                第 <input id="bagPageInput" value="${page}" inputmode="numeric" /> / ${PAGES} 页
              </span>
              <button class="pg-btn" data-page="next" ${page === PAGES ? 'disabled' : ''}>下一页 ›</button>
              <button class="pg-btn" data-page="last" ${page === PAGES ? 'disabled' : ''}>»</button>
              ${lastItemPage !== page ? `<button class="pg-btn hot" data-page="lastitem">跳到 ${lastItemPage} 页</button>` : ''}
            </div>
          </div>
          <div class="bag-side">${detail}</div>
        </div>
      </div>`;
  }

  /* ================= 技能 ================= */
  function panelSkills() {
    const p = G.player, cls = D.CLASSES[p.cls];
    const rows = p.skills.map((s, i) => {
      const d = D.SKILLS[s.id];
      const unlocked = s.unlocked;
      return `<div class="card">
        <div class="ct">
          <span style="color:${unlocked ? '#f0e2c4' : '#5d6878'}">${d.icon} ${d.name}
            <span style="font-size:10px;color:#69748a;margin-left:6px">${d.lv} 级解锁 · ${d.cd}s 冷却 · ${d.mp} 魔法</span>
          </span>
          <span style="font-size:11px;color:${unlocked ? '#5fd18d' : '#7b8699'}">${unlocked ? '已习得' : 'Lv.' + d.lv + ' 解锁'}</span>
        </div>
        <div class="cd">${d.desc}</div>
        ${s.mastery ? `<div class="cr">熟练度：${s.mastery} 次</div>` : ''}
      </div>`;
    }).join('');

    const stances = Object.values(D.STANCES).map(s => `<div class="stat-row"><span style="color:${s.color}">${s.name}</span><b style="font-weight:400;font-size:11px">${s.desc}</b></div>`).join('');

    return head('技 能', `${cls.name} · 按 1 2 3 释放 · Q 切换姿态`) + `<div class="p-body">
      <div class="p-cols">
        <div>
          <div class="stat-block"><h3>战 技</h3><div class="list">${rows}</div></div>
        </div>
        <div>
          <div class="stat-block"><h3>姿 态</h3>${stances}
            <div style="font-size:10.5px;color:#5d6878;margin-top:9px;line-height:1.7">
              切换姿态有 1.2 秒公共冷却。盾击只有在坚守姿态下才能打出完整效果。
            </div>
          </div>
          <div class="stat-block"><h3>自创技能</h3>
            <div style="font-size:11.5px;color:#6d788c;line-height:1.8">
              技能构筑器尚未开放。后续版本可投入技能点与材料，组合出带随机后缀的唯一技能。
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 任务 ================= */
  function panelQuests() {
    const q = W.mainQuest();
    let mainHTML = '';
    if (q) {
      mainHTML = `<div class="card" style="border-color:rgba(201,163,92,.3)">
        <div class="ct"><span style="color:#f0d49a">【主线】${q.title}</span>
        <span style="font-size:10px;color:#7b8699">${G.mainIdx + 1} / ${D.MAIN_QUESTS.length}</span></div>
        <div class="cd">${q.desc}</div>
        <div class="cr">目标：${W.objText(q)}</div>
        <div class="cr" style="color:#8b95a8">奖励：${q.reward.gold} 金币 · ${q.reward.exp} 经验 · ${q.reward.rep} 声望${q.reward.item ? ' · 一件装备' : ''}</div>
      </div>`;
    } else {
      mainHTML = `<div class="card"><div class="ct"><span style="color:#f0d49a">主线已全部完成</span></div>
        <div class="cd">你已站到这个世界的顶端。可以继续刷装备、挑战副本，或重新开一局试试别的流派。</div></div>`;
    }

    const bounties = G.bounties.length ? G.bounties.map(b => `
      <div class="card">
        <div class="ct"><span>${b.type} · ${b.text}</span>
          <span style="font-size:10px;color:#ffb0b0">${U.timeStr(b.ttl)}</span></div>
        <div class="cd">${D.ZONES[b.zone].name} · 击杀 ${D.MONSTERS[b.target].name} ${Math.min(b.prog, b.count)}/${b.count}</div>
        ${bar(b.prog / b.count, '#c9a35c', 4)}
        <div class="cr">奖励：${b.reward.gold} 金币 · ${b.reward.exp} 经验 · 声望 +${b.reward.rep}</div>
      </div>`).join('') : `<div class="card"><div class="cd">任务板暂时空了，等一会儿再来看看。</div></div>`;

    const preview = D.MAIN_QUESTS.slice(G.mainIdx + 1, G.mainIdx + 4)
      .map(q => `<div class="stat-row"><span style="color:#6d788c">${q.title}</span>
        <b style="font-weight:400;font-size:10.5px;color:#4d5769">后续</b></div>`).join('');

    return head('任 务', `主线 ${G.mainIdx}/${D.MAIN_QUESTS.length} · 悬赏 ${G.bounties.length}/4`) + `<div class="p-body">
      <div class="p-cols">
        <div><div class="stat-block"><h3>主 线</h3><div class="list">${mainHTML}</div></div>
          ${preview ? `<div class="stat-block"><h3>后 续</h3>${preview}</div>` : ''}
        </div>
        <div><div class="stat-block"><h3>活的任务板</h3><div class="list">${bounties}</div>
          <div style="font-size:10.5px;color:#5d6878;margin-top:10px;line-height:1.7">
            悬赏有数量上限和时效，AI 势力也会接走一部分。看到合适的就先去清掉。
          </div>
        </div></div>
      </div>
    </div>`;
  }

  /* ================= 势力 ================= */
  function panelFaction() {
    const p = G.player;
    const maxS = Math.max.apply(null, G.factions.map(f => f.strength).concat([1]));
    const cards = G.factions.map(f => {
      const joined = p.factionId === f.id;
      const relColor = f.relation > 20 ? '#5fd18d' : f.relation < -20 ? '#ff6b6b' : '#a9b3c5';
      return `<div class="card">
        <div class="ct">
          <span style="color:${f.color}">${f.name} <span style="font-size:10px;color:#7b8699">${f.trait}</span></span>
          <span style="font-size:10px;color:${relColor}">好感 ${Math.round(f.relation)}</span>
        </div>
        <div class="cd">${f.desc}</div>
        <div style="margin-top:6px">${bar(f.strength / maxS, f.color, 4)}</div>
        <div class="cr" style="display:flex;justify-content:space-between;align-items:center">
          <span>实力 ${U.fmt(f.strength)} · 据点 ${f.points}</span>
          ${joined ? `<span style="color:#5fd18d;font-size:11px">已加入</span>`
            : `<span style="display:flex;gap:6px">
                 <button class="btn sm ghost" data-gift="${f.id}" ${p.gold < 300 ? 'disabled' : ''}>示好 300金</button>
                 <button class="btn sm" data-join="${f.id}" ${p.factionId || f.relation < 10 ? 'disabled' : ''}>加入</button>
               </span>`}
        </div>
      </div>`;
    }).join('');

    const comps = W.COMPANIONS.map(c => {
      const owned = G.flags['ally_' + c.id];
      return `<div class="card">
        <div class="ct"><span>${c.name} <span style="font-size:10px;color:#7b8699">${c.role}</span></span>
          <span style="font-size:10px;color:#c9a35c">${c.cost} 金${c.rep ? ' · 声望 ' + c.rep : ''}</span></div>
        <div class="cd">${c.desc}</div>
        <div style="margin-top:6px">${owned ? '<span style="color:#5fd18d;font-size:11px">已在队伍中</span>'
          : `<button class="btn sm" data-recruit="${c.id}">招募</button>`}</div>
      </div>`;
    }).join('');

    return head('势 力', p.factionId ? '你已加入 ' + (G.factions.find(f => f.id === p.factionId) || {}).name : '散人 · 无归属') + `<div class="p-body">
      <div class="p-cols">
        <div>
          <div class="stat-block"><h3>天下之势</h3><div class="list">${cards}</div>
            <div style="font-size:10.5px;color:#5d6878;margin-top:10px;line-height:1.7">
              好感达到 10 才能加入。加入后每周领取俸禄、享受势力商店折扣，也要承担防守义务。
            </div>
            ${p.factionId ? `<button class="btn sm red" data-leave style="margin-top:10px">退出势力</button>` : ''}
          </div>
        </div>
        <div>
          <div class="stat-block"><h3>队 伍</h3><div class="list">${comps}</div>
            <div style="font-size:10.5px;color:#5d6878;margin-top:10px;line-height:1.7">
              同伴会跟随你并对附近敌人自动出手。队伍上限 3 人（当前 ${G.allies.filter(a => !a.dead).length}）。
            </div>
          </div>
          <div class="stat-block"><h3>势 力 动 态</h3>
            <div class="list">${G.log.slice(0, 6).map(l => `<div style="font-size:11px;color:#8b95a8;line-height:1.7">· ${l.text}</div>`).join('') || '<div style="font-size:11px;color:#4d5769">暂无</div>'}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 地图 ================= */
  function panelMap() {
    const p = G.player;
    const cards = D.ZONE_ORDER.map(id => {
      const z = D.ZONES[id];
      const need = W.needLevel(id);
      const here = G.zoneId === id;
      const locked = p.level < need;
      return `<div class="card ${locked || here ? '' : 'click'}" data-travel="${id}" style="${here ? 'border-color:rgba(201,163,92,.5)' : ''}">
        <div class="ct">
          <span style="color:${here ? '#f0d49a' : '#dbe3ef'}">${z.name}
            ${z.dungeon ? '<span style="font-size:9px;color:#b06bff;border:1px solid rgba(176,107,255,.4);padding:0 4px;border-radius:3px;margin-left:5px">副本</span>' : ''}
          </span>
          <span style="font-size:10px;color:${here ? '#5fd18d' : locked ? '#ff6b6b' : '#7b8699'}">${here ? '当前所在' : locked ? '需 Lv.' + need : '可前往'}</span>
        </div>
        <div class="cd">${z.sub} · 区域等级 ${z.lv[0]}-${z.lv[1]}</div>
        ${locked ? `<div style="font-size:10px;color:#ff6b6b;margin-top:5px">等级不足，暂不可前往</div>` : ''}
      </div>`;
    }).join('');

    return head('地 图', '落霞城 · 安全区') + `<div class="p-body">
      <div class="list">${cards}</div>
      <div style="font-size:10.5px;color:#5d6878;margin-top:14px;line-height:1.8">
        · 主城有杂货商、铁匠、训练师、任务板与势力使者。<br>
        · 黑石矿洞与炎殇深渊为副本，内部有首领。首领掉落建帮令级道具与高品质装备。
      </div>
    </div>`;
  }

  /* ================= 商店 ================= */
  function panelShop() {
    const p = G.player;
    const list = D.SHOP.map(s => {
      const owned = s.type === 'potion' ? p.potions.potion : s.type === 'mana' ? p.potions.mana : s.type === 'stone' ? p.stones : 0;
      return `<div class="card">
        <div class="ct"><span>${s.icon} ${s.name} <span style="font-size:10px;color:#7b8699">${owned ? '持有 ' + owned : ''}</span></span>
          <span style="font-size:11px;color:#f0c24b">${s.price} 金</span></div>
        <div class="cd">${s.desc}</div>
        <div style="margin-top:6px"><button class="btn sm" data-buy="${s.id}" ${p.gold < s.price ? 'disabled' : ''}>购买</button></div>
      </div>`;
    }).join('');

    const sellable = bagTop(p, 40).map(it => `<div class="card">
        <div class="ct"><span style="color:${D.QUALITY[it.q].color}">${I.fullName(it)}</span>
          <span style="font-size:10.5px;color:#f0c24b">${Math.round(it.price * (1 + it.enh * 0.3))} 金</span></div>
        <div class="cd">${D.QUALITY[it.q].name} · iLv.${it.ilvl}</div>
        <div style="margin-top:5px"><button class="btn sm ghost" data-sell="${it.uid}">出售</button></div>
      </div>`).join('') + moreNote(p.bag.length, 40) || '<div style="font-size:11.5px;color:#4d5769">没有可出售的物品</div>';

    return head('杂 货 商 阿 福', `金币 ${p.gold}`) + `<div class="p-body">
      <div class="p-cols">
        <div><div class="stat-block"><h3>出 售</h3><div class="list">${list}</div></div></div>
        <div><div class="stat-block"><h3>收 购</h3><div class="list">${sellable}</div></div></div>
      </div>
    </div>`;
  }

  /* ================= 铁匠 ================= */
  function panelSmith() {
    const p = G.player;
    const tab = UI.smithTab;
    const tabs = `<div class="tabs">
      <button data-tab="enh" class="${tab === 'enh' ? 'on' : ''}">强化</button>
      <button data-tab="break" class="${tab === 'break' ? 'on' : ''}">分解</button>
      <button data-tab="gem" class="${tab === 'gem' ? 'on' : ''}">镶嵌</button>
    </div>`;

    let body = '';
    if (tab === 'enh') {
      const items = [];
      for (const k in p.equip) if (p.equip[k]) items.push({ it: p.equip[k], eq: true });
      for (const it of bagTop(p, 40)) items.push({ it, eq: false });
      body = items.length ? `<div class="list">${items.map(({ it, eq }) => {
        const cost = D.ENHANCE.cost(it.enh + 1);
        const rate = Math.round(D.ENHANCE.rate(it.enh + 1) * 100);
        const max = it.enh >= D.ENHANCE.max;
        return `<div class="card">
          <div class="ct"><span style="color:${D.QUALITY[it.q].color}">${I.fullName(it)} ${eq ? '<span style="font-size:9px;color:#5fd18d">已装备</span>' : ''}</span>
            <span style="font-size:10.5px;color:#8b95a8">+${it.enh} / ${D.ENHANCE.max}</span></div>
          <div class="cd">${max ? '已达强化上限' : `消耗 ${cost.gold} 金 + 强化石 ×${cost.stone}　成功率 ${rate}%　失败不掉级`}</div>
          <div style="margin-top:6px">${max ? '' : `<button class="btn sm" data-enh="${it.uid}">强化 +${it.enh + 1}</button>`}</div>
        </div>`;
      }).join('')}</div>${moreNote(p.bag.length, 40)}` : '<div style="font-size:11.5px;color:#4d5769">没有可强化的装备</div>';
    } else if (tab === 'break') {
      body = p.bag.length ? `<div class="list">${bagTop(p, 40).map(it => `<div class="card">
        <div class="ct"><span style="color:${D.QUALITY[it.q].color}">${I.fullName(it)}</span>
          <span style="font-size:10px;color:#8b95a8">${D.QUALITY[it.q].name} iLv.${it.ilvl}</span></div>
        <div style="margin-top:5px"><button class="btn sm ghost" data-decomp="${it.uid}">分解（约 ${1 + Math.floor(it.q / 2)} 强化石）</button></div>
      </div>`).join('')}</div>${moreNote(p.bag.length, 40)}` : '<div style="font-size:11.5px;color:#4d5769">背包里没有装备</div>';
    } else {
      const withSock = [];
      for (const k in p.equip) if (p.equip[k] && p.equip[k].sockets && p.equip[k].sockets.length) withSock.push(p.equip[k]);
      for (const it of bagTop(p, 200)) if (it.sockets && it.sockets.length) withSock.push(it);
      const gems = p.gems || [];
      const sel = withSock.find(x => x.uid === UI.smithSel) || withSock[0];
      if (sel) UI.smithSel = sel.uid;
      body = `<div class="p-cols">
        <div><div class="stat-block"><h3>带凹槽的装备</h3><div class="list">
          ${withSock.length ? withSock.map(it => `<div class="card click" data-sockitem="${it.uid}" style="${sel && sel.uid === it.uid ? 'border-color:rgba(201,163,92,.5)' : ''}">
            <div class="ct"><span style="color:${D.QUALITY[it.q].color}">${I.fullName(it)}</span>
              <span style="font-size:10px;color:#69748a">${(it.sockets || []).filter(x => x).length}/${(it.sockets || []).length}</span></div>
            <div class="cd">${(it.sockets || []).map(g => g ? `<span style="color:${D.GEMS[g.gem].color}">${D.GEMS[g.gem].name} Lv.${g.lv}</span>` : '空槽').join(' / ')}</div>
          </div>`).join('') : '<div style="font-size:11.5px;color:#4d5769">没有带凹槽的装备（白银器以上才有凹槽）</div>'}
        </div></div></div>
        <div><div class="stat-block"><h3>宝石</h3><div class="list">
          ${gems.length ? gems.map((g, i) => `<div class="card">
            <div class="ct"><span style="color:${D.GEMS[g.gem].color}">${D.GEMS[g.gem].name} Lv.${g.lv}</span>
              <span style="font-size:10px;color:#8b95a8">${D.GEMS[g.gem].label(D.GEMS[g.gem].per * g.lv)}</span></div>
            <div style="margin-top:5px"><button class="btn sm" data-gem="${i}" ${sel ? '' : 'disabled'}>镶嵌到选中装备</button></div>
          </div>`).join('') : '<div style="font-size:11.5px;color:#4d5769">没有宝石。首领必掉宝石。</div>'}
        </div></div></div>
      </div>`;
    }

    return head('铁 匠 老 铁', `金币 ${p.gold} · 强化石 ×${p.stones}`) + `<div class="p-body">${tabs}${body}
      <div style="font-size:10.5px;color:#5d6878;margin-top:14px;line-height:1.7">
        · 强化每级提升装备基础属性 7%，失败只消耗材料不降级。高等级强化材料极为稀缺。
      </div>
    </div>`;
  }

  /* ================= 训练师 ================= */
  function panelTrainer() {
    const p = G.player;
    const cls = D.CLASSES[p.cls];
    const skillRows = p.skills.map(s => {
      const d = D.SKILLS[s.id];
      return `<div class="stat-row"><span>${d.name}</span><b style="font-weight:400;font-size:11px;color:${s.unlocked ? '#5fd18d' : '#7b8699'}">${s.unlocked ? '已习得' : 'Lv.' + d.lv + ' 自动习得'}</b></div>`;
    }).join('');

    const canMount = p.cls === 'knight' && p.level >= 10 && !p.mount;
    const mountRow = p.cls === 'knight'
      ? `<div class="card">
          <div class="ct"><span>战马 · 驯服</span><span style="font-size:10.5px;color:#f0c24b">1500 金</span></div>
          <div class="cd">${p.mount ? '已驯服，移动速度 +12%。' : '需 10 级。驯服后移动速度 +12%，可在坐骑上战斗。'}</div>
          <div style="margin-top:6px">${p.mount ? '' : `<button class="btn sm" data-mount ${canMount ? '' : 'disabled'}>驯服</button>`}</div>
        </div>`
      : `<div class="card"><div class="cd">${cls.name}没有坐骑天赋。骑士 10 级可在此驯服战马。</div></div>`;

    return head('训 练 师 云 老', `${cls.name} · Lv.${p.level}`) + `<div class="p-body">
      <div class="p-cols">
        <div>
          <div class="stat-block"><h3>职 业 战 技</h3>${skillRows}
            <div style="font-size:10.5px;color:#5d6878;margin-top:10px;line-height:1.7">
              职业战技随等级自动习得，无需花费。技能书掉落与自创技能将在后续版本开放。
            </div>
          </div>
        </div>
        <div>
          ${p.unlocked.dragon ? `<div class="stat-block"><h3>血 脉 觉 醒</h3>
            <div class="card" style="border-color:rgba(255,139,61,.4)">
              <div class="ct"><span style="color:#ff8b3d">龙语者</span><span style="font-size:10px;color:#7b8699">隐藏职业</span></div>
              <div class="cd">觉醒后保留等级与装备，战技替换为龙系三式，四维成长大幅提升。</div>
              <div style="margin-top:6px">${p.cls === 'dragon'
                ? '<span style="color:#5fd18d;font-size:11px">已完成觉醒</span>'
                : '<button class="btn sm" data-awaken>觉醒为龙语者</button>'}</div>
            </div>
          </div>` : ''}
          <div class="stat-block"><h3>坐 骑</h3><div class="list">${mountRow}</div></div>
          <div class="stat-block"><h3>洗 点</h3>
            <div class="card"><div class="cd">重置所有已分配的自由属性点，费用 300 金。</div>
            <div style="margin-top:6px"><button class="btn sm ghost" data-reset ${p.gold < 300 ? 'disabled' : ''}>重置属性点</button></div></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 帮助 ================= */
  function panelHelp() {
    const keys = [
      ['W A S D', '移动'], ['鼠标左键', '普通攻击（按住连续攻击）'], ['鼠标指向', '瞄准要害 / 选择目标'],
      ['空格', '翻滚闪避（短暂无敌）'], ['1 2 3', '释放三个职业战技'], ['R', '使用金疮药'],
      ['Q', '切换姿态（进攻 / 坚守 / 游击）'], ['E', '与 NPC 对话、使用界门、占领资源点'],
      ['C I K J F M U', '角色 / 背包 / 技能 / 任务 / 势力 / 地图 / 云存档'], ['Esc', '关闭面板'],
    ].map(r => `<div class="stat-row"><span style="color:#8b95a8">${r[1]}</span><b style="font-family:monospace;font-size:11px">${r[0]}</b></div>`).join('');

    return head('操 作 与 机 制', '纵横 · 单机版') + `<div class="p-body">
      <div class="p-cols">
        <div>
          <div class="stat-block"><h3>操 作</h3>${keys}</div>
          <div class="stat-block"><h3>存 档</h3>
            <div style="font-size:11.5px;color:#8b95a8;line-height:1.9">
              游戏每 25 秒自动存档，关闭页面前也会保存。存档同时存在本机与云端（登录后）。<br>
              一个账号有 3 个独立卡槽，可在云存档面板点「切换卡槽」回标题界面切换。
            </div>
            <button class="btn sm red" data-wipe style="margin-top:8px">删除当前卡槽存档</button>
          </div>
        </div>
        <div>
          <div class="stat-block"><h3>致 命 一 击</h3>
            <div style="font-size:11.5px;color:#8b95a8;line-height:1.9">
              每个怪物都有一个<span style="color:#ff9f43">红色要害</span>。把准星压在上面命中，伤害提升到 3.2 倍并造成硬直。<br>
              对同级或低 5 级以内的普通怪，要害命中直接<span style="color:#ffd166">处决</span>；精英与首领会转化为巨额伤害。<br>
              低于目标 10 级以上时，要害攻击只算普通命中。
            </div>
          </div>
          <div class="stat-block"><h3>势 力</h3>
            <div style="font-size:11.5px;color:#8b95a8;line-height:1.9">
              AI 势力会自行扩张、争夺资源点、接走悬赏。与他们示好到 10 点好感即可加入。<br>
              占领野外资源点会得罪原属势力，但能拿到金币、声望与装备。
            </div>
          </div>
          <div class="stat-block"><h3>成 长</h3>
            <div style="font-size:11.5px;color:#8b95a8;line-height:1.9">
              升级自动分配属性，每 5 级额外给 5 点自由属性。装备品质从粗糙品到神器共 13 阶，强化每级 +7%。
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 云存档 ================= */
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function panelCloud() {
    const user = C.user();
    const CN_NO = ['一', '二', '三'];
    let body = '';

    if (!C.enabled) {
      body = `<div class="stat-block"><h3>尚 未 配 置</h3>
        <div class="cloud-note">云存档的代码已经接好了，但还没有填入你的 Supabase 项目信息。填完刷新页面即可使用。</div>
        <ol class="cloud-steps">
          <li>到 <b>supabase.com</b> 新建一个项目（免费额度足够）</li>
          <li>打开 <b>SQL Editor</b>，粘贴并执行仓库里的 <code>supabase/schema.sql</code></li>
          <li>到 <b>Project Settings → API</b>，复制 <code>Project URL</code> 与 <code>anon public key</code></li>
          <li>填进 <code>js/config.js</code> 的 <code>url</code> / <code>anonKey</code>，刷新页面</li>
        </ol>
        <div class="cloud-note">部署到 GitHub Pages 后也只需要改这一处，不用重新构建。</div>
      </div>`;
    } else if (!user) {
      body = `<div class="stat-block"><h3>未 登 录</h3>
        <div class="cloud-note">账号在标题界面登录。现在你在离线模式，存档只存在这台电脑上。</div>
        <div class="cloud-actions"><button class="btn sm" data-cloud="back">返回标题界面</button></div>
      </div>`;
    } else {
      const cur = S.slot;
      const localInfo = S.slotInfo(cur);
      const remote = UI.cloudRemote;
      const remoteTxt = remote
        ? `${remote.player_name || '无名'} · Lv.${remote.level || 1} · ${fmtTime(new Date(remote.updated_at).getTime())}`
        : (UI.cloudFetching ? '读取中…' : '暂无云端存档');

      const slotRows = [1, 2, 3].map(n => {
        const l = S.slotInfo(n);
        const r = (UI.slotRemote || []).find(x => x.slot === n);
        const mine = n === cur;
        const cls = l ? D.CLASSES[l.cls] : (r && D.CLASSES[r.cls]);
        return `<div class="stat-row" style="${mine ? 'color:#f0e2c4' : ''}">
          <span>卡槽${CN_NO[n - 1]}${mine ? '（当前）' : ''}</span>
          <b style="font-weight:400;font-size:11px;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${l || r ? `${cls ? cls.name : ''} ${U.esc((l || {}).name || (r || {}).player_name || '')} Lv.${(l || {}).level || (r || {}).level || 1}`
              : '<span style="color:#4d5769">空</span>'}
          </b></div>`;
      }).join('');

      body = `<div class="cloud-user">
          <div class="cu-av">◈</div>
          <div class="cu-info">
            <div class="cu-mail">${U.esc(A.nickname())}　<span style="color:#7b8699;font-size:11px">${U.esc(A.account())}</span></div>
            <div class="cu-sub">卡槽 ${CN_NO[cur - 1]} · ${C.isAuto() ? '自动同步已开启' : '自动同步已关闭'}</div>
          </div>
          <button class="btn sm ghost" data-cloud="switch">切换卡槽</button>
        </div>
        <div class="p-cols">
          <div>
            <div class="stat-block"><h3>卡 槽 状 态</h3>${slotRows}</div>
            <div class="stat-block"><h3>本 卡 槽 对 比</h3>
              <div class="stat-row"><span>本机存档</span><b>${localInfo ? `${U.esc(localInfo.name)} · Lv.${localInfo.level}` : '无'}</b></div>
              <div class="stat-row"><span>本机时间</span><b>${localInfo ? fmtTime(localInfo.ts) : '—'}</b></div>
              <div class="stat-row"><span>云端存档</span><b>${remoteTxt}</b></div>
              <div class="stat-row"><span>上次同步</span><b>${C.lastSync() ? fmtTime(C.lastSync()) : '本次会话尚未同步'}</b></div>
            </div>
            <div class="stat-block"><h3>操 作</h3>
              <div class="cloud-actions">
                <button class="btn sm" data-cloud="push" ${C.isSyncing() ? 'disabled' : ''}>上传本卡槽</button>
                <button class="btn sm ghost" data-cloud="pull">下载到本卡槽</button>
                <button class="btn sm ghost" data-cloud="info">刷新</button>
              </div>
              <div class="cloud-actions" style="margin-top:8px">
                <button class="btn sm ghost" data-cloud="auto">自动同步：${C.isAuto() ? '开' : '关'}</button>
                <button class="btn sm red" data-cloud="del">删除本卡槽云端存档</button>
              </div>
              <div class="cloud-msg" id="cloudMsg">${UI.cloudMsg || ''}</div>
            </div>
          </div>
          <div>
            <div class="stat-block"><h3>同 步 规 则</h3>
              <div class="cloud-note" style="line-height:2">
                · 三个卡槽各自独立，互不影响。<br>
                · 开启自动同步后，每 25 秒的自动存档会顺带推到云端（5 秒内最多一次）。<br>
                · 关掉页面时会强制上传一次。<br>
                · 下载云端存档会覆盖当前卡槽，先点「上传」可反向覆盖。<br>
                · 换电脑、换浏览器只要登录同一账号就能接着玩。
              </div>
            </div>
            <div class="stat-block"><h3>账 号</h3>
              <div class="stat-row"><span>姓名</span><b>${U.esc(A.nickname())}</b></div>
              <div class="stat-row"><span>账号</span><b>${U.esc(A.account())}</b></div>
              <div class="cloud-actions" style="margin-top:8px">
                <button class="btn sm ghost" data-cloud="logout">退出登录</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    return head('云 存 档', C.enabled ? 'Supabase · 3 个独立卡槽' : '未配置 · 目前仅本地存档') +
      `<div class="p-body">${body}</div>`;
  }

  function CFG_TABLE() {
    return (window.CLOUD_CONFIG && window.CLOUD_CONFIG.table) || 'saves';
  }

  /* ================= 面板事件 ================= */
  function bindPanel(name) {
    const panel = $('panel');
    const closeBtn = panel.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', UI.close);

    const wipe = panel.querySelector('[data-wipe]');
    if (wipe) wipe.addEventListener('click', () => {
      const n = S.slot;
      if (!window.confirm(`删除卡槽 ${['一', '二', '三'][n - 1]} 的存档并回到标题界面？此操作不可撤销。`)) return;
      S.clearSlot(n);
      if (window.C && C.enabled && C.user()) C.deleteRemote(n).catch(() => {});
      location.reload();
    });

    panel.querySelectorAll('[data-slot]').forEach(el => {
      const it = G.player.equip[el.dataset.slot];
      if (it) {
        bindTip(el, () => I.tipHTML(it, G.player, { showCmp: false, footer: '点击卸下' }));
        el.addEventListener('click', () => I.unequip(el.dataset.slot));
      }
    });

    panel.querySelectorAll('[data-attr]').forEach(el => {
      el.addEventListener('click', () => S.addStat(el.dataset.attr));
    });

    if (name === 'bag') {
      const setPage = n => {
        UI.bagPage = U.clamp(n | 0, 1, I.BAG_PAGES);
        UI.open('bag');
        const body = $('panel') && $('panel').querySelector('.p-body');
        if (body) body.scrollTop = 0;
      };

      panel.querySelectorAll('[data-eqmini]').forEach(el => {
        const it = G.player.equip[el.dataset.eqmini];
        if (it) bindTip(el, () => I.tipHTML(it, G.player, { showCmp: false, footer: '当前装备 · 对比基准' }));
      });

      panel.querySelectorAll('[data-bag]').forEach(el => {
        const uid = +el.dataset.bag;
        const it = G.player.bag.find(x => x.uid === uid);
        if (!it) return;
        bindTip(el, () => I.tipHTML(it, G.player, { showCmp: true }));
        el.addEventListener('click', () => {
          const now = (window.performance && performance.now) ? performance.now() : Date.now();
          if (UI._lastBag === uid && now - (UI._lastBagT || 0) < 380) {
            UI._lastBag = null;
            if (G.player.level >= it.req) I.equip(it);
            else U.toast('等级不足，无法装备', 'bad');
            return;
          }
          UI._lastBag = uid; UI._lastBagT = now;
          UI.selBag = uid;
          UI.open('bag');
        });
        el.addEventListener('contextmenu', ev => { ev.preventDefault(); I.sell(it); });
      });

      panel.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => {
        const k = el.dataset.page;
        if (k === 'prev') setPage(UI.bagPage - 1);
        else if (k === 'next') setPage(UI.bagPage + 1);
        else if (k === 'first') setPage(1);
        else if (k === 'last') setPage(I.BAG_PAGES);
        else if (k === 'lastitem') setPage(I.lastPage(G.player));
      }));

      const pi = panel.querySelector('#bagPageInput');
      if (pi) {
        pi.addEventListener('keydown', e => {
          e.stopPropagation();
          if (e.key === 'Enter') { setPage(parseInt(pi.value, 10) || 1); pi.blur(); }
        });
        pi.addEventListener('change', () => setPage(parseInt(pi.value, 10) || 1));
        pi.addEventListener('blur', () => { pi.value = UI.bagPage; });
      }

      const onlyUp = panel.querySelector('[data-onlyup]');
      if (onlyUp) onlyUp.addEventListener('click', () => { UI.bagFilter = !UI.bagFilter; UI.open('bag'); });

      const jumpUp = panel.querySelector('[data-jumpup]');
      if (jumpUp) jumpUp.addEventListener('click', () => {
        const pl = G.player;
        const idx = pl.bag.findIndex(x => I.verdict(x, pl) > 0);
        if (idx < 0) { U.toast('背包里没有强于当前装备的物品', 'bad'); return; }
        UI.selBag = pl.bag[idx].uid;
        setPage(I.pageOf(idx));
      });

      const clean = panel.querySelector('[data-clean]');
      if (clean) clean.addEventListener('click', () => {
        const pl = G.player;
        let n = 0, st = 0;
        pl.bag = pl.bag.filter(it => {
          if (it.q <= 2) { st += 1 + Math.floor(it.q / 2); n++; return false; }
          return true;
        });
        if (!n) { U.toast('没有可分解的劣质装备（黑铁器以下）', 'bad'); return; }
        pl.stones += st;
        U.toast(`分解 ${n} 件装备，获得强化石 ×${st}`, 'good');
        U.sfx('ui');
        UI.open('bag');
      });

      const sel = G.player.bag.find(x => x.uid === UI.selBag);
      if (sel) {
        const eqBtn = panel.querySelector('[data-act="equip"]');
        if (eqBtn) eqBtn.addEventListener('click', () => I.equip(sel));
        const sellBtn = panel.querySelector('[data-act="sell"]');
        if (sellBtn) sellBtn.addEventListener('click', () => I.sell(sel));
        const dcBtn = panel.querySelector('[data-act="decomp"]');
        if (dcBtn) dcBtn.addEventListener('click', () => I.decompose(sel));
      }
    }

    if (name === 'cloud') {
      const msgEl = panel.querySelector('#cloudMsg');
      const setMsg = (t, color) => {
        UI.cloudMsg = t || '';
        if (msgEl) { msgEl.textContent = t || ''; msgEl.style.color = color || '#a9b3c5'; }
      };
      const busy = on => panel.querySelectorAll('[data-cloud]').forEach(b => { b.disabled = !!on; });

      panel.querySelectorAll('[data-cloud]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const act = btn.dataset.cloud;
          const cur = S.slot;
          try {
            if (act === 'back' || act === 'switch') {
              if (act === 'switch') {
                S.save();
                if (C.user()) { try { await C.push(undefined, { slot: cur }); } catch (e) {} }
              }
              location.reload();
              return;
            }
            if (act === 'logout') {
              if (!window.confirm('退出登录后回到标题界面，存档已保存在本机与云端。')) return;
              S.save();
              await A.logout();
              location.reload();
              return;
            }
            if (act === 'push') {
              busy(true); setMsg('上传中…');
              await C.push(undefined, { slot: cur });
              setMsg('卡槽已上传：' + fmtTime(Date.now()), '#8ff0b6');
              U.toast('本卡槽已上传到云端', 'good');
              UI.cloudRemote = null; UI.slotRemote = null;
              busy(false);
              setTimeout(() => { if (UI.currentPanel === 'cloud') UI.open('cloud'); }, 900);
            } else if (act === 'pull') {
              busy(true); setMsg('读取云端…');
              const row = await C.pull(cur);
              if (!row) { setMsg('这个卡槽云端还没有存档，先点「上传本卡槽」', '#ff9b9b'); busy(false); return; }
              const d = row.data;
              const tip = d && d.p ? `${d.p.name} · Lv.${d.p.level}` : '存档';
              if (!window.confirm(`用云端存档覆盖当前卡槽（卡槽 ${['一', '二', '三'][cur - 1]}）？\n\n云端：${tip}\n时间：${fmtTime(new Date(row.updated_at).getTime())}`)) {
                setMsg('已取消', '#7b8699'); busy(false); return;
              }
              S.applyData(Object.assign({}, d, { slot: cur }));
              UI.selBag = null; UI.bagPage = 1; UI.bagFilter = false;
              UI.buildSkillbar();
              UI.refreshHUD(true);
              U.toast('已载入云端存档', 'good');
              setMsg('已载入云端存档', '#8ff0b6');
              UI.cloudRemote = row; UI.slotRemote = null;
              setTimeout(() => { if (UI.currentPanel === 'cloud') UI.open('cloud'); }, 800);
            } else if (act === 'info') {
              UI.cloudRemote = null; UI.slotRemote = null;
              UI.open('cloud');
            } else if (act === 'auto') {
              C.setAuto(!C.isAuto());
              UI.open('cloud');
            } else if (act === 'del') {
              if (!window.confirm(`确定删除卡槽 ${['一', '二', '三'][cur - 1]} 的云端存档？本机存档不受影响。`)) return;
              busy(true); setMsg('删除中…');
              await C.deleteRemote(cur);
              UI.cloudRemote = null; UI.slotRemote = null;
              setMsg('本卡槽云端存档已删除', '#8ff0b6');
              busy(false);
              setTimeout(() => { if (UI.currentPanel === 'cloud') UI.open('cloud'); }, 900);
            }
          } catch (e) {
            setMsg(C.friendly(e), '#ff9b9b');
            busy(false);
          }
        });
      });

      // 打开面板时拉一次云端信息（slotRemote 为 null 才拉，避免面板重渲染死循环）
      if (C.enabled && C.user() && UI.slotRemote === null && !UI.cloudFetching) {
        UI.cloudFetching = true;
        Promise.all([
          C.pull(S.slot).catch(() => null),
          C.listSlots().catch(() => []),
        ]).then(([row, list]) => {
          UI.cloudRemote = row || null;
          UI.slotRemote = list || [];
        }).catch(e => { UI.cloudMsg = C.friendly(e); }).then(() => {
          UI.cloudFetching = false;
          if (UI.currentPanel === 'cloud') UI.open('cloud');
        });
      }
    }

    if (name === 'quests') {
      // 无交互
    }

    if (name === 'faction') {
      panel.querySelectorAll('[data-join]').forEach(el => el.addEventListener('click', () => W.joinFaction(el.dataset.join)));
      panel.querySelectorAll('[data-gift]').forEach(el => el.addEventListener('click', () => W.giftFaction(el.dataset.gift)));
      panel.querySelectorAll('[data-recruit]').forEach(el => el.addEventListener('click', () => W.recruit(el.dataset.recruit)));
      const lv = panel.querySelector('[data-leave]');
      if (lv) lv.addEventListener('click', () => W.leaveFaction());
    }

    if (name === 'map') {
      panel.querySelectorAll('[data-travel]').forEach(el => el.addEventListener('click', () => W.travel(el.dataset.travel)));
    }

    if (name === 'shop') {
      panel.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => buy(el.dataset.buy)));
      panel.querySelectorAll('[data-sell]').forEach(el => el.addEventListener('click', () => {
        const it = G.player.bag.find(x => x.uid === +el.dataset.sell);
        if (it) I.sell(it);
      }));
    }

    if (name === 'smith') {
      panel.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { UI.smithTab = el.dataset.tab; UI.open('smith'); }));
      panel.querySelectorAll('[data-enh]').forEach(el => el.addEventListener('click', () => {
        const uid = +el.dataset.enh;
        let it = G.player.bag.find(x => x.uid === uid);
        if (!it) for (const k in G.player.equip) if (G.player.equip[k] && G.player.equip[k].uid === uid) it = G.player.equip[k];
        if (it) I.enhance(it);
      }));
      panel.querySelectorAll('[data-decomp]').forEach(el => el.addEventListener('click', () => {
        const it = G.player.bag.find(x => x.uid === +el.dataset.decomp);
        if (it) I.decompose(it);
      }));
      panel.querySelectorAll('[data-sockitem]').forEach(el => el.addEventListener('click', () => { UI.smithSel = +el.dataset.sockitem; UI.open('smith'); }));
      panel.querySelectorAll('[data-gem]').forEach(el => el.addEventListener('click', () => {
        let sel = null;
        for (const k in G.player.equip) if (G.player.equip[k] && G.player.equip[k].uid === UI.smithSel) sel = G.player.equip[k];
        if (!sel) sel = G.player.bag.find(x => x.uid === UI.smithSel);
        if (sel) I.socketGem(sel, +el.dataset.gem);
      }));
    }

    if (name === 'trainer') {
      const m = panel.querySelector('[data-mount]');
      if (m) m.addEventListener('click', () => {
        const p = G.player;
        if (p.gold < 1500) { U.toast('金币不足', 'bad'); return; }
        p.gold -= 1500; p.mount = true;
        U.toast('你驯服了战马，移动速度 +12%', 'epic');
        U.sfx('level');
        UI.open('trainer'); UI.refreshHUD(true);
      });
      const aw = panel.querySelector('[data-awaken]');
      if (aw) aw.addEventListener('click', () => {
        const pl = G.player;
        const dc = D.CLASSES.dragon;
        pl.cls = 'dragon';
        pl.skills = dc.skills.map(id => ({ id, unlocked: pl.level >= D.SKILLS[id].lv, mastery: 0 }));
        pl.skillCd = {};
        pl.stance = 'attack';
        pl.hp = S.stats(pl).maxHp;
        pl.mp = S.stats(pl).maxMp;
        UI.buildSkillbar();
        UI.refreshHUD(true);
        U.sfx('level');
        U.toast('你觉醒了龙语者血脉', 'epic');
        U.log('龙血沸腾——你成为了龙语者。', 'good');
        UI.open('trainer');
      });

      const r = panel.querySelector('[data-reset]');
      if (r) r.addEventListener('click', () => {
        const p = G.player;
        if (p.gold < 300) { U.toast('金币不足', 'bad'); return; }
        const total = S.resetPoints();
        if (total <= 0) { U.toast('你还没有分配过自由属性点', 'bad'); return; }
        p.gold -= 300;
        U.toast(`洗点完成，返还 ${total} 点自由属性`, 'good');
        U.sfx('ui');
        UI.open('trainer');
        UI.refreshHUD(true);
      });
    }
  }

  function buy(id) {
    const s = D.SHOP.find(x => x.id === id);
    const p = G.player;
    if (!s) return;
    if (p.gold < s.price) { U.toast('金币不足', 'bad'); return; }
    p.gold -= s.price;
    if (s.type === 'potion') p.potions.potion++;
    else if (s.type === 'mana') p.potions.mana++;
    else if (s.type === 'stone') p.stones++;
    else if (s.type === 'gem') I.addGem(s.gem, s.glevel);
    U.sfx('coin');
    U.toast(`购买了 ${s.name}`, 'good');
    UI.open('shop');
    UI.refreshHUD(true);
  }

  return UI;
})();
