/* ============ 云存档 · Supabase ============
 * 不依赖任何 SDK：直接用 Supabase 的 Auth / REST 接口（fetch）。
 * 账号体系：邮箱 + 密码（Supabase Auth）
 * 存档表  ：saves(user_id pk, data jsonb, player_name, level, updated_at)
 *          建表与 RLS 策略见 supabase/schema.sql
 */
window.C = (function () {
  const C = {};
  const CFG = window.CLOUD_CONFIG || {};
  // 容错：用户可能把 /rest/v1/ 甚至 /rest/v1/saves 一起粘进来，统一剥掉
  const URL_BASE = String(CFG.url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1(\/[^/]*)?$/i, '');
  const ANON = String(CFG.anonKey || '').trim();
  const TABLE = CFG.table || 'saves';
  const SES_KEY = 'zh_cloud_session_v1';
  const AUTO_KEY = 'zh_cloud_auto';

  C.enabled = /^https?:\/\/.+/i.test(URL_BASE) && ANON.length > 30;
  C.url = URL_BASE;

  let session = null;
  let autoSync = true;
  let lastSyncTs = 0;
  let lastSlot = 0;
  let pushTimer = null;
  let syncing = false;
  const listeners = [];

  try { autoSync = localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { /* ignore */ }

  /* ---------- 事件 ---------- */
  C.onChange = function (fn) { listeners.push(fn); };
  C.emit = function () { listeners.forEach(f => { try { f(); } catch (e) {} }); };

  /* ---------- 会话 ---------- */
  function toSession(j) {
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000,
      user: { id: (j.user && j.user.id) || '', email: (j.user && j.user.email) || '' },
    };
  }

  function readSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SES_KEY) || 'null');
      return s && s.access_token ? s : null;
    } catch (e) { return null; }
  }

  function writeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SES_KEY, JSON.stringify(s));
      else localStorage.removeItem(SES_KEY);
    } catch (e) { /* ignore */ }
    C.emit();
  }

  function api(path, opt) {
    const o = opt || {};
    const headers = { apikey: ANON };
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (o.token) headers.Authorization = 'Bearer ' + o.token;
    if (o.headers) Object.assign(headers, o.headers);
    return fetch(URL_BASE + path, {
      method: o.method || 'GET',
      headers,
      keepalive: !!o.keepalive,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }).then(res => res.text().then(text => {
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text }; }
      if (!res.ok) {
        const msg = (json && (json.msg || json.message || json.error_description || json.error || json.hint))
          || ('HTTP ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.body = json;
        throw err;
      }
      return json;
    }));
  }

  async function refreshToken() {
    const s = session || readSession();
    if (!s || !s.refresh_token) throw new Error('登录状态已失效，请重新登录');
    const j = await api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: s.refresh_token },
    });
    const ns = toSession(j);
    writeSession(ns);
    return ns;
  }

  async function token() {
    if (!C.enabled) throw new Error('尚未配置 Supabase');
    let s = session || readSession();
    if (!s) throw new Error('尚未登录');
    if (s.expires_at && s.expires_at - 60000 < Date.now()) s = await refreshToken();
    else session = s;
    return s;
  }

  /* ---------- 账号 ---------- */
  C.signUp = async function (email, pass) {
    if (!C.enabled) throw new Error('尚未配置 Supabase');
    if (!email || !pass) throw new Error('请填写邮箱与密码');
    if (pass.length < 6) throw new Error('密码至少 6 位');
    const j = await api('/auth/v1/signup', { method: 'POST', body: { email, password: pass } });
    if (j && j.access_token) {
      writeSession(toSession(j));
      return { needConfirm: false };
    }
    return { needConfirm: true };
  };

  C.signIn = async function (email, pass) {
    if (!C.enabled) throw new Error('尚未配置 Supabase');
    if (!email || !pass) throw new Error('请填写邮箱与密码');
    const j = await api('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password: pass },
    });
    writeSession(toSession(j));
    return true;
  };

  C.signOut = async function () {
    const s = session || readSession();
    writeSession(null);
    lastSyncTs = 0;
    if (s && s.access_token) {
      try { await api('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch (e) { /* ignore */ }
    }
    C.emit();
  };

  C.restore = async function () {
    const s = readSession();
    if (!s) return false;
    session = s;
    C.emit();
    try {
      if (s.expires_at && s.expires_at - 60000 < Date.now()) await refreshToken();
      return true;
    } catch (e) {
      writeSession(null);
      return false;
    }
  };

  /* ---------- 存档（按卡槽） ---------- */
  function slotOf(o) {
    const s = (o && o.slot) || (window.S && S.slot) || 1;
    return Math.min(3, Math.max(1, s | 0));
  }

  C.push = async function (data, opts) {
    const o = opts || {};
    const slot = slotOf(o);
    const s = await token();
    const d = data || (window.S && S.serialize());
    if (!d) throw new Error('没有可上传的存档');
    syncing = true;
    C.emit();
    try {
      await api('/rest/v1/' + TABLE + '?on_conflict=user_id,slot', {
        method: 'POST',
        token: s.access_token,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        keepalive: !!o.keepalive,
        body: {
          user_id: s.user.id,
          slot: slot,
          data: d,
          player_name: (d.p && d.p.name) || '',
          level: (d.p && d.p.level) || 1,
          cls: (d.p && d.p.cls) || null,
          playtime: Math.round(d.t || 0),
          updated_at: new Date().toISOString(),
        },
      });
      lastSyncTs = Date.now();
      lastSlot = slot;
      return true;
    } finally {
      syncing = false;
      C.emit();
    }
  };

  C.pull = async function (slot) {
    const s = await token();
    const n = Math.min(3, Math.max(1, (slot || (window.S && S.slot) || 1) | 0));
    const rows = await api('/rest/v1/' + TABLE
      + '?user_id=eq.' + encodeURIComponent(s.user.id)
      + '&slot=eq.' + n
      + '&select=data,updated_at,player_name,level,cls,playtime,slot&limit=1', { token: s.access_token });
    if (!rows || !rows.length) return null;
    return rows[0];
  };

  /** 三个卡槽的摘要（不含 data，很轻） */
  C.listSlots = async function () {
    const s = await token();
    const rows = await api('/rest/v1/' + TABLE
      + '?user_id=eq.' + encodeURIComponent(s.user.id)
      + '&select=slot,player_name,level,cls,playtime,updated_at&order=slot.asc', { token: s.access_token });
    return Array.isArray(rows) ? rows : [];
  };

  C.deleteRemote = async function (slot) {
    const s = await token();
    const n = Math.min(3, Math.max(1, (slot || (window.S && S.slot) || 1) | 0));
    await api('/rest/v1/' + TABLE
      + '?user_id=eq.' + encodeURIComponent(s.user.id) + '&slot=eq.' + n, {
      method: 'DELETE', token: s.access_token,
    });
  };

  /* 本地存档变化后自动上云（节流，不阻塞游戏） */
  C.autoPush = function (data, slot) {
    if (!C.enabled || !autoSync) return;
    if (!(session || readSession())) return;
    if (syncing) return;
    if (Date.now() - lastSyncTs < 5000) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (!(session || readSession())) return;
      C.push(data, { slot: slot }).catch(() => { /* 网络问题静默失败，下次再传 */ });
    }, 4000);
  };

  C.flush = function (slot) {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    if (!C.enabled || !autoSync || !(session || readSession())) return;
    // 关页面时用 keepalive 请求，尽量把最后一次存档送出去
    C.push(undefined, { keepalive: true, slot: slot || lastSlot }).catch(() => {});
  };

  C.setAuto = function (v) {
    autoSync = !!v;
    try { localStorage.setItem(AUTO_KEY, autoSync ? '1' : '0'); } catch (e) {}
    C.emit();
  };

  C.isAuto = () => autoSync;
  C.user = () => {
    const s = session || readSession();
    return s ? s.user : null;
  };
  C.isSyncing = () => syncing;
  C.lastSync = () => lastSyncTs;

  /* ---------- 低层接口（账号模块使用） ---------- */
  C.req = (path, opt) => api(path, opt);
  C.getToken = () => token();
  C.rpc = async function (name, args, opts) {
    const o = opts || {};
    const s = o.anon ? null : await token();
    return api('/rest/v1/rpc/' + name, {
      method: 'POST',
      token: s ? s.access_token : null,
      body: args || {},
    });
  };

  C.friendly = function (err) {
    const m = String((err && err.message) || err || '未知错误');
    if (/Invalid login credentials/i.test(m)) return '账号或密码错误';
    if (/Email not confirmed/i.test(m)) return '账号尚未验证：请在 Supabase 关闭 Confirm email';
    if (/User already registered|already been registered|already registered/i.test(m)) return '该账号已被注册，换一个';
    if (/Password should be at least/i.test(m)) return '密码太短（至少 6 位）';
    if (/relation .* does not exist/i.test(m)) return '数据表不存在：请先在 Supabase 执行 supabase/schema.sql';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '无法连接 Supabase：请检查网络、URL 与 anon key';
    if (/permission denied|row-level security/i.test(m)) return '权限被拒绝：请确认已执行 schema.sql 中的 RLS 策略';
    if (/ACCOUNT_TAKEN/i.test(m)) return '该账号已被注册，换一个';
    if (/NICK_TAKEN/i.test(m)) return '该姓名已被占用，换一个';
    if (/BAD_ACCOUNT/i.test(m)) return '账号格式不对：2–12 个字符，不能有空格';
    if (/BAD_NICK/i.test(m)) return '姓名需 1–12 个字符';
    if (/NOT_LOGGED_IN/i.test(m)) return '登录状态已失效，请重新登录';
    if (/function .* does not exist|Could not find the function|PGRST202/i.test(m)) return '数据库结构未更新：请重新执行 supabase/schema.sql';
    if (/JWT|token/i.test(m)) return '登录凭据已过期，请重新登录';
    return m;
  };

  window.addEventListener('beforeunload', () => { C.flush(); });

  return C;
})();
