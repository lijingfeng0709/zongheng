/* ============ 云存档配置 ============
 * 在 Supabase 控制台 → Project Settings → API 里复制两项填到下面：
 *   url     : Project URL       形如 https://abcdefghijkl.supabase.co
 *   anonKey : anon public key   形如 eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *
 * 留空则游戏完全离线运行（只用浏览器本地存档），不会报错。
 * anon key 是公开密钥，可以写进前端；真正的数据安全由 supabase/schema.sql
 * 里的行级安全策略（RLS）保证——每个账号只能读写自己的存档。
 */
window.CLOUD_CONFIG = {
  // 只填到域名，不要带 /rest/v1/ —— 路径由 cloud.js 自己拼
  url: 'https://fyzlyprvlcwquxlzpbfe.supabase.co',
  anonKey: 'sb_publishable_iheTaVzjntTC61WgJx0U5Q_0Wpp_GTK',
  table: 'saves',
  // 玩家用「账号」登录，Supabase Auth 需要邮箱格式，
  // 这里把账号编码后拼一个内部域名，玩家看不到也不需要是真实邮箱。
  loginDomain: 'zh-player.app',
};
