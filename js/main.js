/* ============ 入口 · 主循环 · 输入 ============ */
(function () {
  let last = 0, hudT = 0, started = false;
  const $ = id => document.getElementById(id);
  const CN_NO = ['一', '二', '三'];

  /* ---------- 视图切换 ---------- */
  function show(view) {
    ['viewAuth', 'viewSlots', 'viewCreate'].forEach(v => {
      const el = $(v);
      if (el) el.classList.toggle('hidden', v !== view);
    });
  }

  function gateMsg(text, ok) {
    const el = $('gateMsg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
  }
  function slotMsg(text, ok) {
    const el = $('slotMsg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
  }

  /* ---------- 登录 / 注册 ---------- */
  function bindAuth() {
    document.querySelectorAll('.gate-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        document.querySelectorAll('.gate-tab').forEach(x => x.classList.toggle('on', x === tab));
        document.querySelectorAll('.gate-pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== name));
        gateMsg('');
        setTimeout(() => {
          const inp = document.querySelector(`.gate-pane[data-pane="${name}"] input`);
          if (inp) inp.focus();
        }, 30);
      });
    });

    async function doLogin() {
      if (!A.enabled && !window.C) return;
      const acc = $('lgAccount').value, pass = $('lgPass').value;
      gateMsg('登录中…', true);
      try {
        await A.login(acc, pass);
        gateMsg('');
        show('viewSlots');
        renderSlots();
      } catch (e) {
        gateMsg(C.friendly(e));
      }
    }

    async function doRegister() {
      const acc = $('rgAccount').value, nick = $('rgName').value;
      const p1 = $('rgPass').value, p2 = $('rgPass2').value;
      gateMsg('注册中…', true);
      try {
        await A.register(acc, nick, p1, p2);
        gateMsg('');
        show('viewSlots');
        renderSlots();
        setTimeout(() => U.toast(`欢迎，${A.nickname()}`, 'epic'), 300);
      } catch (e) {
        const msg = C.friendly(e);
        if (A.profileData) {          // 账号已存在但已成功登录
          gateMsg('');
          show('viewSlots');
          renderSlots();
          slotMsg(msg, true);
        } else {
          gateMsg(msg);
        }
      }
    }

    $('btnLogin').addEventListener('click', doLogin);
    $('btnRegister').addEventListener('click', doRegister);
    $('lgPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('lgAccount').addEventListener('keydown', e => { if (e.key === 'Enter') $('lgPass').focus(); });
    $('rgPass2').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

    // 账号输入即时提示
    $('rgAccount').addEventListener('blur', async () => {
      const v = $('rgAccount').value.trim();
      if (!v) return;
      if (!A.validAccount(v)) { gateMsg('账号需 2–12 位，可用字母、数字、下划线或汉字'); return; }
      const r = await A.checkNames(v, '');
      if (r && r.account === false) gateMsg('这个账号已经有人用了');
      else gateMsg('');
    });
    $('rgName').addEventListener('blur', async () => {
      const v = $('rgName').value.trim();
      if (!v) return;
      if (!A.validNick(v)) { gateMsg('姓名需 1–12 个字符'); return; }
      const r = await A.checkNames('', v);
      if (r && r.nickname === false) gateMsg('这个姓名已经被占用');
      else gateMsg('');
    });
  }

  /* ---------- 卡槽 ---------- */
  async function renderSlots() {
    const listEl = $('slotList');
    if (!listEl) return;
    $('slotHello').textContent = A.guest
      ? '离线模式 · 本机 3 个卡槽'
      : `${A.nickname()}（${A.account()}）`;

    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#6b7688;font-size:12px;padding:22px 0">读取卡槽…</div>`;

    let remote = [];
    if (!A.guest && A.loggedIn()) {
      try { remote = await C.listSlots(); }
      catch (e) { slotMsg(C.friendly(e)); }
    }

    const cards = [];
    for (let n = 1; n <= S.SLOTS; n++) {
      const loc = S.slotInfo(n);
      const rem = (remote || []).find(r => r.slot === n) || null;
      const locTs = loc ? (loc.ts || 0) : 0;
      const remTs = rem ? new Date(rem.updated_at).getTime() : 0;
      const useLocal = loc && locTs >= remTs;
      const info = loc && useLocal ? loc : (rem ? {
        name: rem.player_name || '无名散人', cls: rem.cls, level: rem.level,
        ts: remTs, playtime: rem.playtime || 0, zone: null,
      } : null);
      const tag = loc && rem ? (useLocal ? '本机较新' : '云端较新') : (loc ? '仅本机' : (rem ? '仅云端' : ''));

      if (!info) {
        cards.push(`<div class="slot-card empty" data-new="${n}">
          <div class="slot-no">卡 槽 ${CN_NO[n - 1]}</div>
          <div class="slot-empty-tip">空 置<br><span style="font-size:10px;color:#3f4a5c">点击创建角色</span></div>
        </div>`);
        continue;
      }
      const cls = D.CLASSES[info.cls];
      cards.push(`<div class="slot-card" data-enter="${n}">
        <div class="slot-no">卡 槽 ${CN_NO[n - 1]}${tag ? ` · ${tag}` : ''}</div>
        <div class="slot-cls" style="color:${cls ? cls.color : '#c3cddd'}">${cls ? cls.name : '未知职业'}</div>
        <div class="slot-name">${U.esc(info.name)}</div>
        <div class="slot-meta">Lv.${info.level} · ${U.timeStr(info.playtime || 0)}<br>${fmtTs(info.ts)}</div>
        <div class="slot-btns">
          <button class="btn sm" data-enter-btn="${n}">进 入</button>
          <span class="slot-del" data-del="${n}">删除</span>
        </div>
      </div>`);
    }
    listEl.innerHTML = cards.join('');

    listEl.querySelectorAll('[data-new]').forEach(el => {
      el.addEventListener('click', () => openCreate(+el.dataset.new));
    });
    listEl.querySelectorAll('[data-enter-btn]').forEach(el => {
      el.addEventListener('click', ev => { ev.stopPropagation(); enterSlot(+el.dataset.enterBtn); });
    });
    listEl.querySelectorAll('[data-enter]').forEach(el => {
      el.addEventListener('click', ev => { if (!ev.target.closest('[data-del]')) enterSlot(+el.dataset.enter); });
    });
    listEl.querySelectorAll('[data-del]').forEach(el => {
      el.addEventListener('click', async ev => {
        ev.stopPropagation();
        const n = +el.dataset.del;
        if (!window.confirm(`确定删除卡槽 ${CN_NO[n - 1]} 的角色？本地与云端的存档都会被清除。`)) return;
        S.clearSlot(n);
        if (!A.guest && A.loggedIn()) { try { await C.deleteRemote(n); } catch (e) { slotMsg(C.friendly(e)); } }
        slotMsg('已删除', true);
        renderSlots();
      });
    });
  }

  function fmtTs(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  async function enterSlot(n) {
    slotMsg('');
    S.setSlot(n);
    let ok = S.loadSlot(n);
    if (!ok && !A.guest && A.loggedIn()) {
      try {
        const row = await C.pull(n);
        if (row && row.data) {
          ok = S.applyData(Object.assign({}, row.data, { slot: n }));
          if (ok) U.toast('已从云端载入该卡槽', 'good');
        }
      } catch (e) { slotMsg(C.friendly(e)); }
    }
    if (!ok) { slotMsg('这个卡槽还没有存档'); return; }
    beginGame();
  }

  /* ---------- 建角色 ---------- */
  let selCls = 'knight';
  let createSlot = 1;

  function buildClassPick() {
    const pick = $('clsPick');
    const keys = ['knight', 'assassin', 'archer', 'dragon'];
    const dragonOK = S.dragonUnlocked();
    pick.innerHTML = keys.map(k => {
      const c = D.CLASSES[k];
      const locked = !!c.hidden && !dragonOK;
      return `<div class="cls-card ${k === selCls && !locked ? 'on' : ''} ${locked ? 'locked' : ''}" data-cls="${k}"
        style="${locked ? 'opacity:.72' : ''}">
        ${c.hidden ? `<span class="hidden-tag">${locked ? '隐藏' : '已解锁'}</span>` : ''}
        <div class="cn" style="color:${c.color}">${c.name}</div>
        <div class="cr">${c.tag}</div>
        <div class="cd">${c.blurb}</div>
        <div class="cs">
          <span>力量 <b>${c.stars.str}★</b></span>
          <span>体力 <b>${c.stars.vit}★</b></span>
          <span>敏捷 <b>${c.stars.agi}★</b></span>
          <span>智力 <b>${c.stars.int}★</b></span>
        </div>
      </div>`;
    }).join('');

    pick.querySelectorAll('[data-cls]').forEach(el => {
      el.addEventListener('click', () => {
        const k = el.dataset.cls;
        if (D.CLASSES[k].hidden && !S.dragonUnlocked()) {
          U.toast('龙语者为隐藏职业：20 级 + 声望 120 + 击败黑石矿主后解锁', 'bad');
          return;
        }
        selCls = k;
        pick.querySelectorAll('.cls-card').forEach(c => c.classList.remove('on'));
        el.classList.add('on');
        U.sfx('ui');
      });
    });
  }

  function openCreate(n) {
    createSlot = n;
    S.setSlot(n);
    $('createTitle').textContent = `新建角色 · 卡 槽 ${CN_NO[n - 1]}`;
    $('charName').value = A.nickname() === '旅人' ? '' : A.nickname();
    selCls = 'knight';
    buildClassPick();
    slotMsg('');
    show('viewCreate');
  }

  function bindSlots() {
    document.querySelectorAll('#viewSlots [data-act="logout"]').forEach(el => {
      el.addEventListener('click', async () => {
        if (!window.confirm('退出登录？存档已保存在本机与云端。')) return;
        await A.logout();
        $('lgPass').value = '';
        gateMsg('');
        show('viewAuth');
      });
    });
    document.querySelectorAll('#viewCreate [data-act="back"]').forEach(el => {
      el.addEventListener('click', () => { show('viewSlots'); renderSlots(); });
    });

    $('btnStart').addEventListener('click', () => {
      if (started) return;
      let name = ($('charName').value || '').trim();
      if (!name) name = A.nickname() === '旅人' ? '无名散人' : A.nickname();
      name = name.slice(0, 8);
      S.newGame(selCls, name, createSlot);
      beginGame();
    });
  }

  /* ---------- 进入游戏 ---------- */
  function fadeOutStart() {
    const snd = $('start');
    if (snd) {
      snd.style.transition = 'opacity .4s';
      snd.style.opacity = '0';
      setTimeout(() => snd.remove(), 420);
    }
    $('hud').classList.remove('hidden');
  }

  function beginGame() {
    if (started) return;
    started = true;
    fadeOutStart();
    UI.buildSkillbar();
    UI.refreshHUD(true);

    // 把已经发生过的频道发言铺回 HUD
    if (window.AI && AI.st && AI.st()) {
      const s = AI.st();
      s.chat.slice().reverse().forEach(m => UI.chatPush(m));
      const pop = AI.populationView();
      U.log(`全服 ${pop.total} 名玩家，此刻在线 ${pop.online} 人。`, 'hot');
      if (s.awaySummary) setTimeout(() => U.log(s.awaySummary + '。', 'good'), 2200);
    }

    G.running = true;
    U.log(`你进入了《灵恸》。这里是落霞城，安全区。（卡槽 ${CN_NO[S.slot - 1]}）`, 'hot');
    setTimeout(() => {
      U.toast('按住左键攻击，瞄准怪物的<span style="color:#ff9f43">红色要害</span>可触发致命一击', 'epic');
    }, 700);
    setTimeout(() => {
      U.toast('按 <b>E</b> 与 NPC 交谈，<b>M</b> 打开地图前往林区', 'good');
    }, 3600);
  }

  /* ---------- 输入 ---------- */
  function initInput() {
    const cv = document.getElementById('game');

    window.addEventListener('keydown', e => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      G.keys[k] = true;

      if (e.key === 'Escape') {
        if (UI.currentPanel) UI.close();
        return;
      }
      if (!G.running) return;

      // F1：AI 生态调试面板
      if (e.key === 'F1') {
        e.preventDefault();
        UI.worldTab = 'eco';
        UI.open('world');
        return;
      }

      // 面板快捷键
      const map = { c: 'char', i: 'bag', k: 'skills', j: 'quests', f: 'faction', m: 'map', h: 'help', u: 'cloud', t: 'world', p: 'ranks' };
      if (map[k] && !e.repeat) {
        e.preventDefault();
        UI.toggle(map[k]);
        return;
      }
      if (G.paused) return;

      if (k === ' ' || e.code === 'Space') { e.preventDefault(); dash(); }
      else if (k === '1') E.castSkill(0);
      else if (k === '2') E.castSkill(1);
      else if (k === '3') E.castSkill(2);
      else if (k === 'q') E.cycleStance();
      else if (k === 'e') W.interact();
      else if (k === 'r') E.usePotion();
    });

    window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { G.keys = {}; G.mouse.down = false; });

    cv.addEventListener('mousemove', e => {
      G.mouse.x = e.clientX;
      G.mouse.y = e.clientY;
      G.mouse.wx = e.clientX / R.ZOOM + G.cam.x;
      G.mouse.wy = e.clientY / R.ZOOM + G.cam.y;
    });
    cv.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      G.mouse.down = true;
      G.mouse.x = e.clientX; G.mouse.y = e.clientY;
      G.mouse.wx = e.clientX / R.ZOOM + G.cam.x; G.mouse.wy = e.clientY / R.ZOOM + G.cam.y;
    });
    window.addEventListener('mouseup', () => { G.mouse.down = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => e.preventDefault(), { passive: false });

    // HUD 按钮
    document.querySelectorAll('#hud [data-panel]').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); UI.toggle(btn.dataset.panel); });
    });

    // 关闭面板背景
    document.getElementById('panelWrap').addEventListener('mousedown', e => {
      if (e.target.id === 'panelWrap') UI.close();
    });

    window.addEventListener('beforeunload', () => { if (G.player) S.save(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { G.mouse.down = false; G.keys = {}; if (G.player) S.save(); }
    });
  }

  function dash() {
    const p = G.player;
    if (!p || p.dead || p.dashCd > 0) return;
    let dx = 0, dy = 0;
    if (G.keys['w'] || G.keys['arrowup']) dy -= 1;
    if (G.keys['s'] || G.keys['arrowdown']) dy += 1;
    if (G.keys['a'] || G.keys['arrowleft']) dx -= 1;
    if (G.keys['d'] || G.keys['arrowright']) dx += 1;
    const len = Math.hypot(dx, dy);
    p.dashDir = len > 0 ? Math.atan2(dy, dx) : p.facing;
    p.dashT = 0.17;
    p.dashCd = 1.4;
    p.invuln = Math.max(p.invuln, 0.3);
    U.sfx('ui');
    E.fx('p', { x: p.x, y: p.y, vx: 0, vy: 0, color: '#cfe2ff', life: 0.3, max: 0.3, r: 14 });
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    const p = G.player;
    if (!p) return;
    G.t += dt;

    E.updatePlayer(dt);
    E.updateEnemies(dt);
    E.updateAllies(dt);
    E.updateProjectiles(dt);
    E.updateFx(dt);
    W.spawnTick(dt);
    W.factionTick(dt);
    W.bountyTick(dt);
    W.updateCapture(dt);
    W.zoneTick(dt);
    W.updateNear();
    if (window.AI) AI.tick(dt);

    G.saveT += dt;
    if (G.saveT > 25) { G.saveT = 0; S.save(); }
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    dt = Math.min(0.05, dt);

    if (G.running && !G.paused) {
      update(dt);
    } else if (G.running) {
      E.updateFx(dt * 0.35);
    }
    R.draw(dt);

    hudT += dt;
    if (hudT > 0.1) { hudT = 0; if (G.running) UI.refreshHUD(); }
  }

  /* ---------- 启动 ---------- */
  window.addEventListener('DOMContentLoaded', async () => {
    R.init();
    initInput();
    requestAnimationFrame(frame);
    G.zone = D.ZONES.town;

    bindAuth();
    bindSlots();
    S.migrateLegacy();

    // 调试 / 自动化：index.html#dev=knight&slot=1
    const hash = (location.hash || '').replace('#', '');
    if (hash.indexOf('dev=') === 0) {
      const q = new URLSearchParams(hash.replace(/^dev=/, 'c='));
      const cls = q.get('c') || 'knight';
      const slot = +(q.get('slot') || 1);
      S.newGame(D.CLASSES[cls] ? cls : 'knight', '测试者', slot);
      beginGame();
      return;
    }

    try { await A.restore(); } catch (e) { /* 网络异常时按未登录处理 */ }

    if (A.needsAuth()) {
      show('viewAuth');
      setTimeout(() => $('lgAccount').focus(), 200);
    } else {
      show('viewSlots');
      renderSlots();
    }
  });
})();
