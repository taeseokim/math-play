// Supabase 연결 정보
// - URL과 publishable(anon) 키는 브라우저에 공개되도록 설계된 값입니다.
// - 데이터 보호는 supabase/schema.sql 의 RLS(행 수준 보안) 정책이 담당합니다.
// - 두 값을 비워 두면 점수는 이 기기(localStorage)에만 저장됩니다.
export const SUPABASE_URL = 'https://weymnysnewhkmonbpipx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_XjRGLvP0ACp7n0ic8n-7cg_RgMUXAdD';
