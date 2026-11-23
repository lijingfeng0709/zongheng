/* ============ 账号体系 ============
 * 玩家用「账号 + 密码」登录，账号与姓名都全局唯一。
 * Supabase Auth 只接受邮箱，所以把账号编码成内部邮箱：
 *   admin  ->  uYWRtaW4@zh-player.app
 * 玩家永远看不到这个地址，也不需要是真实邮箱。
 */
window.A = (function () {
  const A = {};
  const CFG = window.CLOUD_CONFIG || {};
  const DOMAIN = String(CFG.loginDomain || 'zh-player.app');
  const PROFILES = 'profiles';

  A.profileData = null;      // { account, nickname }
  A.guest = false;           // 未配置云服务时的离线模式

  /* ---------- 工具 ---------- */
  // 纯 JS 的 UTF-8 → base64url，不依赖 btoa / Buffer，任何环境结果都一致
  const B64CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function toB64(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {   // 代理对
        const d = str.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
      }
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
      out += B64CH[b1 >> 2];
      out += B64CH[((b1 & 3) << 4) | ((b2 || 0) >> 4)];
      if (b2 === undefined) break;
      out += B64CH[((b2 & 15) << 2) | ((b3 || 0) >> 6)];
      if (b3 === undefined) break;
      out += B64CH[b3 & 63];
    }
    return out;
  }

  /** 账号 → 内部登录邮箱（大小写不敏感） */
  A.emailOf = function (account) {
    return 'u' + toB64(String(account || '').trim().toLowerCase()) + '@' + DOMAIN;
  };

  A.validAccount = function (s) {
    return /^[\u4e00-\u9fa5A-Za-z0-9_]{2,12}$/.test(String(s || '').trim());
  };
  A.validNick = function (s) {
    const v = String(s || '').trim();
    return v.length >= 1 && v.length <= 12;
  };

  /* ---------- 状态 ---------- */
  A.user = () => (window.C ? C.user() : null);
  A.uid = () => {
    const u = A.user();
    return u ? u.id : 'guest';
  };
  A.loggedIn = () => !!A.user();
  A.needsAuth = () => !!(window.C && C.enabled) && !A.loggedIn();
  A.account = () => (A.profileData && A.profileData.account) || '';
  A.nickname = () => (A.profileData && A.profileData.nickname) || '旅人';

  /* ---------- 档案 ---------- */
  async function fetchProfile() {
    const u = A.user();
    if (!u) return null;
    const s = await C.getToken();
    const rows = await C.req('/rest/v1/' + PROFILES
      + '?select=account,nickname&id=eq.' + encodeURIComponent(u.id) + '&limit=1',
      { token: s.access_token });
    if (!Array.isArray(rows) || !rows.length) return null;
    return { account: rows[0].account, nickname: rows[0].nickname };
  }

  async function createProfile(account, nickname) {
    const r = await C.rpc('zh_create_profile', { p_account: account, p_nickname: nickname });
    return { account: (r && r.account) || account, nickname: (r && r.nickname) || nickname };
  }

  /** 注册前预检（仅用于界面提示，不参与判定） */
  A.checkNames = async function (account, nickname) {
    try {
      return await C.rpc('zh_check_names',
        { p_account: String(account || '').trim(), p_nickname: String(nickname || '').trim() },
        { anon: true });
    } catch (e) { return null; }
  };

  /* ---------- 注册 ---------- */
  A.register = async function (account, nickname, pass, pass2) {
    if (!C.enabled) throw new Error('云服务未配置，无法注册');
    account = String(account || '').trim();
    nickname = String(nickname || '').trim();

    if (!A.validAccount(account)) throw new Error('账号需 2–12 位，可用字母、数字、下划线或汉字，不能有空格');
    if (!A.validNick(nickname)) throw new Error('姓名需 1–12 个字符');
    if (!pass || pass.length < 6) throw new Error('密码至少 6 位');
    if (pass2 !== undefined && pass !== pass2) throw new Error('两次输入的密码不一致');

    const email = A.emailOf(account);
    let isNew = false;

    try {
      const r = await C.signUp(email, pass);
      if (r.needConfirm) {
        await C.signOut().catch(() => {});
        throw new Error('注册成功但需要邮箱验证：请在 Supabase 关闭 Confirm email 后重试');
      }
      isNew = true;
    } catch (e) {
      const msg = String((e && e.message) || '');
      if (!/already registered|already been registered|User already registered/i.test(msg)) throw e;

      // 账号已存在：可能是自己之前注册留下的空档案，也可能真是别人的
      try {
        await C.signIn(email, pass);
      } catch (e2) {
        throw new Error('该账号已被注册，换一个');
      }
      const old = await fetchProfile().catch(() => null);
      if (old) {
        A.profileData = old;
        throw new Error('该账号已存在，已为你直接登录');
      }
    }

    // 建档案（账号 / 姓名唯一性在这里由数据库把关）
    try {
      A.profileData = await createProfile(account, nickname);
    } catch (e) {
      const msg = String((e && e.message) || '');
      if (/ACCOUNT_TAKEN|NICK_TAKEN|TAKEN/.test(msg)) {
        // 档案没建成，但 auth 用户已产生：保留会话，让玩家改个名字重试即可
        A.profileData = null;
        if (/ACCOUNT_TAKEN/.test(msg)) {
          await C.signOut().catch(() => {});
          throw new Error('该账号已被注册，换一个');
        }
        throw new Error('该姓名已被占用，换一个');
      }
      throw e;
    }
    return A.profileData;
  };

  /* ---------- 登录 ---------- */
  A.login = async function (account, pass) {
    if (!C.enabled) throw new Error('云服务未配置，无法登录');
    account = String(account || '').trim();
    if (!A.validAccount(account)) throw new Error('账号格式不对');
    if (!pass) throw new Error('请输入密码');

    await C.signIn(A.emailOf(account), pass);

    let prof = await fetchProfile().catch(() => null);
    if (!prof) {
      // 老账号（早期版本只存了邮箱，没有档案）：用账号名补一份
      try { prof = await createProfile(account, account); } catch (e) { prof = { account, nickname: account }; }
    }
    A.profileData = prof;
    return prof;
  };

  A.logout = async function () {
    A.profileData = null;
    if (window.C) await C.signOut().catch(() => {});
  };

  /** 开局时恢复上次登录 */
  A.restore = async function () {
    if (!window.C || !C.enabled) {
      A.guest = true;
      return null;
    }
    A.guest = false;
    const ok = await C.restore().catch(() => false);
    if (!ok) return null;
    A.profileData = await fetchProfile().catch(() => null);
    return A.profileData;
  };

  return A;
})();
