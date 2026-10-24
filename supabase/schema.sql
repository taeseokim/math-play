-- 숫자 놀이터: 점수 테이블
-- 개인정보를 받지 않도록 별명(최대 10자)과 캐릭터 이모지만 저장합니다.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text not null check (char_length(btrim(nickname)) between 1 and 10),
  avatar      text check (avatar is null or char_length(avatar) <= 4),
  game        text not null check (game in ('count', 'calc', 'compare', 'pattern')),
  level       text not null check (level in ('k', 'low', 'mid')),
  score       smallint not null check (score between 0 and 10),
  total       smallint not null default 10 check (total = 10),
  created_at  timestamptz not null default now()
);

create index if not exists scores_board_idx
  on public.scores (game, level, score desc, created_at);

-- 행 수준 보안: 누구나 읽기·기록 추가만 가능, 수정·삭제는 불가
alter table public.scores enable row level security;

drop policy if exists "scores are readable by everyone" on public.scores;
create policy "scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can add a score" on public.scores;
create policy "anyone can add a score"
  on public.scores for insert
  to anon, authenticated
  with check (created_at > now() - interval '1 minute');

-- 기록 시간은 서버가 정하도록 클라이언트 값을 덮어씀
create or replace function public.scores_set_created_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end $$;

drop trigger if exists scores_set_created_at on public.scores;
create trigger scores_set_created_at
  before insert on public.scores
  for each row execute function public.scores_set_created_at();
